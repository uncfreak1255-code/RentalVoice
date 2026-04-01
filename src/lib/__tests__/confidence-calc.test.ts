/**
 * Characterization tests for calculateConfidence() in ai-enhanced.ts.
 * Captures current behavior of:
 *   - Step-function styleMatch gates at sample boundaries (0, 5, 10, 20, 50, 100+)
 *   - Sentiment-based scoring (urgent, negative, angry)
 *   - Knowledge availability scoring
 *   - Topic coverage with sensitive-topic penalty
 *   - Safety check (money mentioned without knowledge)
 *   - Overall weighted calculation (25/25/20/15/15)
 *   - Auto-send blocking conditions
 *
 * These are characterization tests — they lock in CURRENT behavior as a
 * regression safety net before the confidence curves are modified.
 */

// Mock AsyncStorage (transitive dep via store → ai-enhanced)
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn().mockResolvedValue(undefined),
    getItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(undefined),
    multiGet: jest.fn().mockResolvedValue([]),
    multiSet: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock expo-secure-store (transitive dep via store)
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock account-scoped-storage (transitive dep via advanced-training)
jest.mock('../account-scoped-storage', () => ({
  scopedKey: (key: string) => key,
}));

// Mock learning-sync (network dependency in advanced-training)
jest.mock('../learning-sync', () => ({
  syncLearningToCloud: jest.fn().mockResolvedValue(undefined),
}));

// Mock google-auth (transitive dep via ai-keys — pulls in expo-auth-session native modules)
jest.mock('../google-auth', () => ({
  promptGoogleSignIn: jest.fn().mockResolvedValue(null),
  getGoogleAuthTokens: jest.fn().mockReturnValue(null),
  clearGoogleAuth: jest.fn().mockResolvedValue(undefined),
}));

// Mock ai-keys to avoid pulling in google-auth and expo-auth-session transitives
jest.mock('../ai-keys', () => ({
  getAIKey: jest.fn().mockReturnValue(null),
  getProviderOrder: jest.fn().mockReturnValue(['google']),
  isProviderEnabled: jest.fn().mockReturnValue(true),
  getSelectedModel: jest.fn().mockReturnValue('gemini-2.0-flash'),
  getGoogleAuthMethod: jest.fn().mockReturnValue('api_key'),
  AI_MODELS: {},
}));

// Mock config (transitive dep via ai-enhanced)
jest.mock('../config', () => ({
  API_BASE_URL: 'http://localhost:3000',
  APP_MODE: 'personal',
  SERVER_AI_ENABLED: false,
}));

// Mock ai-usage-limiter (transitive dep via ai-enhanced)
jest.mock('../ai-usage-limiter', () => ({
  canGenerateDraft: jest.fn().mockResolvedValue(true),
  recordDraftGeneration: jest.fn().mockResolvedValue(undefined),
}));

// Mock semantic-voice-index (transitive dep via ai-enhanced)
jest.mock('../semantic-voice-index', () => ({
  querySemanticExamples: jest.fn().mockResolvedValue([]),
  formatAsPrompt: jest.fn().mockReturnValue(''),
}));

// Mock supermemory-service (transitive dep)
jest.mock('../supermemory-service', () => ({
  supermemory: { search: jest.fn().mockResolvedValue([]) },
}));

import {
  calculateConfidence,
  type SentimentAnalysis,
  type DetectedTopic,
  type ConfidenceScore,
} from '../ai-enhanced';
import type { PropertyKnowledge, HostStyleProfile } from '../store';

// ── Helpers ──

function makeSentiment(overrides: Partial<SentimentAnalysis> = {}): SentimentAnalysis {
  return {
    primary: 'neutral',
    intensity: 30,
    emotions: [],
    requiresEscalation: false,
    ...overrides,
  };
}

function makeTopic(overrides: Partial<DetectedTopic> = {}): DetectedTopic {
  return {
    topic: 'check-in',
    intent: 'check_in_request',
    priority: 1,
    hasAnswer: true,
    ...overrides,
  };
}

function makeStyleProfile(overrides: Partial<HostStyleProfile> = {}): HostStyleProfile {
  return {
    propertyId: 'global',
    formalityLevel: 50,
    warmthLevel: 60,
    commonGreetings: ['Hi'],
    commonSignoffs: ['Thanks'],
    usesEmojis: false,
    emojiFrequency: 0,
    averageResponseLength: 80,
    commonPhrases: [],
    avoidedWords: [],
    intentPatterns: {},
    capsEmphasisWords: [],
    pronounPreference: 'i',
    pronounWeRatio: 20,
    exclamationStyle: 'single',
    usesGuestNames: false,
    guestNameFrequency: 0,
    forwardInvitations: [],
    isTemplateMessage: false,
    samplesAnalyzed: 0,
    lastUpdated: new Date(),
    ...overrides,
  };
}

