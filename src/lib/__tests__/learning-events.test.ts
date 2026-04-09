jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { createLearningEventRecorder, type LearningEventDeps } from '../learning-events';

function makeDeps(overrides: Partial<LearningEventDeps> = {}): LearningEventDeps {
  const storeState = {
    founderSession: null,
    addLearningEntry: jest.fn(),
    updateAILearningProgress: jest.fn(),
    addDraftOutcome: jest.fn(),
    addCalibrationEntry: jest.fn(),
    addReplyDelta: jest.fn(),
  };

  return {
    now: () => 1_744_136_000_000,
    randomId: () => 'fixed-id',
    getStoreState: () => storeState,
    queueTrainingMessage: jest.fn().mockResolvedValue(undefined),
    addFewShotExample: jest.fn().mockResolvedValue(undefined),
    syncSemanticExample: jest.fn().mockResolvedValue(undefined),
    analyzeEdit: jest.fn(() => ({
      id: 'edit-1',
      timestamp: 1_744_136_000_000,
      originalDraft: 'Original draft',
      editedMessage: 'Edited reply',
      editTypes: ['shortened'],
      lengthChange: -25,
      wordCountChange: -4,
      addedPhrases: [],
      removedPhrases: ['please let me know if you have any questions'],
      toneShift: 'warmer',
    })),
    storeEditPattern: jest.fn().mockResolvedValue(undefined),
    getEditSummary: jest.fn(() => 'shorter • warmer'),
    analyzeIndependentReply: jest.fn(() => ({
      id: 'independent-1',
      timestamp: 1_744_136_000_000,
      propertyId: 'property-1',
      guestIntent: 'check_in',
      guestMessage: 'When can I check in?',
      aiDraft: 'AI draft',
      hostReply: 'Manual host reply',
      stylePreferences: ['more_direct'],
      aiDraftLength: 24,
      hostReplyLength: 34,
      lengthDifference: 41.6,
      hostGreeting: 'hi there',
      hostSignoff: 'thanks',
      aiGreeting: undefined,
      aiSignoff: undefined,
      hostTone: 'casual',
      aiTone: 'neutral',
    })),
    storeIndependentReplyPattern: jest.fn().mockResolvedValue(undefined),
    getIndependentReplySummary: jest.fn(() => 'rewrote opening • added direct answer'),
    createCalibrationEntry: jest.fn(() => ({ id: 'calibration-1' })),
    analyzeReplyDelta: jest.fn(() => ({ learningSummary: 'delta summary' })),
    recordServerOutcome: jest.fn().mockResolvedValue({ success: true }),
    submitServerEditFeedback: jest.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
}

describe('createLearningEventRecorder', () => {
  it('stores host-written example truth without correction truth', async () => {
    const deps = makeDeps();
    const recordLearningEvent = createLearningEventRecorder(deps);

    const receipt = await recordLearningEvent({
      type: 'host_written',
      source: 'test_my_voice',
      guestMessage: 'Do you allow late check-in?',
      finalReply: 'Yes, late check-in is fine. I will send the code the day of arrival.',
      propertyId: 'property-1',
      guestIntent: 'late_checkin',
    });

    expect(deps.queueTrainingMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Yes, late check-in is fine. I will send the code the day of arrival.',
        guestMessage: 'Do you allow late check-in?',
        propertyId: 'property-1',
        originType: 'host_written',
      }),
    );
    expect(deps.addFewShotExample).toHaveBeenCalledWith(
      'Do you allow late check-in?',
      'Yes, late check-in is fine. I will send the code the day of arrival.',
      'property-1',
      'host_written',
    );
    expect(deps.storeEditPattern).not.toHaveBeenCalled();
    expect(deps.storeIndependentReplyPattern).not.toHaveBeenCalled();
    expect(receipt).toMatchObject({
      storedLocalExample: true,
      storedLocalCorrection: false,
      queuedIncrementalTraining: true,
      updatedOutcomeMetrics: true,
      summary: 'Saved as a new host-written example',
    });
  });

  it('stores approved AI replies as example truth plus outcome truth', async () => {
    const deps = makeDeps();
    const recordLearningEvent = createLearningEventRecorder(deps);

    const receipt = await recordLearningEvent({
      type: 'ai_approved',
      source: 'chat_approve',
      guestMessage: 'What time is check-in?',
      finalReply: 'Check-in starts at 3 PM.',
      aiDraft: 'Check-in starts at 3 PM.',
      propertyId: 'property-1',
      guestIntent: 'check_in',
      confidence: 82,
    });

    expect(deps.storeEditPattern).not.toHaveBeenCalled();
    expect(deps.recordServerOutcome).not.toHaveBeenCalled();
    expect(receipt).toMatchObject({
      storedLocalExample: true,
      storedLocalCorrection: false,
      updatedOutcomeMetrics: true,
      summary: 'Saved approved reply as a strong example',
    });

    const storeState = deps.getStoreState();
    expect(storeState.addDraftOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        outcomeType: 'approved',
        propertyId: 'property-1',
        guestIntent: 'check_in',
        confidence: 82,
      }),
    );
    expect(storeState.addCalibrationEntry).toHaveBeenCalledWith({ id: 'calibration-1' });
    expect(storeState.addReplyDelta).not.toHaveBeenCalled();
  });

  it('stores edited AI replies as example truth plus correction truth', async () => {
    const deps = makeDeps({
      getStoreState: () => ({
        founderSession: { accessToken: 'token', orgId: 'org-1' },
        addLearningEntry: jest.fn(),
        updateAILearningProgress: jest.fn(),
        addDraftOutcome: jest.fn(),
        addCalibrationEntry: jest.fn(),
        addReplyDelta: jest.fn(),
      }),
    });
    const recordLearningEvent = createLearningEventRecorder(deps);

    const receipt = await recordLearningEvent({
      type: 'ai_edited',
      source: 'chat_edit',
      guestMessage: 'Can we check in early?',
      finalReply: 'You can check in at 2 PM if the cleaner finishes early.',
      aiDraft: 'Early check-in might be possible.',
      propertyId: 'property-1',
      guestIntent: 'early_checkin',
      confidence: 57,
    });

    expect(deps.analyzeEdit).toHaveBeenCalledWith(
      'Early check-in might be possible.',
      'You can check in at 2 PM if the cleaner finishes early.',
      'property-1',
      'early_checkin',
    );
    expect(deps.storeEditPattern).toHaveBeenCalled();
    expect(deps.syncSemanticExample).toHaveBeenCalledWith(
      'Can we check in early?',
      'You can check in at 2 PM if the cleaner finishes early.',
      'property-1',
      'ai_edited',
      'early_checkin',
    );
    expect(deps.recordServerOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        outcomeType: 'edited',
        propertyId: 'property-1',
        guestIntent: 'early_checkin',
        confidence: 57,
        aiDraft: 'Early check-in might be possible.',
        hostReply: 'You can check in at 2 PM if the cleaner finishes early.',
        guestMessage: 'Can we check in early?',
      }),
    );
    expect(deps.submitServerEditFeedback).toHaveBeenCalledWith({
      original: 'Early check-in might be possible.',
      edited: 'You can check in at 2 PM if the cleaner finishes early.',
      category: 'early_checkin',
      propertyId: 'property-1',
    });
    expect(receipt).toMatchObject({
      storedLocalExample: true,
      storedLocalCorrection: true,
      syncedServerExample: true,
      syncedServerCorrection: true,
      updatedOutcomeMetrics: true,
      summary: 'Saved correction pattern: shorter • warmer',
    });
  });

  it('keeps independent manual rewrite correction truth instead of dropping it', async () => {
    const deps = makeDeps();
    const recordLearningEvent = createLearningEventRecorder(deps);

    const receipt = await recordLearningEvent({
      type: 'host_written',
      source: 'chat_manual',
      guestMessage: 'When can I check in?',
      finalReply: 'Check-in starts at 3 PM, and I can text you if the home is ready sooner.',
      aiDraft: 'Check-in is after 3 PM.',
      propertyId: 'property-1',
      guestIntent: 'check_in',
    });

    expect(deps.analyzeIndependentReply).toHaveBeenCalledWith(
      'Check-in is after 3 PM.',
      'Check-in starts at 3 PM, and I can text you if the home is ready sooner.',
      'When can I check in?',
      'property-1',
      'check_in',
    );
    expect(deps.storeIndependentReplyPattern).toHaveBeenCalled();
    expect(receipt).toMatchObject({
      storedLocalExample: true,
      storedLocalCorrection: true,
      summary: 'Saved manual rewrite pattern: rewrote opening • added direct answer',
    });
  });

  it('preserves local success when server sync fails', async () => {
    const deps = makeDeps({
      getStoreState: () => ({
        founderSession: { accessToken: 'token', orgId: 'org-1' },
        addLearningEntry: jest.fn(),
        updateAILearningProgress: jest.fn(),
        addDraftOutcome: jest.fn(),
        addCalibrationEntry: jest.fn(),
        addReplyDelta: jest.fn(),
      }),
      syncSemanticExample: jest.fn().mockRejectedValue(new Error('voice example failed')),
      recordServerOutcome: jest.fn().mockRejectedValue(new Error('outcome failed')),
      submitServerEditFeedback: jest.fn().mockRejectedValue(new Error('edit feedback failed')),
    });
    const recordLearningEvent = createLearningEventRecorder(deps);

    const receipt = await recordLearningEvent({
      type: 'ai_edited',
      source: 'test_my_voice',
      guestMessage: 'Can we get a late checkout?',
      finalReply: 'Late checkout is possible for a fee if the calendar stays open.',
      aiDraft: 'Late checkout may be available.',
      propertyId: 'property-1',
      guestIntent: 'late_checkout',
      confidence: 61,
    });

    expect(receipt).toMatchObject({
      storedLocalExample: true,
      storedLocalCorrection: true,
      syncedServerExample: false,
      syncedServerCorrection: false,
      updatedOutcomeMetrics: true,
      summary: 'Saved correction pattern: shorter • warmer',
    });
  });
});
