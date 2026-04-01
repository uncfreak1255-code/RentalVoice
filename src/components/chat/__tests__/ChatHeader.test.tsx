import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ChatHeader } from '../ChatHeader';

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
    Phone: icon('phone'), Home: icon('home'), Calendar: icon('calendar'),
    User: icon('user'), Brain: icon('brain'), Search: icon('search'), X: icon('x'),
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
  spacing: { '0': 0, '0.5': 2, '1': 4, '1.5': 6, '2': 8, '2.5': 10, '3': 12, '4': 16, '5': 20, '6': 24, '8': 32 },
  radius: { md: 12, xl: 20, full: 9999 },
}));

jest.mock('../../ReservationSummaryBar', () => ({
  ReservationSummaryBar: () => null,
}));

jest.mock('../../GuestMemoryCard', () => {
  return { __esModule: true, default: () => null };
});

jest.mock('../../IssueTriageCard', () => {
  return { __esModule: true, default: () => null };
});

jest.mock('../../ConversationSummaryDisplay', () => ({
  ConversationSummaryDisplay: () => null,
}));

// ── Helpers ──

const makeConversation = (overrides?: any) => ({
  id: 'conv-1',
  guest: { name: 'John Doe', email: 'john@test.com', phone: '+1234567890' },
  property: { id: 'prop-1', name: 'Beach House' },
  checkInDate: '2026-04-01',
  checkOutDate: '2026-04-05',
  messages: [],
  unreadCount: 0,
  status: 'active',
  platform: 'hostaway',
  hasAiDraft: false,
  ...overrides,
});

const baseProps = {
  conversation: makeConversation() as any,
  onBack: jest.fn(),
  onShowGuestProfile: jest.fn(),
  isSearchOpen: false,
  searchQuery: '',
  onToggleSearch: jest.fn(),
  onSearchQueryChange: jest.fn(),
  showGuestInfo: false,
  onToggleGuestInfo: jest.fn(),
  editLearningSummary: null as string | null,
  learningToastType: 'edit' as const,
  triagedIssue: null,
  latestConversationIssue: null,
  issueTriageCollapsed: false,
  savedHandoffDraft: null,
  onToggleIssueTriageCollapsed: jest.fn(),
  onIssueNeedsFollowUp: jest.fn(),
  onIssueCreateHandoff: jest.fn(),
  onIssueResumeHandoff: jest.fn(),
  onIssueMarkResolved: jest.fn(),
  guestMemory: null,
  guestStayCount: 0,
  guestMemoryCollapsed: false,
  onToggleGuestMemoryCollapsed: jest.fn(),
};

// ── Tests ──

describe('ChatHeader', () => {
  it('renders guest name', () => {
    const { getByText } = render(<ChatHeader {...baseProps} />);
    expect(getByText('John Doe')).toBeTruthy();
  });

  it('renders Done button and calls onBack', () => {
    const onBack = jest.fn();
    const { getByText } = render(<ChatHeader {...baseProps} onBack={onBack} />);
    fireEvent.press(getByText('Done'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('calls onShowGuestProfile when guest name tapped', () => {
    const onShowGuestProfile = jest.fn();
    const { getByText } = render(
      <ChatHeader {...baseProps} onShowGuestProfile={onShowGuestProfile} />,
    );
    fireEvent.press(getByText('John Doe'));
    expect(onShowGuestProfile).toHaveBeenCalledTimes(1);
  });

  it('renders search bar when isSearchOpen is true', () => {
    const { getByPlaceholderText } = render(
      <ChatHeader {...baseProps} isSearchOpen={true} />,
    );
    expect(getByPlaceholderText('Search messages...')).toBeTruthy();
  });

  it('calls onSearchQueryChange when typing in search', () => {
    const onSearchQueryChange = jest.fn();
    const { getByPlaceholderText } = render(
      <ChatHeader {...baseProps} isSearchOpen={true} onSearchQueryChange={onSearchQueryChange} />,
    );
    fireEvent.changeText(getByPlaceholderText('Search messages...'), 'hello');
    expect(onSearchQueryChange).toHaveBeenCalledWith('hello');
  });

  it('renders learning toast when editLearningSummary is set', () => {
    const { getByText } = render(
      <ChatHeader
        {...baseProps}
        editLearningSummary="AI will remember this"
        learningToastType="edit"
      />,
    );
    expect(getByText('AI will remember this')).toBeTruthy();
    expect(getByText('Learned from your edit')).toBeTruthy();
  });

  it('shows approval toast label', () => {
    const { getByText } = render(
      <ChatHeader
        {...baseProps}
        editLearningSummary="Style reinforced"
        learningToastType="approval"
      />,
    );
    expect(getByText('Draft approved')).toBeTruthy();
  });

  it('shows guest info panel when showGuestInfo is true', () => {
    const { getByText } = render(
      <ChatHeader {...baseProps} showGuestInfo={true} />,
    );
    expect(getByText('john@test.com')).toBeTruthy();
    expect(getByText('Beach House')).toBeTruthy();
  });

  it('renders "Guest" when guest name is empty', () => {
    const conv = makeConversation({ guest: { name: '', email: 'a@b.com' } });
    const { getByText } = render(
      <ChatHeader {...baseProps} conversation={conv as any} />,
    );
    expect(getByText('Guest')).toBeTruthy();
  });
});
