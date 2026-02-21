/**
 * Tests for ai-intelligence.ts pure computation functions.
 * Covers: createCalibrationEntry, computeCalibrationSummary,
 * analyzeReplyDelta, detectConversationFlows, predictNextQuestion,
 * generateVoiceDNA, and getDeltaPromptAdjustments.
 */

import {
  createCalibrationEntry,
  computeCalibrationSummary,
  analyzeReplyDelta,
  detectConversationFlows,
  predictNextQuestion,
  generateVoiceDNA,
  getDeltaPromptAdjustments,
  type CalibrationEntry,
  type ReplyDelta,
} from '../ai-intelligence';
import type { DraftOutcome, HostStyleProfile } from '../store';

// ── Calibration Tests ──

describe('createCalibrationEntry', () => {
  it('should mark high-confidence approved as calibrated', () => {
    const outcome: DraftOutcome = {
      id: 'test', timestamp: new Date(),
      outcomeType: 'approved', confidence: 85,
    };
    const entry = createCalibrationEntry(outcome);
    expect(entry.calibrationResult).toBe('calibrated');
    expect(entry.predictedConfidence).toBe(85);
  });

  it('should mark high-confidence rejected as overconfident', () => {
    const outcome: DraftOutcome = {
      id: 'test', timestamp: new Date(),
      outcomeType: 'rejected', confidence: 90,
    };
    const entry = createCalibrationEntry(outcome);
    expect(entry.calibrationResult).toBe('overconfident');
  });

  it('should mark low-confidence approved as underconfident', () => {
    const outcome: DraftOutcome = {
      id: 'test', timestamp: new Date(),
      outcomeType: 'approved', confidence: 20,
    };
    const entry = createCalibrationEntry(outcome);
    expect(entry.calibrationResult).toBe('underconfident');
  });

  it('should mark low-confidence rejected as calibrated', () => {
    const outcome: DraftOutcome = {
      id: 'test', timestamp: new Date(),
      outcomeType: 'rejected', confidence: 30,
    };
    const entry = createCalibrationEntry(outcome);
    expect(entry.calibrationResult).toBe('calibrated');
  });

  it('should default to confidence 50 when undefined', () => {
    const outcome: DraftOutcome = {
      id: 'test', timestamp: new Date(),
      outcomeType: 'independent',
    };
    const entry = createCalibrationEntry(outcome);
    expect(entry.predictedConfidence).toBe(50);
  });
});

describe('computeCalibrationSummary', () => {
  it('should return zeroes for empty entries', () => {
    const summary = computeCalibrationSummary([]);
    expect(summary.totalEntries).toBe(0);
    expect(summary.calibrationScore).toBe(0);
  });

  it('should compute correct calibration score', () => {
    const entries: CalibrationEntry[] = [
      { id: '1', timestamp: Date.now(), predictedConfidence: 80, outcomeType: 'approved', calibrationResult: 'calibrated' },
      { id: '2', timestamp: Date.now(), predictedConfidence: 90, outcomeType: 'rejected', calibrationResult: 'overconfident' },
      { id: '3', timestamp: Date.now(), predictedConfidence: 70, outcomeType: 'approved', calibrationResult: 'calibrated' },
    ];
    const summary = computeCalibrationSummary(entries);
    expect(summary.totalEntries).toBe(3);
    expect(summary.calibratedCount).toBe(2);
    expect(summary.overconfidentCount).toBe(1);
    expect(summary.calibrationScore).toBe(67); // 2/3 * 100 rounded
  });

  it('should identify problem intents with 3+ occurrences', () => {
    const entries: CalibrationEntry[] = Array.from({ length: 4 }, (_, i) => ({
      id: `${i}`, timestamp: Date.now(), predictedConfidence: 90,
      outcomeType: 'rejected' as const, calibrationResult: 'overconfident' as const,
      guestIntent: 'wifi',
    }));
    const summary = computeCalibrationSummary(entries);
    expect(summary.problemIntents).toHaveLength(1);
    expect(summary.problemIntents[0].intent).toBe('wifi');
    expect(summary.problemIntents[0].issue).toBe('overconfident');
  });

  it('should compute negative adjustment when overconfident', () => {
    const entries: CalibrationEntry[] = [
      { id: '1', timestamp: Date.now(), predictedConfidence: 90, outcomeType: 'rejected', calibrationResult: 'overconfident' },
      { id: '2', timestamp: Date.now(), predictedConfidence: 85, outcomeType: 'rejected', calibrationResult: 'overconfident' },
      { id: '3', timestamp: Date.now(), predictedConfidence: 70, outcomeType: 'approved', calibrationResult: 'calibrated' },
    ];
    const summary = computeCalibrationSummary(entries);
    expect(summary.confidenceAdjustment).toBeLessThan(0);
  });
});

// ── Reply Delta Tests ──

