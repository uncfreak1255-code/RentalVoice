// AI Training Service
// Handles ultra-safe batch processing of large message histories (25,000+ messages)
// with smart sampling, historical response matching, and auto-training

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HostStyleProfile, LearningEntry, MessageOriginType } from './store';
import type { HostawayMessage, HostawayConversation } from './history-sync';
import { analyzeMessage, analyzeHostawayHistory, mergeAnalysisWithProfile, type AnonymizedPattern, type HistoricalAnalysisResult } from './ai-learning';
import { supermemoryService, type MemorySearchResult } from './supermemory-service';
import { scopedKey } from './account-scoped-storage';

// Storage key bases — scoped per account at runtime via scopedKey()
const TRAINING_STATE_KEY = 'ai_training_state';
const RESPONSE_INDEX_KEY = 'ai_response_index';
const TRAINING_PROGRESS_KEY = 'ai_training_progress';

// Configuration for ultra-safe processing
const TRAINING_CONFIG = {
  batchSize: 250, // Messages per batch
  batchPauseMs: 2500, // 2.5 seconds between batches
  maxStyleSampleSize: 8000, // ⚠️ Bumped from 5000 on 2026-02-12 — revert to 5000 if training degrades mobile perf
  maxIndexEntries: 50000, // Max entries in response index
  autoTrainDelay: 3000, // Delay after fetch before auto-training starts
  incrementalBatchSize: 50, // Smaller batches for incremental updates
};

// Training state persisted to storage
export interface TrainingState {
  isTraining: boolean;
  isAutoTraining: boolean;
  phase: 'idle' | 'sampling' | 'analyzing' | 'indexing' | 'complete' | 'error';
  progress: number; // 0-100

  // Stats
  totalMessagesProcessed: number;
  hostMessagesProcessed: number;
  sampledForStyle: number;
  indexedForRecall: number;

  // Timing
  startTime: number | null;
  lastTrainingTime: number | null;
  estimatedTimeRemaining: number | null;

  // Errors
  lastError: string | null;
  errorCount: number;

  // Settings
  lastFetchSize: number;
  hasCompletedInitialTraining: boolean;
}

// Response pattern for historical matching
export interface ResponsePattern {
  id: string;
  guestIntent: string;
  guestKeywords: string[];
  guestSentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  hostResponse: string;
  hostResponseAnonymized: string;
  propertyId?: string;
  responseLength: number;
  hasEmoji: boolean;
  timestamp: Date;
  matchScore?: number; // Used during search
  priority: 'normal' | 'high'; // Used during search
}

// Response index for fast historical lookup
export interface ResponseIndex {
  patterns: ResponsePattern[];
  intentGroups: Record<string, string[]>; // intent -> pattern IDs
  keywordIndex: Record<string, string[]>; // keyword -> pattern IDs
  lastUpdated: Date;
  totalPatterns: number;
}

// Training progress callback
export type TrainingProgressCallback = (state: TrainingState) => void;
export type TrainingCompleteCallback = (result: TrainingResult) => void;

export interface TrainingResult {
  success: boolean;
  styleProfile: Partial<HostStyleProfile>;
  responseIndex: ResponseIndex;
  stats: {
    totalMessagesAnalyzed: number;
    hostMessagesAnalyzed: number;
    patternsIndexed: number;
    trainingSampleSize: number;
    trainingDurationMs: number;
  };
}

// Smart sampling criteria for large datasets
interface SamplingCriteria {
  propertyDistribution: boolean; // Sample across all properties
  timeDistribution: boolean; // Sample across time periods
  intentDistribution: boolean; // Sample different question types
  lengthVariation: boolean; // Include short, medium, long responses
}

// Intent detection patterns
const INTENT_PATTERNS: Record<string, RegExp[]> = {
  check_in: [/check.?in/i, /arrival/i, /key|access|door|lock|code/i, /when.*arrive/i, /get in/i],
  check_out: [/check.?out/i, /departure/i, /leaving/i, /late.*check.*out/i],
  wifi: [/wi.?fi/i, /internet|password|network|connect/i],
  parking: [/park|parking|car|garage|driveway/i],
  amenity: [/pool|gym|parking|tv|kitchen|bathroom|washer|dryer/i, /amenities/i],
  maintenance: [/broken|not working|problem|issue|fix|leak|damage/i],
  local_tips: [/restaurant|food|eat|coffee|grocery|nearby|recommend/i],
  noise: [/noise|loud|quiet|neighbor/i],
  booking: [/book|reservation|extend|cancel|dates|availability/i],
  thanks: [/thank|appreciate|great stay|wonderful|amazing/i],
  question: [/where|how|what|when|can I|is there/i],
  early_checkin: [/early.*check|earlier.*arrive/i],
  late_checkout: [/late.*check|later.*leave|stay.*longer/i],
  refund: [/refund|money back|compensation|discount/i],
};

