// Background History Sync Service
// Handles large dataset fetching with rate limiting, resumability, and progress tracking

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccessToken } from './hostaway';

const HOSTAWAY_API_BASE = 'https://api.hostaway.com/v1';
const SYNC_STATE_KEY = 'hostaway_sync_state';

// Sync configuration
const CONFIG = {
  conversationsPerBatch: 100,
  messagesPerBatch: 100,
  delayBetweenRequests: 2000, // 2 seconds
  delayBetweenBatches: 5000, // 5 seconds
  maxRetries: 5,
  initialRetryDelay: 5000, // 5 seconds
  maxRetryDelay: 60000, // 60 seconds
  requestTimeout: 30000, // 30 seconds
};

// Types
export interface SyncState {
  isRunning: boolean;
  isPaused: boolean;
  phase: 'idle' | 'conversations' | 'messages' | 'analyzing' | 'complete' | 'error';

  // Progress tracking
  totalConversations: number;
  processedConversations: number;
  totalMessages: number;
  processedMessages: number;
  currentConversationIndex: number;

  // Resumability
  lastConversationOffset: number;
  lastConversationId: number | null;
  processedConversationIds: number[];

  // Timing
  startTime: number | null;
  estimatedTimeRemaining: number | null;

  // Settings
  dateRangeMonths: number | null; // null = all time

  // Error handling
  errorLog: SyncError[];
  lastError: string | null;
  retryCount: number;
}

export interface SyncError {
  timestamp: number;
  phase: string;
  message: string;
  conversationId?: number;
  retryable: boolean;
}

export interface SyncProgress {
  phase: SyncState['phase'];
  percentage: number;
  processedConversations: number;
  totalConversations: number;
  processedMessages: number;
  totalMessages: number;
  estimatedTimeRemaining: number | null;
  currentBatch: number;
  totalBatches: number;
  errorCount: number;
  lastError: string | null;
}

export interface HostawayConversation {
  id: number;
  listingMapId: number;
  reservationId?: number;
  guestName?: string;
  channelName?: string;
  arrivalDate?: string;
  departureDate?: string;
  isArchived?: boolean;
  lastMessageSentAt?: string;
}

export interface HostawayMessage {
  id: number;
  conversationId: number;
  body: string;
  isIncoming: boolean;
  status: string;
  insertedOn: string;
  sentOn?: string;
  senderName?: string;
}

interface FetchResult<T> {
  data: T | null;
  error: string | null;
  rateLimited: boolean;
  retryAfter?: number;
}

// Callbacks for sync events
type ProgressCallback = (progress: SyncProgress) => void;
type DataCallback = (conversations: HostawayConversation[], messages: Record<number, HostawayMessage[]>) => void;
type ErrorCallback = (error: SyncError) => void;
type CompleteCallback = (stats: { conversations: number; messages: number }) => void;

// Singleton sync manager
class HistorySyncManager {
  private state: SyncState;
  private abortController: AbortController | null = null;
  private progressCallback: ProgressCallback | null = null;
  private dataCallback: DataCallback | null = null;
  private errorCallback: ErrorCallback | null = null;
  private completeCallback: CompleteCallback | null = null;
  private accountId: string = '';
  private apiKey: string = '';

  // Fetched data storage
  private fetchedConversations: HostawayConversation[] = [];
  private fetchedMessages: Record<number, HostawayMessage[]> = {};

  constructor() {
    this.state = this.getInitialState();
  }

  private getInitialState(): SyncState {
    return {
      isRunning: false,
      isPaused: false,
      phase: 'idle',
      totalConversations: 0,
      processedConversations: 0,
      totalMessages: 0,
      processedMessages: 0,
      currentConversationIndex: 0,
      lastConversationOffset: 0,
      lastConversationId: null,
      processedConversationIds: [],
      startTime: null,
      estimatedTimeRemaining: null,
      dateRangeMonths: 24,
      errorLog: [],
      lastError: null,
      retryCount: 0,
    };
  }

