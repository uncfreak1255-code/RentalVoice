// Advanced AI Training Service
// Implements: Incremental Training, Multi-Pass Deep Training, Property Lexicons,
// Temporal Weighting, Training Quality, Active Learning, Negative Examples,
// Few-Shot Dynamic Examples, Conversation Flow Learning, Guest Memory

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HostStyleProfile, Conversation, Message, PropertyKnowledge } from './store';
import type { HostawayMessage, HostawayConversation } from './hostaway';
import { analyzeMessage } from './ai-learning';

// Storage keys
const INCREMENTAL_QUEUE_KEY = 'ai_incremental_queue';
const PROPERTY_LEXICON_KEY = 'ai_property_lexicons';
const TEMPORAL_WEIGHTS_KEY = 'ai_temporal_weights';
const TRAINING_QUALITY_KEY = 'ai_training_quality';
const NEGATIVE_EXAMPLES_KEY = 'ai_negative_examples';
const CONVERSATION_FLOWS_KEY = 'ai_conversation_flows';
const GUEST_MEMORY_KEY = 'ai_guest_memory';
const FEW_SHOT_INDEX_KEY = 'ai_few_shot_index';
const MULTI_PASS_STATE_KEY = 'ai_multi_pass_state';

// ============================================================================
// 1. INCREMENTAL TRAINING - Auto-train every 10 messages
// ============================================================================

export interface IncrementalTrainingState {
  messageQueue: QueuedMessage[];
  lastTrainedAt: number | null;
  totalIncrementsProcessed: number;
  pendingCount: number;
}

interface QueuedMessage {
  id: string;
  content: string;
  guestMessage?: string;
  propertyId?: string;
  timestamp: number;
  wasEdited: boolean;
  wasApproved: boolean;
}

const INCREMENTAL_BATCH_SIZE = 10;

class IncrementalTrainer {
  private queue: QueuedMessage[] = [];
  private isProcessing = false;
  private callbacks: ((state: IncrementalTrainingState) => void)[] = [];

  async loadQueue(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(INCREMENTAL_QUEUE_KEY);
      if (data) {
        const state = JSON.parse(data);
        this.queue = state.queue || [];
      }
    } catch (error) {
      console.error('[IncrementalTrainer] Failed to load queue:', error);
    }
  }

  async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(INCREMENTAL_QUEUE_KEY, JSON.stringify({
        queue: this.queue,
        lastSaved: Date.now(),
      }));
    } catch (error) {
      console.error('[IncrementalTrainer] Failed to save queue:', error);
    }
  }

  // Add a message to the incremental training queue
  async queueMessage(message: QueuedMessage): Promise<void> {
    this.queue.push(message);
    console.log(`[IncrementalTrainer] Queued message, total: ${this.queue.length}`);

    // Check if we should trigger training
    if (this.queue.length >= INCREMENTAL_BATCH_SIZE && !this.isProcessing) {
      await this.processBatch();
    }

    await this.saveQueue();
    this.notifyCallbacks();
  }

  // Process a batch of messages for incremental training
  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.queue.length < INCREMENTAL_BATCH_SIZE) {
      return;
    }

    this.isProcessing = true;
    console.log(`[IncrementalTrainer] Processing batch of ${INCREMENTAL_BATCH_SIZE} messages`);

    try {
      const batch = this.queue.splice(0, INCREMENTAL_BATCH_SIZE);

      // Analyze each message
      for (const msg of batch) {
        const analysis = analyzeMessage(msg.content);

        // Update style metrics incrementally
        await this.updateStyleMetrics(msg, analysis);

        // Add to few-shot index
        if (msg.guestMessage) {
          await fewShotIndexer.addExample(msg.guestMessage, msg.content, msg.propertyId);
        }

        // If edited, this is more valuable for learning
        if (msg.wasEdited) {
          console.log('[IncrementalTrainer] Learning from edited response (high value)');
        }
      }

      console.log(`[IncrementalTrainer] Batch processed, learned from ${batch.length} messages`);

      // Notify: "Learned from 10 new messages"
      this.notifyCallbacks();

    } catch (error) {
      console.error('[IncrementalTrainer] Batch processing error:', error);
    } finally {
      this.isProcessing = false;
      await this.saveQueue();
    }
  }

  private async updateStyleMetrics(
    msg: QueuedMessage,
    analysis: ReturnType<typeof analyzeMessage>
  ): Promise<void> {
    // Update temporal weights based on recency
    await temporalWeightManager.recordMessageAnalysis({
      timestamp: msg.timestamp,
      formality: analysis.formalityScore,
      warmth: analysis.warmthScore,
      length: analysis.wordCount,
      hasEmoji: analysis.hasEmojis,
      propertyId: msg.propertyId,
    });
  }

  onStateChange(callback: (state: IncrementalTrainingState) => void): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  private notifyCallbacks(): void {
    const state: IncrementalTrainingState = {
      messageQueue: this.queue,
      lastTrainedAt: Date.now(),
      totalIncrementsProcessed: this.queue.length,
      pendingCount: this.queue.length,
    };
    this.callbacks.forEach(cb => cb(state));
  }

  getState(): IncrementalTrainingState {
    return {
      messageQueue: this.queue,
      lastTrainedAt: null,
      totalIncrementsProcessed: 0,
      pendingCount: this.queue.length,
    };
  }
}

export const incrementalTrainer = new IncrementalTrainer();

// ============================================================================
// 2. MULTI-PASS DEEP TRAINING - 5 specialized passes
// ============================================================================

export type TrainingPass =
  | 'style_tone'        // Pass 1: Style & Tone (formality, warmth, length)
  | 'intent_mapping'    // Pass 2: Intent Mapping (what guests ask → your responses)
  | 'phrase_mining'     // Pass 3: Phrase Mining (extract unique expressions)
  | 'contextual'        // Pass 4: Contextual Patterns (time-based, property-specific)
  | 'edge_cases';       // Pass 5: Edge Cases (complaints, refunds, emergencies)

export interface MultiPassState {
  currentPass: TrainingPass | null;
  passesCompleted: TrainingPass[];
  passProgress: Record<TrainingPass, number>;
  totalProgress: number;
  isRunning: boolean;
  results: Record<TrainingPass, MultiPassResult>;
}

export interface MultiPassResult {
  pass: TrainingPass;
  samplesProcessed: number;
  patternsExtracted: number;
  metrics: Record<string, number>;
  completedAt: number;
}

class MultiPassTrainer {
  private state: MultiPassState = {
    currentPass: null,
    passesCompleted: [],
    passProgress: {
      style_tone: 0,
      intent_mapping: 0,
      phrase_mining: 0,
      contextual: 0,
      edge_cases: 0,
    },
    totalProgress: 0,
    isRunning: false,
    results: {} as Record<TrainingPass, MultiPassResult>,
  };

  private callbacks: ((state: MultiPassState) => void)[] = [];

