import {
  buildLearningDashboardStats,
  buildLearningImportSummary,
  buildRecurringIntentCoverage,
  type LearningDashboardStatsInput,
} from '../ai-learning';
import type {
  AILearningProgress,
  DraftOutcome,
  HistorySyncStatus,
  LearningEntry,
} from '../store';
import type { HostawayConversation, HostawayMessage } from '../history-sync';

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

function makeHistorySyncStatus(overrides: Partial<HistorySyncStatus> = {}): HistorySyncStatus {
  return {
    lastFullSync: null,
    lastIncrementalSync: null,
    totalConversationsSynced: 0,
    totalMessagesSynced: 0,
    isSyncing: false,
    isPaused: false,
    syncPhase: 'idle',
    syncProgress: 0,
    syncError: null,
    dateRangeStart: null,
    dateRangeEnd: null,
    dateRangeMonths: 24,
    processedConversations: 0,
    processedMessages: 0,
    estimatedTimeRemaining: null,
    currentBatch: 0,
    totalBatches: 0,
    errorCount: 0,
    errorLog: [],
    canResume: false,
    ...overrides,
  };
}

function makeConversation(id: number): HostawayConversation {
  return {
    id,
    listingMapId: 100 + id,
  };
}

function makeGuestMessage(id: number, conversationId: number, body: string): HostawayMessage {
  return {
    id,
    conversationId,
    body,
    isIncoming: true,
    status: 'sent',
    insertedOn: '2026-03-01T12:00:00Z',
  };
}

function makeHostMessage(id: number, conversationId: number, body: string): HostawayMessage {
  return {
    id,
    conversationId,
    body,
    isIncoming: false,
    status: 'sent',
    insertedOn: '2026-03-01T12:05:00Z',
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

describe('buildLearningImportSummary', () => {
  it('uses conversation counts for message-fetch progress labels and keeps message totals separate', () => {
    const summary = buildLearningImportSummary({
      historySyncStatus: makeHistorySyncStatus({
        isSyncing: true,
        syncPhase: 'messages',
        syncProgress: 100,
        processedConversations: 1465,
        processedMessages: 22486,
        estimatedTimeRemaining: 2000,
      }),
      aiLearningProgress: makeProgress({
        totalMessagesAnalyzed: 13151,
        patternsIndexed: 420,
        lastTrainingResult: {
          hostMessagesAnalyzed: 13151,
          patternsIndexed: 420,
          trainingSampleSize: 8000,
          trainingDurationMs: 45000,
        },
      }),
      totalConversationsDiscovered: 1465,
    });

    expect(summary.statusLabel).toBe('Reading your messages (100%)');
    expect(summary.detailLabel).toBe('22,486 messages imported');
    expect(summary.hostMessagesAnalyzed).toBe(13151);
    expect(summary.patternsIndexed).toBe(420);
    expect(summary.isImported).toBe(true);
  });

  it('surfaces training as the next step after import completes', () => {
    const summary = buildLearningImportSummary({
      historySyncStatus: makeHistorySyncStatus({
        isSyncing: false,
        syncPhase: 'complete',
        syncProgress: 100,
        totalConversationsSynced: 120,
        totalMessagesSynced: 3200,
      }),
      aiLearningProgress: makeProgress({
        totalMessagesAnalyzed: 0,
        patternsIndexed: 0,
        lastTrainingResult: null,
      }),
      totalConversationsDiscovered: 120,
    });

    expect(summary.statusLabel).toBe('Import complete. Training your history now');
    expect(summary.isImported).toBe(true);
    expect(summary.isTrainingReady).toBe(false);
  });
});

describe('buildRecurringIntentCoverage', () => {
  it('computes coverage from recurring guest intents against indexed patterns', () => {
    const conversations = [
      makeConversation(1),
      makeConversation(2),
      makeConversation(3),
      makeConversation(4),
      makeConversation(5),
      makeConversation(6),
      makeConversation(7),
      makeConversation(8),
      makeConversation(9),
      makeConversation(10),
      makeConversation(11),
      makeConversation(12),
      makeConversation(13),
      makeConversation(14),
      makeConversation(15),
    ];

    const messagesByConversation: Record<number, HostawayMessage[]> = {};

    for (let index = 1; index <= 6; index++) {
      messagesByConversation[index] = [
        makeGuestMessage(index * 10, index, 'What is the wifi password?'),
        makeHostMessage(index * 10 + 1, index, 'The wifi password is listed in your check-in guide.'),
      ];
    }

    for (let index = 7; index <= 11; index++) {
      messagesByConversation[index] = [
        makeGuestMessage(index * 10, index, 'Can we check in early tomorrow?'),
        makeHostMessage(index * 10 + 1, index, 'Early check-in depends on cleaning progress.'),
      ];
    }

    for (let index = 12; index <= 15; index++) {
      messagesByConversation[index] = [
        makeGuestMessage(index * 10, index, 'Where should we park our car?'),
        makeHostMessage(index * 10 + 1, index, 'You can park in the driveway.'),
      ];
    }

    const coverage = buildRecurringIntentCoverage({
      conversations,
      messagesByConversation,
      indexedPatterns: [
        { guestIntent: 'question' },
        { guestIntent: 'question' },
        { guestIntent: 'question' },
        { guestIntent: 'question' },
        { guestIntent: 'check_in' },
        { guestIntent: 'check_in' },
      ],
      minimumRecurringVolume: 4,
      coveredPatternThreshold: 3,
    });

    expect(coverage.recurringIntentCount).toBe(2);
    expect(coverage.coveredIntentCount).toBe(1);
    expect(coverage.coveragePercent).toBe(50);
    expect(coverage.targetPercent).toBe(75);
    expect(coverage.rows[0].intent).toBe('question');
    expect(coverage.rows[0].status).toBe('covered');
    expect(coverage.rows.find((row) => row.intent === 'check_in')?.status).toBe('weak');
  });

  it('ignores low-volume intents below the recurring threshold', () => {
    const coverage = buildRecurringIntentCoverage({
      conversations: [makeConversation(1), makeConversation(2), makeConversation(3)],
      messagesByConversation: {
        1: [makeGuestMessage(1, 1, 'What is the wifi password?')],
        2: [makeGuestMessage(2, 2, 'The house is dirty and unacceptable.')],
        3: [makeGuestMessage(3, 3, 'Can we check in early?')],
      },
      indexedPatterns: [{ guestIntent: 'question' }],
      minimumRecurringVolume: 2,
      coveredPatternThreshold: 2,
    });

    expect(coverage.recurringIntentCount).toBe(0);
    expect(coverage.coveragePercent).toBe(0);
  });
});