// Sentiment patterns
const SENTIMENT_PATTERNS: Record<string, RegExp[]> = {
  positive: [/thank|great|wonderful|amazing|perfect|love|excellent|fantastic/i],
  negative: [/frustrated|disappointed|upset|problem|issue|broken|terrible|awful/i],
  urgent: [/urgent|emergency|help|immediately|asap|locked out/i],
};

// Singleton training manager
class AITrainingService {
  private state: TrainingState;
  private responseIndex: ResponseIndex;
  private patternMap: Map<string, ResponsePattern> = new Map(); // O(1) lookup by ID
  private progressCallbacks: TrainingProgressCallback[] = [];
  private completeCallbacks: TrainingCompleteCallback[] = [];
  private isProcessing = false;
  private abortController: AbortController | null = null;

  constructor() {
    this.state = this.getInitialState();
    this.responseIndex = this.getInitialIndex();
  }

  private getInitialState(): TrainingState {
    return {
      isTraining: false,
      isAutoTraining: false,
      phase: 'idle',
      progress: 0,
      totalMessagesProcessed: 0,
      hostMessagesProcessed: 0,
      sampledForStyle: 0,
      indexedForRecall: 0,
      startTime: null,
      lastTrainingTime: null,
      estimatedTimeRemaining: null,
      lastError: null,
      errorCount: 0,
      lastFetchSize: 0,
      hasCompletedInitialTraining: false,
    };
  }

  private getInitialIndex(): ResponseIndex {
    return {
      patterns: [],
      intentGroups: {},
      keywordIndex: {},
      lastUpdated: new Date(),
      totalPatterns: 0,
    };
  }

  // Load state from storage
  async loadState(): Promise<void> {
    try {
      const [stateData, indexData] = await Promise.all([
        AsyncStorage.getItem(scopedKey(TRAINING_STATE_KEY)),
        AsyncStorage.getItem(scopedKey(RESPONSE_INDEX_KEY)),
      ]);

      if (stateData) {
        this.state = { ...this.getInitialState(), ...JSON.parse(stateData), isTraining: false };
      }

      if (indexData) {
        this.responseIndex = JSON.parse(indexData);
        // Rebuild O(1) pattern lookup map from loaded data
        this.patternMap.clear();
        for (const pattern of this.responseIndex.patterns) {
          this.patternMap.set(pattern.id, pattern);
        }
      }
    } catch (error) {
      console.error('[AITraining] Failed to load state:', error);
    }
  }

  // Save state to storage
  async saveState(): Promise<void> {
    try {
      await AsyncStorage.setItem(scopedKey(TRAINING_STATE_KEY), JSON.stringify(this.state));
    } catch (error) {
      console.error('[AITraining] Failed to save state:', error);
    }
  }

  // Save response index to storage
  async saveIndex(): Promise<void> {
    try {
      // Trim index if too large
      if (this.responseIndex.patterns.length > TRAINING_CONFIG.maxIndexEntries) {
        this.responseIndex.patterns = this.responseIndex.patterns.slice(-TRAINING_CONFIG.maxIndexEntries);
        // Rebuild maps with corruption guard — revert on failure
        const oldIntentGroups = { ...this.responseIndex.intentGroups };
        const oldKeywordIndex = { ...this.responseIndex.keywordIndex };
        try {
          this.rebuildIndexMaps();
        } catch (rebuildErr) {
          console.error('[AITraining] rebuildIndexMaps failed, reverting:', rebuildErr);
          this.responseIndex.intentGroups = oldIntentGroups;
          this.responseIndex.keywordIndex = oldKeywordIndex;
        }
      }
      await AsyncStorage.setItem(scopedKey(RESPONSE_INDEX_KEY), JSON.stringify(this.responseIndex));
    } catch (error) {
      console.error('[AITraining] Failed to save index:', error);
    }
  }

  // Subscribe to progress updates
  onProgress(callback: TrainingProgressCallback): () => void {
    this.progressCallbacks.push(callback);
    return () => {
      this.progressCallbacks = this.progressCallbacks.filter(cb => cb !== callback);
    };
  }

  // Subscribe to completion
  onComplete(callback: TrainingCompleteCallback): () => void {
    this.completeCallbacks.push(callback);
    return () => {
      this.completeCallbacks = this.completeCallbacks.filter(cb => cb !== callback);
    };
  }

  // Notify progress
  private notifyProgress(): void {
    this.progressCallbacks.forEach(cb => cb(this.state));
  }

  // Notify completion
  private notifyComplete(result: TrainingResult): void {
    this.completeCallbacks.forEach(cb => cb(result));
  }

  // Get current state
  getState(): TrainingState {
    return { ...this.state };
  }

  // Get response index
  getResponseIndex(): ResponseIndex {
    return this.responseIndex;
  }

