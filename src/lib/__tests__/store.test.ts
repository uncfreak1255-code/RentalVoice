/**
 * Tests for Zustand store actions — the app's brain.
 * Covers: message management, conversation updates, credential management,
 * analytics, autopilot settings, and learning data.
 */

import { waitFor } from '@testing-library/react-native';
// Mock AsyncStorage to avoid window.localStorage crash in Node
import { stripApiKeyFromSettings, useAppStore } from '../store';
import type { Message, Conversation } from '../store';

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

// Mock expo-secure-store for credential storage
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

function getMockAsyncStorage() {
  return jest.requireMock('@react-native-async-storage/async-storage').default as {
    setItem: jest.Mock;
    getItem: jest.Mock;
    removeItem: jest.Mock;
    multiGet: jest.Mock;
    multiSet: jest.Mock;
  };
}

// Reset store before each test to avoid state leakage
beforeEach(() => {
  const mockAsyncStorage = getMockAsyncStorage();
  mockAsyncStorage.setItem.mockClear();
  mockAsyncStorage.getItem.mockClear();
  mockAsyncStorage.removeItem.mockClear();
  mockAsyncStorage.multiGet.mockClear();
  mockAsyncStorage.multiSet.mockClear();
  useAppStore.setState(useAppStore.getInitialState());
});