  async loadState(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(MULTI_PASS_STATE_KEY);
      if (data) {
        this.state = { ...this.state, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('[MultiPassTrainer] Failed to load state:', error);
    }
  }

  async saveState(): Promise<void> {
    try {
      await AsyncStorage.setItem(MULTI_PASS_STATE_KEY, JSON.stringify(this.state));
    } catch (error) {
      console.error('[MultiPassTrainer] Failed to save state:', error);
    }
  }

  getState(): MultiPassState {
    return { ...this.state };
  }

  onStateChange(callback: (state: MultiPassState) => void): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  private notifyCallbacks(): void {
    this.callbacks.forEach(cb => cb(this.state));
  }

  // Run all 5 training passes
  async runDeepTraining(
    messages: Array<{ content: string; prevGuestContent?: string; propertyId?: string; timestamp: Date }>,
    onProgress?: (pass: TrainingPass, progress: number) => void
  ): Promise<MultiPassState> {
    if (this.state.isRunning) {
      console.log('[MultiPassTrainer] Already running');
      return this.state;
    }

    this.state.isRunning = true;
    this.state.passesCompleted = [];
    this.notifyCallbacks();

    const passes: TrainingPass[] = ['style_tone', 'intent_mapping', 'phrase_mining', 'contextual', 'edge_cases'];

    for (const pass of passes) {
      this.state.currentPass = pass;
      this.state.passProgress[pass] = 0;
      this.notifyCallbacks();

      console.log(`[MultiPassTrainer] Starting pass: ${pass}`);

      const result = await this.runPass(pass, messages, (progress) => {
        this.state.passProgress[pass] = progress;
        this.state.totalProgress =
          (this.state.passesCompleted.length * 100 + progress) / passes.length;
        this.notifyCallbacks();
        onProgress?.(pass, progress);
      });

      this.state.results[pass] = result;
      this.state.passProgress[pass] = 100;
      this.state.passesCompleted.push(pass);
      await this.saveState();
    }

    this.state.currentPass = null;
    this.state.isRunning = false;
    this.state.totalProgress = 100;
    await this.saveState();
    this.notifyCallbacks();

    console.log('[MultiPassTrainer] All passes complete');
    return this.state;
  }

  private async runPass(
    pass: TrainingPass,
    messages: Array<{ content: string; prevGuestContent?: string; propertyId?: string; timestamp: Date }>,
    onProgress: (progress: number) => void
  ): Promise<MultiPassResult> {
    const startTime = Date.now();
    let patternsExtracted = 0;
    const metrics: Record<string, number> = {};

    switch (pass) {
      case 'style_tone':
        // Pass 1: Extract style metrics
        const styleResult = await this.runStyleTonePass(messages, onProgress);
        patternsExtracted = styleResult.patterns;
        metrics.avgFormality = styleResult.avgFormality;
        metrics.avgWarmth = styleResult.avgWarmth;
        metrics.avgLength = styleResult.avgLength;
        break;

      case 'intent_mapping':
        // Pass 2: Map guest intents to response patterns
        const intentResult = await this.runIntentMappingPass(messages, onProgress);
        patternsExtracted = intentResult.patterns;
        metrics.uniqueIntents = intentResult.uniqueIntents;
        metrics.coveredIntents = intentResult.coveredIntents;
        break;

      case 'phrase_mining':
        // Pass 3: Extract unique phrases
        const phraseResult = await this.runPhraseMiningPass(messages, onProgress);
        patternsExtracted = phraseResult.patterns;
        metrics.uniquePhrases = phraseResult.uniquePhrases;
        metrics.frequentPhrases = phraseResult.frequentPhrases;
        break;

      case 'contextual':
        // Pass 4: Time and property patterns
        const contextResult = await this.runContextualPass(messages, onProgress);
        patternsExtracted = contextResult.patterns;
        metrics.propertyPatterns = contextResult.propertyPatterns;
        metrics.timePatterns = contextResult.timePatterns;
        break;

      case 'edge_cases':
        // Pass 5: Complaints, refunds, emergencies
        const edgeResult = await this.runEdgeCasePass(messages, onProgress);
        patternsExtracted = edgeResult.patterns;
        metrics.complaintPatterns = edgeResult.complaintPatterns;
        metrics.urgentPatterns = edgeResult.urgentPatterns;
        break;
    }

    return {
      pass,
      samplesProcessed: messages.length,
      patternsExtracted,
      metrics,
      completedAt: Date.now(),
    };
  }

  private async runStyleTonePass(
    messages: Array<{ content: string }>,
    onProgress: (progress: number) => void
  ): Promise<{ patterns: number; avgFormality: number; avgWarmth: number; avgLength: number }> {
    let totalFormality = 0;
    let totalWarmth = 0;
    let totalLength = 0;
    let patterns = 0;

    for (let i = 0; i < messages.length; i++) {
      const analysis = analyzeMessage(messages[i].content);
      totalFormality += analysis.formalityScore;
      totalWarmth += analysis.warmthScore;
      totalLength += analysis.wordCount;
      patterns++;

      if (i % 100 === 0) {
        onProgress(Math.round((i / messages.length) * 100));
        await this.delay(10); // Yield to event loop
      }
    }

    return {
      patterns,
      avgFormality: Math.round(totalFormality / messages.length),
      avgWarmth: Math.round(totalWarmth / messages.length),
      avgLength: Math.round(totalLength / messages.length),
    };
  }

  private async runIntentMappingPass(
    messages: Array<{ content: string; prevGuestContent?: string }>,
    onProgress: (progress: number) => void
  ): Promise<{ patterns: number; uniqueIntents: number; coveredIntents: number }> {
    const intentMap = new Map<string, string[]>();

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.prevGuestContent) {
        const intent = this.detectIntent(msg.prevGuestContent);
        if (!intentMap.has(intent)) {
          intentMap.set(intent, []);
        }
        intentMap.get(intent)!.push(msg.content);
      }

      if (i % 100 === 0) {
        onProgress(Math.round((i / messages.length) * 100));
        await this.delay(10);
      }
    }