  // Cancel training
  cancel(): void {
    this.abortController?.abort();
    this.state.isTraining = false;
    this.state.isAutoTraining = false;
    this.state.phase = 'idle';
    this.notifyProgress();
    this.saveState();
  }

  /**
   * Auto-train after successful message history fetch
   * Called automatically when historySyncManager completes
   */
  async autoTrainOnFetch(
    conversations: HostawayConversation[],
    messagesByConversation: Record<number, HostawayMessage[]>,
    existingProfile?: HostStyleProfile
  ): Promise<TrainingResult> {
    console.log('[AITraining] Starting auto-training after fetch...');

    // Count total messages
    let totalMessages = 0;
    for (const convId in messagesByConversation) {
      totalMessages += messagesByConversation[convId].length;
    }

    this.state.lastFetchSize = totalMessages;
    this.state.isAutoTraining = true;
    await this.saveState();

    // Short delay before starting
    await this.delay(TRAINING_CONFIG.autoTrainDelay);

    return this.runTraining(conversations, messagesByConversation, existingProfile, true);
  }

  /**
   * Manual training trigger
   * Called when user clicks "Train on Messages" button
   */
  async manualTrain(
    conversations: HostawayConversation[],
    messagesByConversation: Record<number, HostawayMessage[]>,
    existingProfile?: HostStyleProfile
  ): Promise<TrainingResult> {
    console.log('[AITraining] Starting manual training...');
    return this.runTraining(conversations, messagesByConversation, existingProfile, false);
  }