function makeKnowledge(): PropertyKnowledge {
  return {
    propertyId: 'prop-1',
    propertyType: 'vacation_rental',
    wifiPassword: 'beach123',
    checkInTime: '3pm',
    checkOutTime: '11am',
    houseRules: 'No parties',
  } as PropertyKnowledge;
}

// ============================================================================
// styleMatch step-function boundaries
// ============================================================================

describe('calculateConfidence — styleMatch step function', () => {
  // Base case: no profile at all
  it('styleMatch = 40 when no styleProfile provided', () => {
    const result = calculateConfidence(makeSentiment(), [makeTopic()]);
    expect(result.factors.styleMatch).toBe(40);
  });

  // 0 samples analyzed
  it('styleMatch = 40 when samplesAnalyzed = 0', () => {
    const profile = makeStyleProfile({ samplesAnalyzed: 0 });
    const result = calculateConfidence(makeSentiment(), [makeTopic()], undefined, profile);
    expect(result.factors.styleMatch).toBe(40);
  });

  // 1 sample (> 0 but <= 5)
  it('styleMatch = 45 when samplesAnalyzed = 1', () => {
    const profile = makeStyleProfile({ samplesAnalyzed: 1 });
    const result = calculateConfidence(makeSentiment(), [makeTopic()], undefined, profile);
    expect(result.factors.styleMatch).toBe(45);
  });

  // 5 samples (> 0 but <= 5)
  it('styleMatch = 45 when samplesAnalyzed = 5', () => {
    const profile = makeStyleProfile({ samplesAnalyzed: 5 });
    const result = calculateConfidence(makeSentiment(), [makeTopic()], undefined, profile);
    expect(result.factors.styleMatch).toBe(45);
  });

  // 6 samples (> 5 but <= 10)
  it('styleMatch = 58 when samplesAnalyzed = 6', () => {
    const profile = makeStyleProfile({ samplesAnalyzed: 6 });
    const result = calculateConfidence(makeSentiment(), [makeTopic()], undefined, profile);
    expect(result.factors.styleMatch).toBe(58);
  });

  // 10 samples (> 5 but <= 10)
  it('styleMatch = 58 when samplesAnalyzed = 10', () => {
    const profile = makeStyleProfile({ samplesAnalyzed: 10 });
    const result = calculateConfidence(makeSentiment(), [makeTopic()], undefined, profile);
    expect(result.factors.styleMatch).toBe(58);
  });

  // 11 samples (> 10 but <= 20)
  it('styleMatch = 70 when samplesAnalyzed = 11', () => {
    const profile = makeStyleProfile({ samplesAnalyzed: 11 });
    const result = calculateConfidence(makeSentiment(), [makeTopic()], undefined, profile);
    expect(result.factors.styleMatch).toBe(70);
  });

  // 20 samples (> 10 but <= 20)
  it('styleMatch = 70 when samplesAnalyzed = 20', () => {
    const profile = makeStyleProfile({ samplesAnalyzed: 20 });
    const result = calculateConfidence(makeSentiment(), [makeTopic()], undefined, profile);
    expect(result.factors.styleMatch).toBe(70);
  });

  // 21 samples (> 20 but <= 50)
  it('styleMatch = 82 when samplesAnalyzed = 21', () => {
    const profile = makeStyleProfile({ samplesAnalyzed: 21 });
    const result = calculateConfidence(makeSentiment(), [makeTopic()], undefined, profile);
    expect(result.factors.styleMatch).toBe(82);
  });

  // 50 samples (> 20 but <= 50)
  it('styleMatch = 82 when samplesAnalyzed = 50', () => {
    const profile = makeStyleProfile({ samplesAnalyzed: 50 });
    const result = calculateConfidence(makeSentiment(), [makeTopic()], undefined, profile);
    expect(result.factors.styleMatch).toBe(82);
  });

  // 51 samples (> 50 but <= 100)
  it('styleMatch = 90 when samplesAnalyzed = 51', () => {
    const profile = makeStyleProfile({ samplesAnalyzed: 51 });
    const result = calculateConfidence(makeSentiment(), [makeTopic()], undefined, profile);
    expect(result.factors.styleMatch).toBe(90);
  });

  // 100 samples (> 50 but <= 100)
  it('styleMatch = 90 when samplesAnalyzed = 100', () => {
    const profile = makeStyleProfile({ samplesAnalyzed: 100 });
    const result = calculateConfidence(makeSentiment(), [makeTopic()], undefined, profile);
    expect(result.factors.styleMatch).toBe(90);
  });

  // 101 samples (> 100)
  it('styleMatch = 95 when samplesAnalyzed = 101', () => {
    const profile = makeStyleProfile({ samplesAnalyzed: 101 });
    const result = calculateConfidence(makeSentiment(), [makeTopic()], undefined, profile);
    expect(result.factors.styleMatch).toBe(95);
  });

  // 500 samples (> 100)
  it('styleMatch = 95 when samplesAnalyzed = 500', () => {
    const profile = makeStyleProfile({ samplesAnalyzed: 500 });
    const result = calculateConfidence(makeSentiment(), [makeTopic()], undefined, profile);
    expect(result.factors.styleMatch).toBe(95);
  });
});

