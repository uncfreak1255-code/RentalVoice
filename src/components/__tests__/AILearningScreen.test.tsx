import { render, waitFor } from '@testing-library/react-native';
import { AILearningScreen } from '../AILearningScreen';
import { useAppStore } from '@/lib/store';

jest.mock('@/lib/cold-storage', () => ({
  saveCold: jest.fn(),
  removeCold: jest.fn(),
  loadCold: jest.fn().mockResolvedValue([]),
  loadAllColdData: jest.fn().mockResolvedValue({
    conversations: [],
    learningEntries: [],
    draftOutcomes: [],
    calibrationEntries: [],
    replyDeltas: [],
    conversationFlows: [],
    issues: [],
    favoriteMessages: [],
    autoPilotLogs: [],
  }),
  flushAllPending: jest.fn().mockResolvedValue(undefined),
}));

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

jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (Component: any) => Component,
      View,
    },
    FadeIn: { duration: () => ({}) },
    FadeInDown: { delay: () => ({ duration: () => ({}) }) },
    useAnimatedStyle: () => ({}),
    useSharedValue: (value: number) => ({ value }),
    withRepeat: (value: any) => value,
    withTiming: (value: any) => value,
    Easing: { linear: 'linear' },
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: function MockLinearGradient({ children }: any) {
    return children ?? null;
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: function MockSafeAreaView({ children }: any) {
      return <View>{children}</View>;
    },
  };
});

jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const icon = (name: string) => {
    const MockIcon = (props: any) => <View testID={`icon-${name}`} {...props} />;
    MockIcon.displayName = `MockLucide${name}`;
    return MockIcon;
  };
  return new Proxy({}, { get: (_, key: string) => icon(key) });
});

jest.mock('@/lib/history-sync', () => ({
  historySyncManager: {
    loadState: jest.fn().mockResolvedValue(undefined),
    getState: jest.fn(() => ({ phase: 'messages', isPaused: false, processedConversations: 1465, processedMessages: 22486 })),
    getData: jest.fn(() => ({
      conversations: Array.from({ length: 15 }, (_, index) => ({ id: index + 1, listingMapId: 100 + index })),
      messages: Object.fromEntries([
        ...Array.from({ length: 6 }, (_, i) => {
          const id = i + 1;
          return [id, [
            { id: id * 10, conversationId: id, body: 'What is the wifi password?', isIncoming: true, status: 'sent', insertedOn: '2026-03-01T12:00:00Z' },
            { id: id * 10 + 1, conversationId: id, body: 'The wifi password is in your guide.', isIncoming: false, status: 'sent', insertedOn: '2026-03-01T12:05:00Z' },
          ]];
        }),
        ...Array.from({ length: 5 }, (_, i) => {
          const id = i + 7;
          return [id, [
            { id: id * 10, conversationId: id, body: 'Can we check in early tomorrow?', isIncoming: true, status: 'sent', insertedOn: '2026-03-01T12:00:00Z' },
            { id: id * 10 + 1, conversationId: id, body: 'Early check-in depends on cleaning progress.', isIncoming: false, status: 'sent', insertedOn: '2026-03-01T12:05:00Z' },
          ]];
        }),
        ...Array.from({ length: 4 }, (_, i) => {
          const id = i + 12;
          return [id, [
            { id: id * 10, conversationId: id, body: 'Where should we park our car?', isIncoming: true, status: 'sent', insertedOn: '2026-03-01T12:00:00Z' },
            { id: id * 10 + 1, conversationId: id, body: 'Use the driveway.', isIncoming: false, status: 'sent', insertedOn: '2026-03-01T12:05:00Z' },
          ]];
        }),
      ]),
    })),
    onProgress: jest.fn(),
    onError: jest.fn(),
    onComplete: jest.fn(),
    onData: jest.fn(),
    canResume: jest.fn(() => false),
    pause: jest.fn(),
    resume: jest.fn(),
    cancel: jest.fn(),
    clearAndRestart: jest.fn(),
    start: jest.fn(),
    startWithFetchers: jest.fn(),
  },
  formatTimeRemaining: jest.fn(() => '~2s remaining'),
}));

jest.mock('@/lib/background-fetch-service', () => ({
  backgroundSyncManager: {
    loadState: jest.fn().mockResolvedValue(null),
    getProgress: jest.fn(() => null),
    onProgress: jest.fn(() => jest.fn()),
    onData: jest.fn(),
    onComplete: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  },
  isBackgroundFetchAvailable: jest.fn().mockResolvedValue({ available: true, statusText: 'Available' }),
  formatBackgroundSyncStatus: jest.fn(() => 'Available'),
}));

