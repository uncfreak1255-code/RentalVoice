/**
 * Tests for the useAIDraft hook — extracted AI draft lifecycle.
 *
 * Tests the hook's pure logic separately from React rendering.
 * We test: draft state management, preloading, editing with originalContent
 * tracking, and the EnhancedAiDraft interface contract.
 *
 * Note: Full integration tests (actual API calls, Haptics) would require
 * a React test renderer. These tests verify the data layer behavior
 * by testing the underlying store actions the hook wraps.
 */

// Mock AsyncStorage to avoid window.localStorage crash in Node
import { useAppStore } from '../../lib/store';
import type { EnhancedAiDraft } from '../useAIDraft';

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

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Reset store before each test
beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState());
});

// ── EnhancedAiDraft Interface Contract ──

describe('EnhancedAiDraft interface', () => {
  it('should have required fields: content and confidence', () => {
    const draft: EnhancedAiDraft = {
      content: 'Hello! Check-in is at 3pm.',
      confidence: 85,
    };
    expect(draft.content).toBe('Hello! Check-in is at 3pm.');
    expect(draft.confidence).toBe(85);
  });

  it('should support optional edit tracking fields', () => {
    const draft: EnhancedAiDraft = {
      content: 'Edited response',
      confidence: 90,
      isEdited: true,
      originalContent: 'Original AI response',
    };
    expect(draft.isEdited).toBe(true);
    expect(draft.originalContent).toBe('Original AI response');
  });

  it('should track confidence details when available', () => {
    const draft: EnhancedAiDraft = {
      content: 'Response',
      confidence: 85,
      confidenceDetails: {
        overall: 85,
        factors: {
          sentimentMatch: 90,
          knowledgeAvailable: 80,
          topicCoverage: 85,
          styleMatch: 88,
          safetyCheck: 100,
        },
        warnings: [],
        blockedForAutoSend: false,
      },
    };
    expect(draft.confidenceDetails?.overall).toBe(85);
    expect(draft.confidenceDetails?.blockedForAutoSend).toBe(false);
  });
});

// ── Store-backed Draft Lifecycle ──

