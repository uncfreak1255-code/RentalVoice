import {
  buildLearningDashboardStats,
  type LearningDashboardStatsInput,
} from '../ai-learning';
import type {
  AILearningProgress,
  DraftOutcome,
  LearningEntry,
} from '../store';

function makeLearningEntry(overrides: Partial<LearningEntry> = {}): LearningEntry {
  return {
    id: `learn-${Math.random()}`,
    originalResponse: 'Draft reply',
    wasApproved: true,
    wasEdited: false,
    guestIntent: 'check_in',
    propertyId: 'prop-1',
    timestamp: new Date('2026-03-01T12:00:00Z'),
    ...overrides,
  };
}

function makeDraftOutcome(overrides: Partial<DraftOutcome> = {}): DraftOutcome {
  return {
    id: `outcome-${Math.random()}`,
    timestamp: new Date('2026-03-01T12:00:00Z'),
    outcomeType: 'approved',
    propertyId: 'prop-1',
    confidence: 88,
    ...overrides,
  };
}

function makeProgress(overrides: Partial<AILearningProgress> = {}): AILearningProgress {
  return {
    totalMessagesAnalyzed: 0,
    totalEditsLearned: 0,
    totalApprovalsLearned: 0,
    accuracyScore: 0,
    lastTrainingDate: new Date('2026-03-01T12:00:00Z'),
    isTraining: false,
    trainingProgress: 0,
    realTimeApprovalsCount: 0,
    realTimeEditsCount: 0,
    realTimeIndependentRepliesCount: 0,
    realTimeRejectionsCount: 0,
    patternsIndexed: 0,
    lastTrainingResult: null,
    ...overrides,
  };
}

function buildInput(overrides: Partial<LearningDashboardStatsInput> = {}): LearningDashboardStatsInput {
  return {
    learningEntries: [],
    draftOutcomes: [],
    aiLearningProgress: makeProgress(),
    hostMessagesCount: 0,
    ...overrides,
  };
}

describe('buildLearningDashboardStats', () => {
  it('prefers draft outcomes for draft feedback metrics and training result host-message counts', () => {
    const stats = buildLearningDashboardStats(buildInput({
      learningEntries: [makeLearningEntry()],
      draftOutcomes: [
        ...Array.from({ length: 10 }, () => makeDraftOutcome({ outcomeType: 'approved' })),
        ...Array.from({ length: 3 }, () => makeDraftOutcome({ outcomeType: 'edited' })),
        ...Array.from({ length: 2 }, () => makeDraftOutcome({ outcomeType: 'rejected' })),
      ],
      aiLearningProgress: makeProgress({
        totalMessagesAnalyzed: 15461,
        lastTrainingResult: {
          hostMessagesAnalyzed: 13151,
          patternsIndexed: 420,
          trainingSampleSize: 13151,
          trainingDurationMs: 45000,
        },
      }),
      hostMessagesCount: 22,
    }));

    expect(stats.feedbackInteractions).toBe(15);
    expect(stats.evaluatedDrafts).toBe(15);
    expect(stats.approvals).toBe(10);
    expect(stats.editsAndCorrections).toBe(3);
    expect(stats.rejections).toBe(2);
    expect(stats.approvalRate).toBe(67);
    expect(stats.trainedMessageCount).toBe(13151);
  });

  it('excludes independent replies from draft-rate math while keeping them in feedback interactions', () => {
    const stats = buildLearningDashboardStats(buildInput({
      draftOutcomes: [
        makeDraftOutcome({ outcomeType: 'approved' }),
        makeDraftOutcome({ outcomeType: 'approved' }),
        makeDraftOutcome({ outcomeType: 'edited' }),
        makeDraftOutcome({ outcomeType: 'independent' }),
      ],
    }));

    expect(stats.feedbackInteractions).toBe(4);
    expect(stats.evaluatedDrafts).toBe(3);
    expect(stats.approvalRate).toBe(67);
    expect(stats.editsAndCorrections).toBe(2);
  });

  it('falls back to learning entries and host message count when richer metrics are unavailable', () => {
    const stats = buildLearningDashboardStats(buildInput({
      learningEntries: [
        makeLearningEntry({ wasApproved: true, wasEdited: false }),
        makeLearningEntry({ wasApproved: true, wasEdited: true }),
      ],
      aiLearningProgress: makeProgress(),
      hostMessagesCount: 42,
    }));

    expect(stats.feedbackInteractions).toBe(2);
    expect(stats.evaluatedDrafts).toBe(2);
    expect(stats.approvals).toBe(1);
    expect(stats.editsAndCorrections).toBe(1);
    expect(stats.rejections).toBe(0);
    expect(stats.approvalRate).toBe(50);
    expect(stats.trainedMessageCount).toBe(42);
  });
});