    return {
      patterns: messages.filter(m => m.prevGuestContent).length,
      uniqueIntents: intentMap.size,
      coveredIntents: intentMap.size,
    };
  }

  private async runPhraseMiningPass(
    messages: Array<{ content: string }>,
    onProgress: (progress: number) => void
  ): Promise<{ patterns: number; uniquePhrases: number; frequentPhrases: number }> {
    const phraseCount = new Map<string, number>();

    for (let i = 0; i < messages.length; i++) {
      const phrases = this.extractPhrases(messages[i].content);
      for (const phrase of phrases) {
        phraseCount.set(phrase, (phraseCount.get(phrase) || 0) + 1);
      }

      if (i % 100 === 0) {
        onProgress(Math.round((i / messages.length) * 100));
        await this.delay(10);
      }
    }

    const frequentPhrases = [...phraseCount.entries()]
      .filter(([_, count]) => count >= 3)
      .length;

    return {
      patterns: messages.length,
      uniquePhrases: phraseCount.size,
      frequentPhrases,
    };
  }

  private async runContextualPass(
    messages: Array<{ content: string; propertyId?: string; timestamp: Date }>,
    onProgress: (progress: number) => void
  ): Promise<{ patterns: number; propertyPatterns: number; timePatterns: number }> {
    const propertySet = new Set<string>();
    const timeDistribution = { morning: 0, afternoon: 0, evening: 0, night: 0 };

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.propertyId) {
        propertySet.add(msg.propertyId);
      }

      const hour = new Date(msg.timestamp).getHours();
      if (hour >= 5 && hour < 12) timeDistribution.morning++;
      else if (hour >= 12 && hour < 17) timeDistribution.afternoon++;
      else if (hour >= 17 && hour < 21) timeDistribution.evening++;
      else timeDistribution.night++;

      if (i % 100 === 0) {
        onProgress(Math.round((i / messages.length) * 100));
        await this.delay(10);
      }
    }

    return {
      patterns: messages.length,
      propertyPatterns: propertySet.size,
      timePatterns: Object.keys(timeDistribution).filter(k =>
        timeDistribution[k as keyof typeof timeDistribution] > 0
      ).length,
    };
  }

  private async runEdgeCasePass(
    messages: Array<{ content: string; prevGuestContent?: string }>,
    onProgress: (progress: number) => void
  ): Promise<{ patterns: number; complaintPatterns: number; urgentPatterns: number }> {
    let complaintPatterns = 0;
    let urgentPatterns = 0;

    const complaintKeywords = /refund|complaint|disappointed|frustrated|problem|issue|broken|terrible/i;
    const urgentKeywords = /urgent|emergency|help|immediately|asap|locked out/i;

    for (let i = 0; i < messages.length; i++) {
      const guestMsg = messages[i].prevGuestContent || '';

      if (complaintKeywords.test(guestMsg)) {
        complaintPatterns++;
      }
      if (urgentKeywords.test(guestMsg)) {
        urgentPatterns++;
      }

      if (i % 100 === 0) {
        onProgress(Math.round((i / messages.length) * 100));
        await this.delay(10);
      }
    }

    return {
      patterns: messages.length,
      complaintPatterns,
      urgentPatterns,
    };
  }

  private detectIntent(content: string): string {
    const intentPatterns: Record<string, RegExp> = {
      wifi: /wi.?fi|internet|password|network/i,
      check_in: /check.?in|arrive|arrival|key|code|lock/i,
      check_out: /check.?out|leave|leaving|departure/i,
      parking: /park|car|garage|driveway/i,
      maintenance: /broken|not working|fix|repair|issue|problem/i,
      thanks: /thank|appreciate|great|wonderful/i,
      question: /where|how|what|when|can I/i,
    };

    for (const [intent, pattern] of Object.entries(intentPatterns)) {
      if (pattern.test(content)) {
        return intent;
      }
    }
    return 'general';
  }

  private extractPhrases(content: string): string[] {
    const phrases: string[] = [];
    const words = content.toLowerCase().split(/\s+/);

    for (let i = 0; i < words.length - 2; i++) {
      const twoWord = `${words[i]} ${words[i + 1]}`;
      const threeWord = words[i + 2] ? `${twoWord} ${words[i + 2]}` : null;

      if (/let me know|happy to|feel free|don't hesitate/i.test(twoWord)) {
        phrases.push(twoWord);
      }
      if (threeWord && /looking forward to|thank you for|please let me/i.test(threeWord)) {
        phrases.push(threeWord);
      }
    }

    return phrases;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const multiPassTrainer = new MultiPassTrainer();

// ============================================================================
// 3. PROPERTY-SPECIFIC LEXICONS
// ============================================================================

export interface PropertyLexicon {
  propertyId: string;
  propertyName: string;
  uniqueTerms: {
    amenities: string[];
    locations: string[];
    instructions: string[];
    recommendations: string[];
  };
  usageFrequency: Record<string, number>;
  lastUpdated: number;
}

class PropertyLexiconManager {
  private lexicons: Map<string, PropertyLexicon> = new Map();

  async loadLexicons(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(PROPERTY_LEXICON_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.lexicons = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error('[PropertyLexicon] Failed to load:', error);
    }
  }

  async saveLexicons(): Promise<void> {
    try {
      const obj = Object.fromEntries(this.lexicons);
      await AsyncStorage.setItem(PROPERTY_LEXICON_KEY, JSON.stringify(obj));
    } catch (error) {
      console.error('[PropertyLexicon] Failed to save:', error);
    }
  }

  getLexicon(propertyId: string): PropertyLexicon | undefined {
    return this.lexicons.get(propertyId);
  }

  getAllLexicons(): PropertyLexicon[] {
    return [...this.lexicons.values()];
  }

  // Build lexicon from messages for a property
  async buildLexicon(
    propertyId: string,
    propertyName: string,
    messages: Array<{ content: string }>
  ): Promise<PropertyLexicon> {
    const amenities = new Set<string>();
    const locations = new Set<string>();
    const instructions = new Set<string>();
    const recommendations = new Set<string>();
    const frequency: Record<string, number> = {};

    // Common terms to exclude
    const genericTerms = new Set([
      'bathroom', 'kitchen', 'bedroom', 'living room', 'house', 'apartment',
      'property', 'place', 'home', 'room', 'door', 'window',
    ]);

    // Amenity patterns
    const amenityPatterns = /\b(pool|hot tub|jacuzzi|gym|fitness|sauna|fire pit|grill|bbq|game room|theater|kayak|paddle board|bikes?|tennis|basketball|ping pong|foosball|arcade)\b/gi;

    // Location patterns
    const locationPatterns = /\b(downstairs|upstairs|basement|attic|patio|deck|balcony|garage|carport|shed|yard|garden|master suite|loft|den|office)\b/gi;

    // Instruction-specific patterns
    const instructionPatterns = /\b(code|button|switch|dial|remote|lever|key|keypad|lock|unlock|press|turn|slide)\b/gi;

    // Local recommendation patterns
    const recommendationPatterns = /\b([A-Z][a-z]+'s?\s+[A-Z]?[a-z]*|[A-Z][a-z]+\s+(Restaurant|Cafe|Coffee|Grill|Bar|Bakery|Diner|Bistro|Market|Store|Shop))\b/g;

    for (const msg of messages) {
      const content = msg.content;

      // Extract amenities
      const amenityMatches = content.match(amenityPatterns) || [];
      amenityMatches.forEach(term => {
        const lower = term.toLowerCase();
        if (!genericTerms.has(lower)) {
          amenities.add(lower);
          frequency[lower] = (frequency[lower] || 0) + 1;
        }
      });

      // Extract locations
      const locationMatches = content.match(locationPatterns) || [];
      locationMatches.forEach(term => {
        const lower = term.toLowerCase();
        if (!genericTerms.has(lower)) {
          locations.add(lower);
          frequency[lower] = (frequency[lower] || 0) + 1;
        }
      });

      // Extract instructions
      const instructionMatches = content.match(instructionPatterns) || [];
      instructionMatches.forEach(term => {
        instructions.add(term.toLowerCase());
        frequency[term.toLowerCase()] = (frequency[term.toLowerCase()] || 0) + 1;
      });

      // Extract recommendations
      const recommendationMatches = content.match(recommendationPatterns) || [];
      recommendationMatches.forEach(term => {
        recommendations.add(term);
        frequency[term] = (frequency[term] || 0) + 1;
      });
    }

    const lexicon: PropertyLexicon = {
      propertyId,
      propertyName,
      uniqueTerms: {
        amenities: [...amenities].slice(0, 20),
        locations: [...locations].slice(0, 20),
        instructions: [...instructions].slice(0, 20),
        recommendations: [...recommendations].slice(0, 15),
      },
      usageFrequency: frequency,
      lastUpdated: Date.now(),
    };

    this.lexicons.set(propertyId, lexicon);
    await this.saveLexicons();

    console.log(`[PropertyLexicon] Built lexicon for ${propertyName}:`, {
      amenities: amenities.size,
      locations: locations.size,
      instructions: instructions.size,
      recommendations: recommendations.size,
    });

    return lexicon;
  }

  // Get AI prompt enhancement based on property lexicon
  getLexiconPrompt(propertyId: string): string {
    const lexicon = this.lexicons.get(propertyId);
    if (!lexicon) return '';

    const parts: string[] = [];

    if (lexicon.uniqueTerms.amenities.length > 0) {
      parts.push(`Property amenities: ${lexicon.uniqueTerms.amenities.join(', ')}`);
    }
    if (lexicon.uniqueTerms.locations.length > 0) {
      parts.push(`Property areas: ${lexicon.uniqueTerms.locations.join(', ')}`);
    }
    if (lexicon.uniqueTerms.recommendations.length > 0) {
      parts.push(`Local recommendations: ${lexicon.uniqueTerms.recommendations.join(', ')}`);
    }

    if (parts.length === 0) return '';

    return `\nPROPERTY-SPECIFIC VOCABULARY for "${lexicon.propertyName}":\n${parts.join('\n')}\nUse these specific terms when relevant to match the host's language for this property.\n`;
  }
}

export const propertyLexiconManager = new PropertyLexiconManager();

// ============================================================================
// 4. TEMPORAL WEIGHTING - Prioritize recent messages
// ============================================================================

export interface TemporalWeights {
  recentWeight: number;      // 0-6 months: 3x
  mediumWeight: number;      // 6-12 months: 2x
  olderWeight: number;       // 12-18 months: 1x
  ancientWeight: number;     // 18+ months: 0.5x
  styleEvolution: StyleEvolution[];
}

export interface StyleEvolution {
  period: string;
  formality: number;
  warmth: number;
  length: number;
  emojiUsage: number;
}

interface MessageAnalysis {
  timestamp: number;
  formality: number;
  warmth: number;
  length: number;
  hasEmoji: boolean;
  propertyId?: string;
}

class TemporalWeightManager {
  private analyses: MessageAnalysis[] = [];
  private weights: TemporalWeights = {
    recentWeight: 3,
    mediumWeight: 2,
    olderWeight: 1,
    ancientWeight: 0.5,
    styleEvolution: [],
  };

  async loadWeights(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(TEMPORAL_WEIGHTS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.analyses = parsed.analyses || [];
        this.weights = parsed.weights || this.weights;
      }
    } catch (error) {
      console.error('[TemporalWeights] Failed to load:', error);
    }
  }

  async saveWeights(): Promise<void> {
    try {
      await AsyncStorage.setItem(TEMPORAL_WEIGHTS_KEY, JSON.stringify({
        analyses: this.analyses.slice(-1000), // Keep last 1000
        weights: this.weights,
      }));
    } catch (error) {
      console.error('[TemporalWeights] Failed to save:', error);
    }
  }

  getWeights(): TemporalWeights {
    return { ...this.weights };
  }

  async recordMessageAnalysis(analysis: MessageAnalysis): Promise<void> {
    this.analyses.push(analysis);

    // Recalculate style evolution periodically
    if (this.analyses.length % 50 === 0) {
      this.calculateStyleEvolution();
    }

    await this.saveWeights();
  }

  // Get weight multiplier for a message based on its age
  getWeightForTimestamp(timestamp: number): number {
    const ageInMonths = (Date.now() - timestamp) / (1000 * 60 * 60 * 24 * 30);

    if (ageInMonths < 6) return this.weights.recentWeight;
    if (ageInMonths < 12) return this.weights.mediumWeight;
    if (ageInMonths < 18) return this.weights.olderWeight;
    return this.weights.ancientWeight;
  }

  // Calculate how style has evolved over time
  private calculateStyleEvolution(): void {
    if (this.analyses.length < 50) return;

    // Group by 3-month periods
    const periods = new Map<string, MessageAnalysis[]>();

    for (const analysis of this.analyses) {
      const date = new Date(analysis.timestamp);
      const period = `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;

      if (!periods.has(period)) {
        periods.set(period, []);
      }
      periods.get(period)!.push(analysis);
    }

    // Calculate averages per period
    const evolution: StyleEvolution[] = [];

    for (const [period, analyses] of periods) {
      if (analyses.length < 10) continue;

      const avgFormality = analyses.reduce((s, a) => s + a.formality, 0) / analyses.length;
      const avgWarmth = analyses.reduce((s, a) => s + a.warmth, 0) / analyses.length;
      const avgLength = analyses.reduce((s, a) => s + a.length, 0) / analyses.length;
      const emojiUsage = analyses.filter(a => a.hasEmoji).length / analyses.length;

      evolution.push({
        period,
        formality: Math.round(avgFormality),
        warmth: Math.round(avgWarmth),
        length: Math.round(avgLength),
        emojiUsage: Math.round(emojiUsage * 100),
      });
    }

    // Sort by period
    evolution.sort((a, b) => a.period.localeCompare(b.period));
    this.weights.styleEvolution = evolution;

    console.log('[TemporalWeights] Style evolution calculated:', evolution.length, 'periods');
  }

  // Get weighted style profile (emphasizing recent style)
  getWeightedStyleProfile(): Partial<HostStyleProfile> | null {
    if (this.analyses.length < 20) return null;

    let weightedFormality = 0;
    let weightedWarmth = 0;
    let weightedLength = 0;
    let weightedEmoji = 0;
    let totalWeight = 0;

    for (const analysis of this.analyses) {
      const weight = this.getWeightForTimestamp(analysis.timestamp);
      weightedFormality += analysis.formality * weight;
      weightedWarmth += analysis.warmth * weight;
      weightedLength += analysis.length * weight;
      weightedEmoji += (analysis.hasEmoji ? 1 : 0) * weight;
      totalWeight += weight;
    }

    return {
      formalityLevel: Math.round(weightedFormality / totalWeight),
      warmthLevel: Math.round(weightedWarmth / totalWeight),
      averageResponseLength: Math.round(weightedLength / totalWeight),
      usesEmojis: (weightedEmoji / totalWeight) > 0.2,
      emojiFrequency: Math.round((weightedEmoji / totalWeight) * 100),
    };
  }
}

export const temporalWeightManager = new TemporalWeightManager();

// ============================================================================
// 5. TRAINING QUALITY DASHBOARD
// ============================================================================

export interface TrainingQuality {
  coverage: {
    intentsLearned: string[];
    intentsMissing: string[];
    propertiesCovered: number;
    dateRangeCovered: { start: Date | null; end: Date | null };
  };
  diversity: {
    uniquePhrases: number;
    toneVariety: number;
    lengthDistribution: Record<'short' | 'medium' | 'long', number>;
  };
  reliability: {
    consistencyScore: number;
    confidenceDistribution: number[];
    lowConfidenceTopics: string[];
  };
  gaps: TrainingGap[];
  strengths: TrainingStrength[];
  overallScore: number;
}

export interface TrainingGap {
  topic: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  suggestion: string;
}

export interface TrainingStrength {
  topic: string;
  description: string;
  confidence: number;
}

class TrainingQualityAnalyzer {
  private quality: TrainingQuality | null = null;

  async loadQuality(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(TRAINING_QUALITY_KEY);
      if (data) {
        this.quality = JSON.parse(data);
      }
    } catch (error) {
      console.error('[TrainingQuality] Failed to load:', error);
    }
  }

  async saveQuality(): Promise<void> {
    try {
      if (this.quality) {
        await AsyncStorage.setItem(TRAINING_QUALITY_KEY, JSON.stringify(this.quality));
      }
    } catch (error) {
      console.error('[TrainingQuality] Failed to save:', error);
    }
  }

  getQuality(): TrainingQuality | null {
    return this.quality;
  }

  // Analyze training quality from indexed data
  async analyzeQuality(
    messages: Array<{ content: string; prevGuestContent?: string; propertyId?: string; timestamp: Date }>,
    confidenceHistory: number[]
  ): Promise<TrainingQuality> {
    const allIntents = ['wifi', 'check_in', 'check_out', 'parking', 'maintenance', 'thanks', 'question', 'refund', 'amenity', 'local_tips', 'booking'];
    const learnedIntents = new Set<string>();
    const properties = new Set<string>();
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    const phrases = new Set<string>();
    const lengthDist = { short: 0, medium: 0, long: 0 };
    let toneSum = 0;

    // Analyze messages
    for (const msg of messages) {
      if (msg.prevGuestContent) {
        const intent = this.detectIntent(msg.prevGuestContent);
        learnedIntents.add(intent);
      }

      if (msg.propertyId) {
        properties.add(msg.propertyId);
      }

      const date = new Date(msg.timestamp);
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;

      const analysis = analyzeMessage(msg.content);
      analysis.phrases.forEach(p => phrases.add(p));
      toneSum += analysis.formalityScore;

      const wordCount = analysis.wordCount;
      if (wordCount < 30) lengthDist.short++;
      else if (wordCount < 100) lengthDist.medium++;
      else lengthDist.long++;
    }

    // Identify gaps
    const gaps: TrainingGap[] = [];
    const missingIntents = allIntents.filter(i => !learnedIntents.has(i));

    for (const intent of missingIntents) {
      gaps.push({
        topic: intent,
        description: `No training examples for ${intent} questions`,
        impact: ['wifi', 'check_in', 'check_out', 'maintenance'].includes(intent) ? 'high' : 'medium',
        suggestion: `Add a template for ${intent} inquiries`,
      });
    }

    // Identify strengths
    const strengths: TrainingStrength[] = [];
    const intentCounts = new Map<string, number>();

    for (const msg of messages) {
      if (msg.prevGuestContent) {
        const intent = this.detectIntent(msg.prevGuestContent);
        intentCounts.set(intent, (intentCounts.get(intent) || 0) + 1);
      }
    }

    for (const [intent, count] of intentCounts) {
      if (count >= 10) {
        strengths.push({
          topic: intent,
          description: `${count} examples of ${intent} responses`,
          confidence: Math.min(100, 60 + count * 2),
        });
      }
    }

    // Calculate overall score
    const coverageScore = (learnedIntents.size / allIntents.length) * 100;
    const diversityScore = Math.min(100, phrases.size / 5);
    const reliabilityScore = confidenceHistory.length > 0
      ? confidenceHistory.reduce((a, b) => a + b, 0) / confidenceHistory.length
      : 50;

    const overallScore = Math.round((coverageScore + diversityScore + reliabilityScore) / 3);

    this.quality = {
      coverage: {
        intentsLearned: [...learnedIntents],
        intentsMissing: missingIntents,
        propertiesCovered: properties.size,
        dateRangeCovered: { start: minDate, end: maxDate },
      },
      diversity: {
        uniquePhrases: phrases.size,
        toneVariety: Math.round(toneSum / Math.max(messages.length, 1)),
        lengthDistribution: lengthDist,
      },
      reliability: {
        consistencyScore: reliabilityScore,
        confidenceDistribution: confidenceHistory.slice(-50),
        lowConfidenceTopics: missingIntents.slice(0, 3),
      },
      gaps,
      strengths,
      overallScore,
    };

    await this.saveQuality();
    console.log('[TrainingQuality] Analysis complete, score:', overallScore);

    return this.quality;
  }

  private detectIntent(content: string): string {
    const patterns: Record<string, RegExp> = {
      wifi: /wi.?fi|internet|password|network/i,
      check_in: /check.?in|arrive|arrival|key|code|lock/i,
      check_out: /check.?out|leave|leaving|departure/i,
      parking: /park|car|garage/i,
      maintenance: /broken|not working|fix|repair|issue/i,
      thanks: /thank|appreciate|great|wonderful/i,
      refund: /refund|money back|compensation/i,
      amenity: /pool|gym|hot tub|amenities/i,
      local_tips: /restaurant|recommend|nearby/i,
      booking: /reservation|extend|cancel|dates/i,
    };

    for (const [intent, pattern] of Object.entries(patterns)) {
      if (pattern.test(content)) {
        return intent;
      }
    }
    return 'general';
  }
}

export const trainingQualityAnalyzer = new TrainingQualityAnalyzer();

// ============================================================================
// 6. ACTIVE LEARNING - Pick between variations
// ============================================================================

export interface ActiveLearningRequest {
  id: string;
  guestMessage: string;
  variations: AIVariation[];
  selectedVariation: string | null;
  context: {
    intent: string;
    sentiment: string;
    propertyId?: string;
  };
  createdAt: number;
}

export interface AIVariation {
  id: string;
  content: string;
  style: 'short_formal' | 'short_casual' | 'long_warm' | 'medium_professional';
  label: string;
}

class ActiveLearningManager {
  private pendingRequests: ActiveLearningRequest[] = [];

  // Create an active learning request when confidence is low
  createRequest(
    guestMessage: string,
    baseResponse: string,
    context: ActiveLearningRequest['context']
  ): ActiveLearningRequest {
    const request: ActiveLearningRequest = {
      id: `al_${Date.now()}`,
      guestMessage,
      variations: this.generateVariations(baseResponse),
      selectedVariation: null,
      context,
      createdAt: Date.now(),
    };

    this.pendingRequests.push(request);
    console.log('[ActiveLearning] Created request with', request.variations.length, 'variations');

    return request;
  }

  private generateVariations(baseResponse: string): AIVariation[] {
    // In a real implementation, these would be generated by the AI
    // For now, we create style variants
    const words = baseResponse.split(/\s+/);
    const shortVersion = words.slice(0, Math.floor(words.length / 2)).join(' ') + '...';

    return [
      {
        id: 'v1',
        content: baseResponse,
        style: 'medium_professional',
        label: 'Professional',
      },
      {
        id: 'v2',
        content: shortVersion,
        style: 'short_formal',
        label: 'Brief & Formal',
      },
      {
        id: 'v3',
        content: baseResponse + ' Let me know if you need anything else! 😊',
        style: 'long_warm',
        label: 'Warm & Detailed',
      },
    ];
  }

  // Record user's selection
  async recordSelection(requestId: string, variationId: string): Promise<void> {
    const request = this.pendingRequests.find(r => r.id === requestId);
    if (request) {
      request.selectedVariation = variationId;

      const selected = request.variations.find(v => v.id === variationId);
      if (selected) {
        console.log('[ActiveLearning] User selected:', selected.style, 'for', request.context.intent);
        // This preference can be stored and used to adjust future generations
      }
    }
  }

  getPendingRequests(): ActiveLearningRequest[] {
    return this.pendingRequests;
  }
}

export const activeLearningManager = new ActiveLearningManager();

// ============================================================================
// 7. NEGATIVE EXAMPLES - What NOT to do
// ============================================================================

export interface NegativeExample {
  id: string;
  badDraft: string;
  issue: 'too_long' | 'too_short' | 'wrong_tone' | 'missing_info' | 'generic' | 'inappropriate';
  context: {
    guestMessage: string;
    guestIntent: string;
    guestSentiment: string;
  };
  betterResponse?: string;
  timestamp: number;
}

class NegativeExampleManager {
  private examples: NegativeExample[] = [];

  async loadExamples(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(NEGATIVE_EXAMPLES_KEY);
      if (data) {
        this.examples = JSON.parse(data);
      }
    } catch (error) {
      console.error('[NegativeExamples] Failed to load:', error);
    }
  }

  async saveExamples(): Promise<void> {
    try {
      // Keep only last 500 examples
      const toSave = this.examples.slice(-500);
      await AsyncStorage.setItem(NEGATIVE_EXAMPLES_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.error('[NegativeExamples] Failed to save:', error);
    }
  }

  // Add a negative example when user dismisses a draft
  async addExample(
    badDraft: string,
    issue: NegativeExample['issue'],
    context: NegativeExample['context'],
    betterResponse?: string
  ): Promise<void> {
    const example: NegativeExample = {
      id: `neg_${Date.now()}`,
      badDraft,
      issue,
      context,
      betterResponse,
      timestamp: Date.now(),
    };

    this.examples.push(example);
    await this.saveExamples();

    console.log('[NegativeExamples] Added example:', issue);
  }

  // Get negative examples to include in AI prompt
  getNegativeExamplesPrompt(): string {
    if (this.examples.length === 0) return '';

    // Group by issue type
    const byIssue = new Map<string, NegativeExample[]>();
    for (const ex of this.examples.slice(-50)) { // Recent 50
      if (!byIssue.has(ex.issue)) {
        byIssue.set(ex.issue, []);
      }
      byIssue.get(ex.issue)!.push(ex);
    }

    let prompt = '\nAVOID THESE PATTERNS (learned from host feedback):\n';

    for (const [issue, examples] of byIssue) {
      const count = examples.length;
      const recentExample = examples[examples.length - 1];

      switch (issue) {
        case 'too_long':
          prompt += `- The host prefers shorter responses (${count} times marked as too long)\n`;
          break;
        case 'too_short':
          prompt += `- The host wants more detail (${count} times marked as too brief)\n`;
          break;
        case 'wrong_tone':
          prompt += `- Match the guest's tone more carefully (${count} times wrong tone)\n`;
          break;
        case 'generic':
          prompt += `- Avoid generic responses - be specific (${count} times too generic)\n`;
          break;
        case 'missing_info':
          prompt += `- Include all requested information (${count} times missing info)\n`;
          break;
      }

      if (recentExample && recentExample.betterResponse) {
        prompt += `  Better example: "${recentExample.betterResponse.substring(0, 100)}..."\n`;
      }
    }

    return prompt;
  }

  getExamples(): NegativeExample[] {
    return this.examples;
  }

  getStats(): { total: number; byIssue: Record<string, number> } {
    const byIssue: Record<string, number> = {};
    for (const ex of this.examples) {
      byIssue[ex.issue] = (byIssue[ex.issue] || 0) + 1;
    }
    return { total: this.examples.length, byIssue };
  }
}

