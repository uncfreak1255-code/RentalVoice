import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ChatScreen } from '../ChatScreen';

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
    SlideInDown: { duration: () => ({}) },
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
}));

jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const icon = (name: string) => {
    const I = (props: any) => <View testID={`icon-${name}`} {...props} />;
    I.displayName = name;
    return I;
  };
  return new Proxy({}, { get: (_, name: string) => icon(name) });
});

jest.mock('@/lib/design-tokens', () => ({
  colors: {
    bg: { base: '#FFF', card: '#FFF', elevated: '#F8F', hover: '#F1F', subtle: '#F8F' },
    primary: { DEFAULT: '#14B', light: '#2DD', muted: '#14B15', soft: '#14B25' },
    accent: { DEFAULT: '#F97', light: '#FB9', muted: '#F9715', soft: '#F9725' },
    danger: { DEFAULT: '#EF4', light: '#F87', muted: '#EF415' },
    success: { DEFAULT: '#22C' },
    warning: { DEFAULT: '#EAB' },
    text: { primary: '#1E2', secondary: '#475', muted: '#647', disabled: '#6B7', inverse: '#FFF' },
    border: { subtle: '#F1F', DEFAULT: '#E2E', strong: '#CBD' },
    status: { online: '#22C', urgent: '#EF4' },
  },
  typography: {
    fontFamily: { regular: 'System', medium: 'System', semibold: 'System', bold: 'System' },
    styles: {},
  },
  spacing: { '0': 0, '0.5': 2, '1': 4, '1.5': 6, '2': 8, '2.5': 10, '3': 12, '4': 16, '5': 20, '6': 24, '8': 32 },
  radius: { none: 0, sm: 8, md: 12, lg: 16, xl: 20, full: 9999 },
  elevation: { none: {}, shadows: { premium: { sm: {}, md: {}, lg: {} } } },
  animation: { spring: { bouncy: {}, subtle: {}, snappy: {} }, duration: {} },
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: (props: any) => {
    const { View } = require('react-native');
    return <View {...props} />;
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

// Mock child components
jest.mock('../ChatHeader', () => ({
  ChatHeader: (props: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="chat-header">
        <Text testID="header-guest-name">{props.conversation?.guest?.name}</Text>
      </View>
    );
  },
}));

jest.mock('../ChatMessageList', () => ({
  ChatMessageList: () => {
    const { View } = require('react-native');
    return <View testID="chat-message-list" />;
  },
}));

jest.mock('../../MessageComposer', () => ({
  MessageComposer: () => {
    const { View } = require('react-native');
    return <View testID="message-composer" />;
  },
}));

jest.mock('../../AIDraftActionsSheet', () => ({
  AIDraftActionsSheet: () => null,
}));

jest.mock('../../GuestProfileScreen', () => ({
  GuestProfileScreen: ({ onBack }: any) => {
    const { View, Pressable, Text } = require('react-native');
    return (
      <View testID="guest-profile">
        <Pressable onPress={onBack}><Text>Back from profile</Text></Pressable>
      </View>
    );
  },
}));

jest.mock('@gorhom/bottom-sheet', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/lib/advanced-training', () => ({
  guestMemoryManager: { getGuestMemory: jest.fn(() => null) },
}));

// Mock the hooks used by ChatScreen
jest.mock('../useChatDraftEngine', () => ({
  useChatDraftEngine: () => ({
    currentEnhancedDraft: null,
    isGeneratingDraft: false,
    isSending: false,
    rateLimitError: null,
    rateLimitActionLabel: null,
    editLearningSummary: null,
    learningToastType: 'edit',
    handleSendMessage: jest.fn(),
    handleApproveAiDraft: jest.fn(),
    handleRegenerateAiDraft: jest.fn(),
    handleEditAiDraft: jest.fn(),
    handleDismissAiDraft: jest.fn(),
    handleFixConflict: jest.fn(),
    dismissComposerNotice: jest.fn(),
  }),
}));

jest.mock('../useChatIssues', () => ({
  useChatIssues: () => ({
    triagedIssue: null,
    latestConversationIssue: null,
    issueTriageCollapsed: false,
    savedHandoffDraft: null,
    toggleIssueTriageCollapsed: jest.fn(),
    handleIssueNeedsFollowUp: jest.fn(),
    handleIssueCreateHandoff: jest.fn(),
    handleIssueResumeHandoff: jest.fn(),
    handleIssueMarkResolved: jest.fn(),
  }),
}));

// Store mock
const mockConversation = {
  id: 'conv-1',
  guest: { name: 'Alice', email: 'alice@test.com' },
  property: { id: 'p1', name: 'Beach House' },
  messages: [],
  unreadCount: 1,
  status: 'active',
  platform: 'hostaway',
  hasAiDraft: false,
};

jest.mock('@/lib/store', () => ({
  useAppStore: (selector: any) => {
    const state = {
      conversations: [mockConversation],
      markAsRead: jest.fn(),
      settings: {
        autoPilotEnabled: false,
        autoPilotConfidenceThreshold: 85,
      },
      propertyKnowledge: {},
    };
    return selector(state);
  },
}));

// ── Tests ──

describe('ChatScreen', () => {
  it('renders header, message list, and composer', () => {
    const { getByTestId } = render(
      <ChatScreen conversationId="conv-1" onBack={jest.fn()} />,
    );
    expect(getByTestId('chat-header')).toBeTruthy();
    expect(getByTestId('chat-message-list')).toBeTruthy();
    expect(getByTestId('message-composer')).toBeTruthy();
  });

  it('shows empty state when conversation not found', () => {
    const { getByText } = render(
      <ChatScreen conversationId="nonexistent" onBack={jest.fn()} />,
    );
    expect(getByText('Conversation unavailable')).toBeTruthy();
  });

  it('calls onBack from empty state Go Back button', () => {
    const onBack = jest.fn();
    const { getByText } = render(
      <ChatScreen conversationId="nonexistent" onBack={onBack} />,
    );
    fireEvent.press(getByText('Go Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('passes guest name to header', () => {
    const { getByTestId } = render(
      <ChatScreen conversationId="conv-1" onBack={jest.fn()} />,
    );
    expect(getByTestId('header-guest-name').props.children).toBe('Alice');
  });
});
