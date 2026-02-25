// Background Fetch Service for Hostaway Message History
// Uses expo-task-manager and expo-background-fetch for reliable background execution

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { getCredentials } from './secure-storage';
import { getAccessToken } from './hostaway';

// Task name for background fetch
export const BACKGROUND_FETCH_TASK = 'HOSTAWAY_HISTORY_SYNC_TASK';

// Storage keys for background sync state
const BG_SYNC_STATE_KEY = 'background_sync_state';
const BG_SYNC_PROGRESS_KEY = 'background_sync_progress';
const BG_SYNC_NOTIFICATION_ID_KEY = 'background_sync_notification_id';

// Configuration for background fetch
const HOSTAWAY_API_BASE = 'https://api.hostaway.com/v1';

const CONFIG = {
  conversationsPerBatch: 50, // Smaller batches for background
  messagesPerBatch: 50,
  delayBetweenRequests: 1500,
  delayBetweenBatches: 3000,
  maxRetries: 3,
  initialRetryDelay: 3000,
  maxRetryDelay: 30000,
  requestTimeout: 20000,
  // Background fetch is typically given ~30 seconds, so we process in small chunks
  maxProcessingTimeMs: 25000,
};

// Background sync state persisted to storage
export interface BackgroundSyncState {
  isEnabled: boolean;
  isRunning: boolean;
  phase: 'idle' | 'conversations' | 'messages' | 'analyzing' | 'complete' | 'error';

  // Progress tracking
  totalConversations: number;
  processedConversations: number;
  totalMessages: number;
  processedMessages: number;
  currentConversationIndex: number;

  // Resumability
  lastConversationOffset: number;
  processedConversationIds: number[];
  conversationIds: number[]; // All conversation IDs to process

  // Settings
  dateRangeMonths: number;

  // Timing
  startTime: number | null;
  lastRunTime: number | null;

  // Error tracking
  errorCount: number;
  lastError: string | null;
}

export interface BackgroundSyncProgress {
  phase: BackgroundSyncState['phase'];
  percentage: number;
  processedConversations: number;
  totalConversations: number;
  processedMessages: number;
  totalMessages: number;
  isRunning: boolean;
  lastRunTime: number | null;
  errorCount: number;
}

// Initialize default state
const getDefaultState = (): BackgroundSyncState => ({
  isEnabled: false,
  isRunning: false,
  phase: 'idle',
  totalConversations: 0,
  processedConversations: 0,
  totalMessages: 0,
  processedMessages: 0,
  currentConversationIndex: 0,
  lastConversationOffset: 0,
  processedConversationIds: [],
  conversationIds: [],
  dateRangeMonths: 24,
  startTime: null,
  lastRunTime: null,
  errorCount: 0,
  lastError: null,
});

// Singleton to manage background sync state in memory
class BackgroundSyncManager {
  private state: BackgroundSyncState = getDefaultState();
  private progressListeners: ((progress: BackgroundSyncProgress) => void)[] = [];
  private dataCallback: ((conversations: unknown[], messages: Record<number, unknown[]>) => void) | null = null;
  private completionCallback: ((stats: { conversations: number; messages: number }) => void) | null = null;

  // Fetched data storage
  private fetchedConversations: unknown[] = [];
  private fetchedMessages: Record<number, unknown[]> = {};

  // Load state from storage
  async loadState(): Promise<BackgroundSyncState> {
    try {
      const savedState = await AsyncStorage.getItem(BG_SYNC_STATE_KEY);
      if (savedState) {
        this.state = { ...getDefaultState(), ...JSON.parse(savedState) };
      }
    } catch (error) {
      console.error('[BackgroundSync] Failed to load state:', error);
    }
    return this.state;
  }

  // Save state to storage
  async saveState(): Promise<void> {
    try {
      await AsyncStorage.setItem(BG_SYNC_STATE_KEY, JSON.stringify(this.state));
    } catch (error) {
      console.error('[BackgroundSync] Failed to save state:', error);
    }
  }