// ============================================================================
// Sentiment scoring
// ============================================================================

describe('calculateConfidence — sentiment scoring', () => {
  it('sentimentMatch = 85 for neutral sentiment', () => {
    const result = calculateConfidence(makeSentiment({ primary: 'neutral' }), [makeTopic()]);
    expect(result.factors.sentimentMatch).toBe(85);
  });

  it('sentimentMatch = 85 for positive sentiment', () => {
    const result = calculateConfidence(makeSentiment({ primary: 'positive' }), [makeTopic()]);
    expect(result.factors.sentimentMatch).toBe(85);
  });

  it('sentimentMatch = 50 for urgent sentiment and blocks auto-send', () => {
    const result = calculateConfidence(makeSentiment({ primary: 'urgent' }), [makeTopic()]);
    expect(result.factors.sentimentMatch).toBe(50);
    expect(result.blockedForAutoSend).toBe(true);
    expect(result.blockReason).toContain('Urgent');
    expect(result.warnings).toContainEqual(expect.stringContaining('Urgent'));
  });

  it('sentimentMatch = 60 for high-intensity negative sentiment', () => {
    const result = calculateConfidence(
      makeSentiment({ primary: 'negative', intensity: 70 }),
      [makeTopic()],
    );
    expect(result.factors.sentimentMatch).toBe(60);
    expect(result.warnings).toContainEqual(expect.stringContaining('upset'));
  });

  it('sentimentMatch = 85 for low-intensity negative sentiment (< 70)', () => {
    const result = calculateConfidence(
      makeSentiment({ primary: 'negative', intensity: 50 }),
      [makeTopic()],
    );
    // Low-intensity negative doesn't trigger the >= 70 branch
    expect(result.factors.sentimentMatch).toBe(85);
  });

  it('sentimentMatch = 55 when guest is angry and blocks auto-send', () => {
    const result = calculateConfidence(
      makeSentiment({ emotions: ['angry'] }),
      [makeTopic()],
    );
    expect(result.factors.sentimentMatch).toBe(55);
    expect(result.blockedForAutoSend).toBe(true);
    expect(result.blockReason).toContain('Angry');
  });

  it('urgent takes priority over angry (sentimentMatch = 50)', () => {
    // When primary is urgent, it hits the urgent branch first regardless of emotions
    const result = calculateConfidence(
      makeSentiment({ primary: 'urgent', emotions: ['angry'] }),
      [makeTopic()],
    );
    expect(result.factors.sentimentMatch).toBe(50);
  });
});

// ============================================================================
// Knowledge availability scoring
// ============================================================================

describe('calculateConfidence — knowledge availability', () => {
  it('knowledgeAvailable = 100 when all topics have answers', () => {
    const topics = [makeTopic({ hasAnswer: true }), makeTopic({ hasAnswer: true })];
    const result = calculateConfidence(makeSentiment(), topics);
    expect(result.factors.knowledgeAvailable).toBe(100);
  });

  it('knowledgeAvailable = 0 when no topics have answers', () => {
    const topics = [makeTopic({ hasAnswer: false }), makeTopic({ hasAnswer: false })];
    const result = calculateConfidence(makeSentiment(), topics);
    expect(result.factors.knowledgeAvailable).toBe(0);
    expect(result.warnings).toContainEqual(expect.stringContaining('Limited knowledge'));
  });

  it('knowledgeAvailable = 50 when half have answers', () => {
    const topics = [makeTopic({ hasAnswer: true }), makeTopic({ hasAnswer: false })];
    const result = calculateConfidence(makeSentiment(), topics);
    expect(result.factors.knowledgeAvailable).toBe(50);
  });

  it('knowledgeAvailable = 70 when no topics at all', () => {
    const result = calculateConfidence(makeSentiment(), []);
    expect(result.factors.knowledgeAvailable).toBe(70);
  });
});

