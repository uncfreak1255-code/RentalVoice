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

jest.mock('@/lib/design-tokens', () => ({
  colors: {
    platform: {
      airbnb: '#FF5A5F',
      vrbo: '#2557A7',
      booking: '#003580',
    },
    accent: { DEFAULT: '#F97316', light: '#FB923C', muted: '#FFF3E8', soft: '#FFF3E8' },
    status: { online: '#22C55E' },
    text: {
      primary: '#111827',
      secondary: '#374151',
      muted: '#6B7280',
      inverse: '#FFFFFF',
    },
    primary: { DEFAULT: '#14B8A6', muted: '#DFF7F3' },
    success: { DEFAULT: '#22C55E', muted: '#DCFCE7', soft: '#DCFCE7' },
    ai: { DEFAULT: '#6D5EF5', light: '#A5A0FF', soft: '#EEEBFF', darkSoft: '#251F4A' },
    danger: { DEFAULT: '#EF4444' },
    border: { subtle: '#E5E7EB' },
    bg: { elevated: '#F6F7F9' },
  },
  typography: {
    fontFamily: { regular: 'System', medium: 'System', semibold: 'System', bold: 'System' },
  },
  spacing: { '1': 4, '2': 8, '3': 12, '4': 16 },
  radius: { sm: 8, md: 12, lg: 16, full: 9999 },
}));

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