  // Clear state and start fresh
  async clearState(): Promise<void> {
    this.state = getDefaultState();
    this.fetchedConversations = [];
    this.fetchedMessages = {};
    await AsyncStorage.removeItem(BG_SYNC_STATE_KEY);
    await this.dismissProgressNotification();
  }

  // Get current state
  getState(): BackgroundSyncState {
    return { ...this.state };
  }

  // Get progress for UI
  getProgress(): BackgroundSyncProgress {
    const totalWork = this.state.totalConversations + this.state.totalMessages;
    const completedWork = this.state.processedConversations + this.state.processedMessages;
    const percentage = totalWork > 0 ? Math.round((completedWork / totalWork) * 100) : 0;

    return {
      phase: this.state.phase,
      percentage,
      processedConversations: this.state.processedConversations,
      totalConversations: this.state.totalConversations,
      processedMessages: this.state.processedMessages,
      totalMessages: this.state.totalMessages,
      isRunning: this.state.isRunning,
      lastRunTime: this.state.lastRunTime,
      errorCount: this.state.errorCount,
    };
  }

  // Check if can resume
  canResume(): boolean {
    return (
      this.state.isEnabled &&
      this.state.phase !== 'idle' &&
      this.state.phase !== 'complete' &&
      this.state.conversationIds.length > 0
    );
  }

  // Register progress listener
  onProgress(callback: (progress: BackgroundSyncProgress) => void): () => void {
    this.progressListeners.push(callback);
    return () => {
      this.progressListeners = this.progressListeners.filter((cb) => cb !== callback);
    };
  }

  // Register data callback
  onData(callback: (conversations: unknown[], messages: Record<number, unknown[]>) => void): void {
    this.dataCallback = callback;
  }

  // Register completion callback
  onComplete(callback: (stats: { conversations: number; messages: number }) => void): void {
    this.completionCallback = callback;
  }

  // Notify listeners of progress change
  private notifyProgress(): void {
    const progress = this.getProgress();
    this.progressListeners.forEach((cb) => cb(progress));
  }

  // Enable background sync and start initial fetch
  async enable(options: { dateRangeMonths?: number; startImmediately?: boolean } = {}): Promise<boolean> {
    const credentials = await getCredentials();
    if (!credentials?.accountId || !credentials?.apiKey) {
      console.error('[BackgroundSync] No credentials available');
      return false;
    }

    this.state.isEnabled = true;
    this.state.dateRangeMonths = options.dateRangeMonths ?? 24;
    await this.saveState();

    // Register background fetch task
    await this.registerBackgroundTask();

    if (options.startImmediately) {
      // Start the sync process immediately in foreground
      this.runSyncChunk().catch(console.error);
    }

    return true;
  }

  // Disable background sync
  async disable(): Promise<void> {
    this.state.isEnabled = false;
    this.state.isRunning = false;
    await this.saveState();
    await this.unregisterBackgroundTask();
    await this.dismissProgressNotification();
  }

