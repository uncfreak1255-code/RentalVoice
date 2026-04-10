import { renderHook, waitFor } from '@testing-library/react-native';
import { useChatDraftEngine } from '../useChatDraftEngine';

const mockGenerateEnhancedAIResponse = jest.fn();
const mockGenerateAIDraftViaServer = jest.fn();
const mockGetVoiceReadinessViaServer = jest.fn();
const mockGetCurrentEntitlements = jest.fn();
const mockGetDraftLearningProof = jest.fn();
const mockUseAutoSend = jest.fn();
const mockUseChatMessageActions = jest.fn();
const mockAddMessage = jest.fn();
const mockUpdateConversation = jest.fn();
const mockIncrementAnalytic = jest.fn();
const mockSetVoiceReadiness = jest.fn();
const mockAddIssue = jest.fn();

const baseConversation = {
  id: 'conv-1',
  property: { id: 'property-1', name: 'Beach House' },
  guest: { name: 'Alice' },
  messages: [
    {
      id: 'guest-1',
      conversationId: 'conv-1',
      sender: 'guest',
      content: 'Can I check in early?',
      timestamp: new Date('2026-04-10T10:00:00.000Z'),
      isRead: true,
    },
  ],
  hasAiDraft: false,
  aiDraftContent: null,
  aiDraftConfidence: null,
};

let mockState: any;

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('@/lib/config', () => ({
  features: {
    serverProxiedAI: false,
  },
}));

jest.mock('@/lib/ai-service', () => ({
  generateDemoResponse: jest.fn(),
}));

jest.mock('@/lib/ai-enhanced', () => ({
  generateEnhancedAIResponse: (...args: any[]) => mockGenerateEnhancedAIResponse(...args),
  analyzeSentimentAdvanced: jest.fn(),
  detectTopics: jest.fn(),
  calculateConfidence: jest.fn(),
  getRegenerationOptions: jest.fn(() => []),
}));

jest.mock('@/lib/api-client', () => ({
  generateAIDraftViaServer: (...args: any[]) => mockGenerateAIDraftViaServer(...args),
  getVoiceReadinessViaServer: (...args: any[]) => mockGetVoiceReadinessViaServer(...args),
  getCurrentEntitlements: (...args: any[]) => mockGetCurrentEntitlements(...args),
}));

jest.mock('@/lib/retrieval-source', () => ({
  getDraftLearningProof: (...args: any[]) => mockGetDraftLearningProof(...args),
}));

jest.mock('../useAutoSend', () => ({
  useAutoSend: (...args: any[]) => mockUseAutoSend(...args),
}));

jest.mock('../useChatMessageActions', () => ({
  useChatMessageActions: (...args: any[]) => mockUseChatMessageActions(...args),
}));

jest.mock('@/lib/store', () => ({
  useAppStore: (selector: any) => selector(mockState),
}));

const { features: mockFeatures } = jest.requireMock('@/lib/config') as {
  features: { serverProxiedAI: boolean };
};

