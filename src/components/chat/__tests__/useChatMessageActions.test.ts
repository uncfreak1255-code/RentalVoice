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
  analyzeEdit: jest.fn(() => ({ type: 'tone', summary: 'tone shift' })),
  storeEditPattern: jest.fn(() => Promise.resolve()),
  getEditSummary: jest.fn(() => 'Tone adjusted'),
  analyzeRejection: jest.fn(() => ({ type: 'off-topic', summary: 'wrong topic' })),
  storeRejectionPattern: jest.fn(() => Promise.resolve()),
  getRejectionSummary: jest.fn(() => 'Draft was off-topic'),
  analyzeIndependentReply: jest.fn(() => ({ type: 'rewrite', summary: 'full rewrite' })),
  storeIndependentReplyPattern: jest.fn(() => Promise.resolve()),
  getIndependentReplySummary: jest.fn(() => 'Host rewrote reply'),
}));

jest.mock('@/lib/ai-intelligence', () => ({
  createCalibrationEntry: jest.fn(() => ({ id: 'cal-1' })),
  analyzeReplyDelta: jest.fn(() => ({ learningSummary: 'delta summary' })),
}));

jest.mock('@/lib/ai-enhanced', () => ({
  learnFromSentMessage: jest.fn(() => Promise.resolve()),
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

const mockUpdateConversation = jest.fn();
const mockIncrementAnalytic = jest.fn();
const mockAddLearningEntry = jest.fn();
const mockUpdateAILearningProgress = jest.fn();
const mockAddDraftOutcome = jest.fn();
const mockAddCalibrationEntry = jest.fn();
const mockAddReplyDelta = jest.fn();
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
      addLearningEntry: mockAddLearningEntry,
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
      addReplyDelta: mockAddReplyDelta,
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
  });

  it('handleApproveAiDraft sends the draft content', async () => {
    const { result } = renderHook(() => useChatMessageActions(baseArgs));
    await act(async () => {
      await result.current.handleApproveAiDraft();
    });
    expect(mockUpdateConversation).toHaveBeenCalled();
    expect(mockIncrementAnalytic).toHaveBeenCalledWith('totalMessagesHandled');
    expect(mockIncrementAnalytic).toHaveBeenCalledWith('aiResponsesApproved');
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