// ============================================================================
// Topic coverage scoring
// ============================================================================

describe('calculateConfidence — topic coverage', () => {
  it('topicCoverage = 75 for 1-3 non-sensitive topics', () => {
    const topics = [makeTopic(), makeTopic(), makeTopic()];
    const result = calculateConfidence(makeSentiment(), topics);
    expect(result.factors.topicCoverage).toBe(75);
  });

  it('topicCoverage = 60 for > 3 topics', () => {
    const topics = [makeTopic(), makeTopic(), makeTopic(), makeTopic()];
    const result = calculateConfidence(makeSentiment(), topics);
    expect(result.factors.topicCoverage).toBe(60);
    expect(result.warnings).toContainEqual(expect.stringContaining('Complex message'));
  });

  it('topicCoverage penalized by 15 for sensitive topic (refund_request)', () => {
    const topics = [makeTopic({ intent: 'refund_request' })];
    const result = calculateConfidence(makeSentiment(), topics);
    expect(result.factors.topicCoverage).toBe(75 - 15); // 60
    expect(result.blockedForAutoSend).toBe(true);
    expect(result.warnings).toContainEqual(expect.stringContaining('sensitive'));
  });

  it('topicCoverage penalized for noise_complaint', () => {
    const topics = [makeTopic({ intent: 'noise_complaint' })];
    const result = calculateConfidence(makeSentiment(), topics);
    expect(result.factors.topicCoverage).toBe(60);
  });

  it('topicCoverage penalized for maintenance_issue', () => {
    const topics = [makeTopic({ intent: 'maintenance_issue' })];
    const result = calculateConfidence(makeSentiment(), topics);
    expect(result.factors.topicCoverage).toBe(60);
  });

  it('both > 3 topics AND sensitive topic stack penalties', () => {
    const topics = [
      makeTopic(), makeTopic(), makeTopic(),
      makeTopic({ intent: 'refund_request' }),
    ];
    const result = calculateConfidence(makeSentiment(), topics);
    // 60 (>3 topics) - 15 (sensitive) = 45
    expect(result.factors.topicCoverage).toBe(45);
  });
});

// ============================================================================
// Safety check scoring
// ============================================================================

describe('calculateConfidence — safety check', () => {
  it('safetyCheck = 80 by default', () => {
    const result = calculateConfidence(makeSentiment(), [makeTopic()]);
    expect(result.factors.safetyCheck).toBe(80);
  });

  it('safetyCheck = 60 when money mentioned without knowledge', () => {
    const topics = [makeTopic({ topic: 'refund of $50' })];
    const result = calculateConfidence(makeSentiment(), topics, undefined);
    expect(result.factors.safetyCheck).toBe(60);
    expect(result.blockedForAutoSend).toBe(true);
    expect(result.warnings).toContainEqual(expect.stringContaining('Money'));
  });

  it('safetyCheck = 80 when money mentioned WITH knowledge', () => {
    const topics = [makeTopic({ topic: 'refund of $50' })];
    const knowledge = makeKnowledge();
    const result = calculateConfidence(makeSentiment(), topics, knowledge);
    expect(result.factors.safetyCheck).toBe(80);
  });

  it('detects money keywords: refund, payment, charge, fee, price, cost', () => {
    for (const keyword of ['refund', 'payment', 'charge', 'fee', 'price', 'cost']) {
      const topics = [makeTopic({ topic: `question about ${keyword}` })];
      const result = calculateConfidence(makeSentiment(), topics, undefined);
      expect(result.factors.safetyCheck).toBe(60);
    }
  });
});

// ============================================================================
// Overall weighted calculation
// ============================================================================