describe('analyzeReplyDelta', () => {
  it('should detect content added by host', () => {
    const delta = analyzeReplyDelta(
      'Thanks for your message. We hope you enjoy your stay.',
      'Thanks for your message. The WiFi password is GuestNet2024. We hope you enjoy your stay.',
      'What is the WiFi password?'
    );
    expect(delta.contentAdded.length).toBeGreaterThan(0);
  });

  it('should detect content removed by host', () => {
    const delta = analyzeReplyDelta(
      'Thanks for reaching out. We are happy to help. The pool opens at 8am. Enjoy your day.',
      'The pool opens at 8am.',
      'When does the pool open?'
    );
    expect(delta.contentRemoved.length).toBeGreaterThan(0);
  });

  it('should detect host_more_specific when host adds codes/times', () => {
    const delta = analyzeReplyDelta(
      'Check in is in the afternoon. You can access the front door.',
      'Check in is at 3:00 PM. The door code is 4521.',
      'When is check in?'
    );
    expect(delta.specificityDelta).toBe('host_more_specific');
  });

  it('should set equal specificity when both are similar', () => {
    const delta = analyzeReplyDelta(
      'Thanks for your message!',
      'Thank you for reaching out!',
      'Hello!'
    );
    expect(delta.specificityDelta).toBe('equal');
  });
});

// ── Conversation Flow Tests ──

describe('detectConversationFlows', () => {
  it('should detect repeated 2-gram sequences', () => {
    const conversations = [
      { intents: ['check_in', 'wifi', 'parking'] },
      { intents: ['check_in', 'wifi', 'local_tips'] },
      { intents: ['check_in', 'wifi'] },
    ];
    const flows = detectConversationFlows(conversations);

    const checkinWifi = flows.find(
      (f) => f.intentSequence[0] === 'check_in' && f.intentSequence[1] === 'wifi'
    );
    expect(checkinWifi).toBeDefined();
    expect(checkinWifi!.frequency).toBe(3);
  });

  it('should predict most common next intent', () => {
    const conversations = [
      { intents: ['booking', 'check_in', 'wifi'] },
      { intents: ['booking', 'check_in', 'wifi'] },
      { intents: ['booking', 'check_in', 'parking'] },
    ];
    const flows = detectConversationFlows(conversations);

    const bookingCheckin = flows.find(
      (f) => f.intentSequence.join(' → ') === 'booking → check_in'
    );
    expect(bookingCheckin).toBeDefined();
    expect(bookingCheckin!.predictedNextIntent).toBe('wifi');
  });

  it('should not return sequences with count < 2', () => {
    const conversations = [
      { intents: ['unique1', 'unique2', 'unique3'] },
    ];
    const flows = detectConversationFlows(conversations);
    expect(flows.length).toBe(0);
  });
});

describe('predictNextQuestion', () => {
  it('should return predicted intent when flow matches', () => {
    const flows = detectConversationFlows([
      { intents: ['check_in', 'wifi', 'parking'] },
      { intents: ['check_in', 'wifi', 'parking'] },
    ]);
    const prediction = predictNextQuestion(['check_in', 'wifi'], flows);
    expect(prediction).not.toBeNull();
    expect(prediction!.intent).toBe('parking');
  });

  it('should return null for empty inputs', () => {
    expect(predictNextQuestion([], [])).toBeNull();
  });
});

// ── Voice DNA Tests ──

describe('generateVoiceDNA', () => {
  const baseProfile: HostStyleProfile = {
    propertyId: 'prop_test',
    formalityLevel: 45,
    warmthLevel: 55,
    commonGreetings: ['Hi there!', 'Hello!'],
    commonSignoffs: ['Best,', 'Cheers!'],
    usesEmojis: true,
    emojiFrequency: 30,
    averageResponseLength: 50,
    commonPhrases: ['hope you enjoy', 'let me know'],
    avoidedWords: ['unfortunately'],
    intentPatterns: {},
    samplesAnalyzed: 100,
    lastUpdated: new Date(),
  };

  it('should include formality and warmth descriptors', () => {
    const dna = generateVoiceDNA(baseProfile);
    expect(dna).toContain('balanced between casual and professional');
    expect(dna).toContain('friendly and approachable');
  });

  it('should include greetings and sign-offs', () => {
    const dna = generateVoiceDNA(baseProfile);
    expect(dna).toContain('Hi there!');
    expect(dna).toContain('Best,');
  });

  it('should include emoji status', () => {
    const dna = generateVoiceDNA(baseProfile);
    expect(dna).toContain('30%');
  });

  it('should include samples count', () => {
    const dna = generateVoiceDNA(baseProfile);
    expect(dna).toContain('100 analyzed messages');
  });
});

// ── Delta Prompt Adjustments Tests ──

describe('getDeltaPromptAdjustments', () => {
  it('should return empty string with < 3 deltas', () => {
    const result = getDeltaPromptAdjustments([]);
    expect(result).toBe('');
  });

  it('should recommend specificity when host is frequently more specific', () => {
    const deltas: ReplyDelta[] = Array.from({ length: 5 }, (_, i) => ({
      id: `${i}`, timestamp: Date.now(),
      contentAdded: [], contentRemoved: [],
      hostPrioritized: '', aiPrioritized: '',
      specificityDelta: 'host_more_specific' as const,
      specificExamples: [], learningSummary: '',
    }));
    const result = getDeltaPromptAdjustments(deltas);
    expect(result).toContain('specific details');
  });
});