describe('useChatDraftEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockFeatures.serverProxiedAI = false;

    mockGenerateEnhancedAIResponse.mockResolvedValue({
      content: 'Local draft',
      sentiment: {
        primary: 'neutral',
        intensity: 50,
        emotions: [],
        requiresEscalation: false,
      },
      topics: [],
      confidence: {
        overall: 82,
        factors: {
          sentimentMatch: 80,
          knowledgeAvailable: 80,
          topicCoverage: 80,
          styleMatch: 80,
          safetyCheck: 100,
        },
        warnings: [],
        blockedForAutoSend: false,
      },
      actionItems: [],
      knowledgeConflicts: [],
      detectedLanguage: 'en',
      regenerationOptions: [],
    });
    mockGenerateAIDraftViaServer.mockResolvedValue({
      draft: 'Server draft',
      confidence: 91,
      detectedLanguage: 'en',
      provider: 'openai',
      model: 'gpt-5.4-mini',
      usedFallback: false,
      tokensUsed: { input: 10, output: 20 },
    });
    mockGetVoiceReadinessViaServer.mockResolvedValue({
      state: 'learning',
      importedExamples: 12,
      styleSamples: 4,
      semanticReady: false,
      autopilotEligible: false,
      reason: 'Founder-managed drafts are live. Autopilot stays off until voice learning finishes.',
    });
    mockGetCurrentEntitlements.mockResolvedValue({
      entitlements: {
        supermemoryMode: 'full',
      },
    });
    mockGetDraftLearningProof.mockResolvedValue({
      summary: 'Using 2 similar replies and 1 recent correction.',
      similarExamplesCount: 2,
      recentCorrectionsCount: 1,
      mode: 'local',
    });
    mockUseAutoSend.mockReturnValue(jest.fn());
    mockUseChatMessageActions.mockReturnValue({
      isSending: false,
      editLearningSummary: null,
      learningToastType: 'edit',
      handleSendMessage: jest.fn(),
      handleApproveAiDraft: jest.fn(),
      handleRegenerateAiDraft: jest.fn(),
      handleEditAiDraft: jest.fn(),
      handleDismissAiDraft: jest.fn(),
      handleFixConflict: jest.fn(),
    });

    mockState = {
      conversations: [{ ...baseConversation }],
      addMessage: mockAddMessage,
      updateConversation: mockUpdateConversation,
      settings: {
        autoPilotEnabled: false,
        autoPilotConfidenceThreshold: 85,
        hostName: 'Sawyer',
        responseLanguageMode: 'match_guest',
        defaultLanguage: 'en',
      },
      isDemoMode: false,
      propertyKnowledge: {},
      incrementAnalytic: mockIncrementAnalytic,
      hostStyleProfiles: {
        global: {
          propertyId: 'global',
        },
      },
      addIssue: mockAddIssue,
      voiceReadiness: {
        state: 'unknown',
        reason: null,
        updatedAt: null,
        autopilotEligible: false,
        importedExamples: 0,
        styleSamples: 0,
        semanticReady: false,
      },
      setVoiceReadiness: mockSetVoiceReadiness,
      founderSession: null,
    };
  });

  it('uses server draft generation when a founder session exists in personal mode', async () => {
    mockState = {
      ...mockState,
      founderSession: {
        userId: 'user-1',
        orgId: 'org-1',
        email: 'sawyerbeck25@gmail.com',
        accessToken: 'token-1',
        refreshToken: 'refresh-1',
        validatedAt: '2026-04-10T10:00:00.000Z',
        migrationState: 'completed',
      },
    };

    const { result } = renderHook(() => useChatDraftEngine({ conversationId: 'conv-1' }));

    await waitFor(() => {
      expect(mockGetVoiceReadinessViaServer).toHaveBeenCalledWith('property-1');
      expect(mockGenerateAIDraftViaServer).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Can I check in early?',
          propertyId: 'property-1',
          guestName: 'Alice',
        }),
      );
      expect(mockGenerateEnhancedAIResponse).not.toHaveBeenCalled();
      expect(mockSetVoiceReadiness).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'learning',
          autopilotEligible: false,
        }),
      );
      expect(result.current.currentEnhancedDraft?.content).toBe('Server draft');
      expect(result.current.rateLimitError).toBe(
        'Founder-managed drafts are live. Autopilot stays off until voice learning finishes.',
      );
    });
  });

  it('keeps unauthenticated personal users on the local draft path', async () => {
    const { result } = renderHook(() => useChatDraftEngine({ conversationId: 'conv-1' }));

    await waitFor(() => {
      expect(mockGenerateEnhancedAIResponse).toHaveBeenCalled();
      expect(mockGenerateAIDraftViaServer).not.toHaveBeenCalled();
      expect(mockGetVoiceReadinessViaServer).not.toHaveBeenCalled();
      expect(result.current.currentEnhancedDraft?.content).toBe('Local draft');
    });
  });
});
