/* eslint-disable @typescript-eslint/no-require-imports */

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { OnboardingScreen } from '../OnboardingScreen';

const mockStoreState = {
  setOnboarded: jest.fn(),
  setDemoMode: jest.fn(),
  setCredentials: jest.fn(),
  setConversations: jest.fn(),
  setProperties: jest.fn(),
  updateSettings: jest.fn(),
  setPropertyKnowledge: jest.fn(),
  setVoiceReadiness: jest.fn(),
};

const mockValidateCredentials = jest.fn();
const mockInitializeConnection = jest.fn();
const mockStartAutoImportAfterConnect = jest.fn();
const mockConnectHostawayServer = jest.fn();
const mockGetHostawayHistorySyncStatusViaServer = jest.fn();
const mockFetchListings = jest.fn();
const mockFetchConversations = jest.fn();
const mockFetchMessages = jest.fn();
const mockFetchReservation = jest.fn();
const mockFetchListingDetail = jest.fn();
const mockFeatures = { serverProxiedAI: false };

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    createAnimatedComponent: (Component: any) => Component,
    View: require('react-native').View,
  },
  FadeIn: { duration: () => ({}) },
  FadeInDown: { delay: () => ({ duration: () => ({}) }) },
  FadeInUp: { delay: () => ({ duration: () => ({}) }) },
  SlideInRight: { duration: () => ({}) },
  useAnimatedStyle: () => ({}),
  useSharedValue: (value: number) => ({ value }),
  withSpring: (value: number) => value,
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children ?? null,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));

jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const icon = (name: string) => {
    const MockIcon = (props: any) => <View testID={`icon-${name}`} {...props} />;
    MockIcon.displayName = `Mock${name}`;
    return MockIcon;
  };
  return {
    MessageSquare: icon('message-square'),
    Key: icon('key'),
    ArrowRight: icon('arrow-right'),
    Sparkles: icon('sparkles'),
    Shield: icon('shield'),
    Zap: icon('zap'),
    User: icon('user'),
    AlertCircle: icon('alert-circle'),
    Eye: icon('eye'),
    EyeOff: icon('eye-off'),
    Check: icon('check'),
    CheckCircle2: icon('check-circle-2'),
    ChevronRight: icon('chevron-right'),
    Loader: icon('loader'),
  };
});

jest.mock('@/lib/store', () => ({
  useAppStore: (selector: any) => selector(mockStoreState),
}));

jest.mock('@/lib/mockData', () => ({
  demoConversations: [],
  demoProperties: [],
}));

// Use the real tokens so tests stay in sync with token additions.
jest.mock('@/lib/design-tokens', () => jest.requireActual('@/lib/design-tokens'));

jest.mock('@/lib/config', () => ({
  __esModule: true,
  features: mockFeatures,
}));

jest.mock('@/lib/auto-import', () => ({
  startAutoImportAfterConnect: (...args: any[]) => mockStartAutoImportAfterConnect(...args),
}));

jest.mock('@/lib/api-client', () => ({
  connectHostaway: (...args: any[]) => mockConnectHostawayServer(...args),
  getHostawayHistorySyncStatusViaServer: (...args: any[]) =>
    mockGetHostawayHistorySyncStatusViaServer(...args),
}));

jest.mock('@/lib/hostaway', () => ({
  validateCredentials: (...args: any[]) => mockValidateCredentials(...args),
  initializeConnection: (...args: any[]) => mockInitializeConnection(...args),
  fetchListings: (...args: any[]) => mockFetchListings(...args),
  fetchConversations: (...args: any[]) => mockFetchConversations(...args),
  fetchMessages: (...args: any[]) => mockFetchMessages(...args),
  fetchReservation: (...args: any[]) => mockFetchReservation(...args),
  fetchListingDetail: (...args: any[]) => mockFetchListingDetail(...args),
  extractGuestName: () => 'Guest',
}));

jest.mock('@/lib/hostaway-utils', () => ({
  convertListingToProperty: jest.fn(),
  getChannelPlatform: jest.fn(() => 'airbnb'),
  convertHostawayMessage: jest.fn(),
}));

describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatures.serverProxiedAI = false;
    mockValidateCredentials.mockResolvedValue(true);
    mockInitializeConnection.mockResolvedValue(true);
    mockStartAutoImportAfterConnect.mockResolvedValue(undefined);
    mockGetHostawayHistorySyncStatusViaServer.mockResolvedValue(null);
  });

  it('shows Hostaway-only onboarding copy after Get Started', () => {
    const { getByTestId, getByText, queryByText } = render(<OnboardingScreen onComplete={jest.fn()} />);

    fireEvent.press(getByTestId('onboarding-get-started'));

    expect(getByText('Hostaway')).toBeTruthy();
    expect(queryByText('Guesty')).toBeNull();
    expect(queryByText('Lodgify')).toBeNull();
  });

  it('renders the Hostaway connect form immediately when intro is skipped', () => {
    const { getByTestId, queryByTestId } = render(
      <OnboardingScreen onComplete={jest.fn()} skipIntro />
    );

    expect(getByTestId('onboarding-account-id')).toBeTruthy();
    expect(queryByTestId('onboarding-get-started')).toBeNull();
  });

  it('opens inline credential help instead of leaving the link dead', () => {
    const { getByTestId, getByText } = render(<OnboardingScreen onComplete={jest.fn()} />);

    fireEvent.press(getByTestId('onboarding-get-started'));
    fireEvent.press(getByText('Where do I find my API credentials?'));

    expect(getByText('Find your Hostaway API credentials')).toBeTruthy();
    expect(getByText(/Settings > API/i)).toBeTruthy();
  });

  it('connects first and starts background sync without blocking on history import', async () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(<OnboardingScreen onComplete={onComplete} />);

    fireEvent.press(getByTestId('onboarding-get-started'));
    fireEvent.changeText(getByTestId('onboarding-account-id'), '51916');
    fireEvent.changeText(getByTestId('onboarding-api-key'), 'secret-key');
    fireEvent.press(getByTestId('onboarding-connect'));

    await waitFor(() => {
      expect(mockValidateCredentials).toHaveBeenCalledWith('51916', 'secret-key');
      expect(mockInitializeConnection).toHaveBeenCalledWith('51916', 'secret-key');
      expect(mockStoreState.setCredentials).toHaveBeenCalledWith('51916', 'secret-key');
      expect(mockStoreState.setOnboarded).toHaveBeenCalledWith(true);
      expect(mockStartAutoImportAfterConnect).toHaveBeenCalledWith('51916', 'secret-key');
      expect(onComplete).toHaveBeenCalled();
    });

    expect(mockFetchListings).not.toHaveBeenCalled();
    expect(mockFetchConversations).not.toHaveBeenCalled();
    expect(mockFetchMessages).not.toHaveBeenCalled();
    expect(mockFetchReservation).not.toHaveBeenCalled();
    expect(mockFetchListingDetail).not.toHaveBeenCalled();
  });

  it('shows learning state after managed Hostaway connect succeeds', async () => {
    mockConnectHostawayServer.mockResolvedValue({
      status: 'connected',
      provider: 'hostaway',
      accountId: '51916',
      connectedAt: '2026-03-27T00:00:00.000Z',
      historySyncJob: {
        id: 'job-123',
        status: 'running',
        phase: 'conversations',
        dateRangeMonths: 24,
        processedConversations: 10,
        totalConversations: 50,
        processedMessages: 0,
        totalMessages: 0,
        lastError: null,
        startedAt: '2026-03-27T00:00:00.000Z',
        completedAt: null,
        createdAt: '2026-03-27T00:00:00.000Z',
        updatedAt: '2026-03-27T00:00:00.000Z',
        payloadAvailable: false,
        isRunningInMemory: true,
      },
    });
    mockGetHostawayHistorySyncStatusViaServer.mockResolvedValue({
      id: 'job-123',
      status: 'running',
      phase: 'analyzing',
      dateRangeMonths: 24,
      processedConversations: 50,
      totalConversations: 50,
      processedMessages: 320,
      totalMessages: 640,
      lastError: null,
      startedAt: '2026-03-27T00:00:00.000Z',
      completedAt: null,
      createdAt: '2026-03-27T00:00:00.000Z',
      updatedAt: '2026-03-27T00:05:00.000Z',
      payloadAvailable: false,
      isRunningInMemory: true,
    });

    const onComplete = jest.fn();
    const { getByTestId, getByText, queryByTestId, getAllByText } = render(
      <OnboardingScreen onComplete={onComplete} skipIntro managedModeOverride />
    );

    fireEvent.changeText(getByTestId('onboarding-account-id'), '51916');
    fireEvent.changeText(getByTestId('onboarding-api-key'), 'secret-key');
    fireEvent.press(getByTestId('onboarding-connect'));

    await waitFor(() => {
      expect(getByText('Learning In Progress')).toBeTruthy();
      expect(getAllByText(/drafts are available now/i).length).toBeGreaterThan(0);
      expect(getByText(/autopilot stays off until your voice model reaches the readiness gate/i)).toBeTruthy();
      expect(getByTestId('voice-learning-banner')).toBeTruthy();
      expect(queryByTestId('onboarding-connect')).toBeNull();
    });

    expect(mockConnectHostawayServer).toHaveBeenCalledWith('51916', 'secret-key');
    expect(mockGetHostawayHistorySyncStatusViaServer).toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
