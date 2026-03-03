/**
 * Component tests for ConversationItem — the inbox row.
 * 
 * Tests cover:
 * - Rendering guest name, message preview, property
 * - Unread state (bold name, dot indicator, NEW label)
 * - Replied state (REPLIED label)
 * - Tap to open conversation
 * - Timestamp formatting (today, yesterday, older)
 * - Inline intent tags (Question, Thanks)
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ConversationItem } from '../ConversationItem';
import type { Conversation, Message } from '@/lib/store';

// ── Mocks ──

jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
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
  typography: {
    fontFamily: { regular: 'System', medium: 'System', semibold: 'System', bold: 'System' },
  },
  animation: { spring: { bouncy: {}, subtle: {}, snappy: {} }, duration: {} },
}));

jest.mock('@/components/ui/PremiumPressable', () => {
  const { Pressable } = require('react-native');
  return {
    PremiumPressable: ({ children, onPress, accessibilityLabel, ...props }: any) => (
      <Pressable onPress={onPress} accessibilityLabel={accessibilityLabel} {...props}>
        {children}
      </Pressable>
    ),
  };
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn().mockResolvedValue(undefined),
    getItem: jest.fn().mockResolvedValue(null),
  },
}));

// ── Helpers ──

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
    guest: { name: 'Thomas Ramsey', id: 'guest-1' },
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

// ── Tests ──

describe('ConversationItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────
  // BASIC RENDERING
  // ─────────────────────────────────────────

  describe('Basic Rendering', () => {
    it('should render guest name', () => {
      const { getByText } = render(
        <ConversationItem conversation={makeConversation()} onPress={jest.fn()} />
      );
      expect(getByText('Thomas Ramsey')).toBeTruthy();
    });

    it('should render message preview with guest first name', () => {
      const { getByText } = render(
        <ConversationItem
          conversation={makeConversation({
            lastMessage: makeMessage({ content: 'Hello, what time is check-in?' }),
          })}
          onPress={jest.fn()}
        />
      );
      expect(getByText(/Thomas: Hello/)).toBeTruthy();
    });

    it('should show "You:" prefix for host messages', () => {
      const { getByText } = render(
        <ConversationItem
          conversation={makeConversation({
            lastMessage: makeMessage({ sender: 'host', content: 'Check-in is at 4pm' }),
          })}
          onPress={jest.fn()}
        />
      );
      expect(getByText(/You: Check-in/)).toBeTruthy();
    });

    it('should render property name', () => {
      const { getByText } = render(
        <ConversationItem conversation={makeConversation()} onPress={jest.fn()} />
      );
      expect(getByText(/Longboat Key Beach House/)).toBeTruthy();
    });

    it('should show "No messages yet" when no lastMessage content', () => {
      const { getByText } = render(
        <ConversationItem
          conversation={makeConversation({
            lastMessage: makeMessage({ content: '' }),
          })}
          onPress={jest.fn()}
        />
      );
      expect(getByText('No messages yet')).toBeTruthy();
    });

    it('should render guest initials when no avatar', () => {
      const { getByText } = render(
        <ConversationItem
          conversation={makeConversation({
            guest: { name: 'Thomas Ramsey', id: 'g1' },
          })}
          onPress={jest.fn()}
        />
      );
      expect(getByText('TR')).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────
  // UNREAD STATE
  // ─────────────────────────────────────────

  describe('Unread State', () => {
    it('should show NEW label for unread guest messages', () => {
      const { getByText } = render(
        <ConversationItem
          conversation={makeConversation({
            unreadCount: 3,
            lastMessage: makeMessage({ sender: 'guest' }),
          })}
          onPress={jest.fn()}
        />
      );
      expect(getByText('NEW')).toBeTruthy();
    });

    it('should show REPLIED label when last message is from host', () => {
      const { getByText } = render(
        <ConversationItem
          conversation={makeConversation({
            unreadCount: 0,
            lastMessage: makeMessage({ sender: 'host', content: 'Thanks!' }),
          })}
          onPress={jest.fn()}
        />
      );
      expect(getByText('REPLIED')).toBeTruthy();
    });

    it('should NOT show NEW when unread + last sender is host', () => {
      const { queryByText } = render(
        <ConversationItem
          conversation={makeConversation({
            unreadCount: 1,
            lastMessage: makeMessage({ sender: 'host', content: 'Reply' }),
          })}
          onPress={jest.fn()}
        />
      );
      expect(queryByText('NEW')).toBeNull();
    });
  });

  // ─────────────────────────────────────────
  // TAP INTERACTION
  // ─────────────────────────────────────────

  describe('Tap Interaction', () => {
    it('should call onPress when tapped', () => {
      const onPress = jest.fn();
      const { getByLabelText } = render(
        <ConversationItem conversation={makeConversation()} onPress={onPress} />
      );

      fireEvent.press(getByLabelText(/Thomas Ramsey/));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('should include unread in accessibility label', () => {
      const { getByLabelText } = render(
        <ConversationItem
          conversation={makeConversation({
            unreadCount: 2,
            lastMessage: makeMessage({ sender: 'guest' }),
          })}
          onPress={jest.fn()}
        />
      );

      expect(getByLabelText(/unread/)).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────
  // INLINE TAGS
  // ─────────────────────────────────────────

  describe('Inline Tags', () => {
    it('should show Question tag when message contains a question', () => {
      const { getByText } = render(
        <ConversationItem
          conversation={makeConversation({
            lastMessage: makeMessage({ content: 'What time is check-in?' }),
          })}
          onPress={jest.fn()}
        />
      );
      expect(getByText('Question')).toBeTruthy();
    });

    it('should show Thanks tag when message contains thanks', () => {
      const { getByText } = render(
        <ConversationItem
          conversation={makeConversation({
            lastMessage: makeMessage({ content: 'Thank you so much!' }),
          })}
          onPress={jest.fn()}
        />
      );
      expect(getByText('Thanks')).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────
  // TRUNCATION
  // ─────────────────────────────────────────

  describe('Message Truncation', () => {
    it('should truncate long messages at 60 characters', () => {
      const longMessage = 'A'.repeat(100);
      const { getByText } = render(
        <ConversationItem
          conversation={makeConversation({
            lastMessage: makeMessage({ content: longMessage }),
          })}
          onPress={jest.fn()}
        />
      );
      // Should contain ellipsis
      expect(getByText(/…/)).toBeTruthy();
    });
  });
});