export const negativeExampleManager = new NegativeExampleManager();

// ============================================================================
// 8. FEW-SHOT DYNAMIC EXAMPLES
// ============================================================================

export interface FewShotExample {
  id: string;
  guestMessage: string;
  hostResponse: string;
  intent: string;
  keywords: string[];
  propertyId?: string;
  timestamp: number;
}

class FewShotIndexer {
  private examples: FewShotExample[] = [];
  private intentIndex: Map<string, string[]> = new Map(); // intent -> example IDs
  private keywordIndex: Map<string, string[]> = new Map(); // keyword -> example IDs

  async loadIndex(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(FEW_SHOT_INDEX_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.examples = parsed.examples || [];
        this.rebuildIndexes();
      }
    } catch (error) {
      console.error('[FewShotIndexer] Failed to load:', error);
    }
  }

  async saveIndex(): Promise<void> {
    try {
      // Keep last 1000 examples
      const toSave = this.examples.slice(-1000);
      await AsyncStorage.setItem(FEW_SHOT_INDEX_KEY, JSON.stringify({
        examples: toSave,
      }));
    } catch (error) {
      console.error('[FewShotIndexer] Failed to save:', error);
    }
  }

  private rebuildIndexes(): void {
    this.intentIndex.clear();
    this.keywordIndex.clear();

    for (const ex of this.examples) {
      // Intent index
      if (!this.intentIndex.has(ex.intent)) {
        this.intentIndex.set(ex.intent, []);
      }
      this.intentIndex.get(ex.intent)!.push(ex.id);

      // Keyword index
      for (const keyword of ex.keywords) {
        if (!this.keywordIndex.has(keyword)) {
          this.keywordIndex.set(keyword, []);
        }
        this.keywordIndex.get(keyword)!.push(ex.id);
      }
    }
  }

  // Add a new example to the index
  async addExample(guestMessage: string, hostResponse: string, propertyId?: string): Promise<void> {
    const intent = this.detectIntent(guestMessage);
    const keywords = this.extractKeywords(guestMessage);

    const example: FewShotExample = {
      id: `fs_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      guestMessage,
      hostResponse,
      intent,
      keywords,
      propertyId,
      timestamp: Date.now(),
    };

    this.examples.push(example);

    // Update indexes
    if (!this.intentIndex.has(intent)) {
      this.intentIndex.set(intent, []);
    }
    this.intentIndex.get(intent)!.push(example.id);

    for (const keyword of keywords) {
      if (!this.keywordIndex.has(keyword)) {
        this.keywordIndex.set(keyword, []);
      }
      this.keywordIndex.get(keyword)!.push(example.id);
    }

    // Save periodically
    if (this.examples.length % 10 === 0) {
      await this.saveIndex();
    }
  }

  // Find most relevant examples for a guest message
  findRelevantExamples(guestMessage: string, propertyId?: string, limit: number = 3): FewShotExample[] {
    const intent = this.detectIntent(guestMessage);
    const keywords = this.extractKeywords(guestMessage);

    // Score each example
    const scored: Array<{ example: FewShotExample; score: number }> = [];

    for (const example of this.examples) {
      let score = 0;

      // Intent match (highest weight)
      if (example.intent === intent) {
        score += 50;
      }

      // Keyword overlap
      const overlap = example.keywords.filter(k => keywords.includes(k)).length;
      score += overlap * 10;

      // Property match bonus
      if (propertyId && example.propertyId === propertyId) {
        score += 20;
      }

      // Recency bonus
      const ageInDays = (Date.now() - example.timestamp) / (1000 * 60 * 60 * 24);
      if (ageInDays < 30) score += 10;
      else if (ageInDays < 90) score += 5;

      if (score > 0) {
        scored.push({ example, score });
      }
    }

    // Sort by score and return top examples
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.example);
  }

  // Generate prompt with few-shot examples
  getFewShotPrompt(guestMessage: string, propertyId?: string): string {
    const examples = this.findRelevantExamples(guestMessage, propertyId, 3);

    if (examples.length === 0) return '';

    let prompt = '\nRELEVANT EXAMPLES from your message history:\n';

    for (let i = 0; i < examples.length; i++) {
      const ex = examples[i];
      prompt += `\nExample ${i + 1}:\n`;
      prompt += `Guest: "${ex.guestMessage.substring(0, 150)}${ex.guestMessage.length > 150 ? '...' : ''}"\n`;
      prompt += `Your response: "${ex.hostResponse.substring(0, 200)}${ex.hostResponse.length > 200 ? '...' : ''}"\n`;
    }

    prompt += '\nUse these examples to guide your tone, style, and level of detail.\n';

    return prompt;
  }

  private detectIntent(content: string): string {
    const patterns: Record<string, RegExp> = {
      wifi: /wi.?fi|internet|password|network/i,
      check_in: /check.?in|arrive|arrival|key|code|lock/i,
      check_out: /check.?out|leave|leaving|departure/i,
      parking: /park|car|garage/i,
      maintenance: /broken|not working|fix|repair|issue|problem/i,
      thanks: /thank|appreciate|great|wonderful/i,
    };

    for (const [intent, pattern] of Object.entries(patterns)) {
      if (pattern.test(content)) return intent;
    }
    return 'general';
  }

  private extractKeywords(content: string): string[] {
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'i', 'we', 'you', 'it', 'my', 'your']);

    return content.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length >= 3 && !stopWords.has(word))
      .slice(0, 10);
  }

  getStats(): { total: number; byIntent: Record<string, number> } {
    const byIntent: Record<string, number> = {};
    for (const ex of this.examples) {
      byIntent[ex.intent] = (byIntent[ex.intent] || 0) + 1;
    }
    return { total: this.examples.length, byIntent };
  }
}

export const fewShotIndexer = new FewShotIndexer();

// ============================================================================
// 9. CONVERSATION FLOW LEARNING
// ============================================================================

export interface ConversationFlow {
  id: string;
  guestPattern: string[];  // Sequence of guest intents
  hostPattern: string[];   // Sequence of host response types
  typicalTurns: number;
  commonEnding: string;
  propertyId?: string;
  count: number;  // How many times this flow has been seen
}

class ConversationFlowLearner {
  private flows: ConversationFlow[] = [];

  async loadFlows(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(CONVERSATION_FLOWS_KEY);
      if (data) {
        this.flows = JSON.parse(data);
      }
    } catch (error) {
      console.error('[ConversationFlows] Failed to load:', error);
    }
  }

  async saveFlows(): Promise<void> {
    try {
      await AsyncStorage.setItem(CONVERSATION_FLOWS_KEY, JSON.stringify(this.flows.slice(0, 100)));
    } catch (error) {
      console.error('[ConversationFlows] Failed to save:', error);
    }
  }

  // Learn flow from a conversation
  async learnFromConversation(conversation: Conversation): Promise<void> {
    const messages = conversation.messages.filter(m => m.sender !== 'ai_draft');
    if (messages.length < 4) return; // Need at least 2 exchanges

    const guestPattern: string[] = [];
    const hostPattern: string[] = [];

    for (const msg of messages) {
      const intent = this.detectIntent(msg.content);
      if (msg.sender === 'guest') {
        guestPattern.push(intent);
      } else {
        hostPattern.push(intent);
      }
    }

    // Find or create matching flow
    const patternKey = guestPattern.join('->');
    let existingFlow = this.flows.find(f => f.guestPattern.join('->') === patternKey);

    if (existingFlow) {
      existingFlow.count++;
      existingFlow.typicalTurns = Math.round((existingFlow.typicalTurns + messages.length / 2) / 2);
    } else {
      // Detect common ending
      const lastGuestMsg = messages.filter(m => m.sender === 'guest').pop();
      const commonEnding = lastGuestMsg?.content.includes('thank') ? 'thanks' : 'resolved';

      this.flows.push({
        id: `flow_${Date.now()}`,
        guestPattern,
        hostPattern,
        typicalTurns: Math.ceil(messages.length / 2),
        commonEnding,
        propertyId: conversation.property.id,
        count: 1,
      });
    }

    await this.saveFlows();
  }

  // Predict likely followup based on current conversation
  predictFollowup(conversation: Conversation): { likelyTopics: string[]; confidence: number } | null {
    const messages = conversation.messages.filter(m => m.sender !== 'ai_draft');
    if (messages.length < 2) return null;

    const currentPattern: string[] = [];
    for (const msg of messages) {
      if (msg.sender === 'guest') {
        currentPattern.push(this.detectIntent(msg.content));
      }
    }

    // Find flows that start with this pattern
    const matchingFlows = this.flows.filter(flow => {
      if (flow.guestPattern.length <= currentPattern.length) return false;

      for (let i = 0; i < currentPattern.length; i++) {
        if (flow.guestPattern[i] !== currentPattern[i]) return false;
      }
      return true;
    });

    if (matchingFlows.length === 0) return null;

    // Get the most common next topics
    const nextTopics = new Map<string, number>();
    for (const flow of matchingFlows) {
      const nextTopic = flow.guestPattern[currentPattern.length];
      if (nextTopic) {
        nextTopics.set(nextTopic, (nextTopics.get(nextTopic) || 0) + flow.count);
      }
    }

    const sorted = [...nextTopics.entries()].sort((a, b) => b[1] - a[1]);
    const totalWeight = sorted.reduce((sum, [_, count]) => sum + count, 0);

    return {
      likelyTopics: sorted.slice(0, 3).map(([topic]) => topic),
      confidence: Math.min(90, Math.round((sorted[0]?.[1] || 0) / totalWeight * 100)),
    };
  }

  private detectIntent(content: string): string {
    const patterns: Record<string, RegExp> = {
      wifi: /wi.?fi|internet|password|network/i,
      check_in: /check.?in|arrive|arrival|key|code/i,
      check_out: /check.?out|leave|leaving|departure/i,
      parking: /park|car|garage/i,
      issue: /broken|not working|fix|repair|problem/i,
      thanks: /thank|appreciate|great|wonderful/i,
      question: /where|how|what|when|can I/i,
    };

    for (const [intent, pattern] of Object.entries(patterns)) {
      if (pattern.test(content)) return intent;
    }
    return 'general';
  }

  getFlows(): ConversationFlow[] {
    return this.flows;
  }

  getCommonFlows(limit: number = 10): ConversationFlow[] {
    return [...this.flows]
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}

export const conversationFlowLearner = new ConversationFlowLearner();

// ============================================================================
// 10. GUEST MEMORY - Remember returning guests
// ============================================================================

export interface GuestMemory {
  guestHash: string;  // Privacy-safe hash of email/phone
  properties: string[];
  conversationHistory: Array<{
    date: Date;
    property: string;
    topics: string[];
    sentiment: string;
    specialRequests: string[];
  }>;
  preferences: {
    preferredTone: 'formal' | 'casual' | 'warm' | null;
    typicalQuestions: string[];
    hasChildren: boolean;
    hasPets: boolean;
    isReturning: boolean;
  };
  lastSeen: number;
}

class GuestMemoryManager {
  private memories: Map<string, GuestMemory> = new Map();

  async loadMemories(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(GUEST_MEMORY_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.memories = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error('[GuestMemory] Failed to load:', error);
    }
  }

  async saveMemories(): Promise<void> {
    try {
      const obj = Object.fromEntries(this.memories);
      await AsyncStorage.setItem(GUEST_MEMORY_KEY, JSON.stringify(obj));
    } catch (error) {
      console.error('[GuestMemory] Failed to save:', error);
    }
  }

  // Create privacy-safe hash of guest identifier
  private hashGuest(email?: string, phone?: string): string {
    const identifier = email || phone || '';
    // Simple hash for demo - in production use a proper hash function
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
      const char = identifier.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `guest_${Math.abs(hash).toString(36)}`;
  }

  // Record a conversation for a guest
  async recordConversation(
    email: string | undefined,
    phone: string | undefined,
    conversation: Conversation
  ): Promise<void> {
    if (!email && !phone) return;

    const guestHash = this.hashGuest(email, phone);
    let memory = this.memories.get(guestHash);

    if (!memory) {
      memory = {
        guestHash,
        properties: [],
        conversationHistory: [],
        preferences: {
          preferredTone: null,
          typicalQuestions: [],
          hasChildren: false,
          hasPets: false,
          isReturning: false,
        },
        lastSeen: Date.now(),
      };
    }

    // Update properties list
    if (!memory.properties.includes(conversation.property.id)) {
      memory.properties.push(conversation.property.id);
    }

    // Mark as returning if multiple properties
    if (memory.properties.length > 1 || memory.conversationHistory.length > 0) {
      memory.preferences.isReturning = true;
    }

    // Extract conversation summary
    const topics: string[] = [];
    const specialRequests: string[] = [];
    let sentiment = 'neutral';

    for (const msg of conversation.messages) {
      if (msg.sender === 'guest') {
        const intent = this.detectIntent(msg.content);
        if (!topics.includes(intent)) {
          topics.push(intent);
        }

        // Detect special requests
        if (/early.*check|earlier/i.test(msg.content)) {
          specialRequests.push('early_checkin');
        }
        if (/late.*check|later/i.test(msg.content)) {
          specialRequests.push('late_checkout');
        }
        if (/kid|child|baby|crib/i.test(msg.content)) {
          memory.preferences.hasChildren = true;
        }
        if (/pet|dog|cat/i.test(msg.content)) {
          memory.preferences.hasPets = true;
        }

        // Track sentiment
        if (/frustrated|disappointed|upset|angry/i.test(msg.content)) {
          sentiment = 'negative';
        } else if (/thank|great|wonderful|amazing/i.test(msg.content)) {
          sentiment = 'positive';
        }
      }
    }

    // Add to history
    memory.conversationHistory.push({
      date: new Date(),
      property: conversation.property.name,
      topics,
      sentiment,
      specialRequests,
    });

    // Update typical questions
    for (const topic of topics) {
      if (!memory.preferences.typicalQuestions.includes(topic)) {
        memory.preferences.typicalQuestions.push(topic);
      }
    }

    memory.lastSeen = Date.now();
    this.memories.set(guestHash, memory);
    await this.saveMemories();

    console.log('[GuestMemory] Recorded conversation for', guestHash, '- returning:', memory.preferences.isReturning);
  }

  // Get memory for a guest
  getGuestMemory(email?: string, phone?: string): GuestMemory | null {
    if (!email && !phone) return null;
    const guestHash = this.hashGuest(email, phone);
    return this.memories.get(guestHash) || null;
  }

  // Get AI prompt enhancement based on guest memory
  getGuestMemoryPrompt(email?: string, phone?: string): string {
    const memory = this.getGuestMemory(email, phone);
    if (!memory) return '';

    let prompt = '\nGUEST MEMORY (returning guest):\n';

    if (memory.preferences.isReturning) {
      prompt += `- This guest has stayed at ${memory.properties.length} of your properties before\n`;
    }

    if (memory.conversationHistory.length > 0) {
      const lastStay = memory.conversationHistory[memory.conversationHistory.length - 1];
      prompt += `- Last stayed at: ${lastStay.property} (${lastStay.sentiment} experience)\n`;
    }

    if (memory.preferences.hasChildren) {
      prompt += `- Has children (traveled with kids before)\n`;
    }

    if (memory.preferences.hasPets) {
      prompt += `- Has pets (traveled with pets before)\n`;
    }

    if (memory.preferences.typicalQuestions.length > 0) {
      prompt += `- Usually asks about: ${memory.preferences.typicalQuestions.slice(0, 3).join(', ')}\n`;
    }

    prompt += '\nUse a warm, familiar tone since this is a returning guest. You might say "Welcome back!" or reference their past stays.\n';

    return prompt;
  }

  private detectIntent(content: string): string {
    const patterns: Record<string, RegExp> = {
      wifi: /wi.?fi|internet|password/i,
      check_in: /check.?in|arrive|arrival|key|code/i,
      check_out: /check.?out|leave|leaving/i,
      parking: /park|car|garage/i,
      amenities: /pool|gym|hot tub/i,
    };

    for (const [intent, pattern] of Object.entries(patterns)) {
      if (pattern.test(content)) return intent;
    }
    return 'general';
  }

  getAllMemories(): GuestMemory[] {
    return [...this.memories.values()];
  }

  getReturningGuestsCount(): number {
    return [...this.memories.values()].filter(m => m.preferences.isReturning).length;
  }
}

export const guestMemoryManager = new GuestMemoryManager();

// ============================================================================
// INITIALIZATION - Load all managers on import
// ============================================================================

export async function initializeAdvancedTraining(): Promise<void> {
  console.log('[AdvancedTraining] Initializing all managers...');

  await Promise.all([
    incrementalTrainer.loadQueue(),
    multiPassTrainer.loadState(),
    propertyLexiconManager.loadLexicons(),
    temporalWeightManager.loadWeights(),
    trainingQualityAnalyzer.loadQuality(),
    negativeExampleManager.loadExamples(),
    fewShotIndexer.loadIndex(),
    conversationFlowLearner.loadFlows(),
    guestMemoryManager.loadMemories(),
  ]);

  console.log('[AdvancedTraining] All managers initialized');
}

// Auto-initialize
initializeAdvancedTraining().catch(console.error);

// ============================================================================
// COMBINED PROMPT BUILDER - Use all learning systems
// ============================================================================

export function buildAdvancedAIPrompt(
  guestMessage: string,
  propertyId?: string,
  guestEmail?: string,
  guestPhone?: string
): string {
  let additionalPrompt = '';

  // 1. Property-specific lexicon
  additionalPrompt += propertyLexiconManager.getLexiconPrompt(propertyId || '');

  // 2. Few-shot examples
  additionalPrompt += fewShotIndexer.getFewShotPrompt(guestMessage, propertyId);

  // 3. Negative examples (what to avoid)
  additionalPrompt += negativeExampleManager.getNegativeExamplesPrompt();

  // 4. Guest memory (returning guests)
  additionalPrompt += guestMemoryManager.getGuestMemoryPrompt(guestEmail, guestPhone);

  return additionalPrompt;
}