  /**
   * Main training logic with ultra-safe batch processing
   */
  private async runTraining(
    conversations: HostawayConversation[],
    messagesByConversation: Record<number, HostawayMessage[]>,
    existingProfile?: HostStyleProfile,
    isAutoTrain: boolean = false
  ): Promise<TrainingResult> {
    if (this.isProcessing) {
      console.log('[AITraining] Training already in progress');
      return this.getEmptyResult();
    }

    this.isProcessing = true;
    this.abortController = new AbortController();

    this.state = {
      ...this.state,
      isTraining: true,
      isAutoTraining: isAutoTrain,
      phase: 'sampling',
      progress: 0,
      startTime: Date.now(),
      lastError: null,
      totalMessagesProcessed: 0,
      hostMessagesProcessed: 0,
      sampledForStyle: 0,
      indexedForRecall: 0,
    };

    await this.saveState();
    this.notifyProgress();

    try {
      // Collect all host messages with context
      const allHostMessages = this.collectHostMessages(conversations, messagesByConversation);
      console.log(`[AITraining] Collected ${allHostMessages.length} host messages`);

      // Phase 1: Smart sampling for style training (large datasets)
      this.state.phase = 'sampling';
      this.notifyProgress();

      const styleSample = await this.smartSampleForStyle(allHostMessages);
      this.state.sampledForStyle = styleSample.length;
      this.state.progress = 30;
      await this.saveState();
      this.notifyProgress();

      // Check for abort
      if (this.abortController.signal.aborted) {
        throw new Error('Training cancelled');
      }

      // Phase 2: Analyze style in batches
      this.state.phase = 'analyzing';
      this.notifyProgress();

      const styleProfile = await this.analyzeStyleInBatches(styleSample, existingProfile);
      this.state.progress = 60;
      await this.saveState();
      this.notifyProgress();

      // Check for abort
      if (this.abortController.signal.aborted) {
        throw new Error('Training cancelled');
      }

      // Phase 3: Index all messages for historical recall
      this.state.phase = 'indexing';
      this.notifyProgress();

      await this.indexMessagesForRecall(allHostMessages);
      this.state.indexedForRecall = this.responseIndex.patterns.length;
      this.state.progress = 90;
      await this.saveState();
      this.notifyProgress();

      // Complete
      this.state.phase = 'complete';
      this.state.progress = 100;
      this.state.isTraining = false;
      this.state.isAutoTraining = false;
      this.state.lastTrainingTime = Date.now();
      this.state.hasCompletedInitialTraining = true;

      await this.saveState();
      await this.saveIndex();
      this.notifyProgress();

      const result: TrainingResult = {
        success: true,
        styleProfile,
        responseIndex: this.responseIndex,
        stats: {
          totalMessagesAnalyzed: this.state.totalMessagesProcessed,
          hostMessagesAnalyzed: this.state.hostMessagesProcessed,
          patternsIndexed: this.responseIndex.patterns.length,
          trainingSampleSize: this.state.sampledForStyle,
          trainingDurationMs: Date.now() - (this.state.startTime || Date.now()),
        },
      };

      this.notifyComplete(result);
      console.log('[AITraining] Training complete!', result.stats);

      return result;

    } catch (error) {
      console.error('[AITraining] Training error:', error);
      this.state.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.state.errorCount++;
      this.state.phase = 'error';
      this.state.isTraining = false;
      this.state.isAutoTraining = false;
      await this.saveState();
      this.notifyProgress();

      return this.getEmptyResult();
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Collect host messages with context (previous guest message)
   */
  private collectHostMessages(
    conversations: HostawayConversation[],
    messagesByConversation: Record<number, HostawayMessage[]>
  ): {
    content: string;
    prevGuestContent?: string;
    propertyId?: string;
    timestamp: Date;
    conversationId: number;
  }[] {
    const hostMessages: {
      content: string;
      prevGuestContent?: string;
      propertyId?: string;
      timestamp: Date;
      conversationId: number;
    }[] = [];

    let pairedCount = 0;
    let unpairedCount = 0;

    for (const conv of conversations) {
      const messages = messagesByConversation[conv.id] || [];

      // Sort by date
      const sorted = [...messages].sort(
        (a, b) => new Date(a.insertedOn).getTime() - new Date(b.insertedOn).getTime()
      );

      for (let i = 0; i < sorted.length; i++) {
        const msg = sorted[i];

        // Only collect outgoing (host) messages
        // Hostaway API returns isIncoming as 0/1 (number) OR true/false (boolean)
        // Use Number() coercion to handle both: Number(false)=0, Number(true)=1, Number(0)=0, Number(1)=1
        const isHostMessage = Number(msg.isIncoming) === 0;

        if (isHostMessage && msg.body && msg.body.trim().length > 10) {
          // Find previous guest message
          let prevGuestContent: string | undefined;
          for (let j = i - 1; j >= 0; j--) {
            const isGuestMessage = Number(sorted[j].isIncoming) === 1;
            if (isGuestMessage && sorted[j].body) {
              prevGuestContent = sorted[j].body;
              break;
            }
          }

          if (prevGuestContent) {
            pairedCount++;
          } else {
            unpairedCount++;
          }

          hostMessages.push({
            content: msg.body,
            prevGuestContent,
            propertyId: conv.listingMapId?.toString(),
            timestamp: new Date(msg.insertedOn),
            conversationId: conv.id,
          });
        }
      }
    }

    console.log(`[AITraining] Collected ${hostMessages.length} host messages (${pairedCount} paired with guest question, ${unpairedCount} unpaired)`);
    this.state.hostMessagesProcessed = hostMessages.length;
    return hostMessages;
  }

  /**
   * Smart sampling for large datasets (>10,000 messages)
   * Selects up to 5,000 varied host replies spread across:
   * - Properties
   * - Time periods
   * - Question types
   */
  private async smartSampleForStyle(
    allMessages: {
      content: string;
      prevGuestContent?: string;
      propertyId?: string;
      timestamp: Date;
      conversationId: number;
    }[]
  ): Promise<typeof allMessages> {
    // If dataset is small, use all messages
    if (allMessages.length <= TRAINING_CONFIG.maxStyleSampleSize) {
      return allMessages;
    }

    console.log(`[AITraining] Smart sampling from ${allMessages.length} messages...`);

    const sampled: typeof allMessages = [];
    const targetSize = TRAINING_CONFIG.maxStyleSampleSize;

    // Group by property
    const byProperty = new Map<string, typeof allMessages>();
    for (const msg of allMessages) {
      const prop = msg.propertyId || 'unknown';
      if (!byProperty.has(prop)) byProperty.set(prop, []);
      byProperty.get(prop)!.push(msg);
    }

    // Group by intent (based on previous guest message)
    const byIntent = new Map<string, typeof allMessages>();
    for (const msg of allMessages) {
      const intent = msg.prevGuestContent ? this.detectIntent(msg.prevGuestContent) : 'unknown';
      if (!byIntent.has(intent)) byIntent.set(intent, []);
      byIntent.get(intent)!.push(msg);
    }

    // Calculate samples per group
    const propertySampleSize = Math.floor(targetSize * 0.4 / byProperty.size);
    const intentSampleSize = Math.floor(targetSize * 0.4 / byIntent.size);
    const randomSampleSize = Math.floor(targetSize * 0.2);

    // Sample from each property
    for (const [, messages] of byProperty) {
      const shuffled = this.shuffleArray([...messages]);
      sampled.push(...shuffled.slice(0, propertySampleSize));

      // Yield to event loop
      await this.delay(1);
    }

    // Sample from each intent
    for (const [, messages] of byIntent) {
      const shuffled = this.shuffleArray([...messages]);
      const toAdd = shuffled.slice(0, intentSampleSize);
      // Avoid duplicates
      for (const msg of toAdd) {
        if (!sampled.includes(msg)) {
          sampled.push(msg);
        }
      }
      await this.delay(1);
    }

    // Add random samples for variety
    const remaining = this.shuffleArray(
      allMessages.filter(m => !sampled.includes(m))
    );
    sampled.push(...remaining.slice(0, randomSampleSize));

    // Ensure diversity in response lengths
    const byLength = {
      short: allMessages.filter(m => m.content.length < 100),
      medium: allMessages.filter(m => m.content.length >= 100 && m.content.length < 300),
      long: allMessages.filter(m => m.content.length >= 300),
    };

    // Ensure at least some of each length type
    const lengthSampleSize = 100;
    for (const [, messages] of Object.entries(byLength)) {
      const shuffled = this.shuffleArray([...messages]);
      for (const msg of shuffled.slice(0, lengthSampleSize)) {
        if (!sampled.includes(msg) && sampled.length < targetSize) {
          sampled.push(msg);
        }
      }
    }

    console.log(`[AITraining] Sampled ${sampled.length} messages for style training`);
    return sampled.slice(0, targetSize);
  }

  /**
   * Analyze style in ultra-safe batches (250 messages, 2-3s pauses)
   */
  private async analyzeStyleInBatches(
    messages: {
      content: string;
      prevGuestContent?: string;
      propertyId?: string;
      timestamp: Date;
      conversationId: number;
    }[],
    existingProfile?: HostStyleProfile
  ): Promise<Partial<HostStyleProfile>> {
    const batchSize = TRAINING_CONFIG.batchSize;
    const totalBatches = Math.ceil(messages.length / batchSize);

    let aggregated = {
      formalitySum: 0,
      warmthSum: 0,
      lengthSum: 0,
      emojiCount: 0,
      emojiMessages: 0,
      greetings: new Map<string, number>(),
      signoffs: new Map<string, number>(),
      phrases: new Map<string, number>(),
      count: 0,
    };

    for (let batch = 0; batch < totalBatches; batch++) {
      // Check for abort
      if (this.abortController?.signal.aborted) {
        throw new Error('Training cancelled');
      }

      const start = batch * batchSize;
      const end = Math.min(start + batchSize, messages.length);
      const batchMessages = messages.slice(start, end);

      // Process batch
      for (const msg of batchMessages) {
        const analysis = analyzeMessage(msg.content);

        aggregated.formalitySum += analysis.formalityScore;
        aggregated.warmthSum += analysis.warmthScore;
        aggregated.lengthSum += analysis.wordCount;
        aggregated.emojiCount += analysis.emojiCount;
        if (analysis.hasEmojis) aggregated.emojiMessages++;

        if (analysis.greeting) {
          const g = analysis.greeting.toLowerCase();
          aggregated.greetings.set(g, (aggregated.greetings.get(g) || 0) + 1);
        }

        if (analysis.signoff) {
          const s = analysis.signoff.toLowerCase();
          aggregated.signoffs.set(s, (aggregated.signoffs.get(s) || 0) + 1);
        }

        for (const phrase of analysis.phrases) {
          aggregated.phrases.set(phrase, (aggregated.phrases.get(phrase) || 0) + 1);
        }

        aggregated.count++;
        this.state.totalMessagesProcessed++;
      }

      // Update progress
      const batchProgress = 30 + Math.round((batch / totalBatches) * 30);
      this.state.progress = batchProgress;
      this.updateTimeEstimate(batch, totalBatches);
      this.notifyProgress();

      // Ultra-safe pause between batches
      await this.delay(TRAINING_CONFIG.batchPauseMs);
    }

    // Calculate final profile
    const count = aggregated.count || 1;
    const profile: Partial<HostStyleProfile> = {
      formalityLevel: Math.round(aggregated.formalitySum / count),
      warmthLevel: Math.round(aggregated.warmthSum / count),
      averageResponseLength: Math.round(aggregated.lengthSum / count),
      usesEmojis: aggregated.emojiMessages / count > 0.2,
      emojiFrequency: Math.round((aggregated.emojiCount / count) * 100),
      commonGreetings: this.getTopEntries(aggregated.greetings, 5),
      commonSignoffs: this.getTopEntries(aggregated.signoffs, 5),
      commonPhrases: this.getTopEntries(aggregated.phrases, 10),
      samplesAnalyzed: aggregated.count,
      lastUpdated: new Date(),
    };

    // Merge with existing if available
    if (existingProfile && existingProfile.samplesAnalyzed > 0) {
      return mergeAnalysisWithProfile(existingProfile, {
        totalConversationsAnalyzed: 0,
        totalMessagesAnalyzed: aggregated.count,
        hostMessagesAnalyzed: aggregated.count,
        dateRange: { earliest: null, latest: null },
        patterns: [],
        styleProfile: profile,
        responsePatterns: [],
      });
    }

    return profile;
  }

  /**
   * Index all messages for historical recall
   * Creates searchable patterns for response matching
   */
  private async indexMessagesForRecall(
    messages: {
      content: string;
      prevGuestContent?: string;
      propertyId?: string;
      timestamp: Date;
      conversationId: number;
    }[]
  ): Promise<void> {
    const batchSize = TRAINING_CONFIG.batchSize;
    const totalBatches = Math.ceil(messages.length / batchSize);

    // Clear existing index for full rebuild
    this.responseIndex = this.getInitialIndex();

    for (let batch = 0; batch < totalBatches; batch++) {
      // Check for abort
      if (this.abortController?.signal.aborted) {
        throw new Error('Training cancelled');
      }

      const start = batch * batchSize;
      const end = Math.min(start + batchSize, messages.length);
      const batchMessages = messages.slice(start, end);

      for (const msg of batchMessages) {
        // Only index messages that have a previous guest message (we need context)
        if (!msg.prevGuestContent) continue;

        const pattern = this.createResponsePattern(
          msg.prevGuestContent,
          msg.content,
          msg.propertyId,
          msg.timestamp
        );

        this.addPatternToIndex(pattern);
      }

      // Update progress
      const batchProgress = 60 + Math.round((batch / totalBatches) * 30);
      this.state.progress = batchProgress;
      this.notifyProgress();

      // Ultra-safe pause
      await this.delay(TRAINING_CONFIG.batchPauseMs);
    }

    this.responseIndex.lastUpdated = new Date();
    this.responseIndex.totalPatterns = this.responseIndex.patterns.length;

    console.log(`[AITraining] Indexed ${this.responseIndex.patterns.length} response patterns`);
  }

  /**
   * Create a response pattern from guest question and host response
   */
  private createResponsePattern(
    guestMessage: string,
    hostResponse: string,
    propertyId?: string,
    timestamp?: Date
  ): ResponsePattern {
    const intent = this.detectIntent(guestMessage);
    const sentiment = this.detectSentiment(guestMessage);
    const keywords = this.extractKeywords(guestMessage);
    const hasEmoji = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/u.test(hostResponse);

    return {
      id: `pat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      guestIntent: intent,
      guestKeywords: keywords,
      guestSentiment: sentiment,
      hostResponse: hostResponse,
      hostResponseAnonymized: this.anonymizeResponse(hostResponse),
      propertyId,
      responseLength: hostResponse.split(/\s+/).length,
      hasEmoji,
      timestamp: timestamp || new Date(),
      priority: 'normal',
    };
  }

  /**
   * Add pattern to index with keyword and intent mappings
   */
  private addPatternToIndex(pattern: ResponsePattern): void {
    this.responseIndex.patterns.push(pattern);
    this.patternMap.set(pattern.id, pattern); // O(1) lookup

    // Add to intent groups
    if (!this.responseIndex.intentGroups[pattern.guestIntent]) {
      this.responseIndex.intentGroups[pattern.guestIntent] = [];
    }
    this.responseIndex.intentGroups[pattern.guestIntent].push(pattern.id);

    // Add to keyword index
    for (const keyword of pattern.guestKeywords) {
      if (!this.responseIndex.keywordIndex[keyword]) {
        this.responseIndex.keywordIndex[keyword] = [];
      }
      this.responseIndex.keywordIndex[keyword].push(pattern.id);
    }
  }

  /**
   * Rebuild index maps from patterns array
   */
  private rebuildIndexMaps(): void {
    this.responseIndex.intentGroups = {};
    this.responseIndex.keywordIndex = {};
    this.patternMap.clear();

    for (const pattern of this.responseIndex.patterns) {
      this.patternMap.set(pattern.id, pattern); // Rebuild O(1) map

      if (!this.responseIndex.intentGroups[pattern.guestIntent]) {
        this.responseIndex.intentGroups[pattern.guestIntent] = [];
      }
      this.responseIndex.intentGroups[pattern.guestIntent].push(pattern.id);

      for (const keyword of pattern.guestKeywords) {
        if (!this.responseIndex.keywordIndex[keyword]) {
          this.responseIndex.keywordIndex[keyword] = [];
        }
        this.responseIndex.keywordIndex[keyword].push(pattern.id);
      }
    }
  }

  /**
   * Search historical responses for similar guest questions
   * Returns best matching past host responses
   * 
   * Two-tier search:
   *  1. Supermemory (semantic vector search — understands meaning)
   *  2. Local index (keyword-based fallback — instant, offline)
   */
  searchHistoricalResponses(
    guestMessage: string,
    propertyId?: string,
    limit: number = 5
  ): ResponsePattern[] {
    // Kick off Supermemory search in background (non-blocking)
    // Results will be available for the *next* draft generation via getSemanticContext()
    this._lastSemanticSearch = supermemoryService.searchMemories(guestMessage, propertyId, limit)
      .catch(err => {
        console.warn('[AITraining] Supermemory search failed (using local only):', err);
        return [] as MemorySearchResult[];
      });

    // === Local keyword-based search (instant, synchronous) ===
    const intent = this.detectIntent(guestMessage);
    const sentiment = this.detectSentiment(guestMessage);
    const keywords = this.extractKeywords(guestMessage);

    // Find candidate patterns
    const candidateIds = new Set<string>();

    // Add patterns matching intent
    const intentPatterns = this.responseIndex.intentGroups[intent] || [];
    intentPatterns.forEach(id => candidateIds.add(id));

    // Add patterns matching keywords
    for (const keyword of keywords) {
      const keywordPatterns = this.responseIndex.keywordIndex[keyword] || [];
      keywordPatterns.forEach(id => candidateIds.add(id));
    }

    // If no matches, try partial keyword matching
    if (candidateIds.size === 0) {
      for (const keyword of keywords) {
        for (const indexedKeyword of Object.keys(this.responseIndex.keywordIndex)) {
          if (indexedKeyword.includes(keyword) || keyword.includes(indexedKeyword)) {
            const patterns = this.responseIndex.keywordIndex[indexedKeyword];
            patterns.forEach(id => candidateIds.add(id));
          }
        }
      }
    }

    // Score candidates using O(1) pattern map lookup
    const scorePattern = (pattern: ResponsePattern): ResponsePattern => {
      let score = 0;

      // Intent match (high weight)
      if (pattern.guestIntent === intent) score += 40;

      // Keyword overlap
      const keywordOverlap = pattern.guestKeywords.filter(k => keywords.includes(k)).length;
      score += keywordOverlap * 10;

      // Sentiment match
      if (pattern.guestSentiment === sentiment) score += 15;

      // Edited-by-host bonus (explicitly corrected = highest quality signal)
      if (pattern.priority === 'high') score += 25;

      // Strong recency weighting with stale decay
      const ageInDays = (Date.now() - new Date(pattern.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      if (ageInDays < 7) score += 25;        // This week — strongest signal
      else if (ageInDays < 30) score += 15;   // This month — very relevant
      else if (ageInDays < 90) score += 5;    // Recent quarter — still ok
      else if (ageInDays > 365) score -= 20;  // Over a year — strong penalty
      else if (ageInDays > 180) score -= 10;  // Over 6 months — mild penalty

      return { ...pattern, matchScore: score };
    };

    // === STRICT PROPERTY FILTERING (pass 1) ===
    // First, try to find matches ONLY from the same property
    if (propertyId) {
      const samePropertyScored: ResponsePattern[] = [];
      for (const id of candidateIds) {
        const pattern = this.patternMap.get(id); // O(1) lookup
        if (!pattern) continue;
        if (pattern.propertyId !== propertyId) continue; // Strict filter

        samePropertyScored.push(scorePattern(pattern));
      }

      // Use same-property results if we have enough good matches
      const goodMatches = samePropertyScored.filter(p => (p.matchScore || 0) >= 30);
      if (goodMatches.length >= 2) {
        console.log(`[AITraining] Property-strict search: ${goodMatches.length} matches for property ${propertyId}`);
        return goodMatches
          .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
          .slice(0, limit);
      }
    }

    // === CROSS-PROPERTY FALLBACK (pass 2) ===
    // Not enough same-property matches — search all but penalize wrong property
    const allScored: ResponsePattern[] = [];
    for (const id of candidateIds) {
      const pattern = this.patternMap.get(id); // O(1) lookup
      if (!pattern) continue;

      const scored = scorePattern(pattern);
      // Add property bonus/penalty
      if (propertyId && pattern.propertyId === propertyId) {
        scored.matchScore = (scored.matchScore || 0) + 20; // Same property bonus
      } else if (propertyId && pattern.propertyId && pattern.propertyId !== propertyId) {
        scored.matchScore = (scored.matchScore || 0) - 15; // Wrong property penalty
      }

      allScored.push(scored);
    }

    console.log(`[AITraining] Cross-property fallback: ${allScored.length} total candidates (property: ${propertyId || 'none'})`);

    // Sort by score and return top matches
    return allScored
      .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
      .slice(0, limit);
  }

  /**
   * Get semantic context from Supermemory for the last searched query
   * Call this after searchHistoricalResponses() to get richer AI context
   */
  async getSemanticContext(): Promise<MemorySearchResult[]> {
    if (!this._lastSemanticSearch) return [];
    return this._lastSemanticSearch;
  }

  /**
   * Get the host's learned profile from Supermemory
   * Returns static facts + dynamic patterns extracted from all stored memories
   */
  async getHostMemoryProfile(propertyId?: string) {
    return supermemoryService.getHostProfile(propertyId);
  }

  // Track latest semantic search promise
  private _lastSemanticSearch: Promise<MemorySearchResult[]> | null = null;

  /**
   * Incremental learning from a single new approved/edited reply
   * Called in real-time when host approves or edits an AI draft
   * 
   * Dual-writes to:
   *  1. Local AsyncStorage index (keyword-based, instant)
   *  2. Supermemory cloud (semantic search, persistent)
   */
  async learnFromReply(
    guestMessage: string,
    hostResponse: string,
    wasEdited: boolean,
    propertyId?: string,
    originType?: MessageOriginType
  ): Promise<void> {
    console.log('[AITraining] Learning from reply:', { wasEdited, originType: originType || 'legacy', responseLength: hostResponse.length });

    // 1. Local index (existing behavior — fast, keyword-based)
    const pattern = this.createResponsePattern(guestMessage, hostResponse, propertyId);
    pattern.priority = wasEdited ? 'high' : 'normal';
    this.addPatternToIndex(pattern);

    // Save index periodically (every 10 new patterns)
    if (this.responseIndex.patterns.length % 10 === 0) {
      await this.saveIndex();
    }

    this.responseIndex.totalPatterns = this.responseIndex.patterns.length;
    this.responseIndex.lastUpdated = new Date();

    // 2. Supermemory cloud (semantic search — fire-and-forget, non-blocking)
    supermemoryService.storeMemory({
      guestMessage,
      hostResponse,
      intent: pattern.guestIntent,
      sentiment: pattern.guestSentiment,
      propertyId,
      wasEdited,
      timestamp: new Date(),
    }).catch(err => console.warn('[AITraining] Supermemory store failed (non-critical):', err));
  }

  // Helper methods

  private detectIntent(content: string): string {
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          return intent;
        }
      }
    }
    return 'general';
  }

  private detectSentiment(content: string): 'positive' | 'neutral' | 'negative' | 'urgent' {
    if (SENTIMENT_PATTERNS.urgent.some(p => p.test(content))) return 'urgent';
    if (SENTIMENT_PATTERNS.negative.some(p => p.test(content))) return 'negative';
    if (SENTIMENT_PATTERNS.positive.some(p => p.test(content))) return 'positive';
    return 'neutral';
  }

  private extractKeywords(content: string): string[] {
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'i', 'we', 'you', 'it', 'my', 'your', 'our', 'can', 'do', 'does', 'how', 'what', 'where', 'when', 'please', 'thanks', 'hi', 'hello', 'hey']);

    const words = content.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .split(/\s+/)
      .filter(word => word.length >= 3 && !stopWords.has(word));

    // Return unique keywords
    return [...new Set(words)].slice(0, 10);
  }

  private anonymizeResponse(content: string): string {
    let anonymized = content;
    // Remove emails
    anonymized = anonymized.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');
    // Remove phone numbers
    anonymized = anonymized.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE]');
    // Remove URLs
    anonymized = anonymized.replace(/https?:\/\/[^\s]+/g, '[URL]');
    // Remove specific addresses
    anonymized = anonymized.replace(/\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|court|ct|blvd|boulevard)\b/gi, '[ADDRESS]');
    return anonymized;
  }

  private getTopEntries(map: Map<string, number>, limit: number): string[] {
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key]) => key);
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private updateTimeEstimate(currentBatch: number, totalBatches: number): void {
    if (!this.state.startTime || currentBatch === 0) return;

    const elapsed = Date.now() - this.state.startTime;
    const rate = currentBatch / elapsed;
    const remaining = totalBatches - currentBatch;
    this.state.estimatedTimeRemaining = Math.round(remaining / rate);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getEmptyResult(): TrainingResult {
    return {
      success: false,
      styleProfile: {},
      responseIndex: this.getInitialIndex(),
      stats: {
        totalMessagesAnalyzed: 0,
        hostMessagesAnalyzed: 0,
        patternsIndexed: 0,
        trainingSampleSize: 0,
        trainingDurationMs: 0,
      },
    };
  }
}

// Export singleton instance
export const aiTrainingService = new AITrainingService();

// Initialize on import
aiTrainingService.loadState().catch(console.error);

// Helper to format training status
export function formatTrainingStatus(state: TrainingState): string {
  if (!state.isTraining && !state.hasCompletedInitialTraining) {
    return 'Not trained yet';
  }

  switch (state.phase) {
    case 'idle':
      return state.hasCompletedInitialTraining ? 'Ready' : 'Not started';
    case 'sampling':
      return 'Selecting training samples...';
    case 'analyzing':
      return `Analyzing style (${state.progress}%)...`;
    case 'indexing':
      return `Building response index (${state.progress}%)...`;
    case 'complete':
      return 'Training complete!';
    case 'error':
      return `Error: ${state.lastError || 'Unknown'}`;
    default:
      return 'Unknown state';
  }
}

// Helper to get training stats summary
export function getTrainingSummary(state: TrainingState): string {
  if (!state.hasCompletedInitialTraining) {
    return 'AI needs training to learn your communication style.';
  }

  return `Trained on ${state.hostMessagesProcessed.toLocaleString()} messages. ${state.indexedForRecall.toLocaleString()} response patterns indexed.`;
}