// ── Helper Factories ──

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    platform: 'airbnb',
    guest: { name: 'Test Guest', id: 'guest-1' },
    property: { name: 'Beach House', id: 'prop-1' },
    messages: [],
    lastMessage: undefined,
    unreadCount: 0,
    hasAiDraft: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Conversation;
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg-${Date.now()}`,
    conversationId: 'conv-1',
    content: 'Hello!',
    sender: 'guest',
    timestamp: new Date(),
    isRead: false,
    ...overrides,
  };
}

// ── Conversations ──

describe('addMessage', () => {
  it('should add a message to the correct conversation', () => {
    const conv = makeConversation();
    useAppStore.setState({ conversations: [conv] });

    const msg = makeMessage({ content: 'Hi there' });
    useAppStore.getState().addMessage('conv-1', msg);

    const updated = useAppStore.getState().conversations[0];
    expect(updated.messages).toHaveLength(1);
    expect(updated.messages[0].content).toBe('Hi there');
  });

  it('should not add message to non-existent conversation', () => {
    const conv = makeConversation();
    useAppStore.setState({ conversations: [conv] });

    const msg = makeMessage({ conversationId: 'nonexistent' });
    useAppStore.getState().addMessage('nonexistent', msg);

    // Original conversation unchanged
    expect(useAppStore.getState().conversations[0].messages).toHaveLength(0);
  });
});

describe('markAsRead', () => {
  it('should reset unread count to 0', () => {
    const conv = makeConversation({ unreadCount: 5 });
    useAppStore.setState({ conversations: [conv] });

    useAppStore.getState().markAsRead('conv-1');

    expect(useAppStore.getState().conversations[0].unreadCount).toBe(0);
  });

  it('should be a no-op for already-read conversations', () => {
    const conv = makeConversation({ unreadCount: 0 });
    useAppStore.setState({ conversations: [conv] });

    useAppStore.getState().markAsRead('conv-1');

    expect(useAppStore.getState().conversations[0].unreadCount).toBe(0);
  });
});

describe('updateConversation', () => {
  it('should merge partial updates into conversation', () => {
    const conv = makeConversation({ hasAiDraft: false });
    useAppStore.setState({ conversations: [conv] });

    useAppStore.getState().updateConversation('conv-1', {
      hasAiDraft: true,
      aiDraftContent: 'Draft content',
      aiDraftConfidence: 85,
    });

    const updated = useAppStore.getState().conversations[0];
    expect(updated.hasAiDraft).toBe(true);
    expect(updated.aiDraftContent).toBe('Draft content');
    expect(updated.aiDraftConfidence).toBe(85);
  });

  it('should clear draft fields when dismissing', () => {
    const conv = makeConversation({
      hasAiDraft: true,
      aiDraftContent: 'Old draft',
      aiDraftConfidence: 90,
    });
    useAppStore.setState({ conversations: [conv] });

    useAppStore.getState().updateConversation('conv-1', {
      hasAiDraft: false,
      aiDraftContent: undefined,
      aiDraftConfidence: undefined,
    });

    const updated = useAppStore.getState().conversations[0];
    expect(updated.hasAiDraft).toBe(false);
    expect(updated.aiDraftContent).toBeUndefined();
  });
});

// ── Credentials ──

describe('setCredentials', () => {
  it('should keep the API key in memory but not persist it to AsyncStorage', async () => {
    const mockAsyncStorage = getMockAsyncStorage();
    useAppStore.getState().setCredentials('acct-123', 'key-456');

    const settings = useAppStore.getState().settings;
    expect(settings.accountId).toBe('acct-123');
    expect(settings.apiKey).toBe('key-456');

    await waitFor(() => {
      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    });

    const persistedWrites = mockAsyncStorage.setItem.mock.calls.filter(
      ([key]) => key === 'rental-reply-storage'
    );
    expect(persistedWrites.length).toBeGreaterThan(0);

    const [, payload] = persistedWrites[persistedWrites.length - 1];
    const parsed = JSON.parse(payload as string) as { state?: { settings?: { accountId?: string; apiKey?: string } } };

    expect(parsed.state?.settings?.accountId).toBe('acct-123');
    expect(parsed.state?.settings?.apiKey).toBeUndefined();
  });

  it('should strip apiKey from migrated persisted state', () => {
    const migrated = stripApiKeyFromSettings({
      ...useAppStore.getState().settings,
      accountId: 'acct-123',
      apiKey: 'old-secret',
    });

    expect(migrated.accountId).toBe('acct-123');
    expect('apiKey' in migrated).toBe(false);
  });
});

// ── Analytics ──

describe('incrementAnalytic', () => {
  it('should increment totalMessagesHandled', () => {
    const before = useAppStore.getState().analytics.totalMessagesHandled;
    useAppStore.getState().incrementAnalytic('totalMessagesHandled');
    expect(useAppStore.getState().analytics.totalMessagesHandled).toBe(before + 1);
  });

  it('should increment aiResponsesApproved', () => {
    const before = useAppStore.getState().analytics.aiResponsesApproved;
    useAppStore.getState().incrementAnalytic('aiResponsesApproved');
    expect(useAppStore.getState().analytics.aiResponsesApproved).toBe(before + 1);
  });

  it('should increment multiple times correctly', () => {
    const before = useAppStore.getState().analytics.aiResponsesRejected;
    useAppStore.getState().incrementAnalytic('aiResponsesRejected');
    useAppStore.getState().incrementAnalytic('aiResponsesRejected');
    useAppStore.getState().incrementAnalytic('aiResponsesRejected');
    expect(useAppStore.getState().analytics.aiResponsesRejected).toBe(before + 3);
  });
});

// ── AutoPilot ──

describe('setAutoPilot', () => {
  it('should enable autopilot', () => {
    useAppStore.getState().setAutoPilot(true);
    expect(useAppStore.getState().settings.autoPilotEnabled).toBe(true);
  });

  it('should disable autopilot', () => {
    useAppStore.getState().setAutoPilot(true);
    useAppStore.getState().setAutoPilot(false);
    expect(useAppStore.getState().settings.autoPilotEnabled).toBe(false);
  });
});

// ── Learning Data ──

describe('addDraftOutcome', () => {
  it('should append outcome to draftOutcomes array', () => {
    const outcome = {
      id: 'outcome-1',
      timestamp: new Date(),
      outcomeType: 'approved' as const,
      confidence: 85,
    };
    useAppStore.getState().addDraftOutcome(outcome);

    expect(useAppStore.getState().draftOutcomes).toHaveLength(1);
    expect(useAppStore.getState().draftOutcomes[0].outcomeType).toBe('approved');
  });
});

describe('addLearningEntry', () => {
  it('should append entry with correct structure', () => {
    const entry = {
      id: 'learn-1',
      originalResponse: 'AI response',
      wasApproved: true,
      wasEdited: false,
      guestIntent: 'check_in',
      propertyId: 'prop-1',
      timestamp: new Date(),
    };
    useAppStore.getState().addLearningEntry(entry);

    expect(useAppStore.getState().learningEntries).toHaveLength(1);
    expect(useAppStore.getState().learningEntries[0].guestIntent).toBe('check_in');
  });
});

// ── Reset ──

describe('resetStore', () => {
  it('should clear all state to defaults', () => {
    // Set some state
    useAppStore.getState().setCredentials('acct', 'key');
    useAppStore.getState().setAutoPilot(true);
    useAppStore.getState().incrementAnalytic('totalMessagesHandled');

    // Reset
    useAppStore.getState().resetStore();

    const state = useAppStore.getState();
    expect(state.settings.accountId).toBeFalsy();
    expect(state.settings.autoPilotEnabled).toBe(false);
  });
});