describe('calculateConfidence — overall score', () => {
  it('weights are 25/25/20/15/15 (sentiment/knowledge/topic/style/safety)', () => {
    // Set up conditions where each factor has a known value:
    // neutral sentiment → sentimentMatch = 85
    // all topics answered → knowledgeAvailable = 100
    // 1 topic → topicCoverage = 75
    // no profile → styleMatch = 40
    // no money → safetyCheck = 80
    const result = calculateConfidence(makeSentiment(), [makeTopic()]);
    const expected = Math.round(
      85 * 0.25 + 100 * 0.25 + 75 * 0.2 + 40 * 0.15 + 80 * 0.15,
    );
    expect(result.overall).toBe(expected);
  });

  it('overall is rounded', () => {
    const result = calculateConfidence(makeSentiment(), [makeTopic()]);
    expect(result.overall).toBe(Math.round(result.overall));
  });

  it('computes correct overall with a trained style profile', () => {
    const profile = makeStyleProfile({ samplesAnalyzed: 101 });
    const topics = [makeTopic({ hasAnswer: true })];
    const result = calculateConfidence(makeSentiment(), topics, undefined, profile);

    // sentimentMatch = 85, knowledgeAvailable = 100, topicCoverage = 75,
    // styleMatch = 95 (101 samples), safetyCheck = 80
    const expected = Math.round(
      85 * 0.25 + 100 * 0.25 + 75 * 0.2 + 95 * 0.15 + 80 * 0.15,
    );
    expect(result.overall).toBe(expected);
  });

  it('computes correct overall with urgent + money + no knowledge', () => {
    const topics = [makeTopic({ topic: 'refund request', hasAnswer: false, intent: 'refund_request' })];
    const result = calculateConfidence(
      makeSentiment({ primary: 'urgent' }),
      topics,
      undefined,
    );

    // sentimentMatch = 50, knowledgeAvailable = 0, topicCoverage = 75 - 15 = 60,
    // styleMatch = 40, safetyCheck = 60
    const expected = Math.round(
      50 * 0.25 + 0 * 0.25 + 60 * 0.2 + 40 * 0.15 + 60 * 0.15,
    );
    expect(result.overall).toBe(expected);
  });
});

// ============================================================================
// Auto-send blocking conditions
// ============================================================================

describe('calculateConfidence — auto-send blocking', () => {
  it('not blocked for simple neutral message', () => {
    const result = calculateConfidence(makeSentiment(), [makeTopic()]);
    expect(result.blockedForAutoSend).toBe(false);
    expect(result.blockReason).toBeUndefined();
  });

  it('blocked for urgent sentiment', () => {
    const result = calculateConfidence(makeSentiment({ primary: 'urgent' }), [makeTopic()]);
    expect(result.blockedForAutoSend).toBe(true);
  });

  it('blocked for angry emotion', () => {
    const result = calculateConfidence(makeSentiment({ emotions: ['angry'] }), [makeTopic()]);
    expect(result.blockedForAutoSend).toBe(true);
  });

  it('blocked for sensitive topic', () => {
    const result = calculateConfidence(makeSentiment(), [makeTopic({ intent: 'refund_request' })]);
    expect(result.blockedForAutoSend).toBe(true);
  });

  it('blocked for money without knowledge', () => {
    const result = calculateConfidence(makeSentiment(), [makeTopic({ topic: 'charge question' })]);
    expect(result.blockedForAutoSend).toBe(true);
  });

  it('multiple block reasons — first one wins', () => {
    const result = calculateConfidence(
      makeSentiment({ primary: 'urgent' }),
      [makeTopic({ intent: 'refund_request', topic: '$100 refund' })],
    );
    expect(result.blockedForAutoSend).toBe(true);
    // Urgent is checked first → its block reason should be set
    expect(result.blockReason).toContain('Urgent');
  });
});

// ============================================================================
// Warnings accumulation
// ============================================================================

describe('calculateConfidence — warnings', () => {
  it('collects multiple warnings for complex situations', () => {
    const topics = [
      makeTopic({ hasAnswer: false }),
      makeTopic({ hasAnswer: false }),
      makeTopic({ hasAnswer: false }),
      makeTopic({ intent: 'refund_request', hasAnswer: false, topic: '$50 refund' }),
    ];
    const result = calculateConfidence(
      makeSentiment({ primary: 'negative', intensity: 75 }),
      topics,
      undefined,
    );

    // Should have warnings for: upset guest, limited knowledge, complex message,
    // sensitive topic, money without knowledge
    expect(result.warnings.length).toBeGreaterThanOrEqual(4);
  });

  it('no warnings for ideal conditions', () => {
    const profile = makeStyleProfile({ samplesAnalyzed: 200 });
    const knowledge = makeKnowledge();
    const result = calculateConfidence(
      makeSentiment(),
      [makeTopic()],
      knowledge,
      profile,
    );
    expect(result.warnings).toEqual([]);
  });
});