jest.mock('@/lib/ai-training-service', () => ({
  aiTrainingService: {
    loadState: jest.fn().mockResolvedValue(undefined),
    getState: jest.fn(() => ({
      isTraining: false,
      isAutoTraining: false,
      phase: 'complete',
      progress: 100,
      lastTrainingTime: Date.now(),
      hasCompletedInitialTraining: true,
    })),
    getResponseIndex: jest.fn(() => ({
      patterns: [
        { guestIntent: 'wifi' },
        { guestIntent: 'wifi' },
        { guestIntent: 'wifi' },
        { guestIntent: 'wifi' },
        { guestIntent: 'early_checkin' },
        { guestIntent: 'early_checkin' },
      ],
      totalPatterns: 6,
    })),
    onProgress: jest.fn(() => jest.fn()),
    onComplete: jest.fn(() => jest.fn()),
    autoTrainOnFetch: jest.fn(),
    manualTrain: jest.fn(),
  },
  formatTrainingStatus: jest.fn(() => 'Training complete'),
  getTrainingSummary: jest.fn(() => 'Training complete'),
}));

jest.mock('@/lib/retrieval-source', () => ({
  getActiveRetrievalCoverageSource: jest.fn(() => ({
    mode: 'local_few_shot',
    patternCount: 6,
    byIntent: {
      question: 4,
      check_in: 2,
    },
    indexedPatterns: [
      { guestIntent: 'question' },
      { guestIntent: 'question' },
      { guestIntent: 'question' },
      { guestIntent: 'question' },
      { guestIntent: 'check_in' },
      { guestIntent: 'check_in' },
    ],
  })),
}));

jest.mock('@/lib/api-client', () => ({
  clearHostawayHistorySyncViaServer: jest.fn(),
  getHostawayConversationsViaServer: jest.fn(),
  getHostawayHistorySyncResultViaServer: jest.fn(),
  getHostawayHistorySyncStatusViaServer: jest.fn(),
  getHostawayMessagesViaServer: jest.fn(),
  getHostawayStatus: jest.fn().mockResolvedValue({ connected: true }),
  startHostawayHistorySyncViaServer: jest.fn(),
}));

jest.mock('@/lib/config', () => ({
  isCommercial: false,
}));

jest.mock('@/components/ui/SettingsComponents', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return {
    SectionHeader: ({ title }: any) => <Text>{title}</Text>,
    SectionFooter: ({ text }: any) => <Text>{text}</Text>,
    Row: ({ label, right, onPress }: any) => (
      <Pressable onPress={onPress}>
        <Text>{label}</Text>
        {right}
      </Pressable>
    ),
    ValueRow: ({ label, value }: any) => (
      <View>
        <Text>{label}</Text>
        <Text>{String(value)}</Text>
      </View>
    ),
    LinkRow: ({ label, onPress }: any) => (
      <Pressable onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
    s: { card: {} },
  };
});

describe('AILearningScreen', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      const firstArg = String(args[0] ?? '');
      if (firstArg.includes('act(...)')) return;
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState());
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        accountId: '51916',
        apiKey: 'secret',
      },
      historySyncStatus: {
        ...useAppStore.getState().historySyncStatus,
        isSyncing: true,
        syncPhase: 'messages',
        syncProgress: 100,
        processedConversations: 1465,
        processedMessages: 22486,
        estimatedTimeRemaining: 2000,
      },
      aiLearningProgress: {
        ...useAppStore.getState().aiLearningProgress,
        totalMessagesAnalyzed: 13151,
        patternsIndexed: 420,
        lastTrainingResult: {
          hostMessagesAnalyzed: 13151,
          patternsIndexed: 420,
          trainingSampleSize: 8000,
          trainingDurationMs: 45000,
        },
      },
    });
  });

  it('renders truthful import text and recurring coverage summary', async () => {
    const { getAllByText, getByText } = render(<AILearningScreen onBack={jest.fn()} />);

    await waitFor(() => {
      expect(getAllByText('Reading your messages (100%)').length).toBeGreaterThan(0);
      expect(getAllByText('22,486 messages imported').length).toBeGreaterThan(0);
      expect(getByText('Top Repeated Guest Questions')).toBeTruthy();
      expect(getAllByText('50%').length).toBeGreaterThan(0);
      expect(getByText('question')).toBeTruthy();
      expect(getByText('covered')).toBeTruthy();
      expect(getByText('History imported. Learning signals are ready.')).toBeTruthy();
    });
  });
});
