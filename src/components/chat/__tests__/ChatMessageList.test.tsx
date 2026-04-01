import React from 'react';
import { render } from '@testing-library/react-native';
import { ChatMessageList } from '../ChatMessageList';

// ── Mocks ──

jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: { createAnimatedComponent: (C: any) => C, View },
    useAnimatedStyle: () => ({}),
    useSharedValue: (v: any) => ({ value: v }),
    withSpring: (v: any) => v,
    useReducedMotion: () => false,
    FadeIn: { duration: () => ({}) },
    FadeInDown: { duration: () => ({}) },
    FadeOut: { duration: () => ({}) },
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
}));

jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const icon = (name: string) => {
    const I = (props: any) => <View testID={`icon-${name}`} {...props} />;
    I.displayName = name;
    return I;
  };
  return {
    Search: icon('search'),
    MessageSquare: icon('message-square'),
    Copy: icon('copy'),
    MoreVertical: icon('more'),
    Share2: icon('share'),
    BookOpen: icon('book'),
    Volume2: icon('volume'),
    VolumeX: icon('volumex'),
    Check: icon('check'),
    CheckCheck: icon('checkcheck'),
    Clock: icon('clock'),
    AlertCircle: icon('alertcircle'),
    User: icon('user'),
    Brain: icon('brain'),
    Sparkles: icon('sparkles'),
  };
});

jest.mock('@/lib/design-tokens', () => ({
  colors: {
    bg: { base: '#FFF', card: '#FFF', elevated: '#F8F', hover: '#F1F', subtle: '#F8F' },
    primary: { DEFAULT: '#14B', light: '#2DD', muted: '#14B15', soft: '#14B25' },
    text: { primary: '#1E2', secondary: '#475', muted: '#647', disabled: '#6B7', inverse: '#FFF' },
    border: { subtle: '#F1F', DEFAULT: '#E2E' },
    danger: { DEFAULT: '#EF4' },
    success: { DEFAULT: '#22C' },
    warning: { DEFAULT: '#EAB' },
    accent: { DEFAULT: '#F97' },
    status: { online: '#22C', urgent: '#EF4' },
  },
  typography: { fontFamily: { regular: 'System', medium: 'System', semibold: 'System', bold: 'System' } },
  spacing: { '0': 0, '1': 4, '1.5': 6, '2': 8, '3': 12, '4': 16, '5': 20, '6': 24, '8': 32 },
  radius: { md: 12, xl: 20, full: 9999 },
}));

// Mock MessageBubble since it's a separate component
jest.mock('../../MessageBubble', () => ({
  MessageBubble: ({ message }: any) => {
    const { Text } = require('react-native');
    return <Text testID={`bubble-${message.id}`}>{message.content}</Text>;
  },
}));

// ── Helpers ──

const makeMessage = (id: string, sender: string, content: string, timestamp?: string) => ({
  id,
  conversationId: 'conv-1',
  sender,
  content,
  timestamp: timestamp ? new Date(timestamp) : new Date(),
  isRead: true,
});

const listRef = { current: null };

// ── Tests ──

describe('ChatMessageList', () => {
  it('renders empty state when no messages and no search', () => {
    const { getByText } = render(
      <ChatMessageList
        displayMessages={[]}
        guestName="John"
        conversationId="conv-1"
        searchQuery=""
        listRef={listRef}
      />,
    );
    expect(getByText('No messages yet')).toBeTruthy();
  });

  it('renders search empty state when no matching messages', () => {
    const { getByText } = render(
      <ChatMessageList
        displayMessages={[]}
        guestName="John"
        conversationId="conv-1"
        searchQuery="nonexistent"
        listRef={listRef}
      />,
    );
    expect(getByText('No matching messages')).toBeTruthy();
  });

  it('renders messages via MessageBubble', () => {
    const messages = [
      makeMessage('m1', 'guest', 'Hello!'),
      makeMessage('m2', 'host', 'Hi there!'),
    ];
    const { getByText } = render(
      <ChatMessageList
        displayMessages={messages as any}
        guestName="John"
        conversationId="conv-1"
        searchQuery=""
        listRef={listRef}
      />,
    );
    expect(getByText('Hello!')).toBeTruthy();
    expect(getByText('Hi there!')).toBeTruthy();
  });

  it('renders date separator between messages on different days', () => {
    const messages = [
      makeMessage('m1', 'guest', 'Old message', '2026-03-01T10:00:00Z'),
      makeMessage('m2', 'guest', 'New message', '2026-03-15T10:00:00Z'),
    ];
    const { getByText } = render(
      <ChatMessageList
        displayMessages={messages as any}
        guestName="John"
        conversationId="conv-1"
        searchQuery=""
        listRef={listRef}
      />,
    );
    // Both messages should render
    expect(getByText('Old message')).toBeTruthy();
    expect(getByText('New message')).toBeTruthy();
  });

  it('passes correct props to MessageBubble', () => {
    const messages = [makeMessage('m1', 'guest', 'Test')];
    const { getByTestId } = render(
      <ChatMessageList
        displayMessages={messages as any}
        guestAvatar="https://img.test/avatar.jpg"
        guestName="Jane"
        conversationId="conv-1"
        propertyId="prop-1"
        searchQuery=""
        listRef={listRef}
      />,
    );
    expect(getByTestId('bubble-m1')).toBeTruthy();
  });
});
