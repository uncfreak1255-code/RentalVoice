import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { InboxDashboard } from '../InboxDashboard';

const mockFetchListings = jest.fn();
const mockFetchConversations = jest.fn();
const mockFetchMessages = jest.fn();
const mockFetchReservation = jest.fn();
const mockUseAppStore = jest.fn();
const mockCheckAndRetrainIfNeeded = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const { View } = jest.requireActual('react-native');
  return function MockSwipeable({ children }: any) {
    return <View>{children}</View>;
  };
});

jest.mock('lucide-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const icon = (name: string) => {
    const MockIcon = (props: any) => <View testID={`icon-${name}`} {...props} />;
    MockIcon.displayName = `Mock${name}`;
    return MockIcon;
  };
  return new Proxy({}, { get: (_, key: string) => icon(key) });
});

jest.mock('@/lib/design-tokens', () => ({
  colors: {
    primary: { DEFAULT: '#14B8A6', muted: '#DFF7F3' },
    bg: { elevated: '#F6F7F9', subtle: '#FAFBFC' },
    text: { primary: '#111827', muted: '#6B7280', secondary: '#374151', inverse: '#FFFFFF' },
    border: { subtle: '#E5E7EB' },
  },
  typography: {
    fontFamily: { regular: 'System', medium: 'System', semibold: 'System', bold: 'System' },
    styles: {
      h2: { fontSize: 24, fontWeight: '600' },
      body: { fontSize: 16, lineHeight: 24 },
    },
  },
  spacing: { '1': 4, '2': 8, '3': 12, '4': 16, '5': 20, '8': 32 },
  radius: { md: 12 },
}));

jest.mock('@/lib/store', () => ({
  useAppStore: (selector: any) => mockUseAppStore(selector),
}));

jest.mock('../ConversationItem', () => ({
  ConversationItem: ({ conversation }: any) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{conversation.guest.name}</Text>;
  },
}));

jest.mock('../DemoModeBanner', () => ({
  DemoModeBanner: () => null,
}));

jest.mock('../DailyBriefingCard', () => ({
  DailyBriefingCard: () => null,
}));

jest.mock('../UndoToast', () => ({
  UndoToast: () => null,
}));

jest.mock('@/lib/demo-data', () => ({
  getDemoConversations: () => [],
}));

jest.mock('@/lib/auto-import', () => ({
  checkAndRetrainIfNeeded: (...args: any[]) => mockCheckAndRetrainIfNeeded(...args),
}));

jest.mock('@/lib/daily-briefing', () => ({
  buildDailyBriefing: () => null,
}));

jest.mock('@/lib/hostaway', () => ({
  fetchListings: (...args: any[]) => mockFetchListings(...args),
  fetchConversations: (...args: any[]) => mockFetchConversations(...args),
  fetchMessages: (...args: any[]) => mockFetchMessages(...args),
  fetchReservation: (...args: any[]) => mockFetchReservation(...args),
  extractGuestName: () => 'Guest',
}));

jest.mock('@/lib/config', () => ({
  features: { serverProxiedAI: false },
}));

jest.mock('@/lib/api-client', () => ({
  getHostawayConversationsViaServer: jest.fn(),
  getHostawayListingsViaServer: jest.fn(),
  getHostawayMessagesViaServer: jest.fn(),
  getHostawayReservationViaServer: jest.fn(),
}));

jest.mock('@/lib/sentiment-analysis', () => ({
  analyzeConversationSentiment: () => ({ currentSentiment: 'neutral' }),
  SENTIMENT_PRIORITY: { neutral: 0 },
}));

jest.mock('@/lib/automation-engine', () => ({
  checkAndSendScheduledMessages: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/hostaway-utils', () => ({
  convertListingToProperty: jest.fn(() => ({ id: 'prop-1', name: '75th ST', address: 'Beach Road' })),
  getChannelPlatform: jest.fn(() => 'airbnb'),
  convertHostawayMessage: jest.fn(),
  parseHostawayTimestamp: jest.fn((value: any) => new Date(value)),
}));

jest.mock('@/lib/push-notifications', () => ({
  notifyNewGuestMessage: jest.fn(),
  notifyAutomationSent: jest.fn(),
  setBadgeCount: jest.fn().mockResolvedValue(undefined),
}));

const baseConversation = {
  id: 'conv-1',
  guest: { id: 'guest-1', name: 'Dean Decker' },
  property: { id: 'prop-1', name: '75th ST', address: 'Beach Road' },
  messages: [],
  lastMessage: {
    id: 'msg-1',
    conversationId: 'conv-1',
    content: 'Can you check the toilet?',
    sender: 'guest',
    timestamp: new Date('2026-03-09T12:00:00Z'),
    isRead: false,
  },
  unreadCount: 1,
  status: 'active',
  workflowStatus: 'active',
  platform: 'airbnb',
  hasAiDraft: false,
};

const mockState: any = {
  conversations: [baseConversation],
  issues: [],
  settings: {
    selectedPropertyId: null,
    accountId: '51916',
    apiKey: 'secret-key',
    inboxSortPreference: 'recent',
    hostName: 'David',
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
  },
  scheduledMessages: [],
  historySyncStatus: {
    isSyncing: false,
    lastFullSync: new Date('2026-03-09T12:00:00Z'),
    syncPhase: 'idle',
    processedMessages: 0,
    processedConversations: 0,
  },
  isDemoMode: false,
  setSelectedProperty: jest.fn(),
  setProperties: jest.fn(),
  setConversations: jest.fn(),
  archiveConversation: jest.fn(),
};

describe('InboxDashboard recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }) as any);
    mockState.conversations = [baseConversation];
    mockCheckAndRetrainIfNeeded.mockResolvedValue(undefined);
    mockFetchListings.mockResolvedValue([]);
    mockFetchConversations.mockResolvedValue([]);
    mockFetchMessages.mockResolvedValue([]);
    mockFetchReservation.mockResolvedValue(null);
    mockUseAppStore.mockImplementation((selector: any) => selector(mockState));
  });

  it('re-fetches when a connected inbox becomes empty after initial load', async () => {
    const view = render(
      <InboxDashboard
        onSelectConversation={jest.fn()}
        onOpenSettings={jest.fn()}
        onOpenCalendar={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(mockFetchConversations).toHaveBeenCalledTimes(1);
    });

    mockState.conversations = [];
    view.rerender(
      <InboxDashboard
        onSelectConversation={jest.fn()}
        onOpenSettings={jest.fn()}
        onOpenCalendar={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(mockFetchConversations).toHaveBeenCalledTimes(2);
    });
  });
});
