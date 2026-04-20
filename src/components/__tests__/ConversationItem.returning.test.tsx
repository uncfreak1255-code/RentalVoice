import React from 'react';
import { render } from '@testing-library/react-native';
import { ConversationItem } from '../ConversationItem';
import type { Conversation, Message } from '@/lib/store';

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (Component: any) => Component,
      View,
    },
    useAnimatedStyle: () => ({}),
    useSharedValue: (initial: any) => ({ value: initial }),
    withSpring: (val: any) => val,
    useReducedMotion: () => false,
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));

// Use the real tokens so tests stay in sync with token additions.
jest.mock('@/lib/design-tokens', () => jest.requireActual('@/lib/design-tokens'));

jest.mock('@/components/ui/PremiumPressable', () => {
  const { Pressable } = jest.requireActual('react-native');
  return {
    PremiumPressable: ({ children, onPress, accessibilityLabel, ...props }: any) => (
      <Pressable onPress={onPress} accessibilityLabel={accessibilityLabel} {...props}>
        {children}
      </Pressable>
    ),
  };
});

const mockGetGuestMemory = jest.fn();

jest.mock('@/lib/advanced-training', () => ({
  guestMemoryManager: {
    getGuestMemory: (...args: any[]) => mockGetGuestMemory(...args),
  },
}));

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    content: 'Hello, what time is check-in?',
    sender: 'guest',
    timestamp: new Date(),
    isRead: false,
    ...overrides,
  };
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  const now = new Date();
  return {
    id: 'conv-1',
    platform: 'airbnb',
    guest: { name: 'Thomas Ramsey', id: 'guest-1', email: 'guest@example.com' },
    property: { name: 'Longboat Key Beach House', id: 'prop-1' },
    messages: [makeMessage()],
    lastMessage: makeMessage(),
    unreadCount: 0,
    hasAiDraft: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Conversation;
}

describe('ConversationItem returning guest badge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a returning badge when guest memory marks the guest as returning', () => {
    mockGetGuestMemory.mockReturnValue({
      preferences: { isReturning: true },
    });

    const { getByText } = render(
      <ConversationItem conversation={makeConversation()} onPress={jest.fn()} />
    );

    expect(getByText('Returning')).toBeTruthy();
  });

  it('does not render the returning badge for first-time guests', () => {
    mockGetGuestMemory.mockReturnValue(null);

    const { queryByText } = render(
      <ConversationItem conversation={makeConversation()} onPress={jest.fn()} />
    );

    expect(queryByText('Returning')).toBeNull();
  });
});