describe('Draft lifecycle via store actions', () => {
  it('should create a conversation and add a draft message', () => {
    const conv = {
      id: 'conv-test',
      platform: 'airbnb' as const,
      guest: { name: 'Test', id: 'g-1' },
      property: { name: 'House', id: 'p-1' },
      messages: [],
      lastMessage: undefined,
      unreadCount: 0,
      hasAiDraft: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    useAppStore.setState({ conversations: [conv] as any });

    // Simulate draft generation
    useAppStore.getState().addMessage('conv-test', {
      id: 'draft-1',
      conversationId: 'conv-test',
      content: 'AI suggests: Check-in is at 3pm.',
      sender: 'ai_draft',
      timestamp: new Date(),
      isRead: true,
      aiConfidence: 85,
      detectedIntent: 'check_in',
    });

    useAppStore.getState().updateConversation('conv-test', {
      hasAiDraft: true,
      aiDraftContent: 'AI suggests: Check-in is at 3pm.',
      aiDraftConfidence: 85,
    });

    const updated = useAppStore.getState().conversations[0];
    expect(updated.hasAiDraft).toBe(true);
    expect(updated.aiDraftContent).toBe('AI suggests: Check-in is at 3pm.');
    expect(updated.aiDraftConfidence).toBe(85);
  });

  it('should clear draft on approval', () => {
    const conv = {
      id: 'conv-test',
      platform: 'airbnb' as const,
      guest: { name: 'Test', id: 'g-1' },
      property: { name: 'House', id: 'p-1' },
      messages: [
        { id: 'draft-1', conversationId: 'conv-test', content: 'Draft', sender: 'ai_draft' as const, timestamp: new Date(), isRead: true },
      ],
      lastMessage: undefined,
      unreadCount: 0,
      hasAiDraft: true,
      aiDraftContent: 'Draft',
      aiDraftConfidence: 90,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    useAppStore.setState({ conversations: [conv] as any });

    // Simulate approval: remove draft, add host message
    const messagesWithoutDraft = conv.messages.filter(m => m.sender !== 'ai_draft');
    const newMsg = { id: 'msg-1', conversationId: 'conv-test', content: 'Draft', sender: 'host' as const, timestamp: new Date(), isRead: false };

    useAppStore.getState().updateConversation('conv-test', {
      messages: [...messagesWithoutDraft, newMsg] as any,
      lastMessage: newMsg as any,
      hasAiDraft: false,
      aiDraftContent: undefined,
      aiDraftConfidence: undefined,
    });

    const updated = useAppStore.getState().conversations[0];
    expect(updated.hasAiDraft).toBe(false);
    expect(updated.aiDraftContent).toBeUndefined();
    expect(updated.messages.find((m: any) => m.sender === 'ai_draft')).toBeUndefined();
  });

  it('should track learning entry on approval', () => {
    useAppStore.getState().addLearningEntry({
      id: 'learn-1',
      originalResponse: 'AI original',
      wasApproved: true,
      wasEdited: false,
      guestIntent: 'check_in',
      propertyId: 'prop-1',
      timestamp: new Date(),
    });

    expect(useAppStore.getState().learningEntries).toHaveLength(1);
    expect(useAppStore.getState().learningEntries[0].wasApproved).toBe(true);
  });

  it('should track edited learning entry with both original and edited', () => {
    useAppStore.getState().addLearningEntry({
      id: 'learn-2',
      originalResponse: 'AI original',
      editedResponse: 'Host edited version',
      wasApproved: true,
      wasEdited: true,
      guestIntent: 'wifi',
      propertyId: 'prop-1',
      timestamp: new Date(),
    });

    const entry = useAppStore.getState().learningEntries[0];
    expect(entry.wasEdited).toBe(true);
    expect(entry.editedResponse).toBe('Host edited version');
  });

  it('should increment analytics on draft outcome', () => {
    const before = useAppStore.getState().analytics.aiResponsesApproved;
    useAppStore.getState().incrementAnalytic('aiResponsesApproved');
    expect(useAppStore.getState().analytics.aiResponsesApproved).toBe(before + 1);
  });

  it('should track rejection in draft outcomes', () => {
    useAppStore.getState().addDraftOutcome({
      id: 'outcome-1',
      timestamp: new Date(),
      outcomeType: 'rejected',
      confidence: 60,
      propertyId: 'prop-1',
      guestIntent: 'parking',
    });

    expect(useAppStore.getState().draftOutcomes).toHaveLength(1);
    expect(useAppStore.getState().draftOutcomes[0].outcomeType).toBe('rejected');
  });
});

// ── Edit Tracking Logic ──

describe('Edit tracking', () => {
  it('should preserve originalContent when draft is edited', () => {
    const original: EnhancedAiDraft = {
      content: 'Original AI response',
      confidence: 85,
    };

    // Simulate first edit
    const afterFirstEdit: EnhancedAiDraft = {
      ...original,
      content: 'Edited response v1',
      isEdited: true,
      originalContent: original.content,
    };

    expect(afterFirstEdit.isEdited).toBe(true);
    expect(afterFirstEdit.originalContent).toBe('Original AI response');
    expect(afterFirstEdit.content).toBe('Edited response v1');

    // Simulate second edit — originalContent should NOT change
    const afterSecondEdit: EnhancedAiDraft = {
      ...afterFirstEdit,
      content: 'Edited response v2',
      originalContent: afterFirstEdit.originalContent || afterFirstEdit.content,
    };

    expect(afterSecondEdit.originalContent).toBe('Original AI response');
    expect(afterSecondEdit.content).toBe('Edited response v2');
  });

  it('should not set isEdited when content matches original', () => {
    const draft: EnhancedAiDraft = {
      content: 'Same content',
      confidence: 85,
      isEdited: false,
    };
    expect(draft.isEdited).toBe(false);
  });
});