  // Load saved state from storage
  async loadState(): Promise<void> {
    try {
      const savedState = await AsyncStorage.getItem(SYNC_STATE_KEY);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        // Merge with initial state to ensure all fields exist
        this.state = { ...this.getInitialState(), ...parsed, isRunning: false, isPaused: false };
      }
    } catch (error) {
      console.error('[HistorySync] Failed to load state:', error);
    }
  }

  // Save state to storage for resumability
  async saveState(): Promise<void> {
    try {
      await AsyncStorage.setItem(SYNC_STATE_KEY, JSON.stringify(this.state));
    } catch (error) {
      console.error('[HistorySync] Failed to save state:', error);
    }
  }

  // Clear saved state
  async clearState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SYNC_STATE_KEY);
      this.state = this.getInitialState();
      this.fetchedConversations = [];
      this.fetchedMessages = {};
    } catch (error) {
      console.error('[HistorySync] Failed to clear state:', error);
    }
  }

  // Set callbacks
  onProgress(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  onData(callback: DataCallback): void {
    this.dataCallback = callback;
  }

  onError(callback: ErrorCallback): void {
    this.errorCallback = callback;
  }

  onComplete(callback: CompleteCallback): void {
    this.completeCallback = callback;
  }

  // Get current progress
  getProgress(): SyncProgress {
    const totalWork = this.state.totalConversations + this.state.totalMessages;
    const completedWork = this.state.processedConversations + this.state.processedMessages;
    const percentage = totalWork > 0 ? Math.round((completedWork / totalWork) * 100) : 0;

    const totalBatches = Math.ceil(this.state.totalConversations / CONFIG.conversationsPerBatch);
    const currentBatch = Math.ceil((this.state.currentConversationIndex + 1) / CONFIG.conversationsPerBatch);

    return {
      phase: this.state.phase,
      percentage,
      processedConversations: this.state.processedConversations,
      totalConversations: this.state.totalConversations,
      processedMessages: this.state.processedMessages,
      totalMessages: this.state.totalMessages,
      estimatedTimeRemaining: this.state.estimatedTimeRemaining,
      currentBatch,
      totalBatches,
      errorCount: this.state.errorLog.length,
      lastError: this.state.lastError,
    };
  }

  // Check if can resume from previous state
  canResume(): boolean {
    return this.state.processedConversationIds.length > 0 &&
           this.state.phase !== 'complete' &&
           this.state.phase !== 'idle';
  }

  // Get current state
  getState(): SyncState {
    return { ...this.state };
  }

  // Start or resume sync
  async start(
    accountId: string,
    apiKey: string,
    options?: { dateRangeMonths?: number; resume?: boolean }
  ): Promise<void> {
    if (this.state.isRunning) {
      console.log('[HistorySync] Already running');
      return;
    }

    this.accountId = accountId;
    this.apiKey = apiKey;
    this.abortController = new AbortController();

    // Check if resuming or starting fresh
    if (options?.resume && this.canResume()) {
      console.log('[HistorySync] Resuming from saved state');
      this.state.isRunning = true;
      this.state.isPaused = false;
    } else {
      console.log('[HistorySync] Starting fresh sync');
      this.state = this.getInitialState();
      this.state.isRunning = true;
      this.state.startTime = Date.now();
      this.state.dateRangeMonths = options?.dateRangeMonths ?? 24;
      this.fetchedConversations = [];
      this.fetchedMessages = {};
    }

    await this.saveState();
    this.emitProgress();

    try {
      await this.runSync();
    } catch (error) {
      if (error instanceof Error && error.message === 'SYNC_CANCELLED') {
        console.log('[HistorySync] Sync cancelled');
      } else {
        console.error('[HistorySync] Sync error:', error);
        this.addError('sync', error instanceof Error ? error.message : 'Unknown error', undefined, false);
      }
    } finally {
      if (this.state.phase !== 'complete') {
        this.state.isRunning = false;
        await this.saveState();
        this.emitProgress();
      }
    }
  }

  // Pause sync
  pause(): void {
    if (this.state.isRunning && !this.state.isPaused) {
      console.log('[HistorySync] Pausing sync');
      this.state.isPaused = true;
      this.emitProgress();
    }
  }

  // Resume from pause
  resume(): void {
    if (this.state.isPaused) {
      console.log('[HistorySync] Resuming sync');
      this.state.isPaused = false;
      this.emitProgress();
    }
  }

  // Cancel sync
  cancel(): void {
    console.log('[HistorySync] Cancelling sync');
    this.abortController?.abort();
    this.state.isRunning = false;
    this.state.isPaused = false;
    this.state.phase = 'idle';
    this.emitProgress();
  }

  // Main sync logic
  private async runSync(): Promise<void> {
    // Phase 1: Fetch all conversations
    if (this.state.phase === 'idle' || this.state.phase === 'conversations') {
      this.state.phase = 'conversations';
      await this.fetchAllConversations();
    }

    // Phase 2: Fetch messages for each conversation
    if (this.state.phase === 'conversations' || this.state.phase === 'messages') {
      this.state.phase = 'messages';
      await this.fetchAllMessages();
    }

    // Phase 3: Complete
    this.state.phase = 'complete';
    this.state.isRunning = false;
    await this.saveState();
    this.emitProgress();

    // Emit data and completion
    if (this.dataCallback) {
      this.dataCallback(this.fetchedConversations, this.fetchedMessages);
    }
    if (this.completeCallback) {
      this.completeCallback({
        conversations: this.fetchedConversations.length,
        messages: this.state.processedMessages,
      });
    }
  }

  // Fetch all conversations with pagination
  private async fetchAllConversations(): Promise<void> {
    console.log('[HistorySync] Fetching conversations...');
    let offset = this.state.lastConversationOffset;
    let hasMore = true;
    let firstFetch = true;

    while (hasMore) {
      await this.checkPauseAndCancel();

      const result = await this.fetchWithRetry<HostawayConversation[]>(
        `${HOSTAWAY_API_BASE}/conversations?limit=${CONFIG.conversationsPerBatch}&offset=${offset}&includeResources=1`
      );

      if (result.error) {
        this.addError('conversations', result.error, undefined, result.rateLimited);
        throw new Error(result.error);
      }

      const conversations = result.data || [];

      // Filter by date range if specified
      const filteredConversations = this.filterByDateRange(conversations);

      this.fetchedConversations.push(...filteredConversations);

      // Update state
      if (firstFetch) {
        // Estimate total from first batch
        this.state.totalConversations = conversations.length < CONFIG.conversationsPerBatch
          ? this.fetchedConversations.length
          : Math.max(this.fetchedConversations.length * 2, 100);
        firstFetch = false;
      }

      this.state.lastConversationOffset = offset + CONFIG.conversationsPerBatch;
      this.state.processedConversations = this.fetchedConversations.length;

      // Update total estimate as we fetch more
      if (conversations.length === CONFIG.conversationsPerBatch) {
        this.state.totalConversations = Math.max(
          this.state.totalConversations,
          this.fetchedConversations.length + CONFIG.conversationsPerBatch
        );
      } else {
        this.state.totalConversations = this.fetchedConversations.length;
      }

      await this.saveState();
      this.emitProgress();
      this.updateTimeEstimate();

      hasMore = conversations.length === CONFIG.conversationsPerBatch;
      offset += CONFIG.conversationsPerBatch;

      if (hasMore) {
        await this.delay(CONFIG.delayBetweenRequests);
      }
    }

    console.log(`[HistorySync] Fetched ${this.fetchedConversations.length} conversations`);

    // Estimate total messages (average 10 messages per conversation)
    this.state.totalMessages = this.fetchedConversations.length * 10;
    await this.saveState();
    this.emitProgress();
  }

  // Fetch messages for all conversations
  private async fetchAllMessages(): Promise<void> {
    console.log('[HistorySync] Fetching messages...');

    const startIndex = this.state.currentConversationIndex;

    for (let i = startIndex; i < this.fetchedConversations.length; i++) {
      await this.checkPauseAndCancel();

      const conv = this.fetchedConversations[i];

      // Skip if already processed
      if (this.state.processedConversationIds.includes(conv.id)) {
        continue;
      }

      this.state.currentConversationIndex = i;
      this.state.lastConversationId = conv.id;

      try {
        const messages = await this.fetchConversationMessages(conv.id);
        this.fetchedMessages[conv.id] = messages;
        this.state.processedMessages += messages.length;
        this.state.totalMessages = Math.max(this.state.totalMessages, this.state.processedMessages);
        this.state.processedConversationIds.push(conv.id);
      } catch (error) {
        console.error(`[HistorySync] Failed to fetch messages for ${conv.id}:`, error);
        // Continue with other conversations
        this.fetchedMessages[conv.id] = [];
        this.state.processedConversationIds.push(conv.id);
      }

      await this.saveState();
      this.emitProgress();
      this.updateTimeEstimate();

      // Delay between conversations
      if (i < this.fetchedConversations.length - 1) {
        // Longer delay every batch
        const isBatchEnd = (i + 1) % 50 === 0;
        await this.delay(isBatchEnd ? CONFIG.delayBetweenBatches : CONFIG.delayBetweenRequests);
      }
    }

    console.log(`[HistorySync] Fetched ${this.state.processedMessages} messages`);
  }

  // Fetch messages for a single conversation with pagination
  private async fetchConversationMessages(conversationId: number): Promise<HostawayMessage[]> {
    const allMessages: HostawayMessage[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      await this.checkPauseAndCancel();

      const result = await this.fetchWithRetry<HostawayMessage[]>(
        `${HOSTAWAY_API_BASE}/conversations/${conversationId}/messages?limit=${CONFIG.messagesPerBatch}&offset=${offset}&includeScheduledMessages=1`
      );

      if (result.error) {
        if (result.error.includes('404')) {
          // Conversation doesn't exist anymore
          return allMessages;
        }
        throw new Error(result.error);
      }

      const messages = result.data || [];
      allMessages.push(...messages);

      hasMore = messages.length === CONFIG.messagesPerBatch;
      offset += CONFIG.messagesPerBatch;

      if (hasMore) {
        await this.delay(500); // Short delay between message pages
      }
    }

    return allMessages;
  }

  // Fetch with exponential backoff retry
  private async fetchWithRetry<T>(url: string): Promise<FetchResult<T>> {
    let retryDelay = CONFIG.initialRetryDelay;

    for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
      try {
        const token = await getAccessToken(this.accountId, this.apiKey);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.requestTimeout);

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
          // Rate limited
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10) * 1000;
          console.warn(`[HistorySync] Rate limited, waiting ${retryAfter}ms`);

          if (attempt < CONFIG.maxRetries) {
            await this.delay(Math.max(retryDelay, retryAfter));
            retryDelay = Math.min(retryDelay * 2, CONFIG.maxRetryDelay);
            continue;
          }

          return { data: null, error: 'Rate limit exceeded', rateLimited: true, retryAfter };
        }

        if (!response.ok) {
          const error = await response.text();

          if (attempt < CONFIG.maxRetries && response.status >= 500) {
            // Server error, retry
            await this.delay(retryDelay);
            retryDelay = Math.min(retryDelay * 2, CONFIG.maxRetryDelay);
            continue;
          }

          return { data: null, error: `HTTP ${response.status}: ${error}`, rateLimited: false };
        }

        const data = await response.json();
        return { data: data.result || data, error: null, rateLimited: false };

      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          if (attempt < CONFIG.maxRetries) {
            console.warn(`[HistorySync] Request timeout, retrying...`);
            await this.delay(retryDelay);
            retryDelay = Math.min(retryDelay * 2, CONFIG.maxRetryDelay);
            continue;
          }
          return { data: null, error: 'Request timeout', rateLimited: false };
        }

        if (attempt < CONFIG.maxRetries) {
          await this.delay(retryDelay);
          retryDelay = Math.min(retryDelay * 2, CONFIG.maxRetryDelay);
          continue;
        }

        return { data: null, error: error instanceof Error ? error.message : 'Unknown error', rateLimited: false };
      }
    }

    return { data: null, error: 'Max retries exceeded', rateLimited: false };
  }

  // Filter conversations by date range
  private filterByDateRange(conversations: HostawayConversation[]): HostawayConversation[] {
    if (!this.state.dateRangeMonths) {
      return conversations;
    }

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - this.state.dateRangeMonths);

    return conversations.filter(conv => {
      const lastMessageDate = conv.lastMessageSentAt ? new Date(conv.lastMessageSentAt) : null;
      const arrivalDate = conv.arrivalDate ? new Date(conv.arrivalDate) : null;

      // Include if has recent message or recent arrival
      const date = lastMessageDate || arrivalDate;
      return date ? date >= cutoffDate : true;
    });
  }

  // Check for pause/cancel
  private async checkPauseAndCancel(): Promise<void> {
    if (this.abortController?.signal.aborted) {
      throw new Error('SYNC_CANCELLED');
    }

    while (this.state.isPaused) {
      await this.delay(500);
      if (this.abortController?.signal.aborted) {
        throw new Error('SYNC_CANCELLED');
      }
    }
  }

  // Update time estimate
  private updateTimeEstimate(): void {
    if (!this.state.startTime) return;

    const elapsed = Date.now() - this.state.startTime;
    const totalWork = this.state.totalConversations + this.state.totalMessages;
    const completedWork = this.state.processedConversations + this.state.processedMessages;

    if (completedWork > 0 && totalWork > completedWork) {
      const rate = completedWork / elapsed;
      const remaining = totalWork - completedWork;
      this.state.estimatedTimeRemaining = Math.round(remaining / rate);
    }
  }

  // Add error to log
  private addError(phase: string, message: string, conversationId?: number, retryable: boolean = true): void {
    const error: SyncError = {
      timestamp: Date.now(),
      phase,
      message,
      conversationId,
      retryable,
    };

    this.state.errorLog.push(error);
    this.state.lastError = message;

    // Keep only last 50 errors
    if (this.state.errorLog.length > 50) {
      this.state.errorLog = this.state.errorLog.slice(-50);
    }

    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }

  // Emit progress update
  private emitProgress(): void {
    if (this.progressCallback) {
      this.progressCallback(this.getProgress());
    }
  }

  // Delay helper
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const historySyncManager = new HistorySyncManager();

// Helper function to format time remaining
export function formatTimeRemaining(ms: number | null): string {
  if (!ms || ms <= 0) return 'Calculating...';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `~${hours}h ${minutes % 60}m remaining`;
  } else if (minutes > 0) {
    return `~${minutes}m ${seconds % 60}s remaining`;
  } else {
    return `~${seconds}s remaining`;
  }
}
