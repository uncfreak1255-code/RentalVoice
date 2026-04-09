import { renderHook, act } from '@testing-library/react-native';
import { useChatMessageActions } from '../useChatMessageActions';

// ── Mocks ──

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
}));

jest.mock('@/lib/edit-diff-analysis', () => ({
  analyzeRejection: jest.fn(() => ({ type: 'off-topic', summary: 'wrong topic' })),
  storeRejectionPattern: jest.fn(() => Promise.resolve()),
  getRejectionSummary: jest.fn(() => 'Draft was off-topic'),
}));

jest.mock('@/lib/ai-intelligence', () => ({
  createCalibrationEntry: jest.fn(() => ({ id: 'cal-1' })),
}));

jest.mock('@/lib/hostaway', () => ({
  sendMessage: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/config', () => ({
  features: { serverProxiedAI: false },
}));

jest.mock('@/lib/api-client', () => ({
  recordDraftOutcomeViaServer: jest.fn(() => Promise.resolve()),
  sendHostawayMessageViaServer: jest.fn(() => Promise.resolve()),
}));

const mockRecordLearningEvent = jest.fn(async (event) => ({
  storedLocalExample: true,
  storedLocalCorrection: event.type !== 'ai_approved',
  queuedIncrementalTraining: true,
  syncedServerExample: false,
  syncedServerCorrection: false,
  updatedOutcomeMetrics: true,
  summary:
    event.type === 'ai_edited'
      ? 'Saved correction pattern: shorter • warmer'
      : event.type === 'ai_approved'
        ? 'Saved approved reply as a strong example'
        : 'Saved manual rewrite pattern: rewrote opening • added direct answer',
}));

jest.mock('@/lib/learning-events', () => ({
  recordLearningEvent: (event: any) => mockRecordLearningEvent(event),
}));

const mockUpdateConversation = jest.fn();
const mockIncrementAnalytic = jest.fn();
const mockUpdateAILearningProgress = jest.fn();
const mockAddDraftOutcome = jest.fn();
const mockAddCalibrationEntry = jest.fn();
const mockUpdatePropertyKnowledge = jest.fn();

const mockMessages = [
  { id: 'm1', sender: 'guest', content: 'What time is check-in?', timestamp: new Date(), conversationId: 'conv-1', isRead: true },
  { id: 'draft-1', sender: 'ai_draft', content: 'Check-in is at 3pm.', timestamp: new Date(), conversationId: 'conv-1', isRead: true, detectedIntent: 'check_in', aiConfidence: 80 },
];

jest.mock('@/lib/store', () => ({
  useAppStore: (selector: any) => {
    const state = {
      conversations: [{
        id: 'conv-1',
        guest: { name: 'Alice' },
        property: { id: 'p1', name: 'Beach House' },
        messages: mockMessages,
      }],
      updateConversation: mockUpdateConversation,
      isDemoMode: true,
      settings: { accountId: 'acc-1', apiKey: 'key-1' },
      updatePropertyKnowledge: mockUpdatePropertyKnowledge,
      incrementAnalytic: mockIncrementAnalytic,
      updateAILearningProgress: mockUpdateAILearningProgress,
      aiLearningProgress: {
        realTimeEditsCount: 0,
        realTimeApprovalsCount: 0,
        realTimeIndependentRepliesCount: 0,
        realTimeRejectionsCount: 0,
        patternsIndexed: 0,
      },
      addDraftOutcome: mockAddDraftOutcome,
      addCalibrationEntry: mockAddCalibrationEntry,
    };
    return selector(state);
  },
}));

// ── Tests ──