  // Register background fetch task with the system
  private async registerBackgroundTask(): Promise<void> {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
      if (!isRegistered) {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
          minimumInterval: 15 * 60, // 15 minutes minimum on iOS
          stopOnTerminate: false, // Android: continue after app closes
          startOnBoot: true, // Android: start after reboot
        });
        console.log('[BackgroundSync] Background fetch task registered');
      }
    } catch (error) {
      console.error('[BackgroundSync] Failed to register background task:', error);
    }
  }

  // Unregister background fetch task
  private async unregisterBackgroundTask(): Promise<void> {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
      if (isRegistered) {
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
        console.log('[BackgroundSync] Background fetch task unregistered');
      }
    } catch (error) {
      console.error('[BackgroundSync] Failed to unregister background task:', error);
    }
  }

  // Show progress notification
  async showProgressNotification(progress: BackgroundSyncProgress): Promise<void> {
    try {
      // Dismiss existing notification first
      await this.dismissProgressNotification();

      const body =
        progress.phase === 'conversations'
          ? `Fetching conversations... ${progress.processedConversations}/${progress.totalConversations}`
          : progress.phase === 'messages'
            ? `Fetching messages... ${progress.percentage}%`
            : progress.phase === 'analyzing'
              ? 'Analyzing communication patterns...'
              : progress.phase === 'complete'
                ? `Complete! Analyzed ${progress.processedMessages} messages`
                : 'Syncing in background...';

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'AI Learning Sync',
          body,
          data: { type: 'background_sync_progress' },
          // Android: show as ongoing notification
          sticky: progress.phase !== 'complete',
        },
        trigger: null, // Immediate
      });

      await AsyncStorage.setItem(BG_SYNC_NOTIFICATION_ID_KEY, notificationId);
    } catch (error) {
      console.error('[BackgroundSync] Failed to show notification:', error);
    }
  }

  // Dismiss progress notification
  async dismissProgressNotification(): Promise<void> {
    try {
      const notificationId = await AsyncStorage.getItem(BG_SYNC_NOTIFICATION_ID_KEY);
      if (notificationId) {
        await Notifications.dismissNotificationAsync(notificationId);
        await AsyncStorage.removeItem(BG_SYNC_NOTIFICATION_ID_KEY);
      }
    } catch (error) {
      // Ignore errors dismissing notification
    }
  }

  // Main sync logic - runs in chunks for background execution
  async runSyncChunk(): Promise<BackgroundFetch.BackgroundFetchResult> {
    if (!this.state.isEnabled) {
      console.log('[BackgroundSync] Sync not enabled');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const credentials = await getCredentials();
    if (!credentials?.accountId || !credentials?.apiKey) {
      console.log('[BackgroundSync] No credentials');
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    this.state.isRunning = true;
    this.state.lastRunTime = Date.now();
    await this.saveState();
    this.notifyProgress();

    const startTime = Date.now();
    let hasNewData = false;

    try {
      // Phase 1: Fetch conversation list if needed
      if (this.state.phase === 'idle' || this.state.phase === 'conversations') {
        this.state.phase = 'conversations';
        this.state.startTime = this.state.startTime || Date.now();
        await this.saveState();

        hasNewData = await this.fetchConversationChunk(credentials.accountId, credentials.apiKey, startTime);

        // Check if we're done with conversations
        if (
          this.state.conversationIds.length > 0 &&
          this.state.lastConversationOffset >= this.state.totalConversations
        ) {
          this.state.phase = 'messages';
          await this.saveState();
        }
      }

      // Phase 2: Fetch messages for conversations
      if (this.state.phase === 'messages' && Date.now() - startTime < CONFIG.maxProcessingTimeMs) {
        hasNewData = (await this.fetchMessagesChunk(credentials.accountId, credentials.apiKey, startTime)) || hasNewData;

        // Check if we're done with messages
        if (this.state.currentConversationIndex >= this.state.conversationIds.length) {
          this.state.phase = 'analyzing';
          await this.saveState();
        }
      }

      // Phase 3: Complete
      if (this.state.phase === 'analyzing') {
        this.state.phase = 'complete';
        this.state.isEnabled = false;
        await this.saveState();

        // Emit completion
        if (this.dataCallback) {
          this.dataCallback(this.fetchedConversations, this.fetchedMessages);
        }
        if (this.completionCallback) {
          this.completionCallback({
            conversations: this.fetchedConversations.length,
            messages: this.state.processedMessages,
          });
        }

        // Show completion notification
        await this.showProgressNotification(this.getProgress());

        // Unregister task since we're done
        await this.unregisterBackgroundTask();

        console.log('[BackgroundSync] Sync complete!');
        return BackgroundFetch.BackgroundFetchResult.NewData;
      }

      // Update notification
      await this.showProgressNotification(this.getProgress());

    } catch (error) {
      console.error('[BackgroundSync] Error during sync chunk:', error);
      this.state.errorCount++;
      this.state.lastError = error instanceof Error ? error.message : 'Unknown error';
      await this.saveState();

      return BackgroundFetch.BackgroundFetchResult.Failed;
    } finally {
      this.state.isRunning = false;
      await this.saveState();
      this.notifyProgress();
    }

    return hasNewData ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
  }

  // Fetch a chunk of conversations
  private async fetchConversationChunk(
    accountId: string,
    apiKey: string,
    startTime: number
  ): Promise<boolean> {
    let hasNewData = false;
    const token = await getAccessToken(accountId, apiKey);

    while (Date.now() - startTime < CONFIG.maxProcessingTimeMs) {
      const offset = this.state.lastConversationOffset;

      try {
        const response = await this.fetchWithTimeout(
          `${HOSTAWAY_API_BASE}/conversations?limit=${CONFIG.conversationsPerBatch}&offset=${offset}&includeResources=1`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const conversations = data.result || [];

        // Filter by date range
        const filteredConversations = this.filterByDateRange(conversations);
        const newIds = filteredConversations.map((c: { id: number }) => c.id);

        this.state.conversationIds.push(...newIds);
        this.fetchedConversations.push(...filteredConversations);
        this.state.processedConversations = this.state.conversationIds.length;
        this.state.lastConversationOffset = offset + CONFIG.conversationsPerBatch;

        // Update total estimate
        if (conversations.length === CONFIG.conversationsPerBatch) {
          this.state.totalConversations = Math.max(
            this.state.totalConversations,
            this.state.processedConversations + CONFIG.conversationsPerBatch
          );
        } else {
          this.state.totalConversations = this.state.processedConversations;
        }

        // Estimate total messages
        this.state.totalMessages = this.state.conversationIds.length * 10;

        hasNewData = filteredConversations.length > 0;
        await this.saveState();
        this.notifyProgress();

        // Check if we've fetched all conversations
        if (conversations.length < CONFIG.conversationsPerBatch) {
          break;
        }

        // Delay between requests
        await this.delay(CONFIG.delayBetweenRequests);

      } catch (error) {
        console.error('[BackgroundSync] Error fetching conversations:', error);
        this.state.errorCount++;
        this.state.lastError = error instanceof Error ? error.message : 'Unknown error';
        await this.saveState();
        break;
      }
    }

    return hasNewData;
  }

  // Fetch a chunk of messages
  private async fetchMessagesChunk(
    accountId: string,
    apiKey: string,
    startTime: number
  ): Promise<boolean> {
    let hasNewData = false;
    const token = await getAccessToken(accountId, apiKey);

    while (
      Date.now() - startTime < CONFIG.maxProcessingTimeMs &&
      this.state.currentConversationIndex < this.state.conversationIds.length
    ) {
      const conversationId = this.state.conversationIds[this.state.currentConversationIndex];

      // Skip if already processed
      if (this.state.processedConversationIds.includes(conversationId)) {
        this.state.currentConversationIndex++;
        continue;
      }

      try {
        const messages = await this.fetchConversationMessages(token, conversationId);
        this.fetchedMessages[conversationId] = messages;
        this.state.processedMessages += messages.length;
        this.state.processedConversationIds.push(conversationId);
        this.state.currentConversationIndex++;

        hasNewData = messages.length > 0;
        await this.saveState();
        this.notifyProgress();

        // Delay between conversations
        await this.delay(CONFIG.delayBetweenRequests);

      } catch (error) {
        console.error(`[BackgroundSync] Error fetching messages for ${conversationId}:`, error);
        this.state.errorCount++;
        // Mark as processed to skip on retry
        this.state.processedConversationIds.push(conversationId);
        this.state.currentConversationIndex++;
        this.fetchedMessages[conversationId] = [];
        await this.saveState();
      }
    }

    return hasNewData;
  }

  // Fetch all messages for a single conversation
  private async fetchConversationMessages(token: string, conversationId: number): Promise<unknown[]> {
    const allMessages: unknown[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.fetchWithTimeout(
        `${HOSTAWAY_API_BASE}/conversations/${conversationId}/messages?limit=${CONFIG.messagesPerBatch}&offset=${offset}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return allMessages; // Conversation doesn't exist
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const messages = data.result || [];
      allMessages.push(...messages);

      hasMore = messages.length === CONFIG.messagesPerBatch;
      offset += CONFIG.messagesPerBatch;

      if (hasMore) {
        await this.delay(500);
      }
    }

    return allMessages;
  }

  // Filter conversations by date range
  private filterByDateRange(
    conversations: { id: number; lastMessageSentAt?: string; arrivalDate?: string }[]
  ): { id: number; lastMessageSentAt?: string; arrivalDate?: string }[] {
    if (!this.state.dateRangeMonths) {
      return conversations;
    }

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - this.state.dateRangeMonths);

    return conversations.filter((conv) => {
      const lastMessageDate = conv.lastMessageSentAt ? new Date(conv.lastMessageSentAt) : null;
      const arrivalDate = conv.arrivalDate ? new Date(conv.arrivalDate) : null;
      const date = lastMessageDate || arrivalDate;
      return date ? date >= cutoffDate : true;
    });
  }

  // Fetch with timeout
  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.requestTimeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Delay helper
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Manual trigger for foreground resume
  async resumeInForeground(): Promise<void> {
    if (!this.canResume()) {
      console.log('[BackgroundSync] Nothing to resume');
      return;
    }

    console.log('[BackgroundSync] Resuming in foreground');
    while (this.state.phase !== 'complete' && this.state.phase !== 'error' && this.state.isEnabled) {
      await this.runSyncChunk();

      // Check app state - stop if backgrounded
      if (AppState.currentState !== 'active') {
        console.log('[BackgroundSync] App backgrounded, stopping foreground sync');
        break;
      }
    }
  }

  // Check background fetch status
  async getBackgroundFetchStatus(): Promise<BackgroundFetch.BackgroundFetchStatus | null> {
    return await BackgroundFetch.getStatusAsync();
  }
}

// Export singleton instance
export const backgroundSyncManager = new BackgroundSyncManager();

// Define the background fetch task
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  console.log('[BackgroundSync] Background fetch task executing');

  // Load state and run a sync chunk
  await backgroundSyncManager.loadState();
  const result = await backgroundSyncManager.runSyncChunk();

  console.log('[BackgroundSync] Background fetch task completed with result:', result);
  return result;
});

// Initialize the manager on import
backgroundSyncManager.loadState().catch(console.error);

// Helper to check if background fetch is available
export async function isBackgroundFetchAvailable(): Promise<{
  available: boolean;
  status: BackgroundFetch.BackgroundFetchStatus | null;
  statusText: string;
}> {
  const status = await BackgroundFetch.getStatusAsync();

  let statusText: string;
  let available: boolean;

  switch (status) {
    case BackgroundFetch.BackgroundFetchStatus.Available:
      statusText = 'Available';
      available = true;
      break;
    case BackgroundFetch.BackgroundFetchStatus.Restricted:
      statusText = 'Restricted - Low Power Mode or system limitations';
      available = false;
      break;
    case BackgroundFetch.BackgroundFetchStatus.Denied:
      statusText = 'Denied - Background App Refresh is disabled';
      available = false;
      break;
    default:
      statusText = 'Unknown';
      available = false;
  }

  return { available, status, statusText };
}

// Helper to format sync status for UI
export function formatBackgroundSyncStatus(state: BackgroundSyncState): string {
  if (!state.isEnabled) {
    return 'Not enabled';
  }

  switch (state.phase) {
    case 'idle':
      return 'Waiting to start...';
    case 'conversations':
      return `Fetching conversations (${state.processedConversations}/${state.totalConversations || '?'})`;
    case 'messages':
      return `Fetching messages (${state.processedMessages} fetched)`;
    case 'analyzing':
      return 'Analyzing patterns...';
    case 'complete':
      return `Complete - ${state.processedMessages} messages analyzed`;
    case 'error':
      return `Error: ${state.lastError || 'Unknown error'}`;
    default:
      return 'Unknown state';
  }
}
