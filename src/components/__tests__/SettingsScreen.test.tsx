import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { SettingsScreen } from '../SettingsScreen';

const mockUseAppStore = jest.fn();
const mockUseNotifications = jest.fn();

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: function MockSafeAreaView({ children }: any) {
      return <View>{children}</View>;
    },
  };
});

jest.mock('@react-native-community/slider', () => 'Slider');

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

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('@/lib/store', () => ({
  useAppStore: (selector: any) => mockUseAppStore(selector),
}));

jest.mock('@/lib/NotificationProvider', () => ({
  useNotifications: () => mockUseNotifications(),
}));

jest.mock('@/lib/hostaway', () => ({
  disconnectHostaway: jest.fn(),
}));

jest.mock('@/lib/ai-usage-limiter', () => ({
  getUsageStats: jest.fn().mockResolvedValue({
    draftsToday: 0,
    dailyLimit: 50,
    dailyPercentage: 0,
    draftsThisMonth: 0,
    tierLabel: 'Starter',
  }),
}));

jest.mock('@/lib/ai-keys', () => ({
  getSelectedModel: jest.fn().mockResolvedValue(null),
  getAvailableModels: jest.fn().mockResolvedValue([{ name: 'Gemini 2.0 Flash' }]),
  AI_MODELS: [],
}));

jest.mock('@/lib/config', () => ({
  features: {
    serverProxiedAI: false,
  },
}));

jest.mock('@/lib/api-client', () => ({
  disconnectHostaway: jest.fn(),
  getAIUsage: jest.fn(),
  getCurrentEntitlements: jest.fn(),
}));

jest.mock('lucide-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const icon = (name: string) => {
    const MockIcon = (props: any) => <View testID={`icon-${name}`} {...props} />;
    MockIcon.displayName = `MockLucide${name}`;
    return MockIcon;
  };
  return new Proxy({}, { get: (_, key: string) => icon(key) });
});

jest.mock('@/lib/design-tokens', () => ({
  colors: {
    primary: { DEFAULT: '#14B8A6' },
    danger: { DEFAULT: '#EF4444' },
    bg: { base: '#FFFFFF', card: '#F9FAFB', elevated: '#F3F4F6' },
    text: { primary: '#111827', secondary: '#374151', muted: '#6B7280' },
    border: { subtle: '#E5E7EB' },
  },
  typography: {
    fontFamily: { regular: 'System', medium: 'System', semibold: 'System', bold: 'System' },
  },
  spacing: { '2': 8, '3': 12, '4': 16 },
  radius: { md: 12 },
}));

jest.mock('@/lib/useThemeColors', () => ({
  useThemeColors: () => ({
    bg: { base: '#FFFFFF', card: '#F9FAFB' },
    text: { primary: '#111827', secondary: '#374151', muted: '#6B7280' },
  }),
  useIsDark: () => false,
}));

jest.mock('../ui/SettingsBottomSheet', () => ({
  SettingsBottomSheet: () => null,
}));

jest.mock('../DemoModeBanner', () => ({
  DemoModeBanner: () => null,
}));

jest.mock('@/lib/learning-sync', () => ({
  syncLearningToCloud: jest.fn(),
  canSync: jest.fn(() => false),
}));

jest.mock('../ConfidenceDetail', () => () => null);
jest.mock('../TestVoiceScreen', () => ({
  TestVoiceScreen: () => null,
}));
jest.mock('../AIProviderSettingsScreen', () => ({
  AIProviderSettingsScreen: () => null,
}));
jest.mock('../AutomationsScreen', () => ({
  AutomationsScreen: () => null,
}));
jest.mock('../SyncDataScreen', () => ({
  SyncDataScreen: () => null,
}));
jest.mock('../HelpCenterScreen', () => ({
  HelpCenterScreen: () => null,
}));
jest.mock('../ApiSettingsScreen', () => ({
  ApiSettingsScreen: () => null,
}));

jest.mock('../ui/SettingsComponents', () => {
  const { Text, View, Pressable, Switch } = jest.requireActual('react-native');

  const Row = ({ label, right, isLast }: any) => (
    <View accessibilityLabel={`row-${label}`}>
      <Text>{label}</Text>
      {right}
      {isLast ? <Text>last-row</Text> : null}
    </View>
  );

  const ValueRow = ({ label, value, isLast }: any) => (
    <View accessibilityLabel={`value-row-${label}`}>
      <Text>{label}</Text>
      <Text>{String(value)}</Text>
      {isLast ? <Text>last-row</Text> : null}
    </View>
  );

  const ToggleRow = ({ label, value, onValueChange, isLast }: any) => (
    <View accessibilityLabel={`toggle-row-${label}`}>
      <Text>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
      {isLast ? <Text>last-row</Text> : null}
    </View>
  );

  const LinkRow = ({ label, onPress, isLast }: any) => (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Text>{label}</Text>
      {isLast ? <Text>last-row</Text> : null}
    </Pressable>
  );

  return {
    SectionHeader: ({ title }: any) => <Text>{title}</Text>,
    SectionFooter: ({ text }: any) => <Text>{text}</Text>,
    Row,
    ToggleRow,
    ValueRow,
    LinkRow,
    useThemedCardStyle: () => ({}),
    s: {
      card: {},
      tealValue: {},
      row: {},
      iconBox: {},
    },
  };
});

const baseState = {
  settings: {
    pushNotificationsEnabled: true,
    autoPilotEnabled: false,
    autoPilotConfidenceThreshold: 85,
    culturalToneEnabled: true,
    notificationCategories: { newMessage: true },
  },
  isDemoMode: false,
  analytics: {
    totalMessagesHandled: 15,
    aiResponsesApproved: 8,
    aiResponsesEdited: 2,
    aiResponsesRejected: 0,
  },
  aiLearningProgress: {
    totalMessagesAnalyzed: 472,
  },
  currentTier: 'free',
  learningEntries: [
    { wasApproved: true, wasEdited: false },
    { wasApproved: false, wasEdited: true },
  ],
  draftOutcomes: [
    { outcomeType: 'independent' },
    { outcomeType: 'approved' },
  ],
};

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNotifications.mockReturnValue({
      isRegistered: true,
      registerForNotifications: jest.fn(),
    });
    mockUseAppStore.mockImplementation((selector: any) =>
      selector({
        ...baseState,
        updateSettings: jest.fn(),
      })
    );
  });

  it('shows effective trained messages across analysis and learned outcomes', async () => {
    const { getByText } = render(
      <SettingsScreen onBack={jest.fn()} onLogout={jest.fn()} onNavigate={jest.fn()} />
    );

    await waitFor(() => {
      expect(getByText('475 messages trained. The AI learns from your edits and approvals.')).toBeTruthy();
    });
  });

  it('shows upgrade CTA for Auto-Pilot on free personal mode', async () => {
    const { getByText, queryByText } = render(
      <SettingsScreen onBack={jest.fn()} onLogout={jest.fn()} onNavigate={jest.fn()} />
    );

    await waitFor(() => {
      expect(getByText('Unlock Auto-Pilot')).toBeTruthy();
      expect(queryByText('Auto-Pilot Mode')).toBeNull();
    });
  });
});