describe('useChatMessageActions', () => {
  const mockSetDraft = jest.fn();
  const mockGenerateDraft = jest.fn(() => Promise.resolve());

  const baseArgs = {
    conversationId: 'conv-1',
    currentEnhancedDraft: {
      content: 'Check-in is at 3pm.',
      confidence: 80,
    },
    setCurrentEnhancedDraft: mockSetDraft,
    isGeneratingDraft: false,
    generateDraftForConversation: mockGenerateDraft,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handleEditAiDraft updates draft with isEdited flag', () => {
    const { result } = renderHook(() => useChatMessageActions(baseArgs));
    act(() => {
      result.current.handleEditAiDraft('Check-in is at 4pm.');
    });
    expect(mockSetDraft).toHaveBeenCalled();
  });

  it('handleDismissAiDraft clears draft and tracks rejection', () => {
    const { result } = renderHook(() => useChatMessageActions(baseArgs));
    act(() => {
      result.current.handleDismissAiDraft();
    });
    expect(mockUpdateConversation).toHaveBeenCalled();
    expect(mockIncrementAnalytic).toHaveBeenCalledWith('aiResponsesRejected');
    expect(mockSetDraft).toHaveBeenCalledWith(null);
  });

  it('handleRegenerateAiDraft clears old draft and calls generate', async () => {
    const { result } = renderHook(() => useChatMessageActions(baseArgs));
    await act(async () => {
      await result.current.handleRegenerateAiDraft();
    });
    expect(mockUpdateConversation).toHaveBeenCalled();
    expect(mockSetDraft).toHaveBeenCalledWith(null);
    expect(mockGenerateDraft).toHaveBeenCalled();
  });

  it('handleSendMessage updates conversation optimistically', async () => {
    const { result } = renderHook(() => useChatMessageActions(baseArgs));
    await act(async () => {
      await result.current.handleSendMessage('My custom reply');
    });
    expect(mockUpdateConversation).toHaveBeenCalled();
    expect(mockIncrementAnalytic).toHaveBeenCalledWith('totalMessagesHandled');
    expect(mockRecordLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'host_written',
        source: 'chat_manual',
        finalReply: 'My custom reply',
        aiDraft: 'Check-in is at 3pm.',
      }),
    );
    expect(result.current.editLearningSummary).toBe(
      'Saved manual rewrite pattern: rewrote opening • added direct answer',
    );
  });

  it('handleApproveAiDraft sends the draft content', async () => {
    const { result } = renderHook(() => useChatMessageActions(baseArgs));
    await act(async () => {
      await result.current.handleApproveAiDraft();
    });
    expect(mockUpdateConversation).toHaveBeenCalled();
    expect(mockIncrementAnalytic).toHaveBeenCalledWith('totalMessagesHandled');
    expect(mockIncrementAnalytic).toHaveBeenCalledWith('aiResponsesApproved');
    expect(mockRecordLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ai_approved',
        source: 'chat_approve',
        guestMessage: 'What time is check-in?',
        finalReply: 'Check-in is at 3pm.',
        aiDraft: 'Check-in is at 3pm.',
      }),
    );
    expect(result.current.editLearningSummary).toBe('Saved approved reply as a strong example');
  });

  it('handleApproveAiDraft with edits records an ai_edited event', async () => {
    const { result } = renderHook(() => useChatMessageActions(baseArgs));
    await act(async () => {
      await result.current.handleApproveAiDraft('Check-in starts at 4pm.');
    });
    expect(mockRecordLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ai_edited',
        source: 'chat_edit',
        finalReply: 'Check-in starts at 4pm.',
        aiDraft: 'Check-in is at 3pm.',
      }),
    );
    expect(result.current.editLearningSummary).toBe('Saved correction pattern: shorter • warmer');
  });

  it('handleFixConflict updates property knowledge', () => {
    const { result } = renderHook(() =>
      useChatMessageActions({
        ...baseArgs,
        currentEnhancedDraft: {
          content: 'Draft',
          confidence: 80,
          knowledgeConflicts: [{ field: 'wifi', issue: 'Outdated wifi name', severity: 'medium' as const }],
        },
      }),
    );
    act(() => {
      result.current.handleFixConflict('wifi', 'NewWifiName');
    });
    expect(mockUpdatePropertyKnowledge).toHaveBeenCalledWith('p1', { wifi: 'NewWifiName' });
  });

  it('handleSendMessage is a no-op for empty content', async () => {
    const { result } = renderHook(() => useChatMessageActions(baseArgs));
    await act(async () => {
      await result.current.handleSendMessage('   ');
    });
    expect(mockUpdateConversation).not.toHaveBeenCalled();
  });
});
