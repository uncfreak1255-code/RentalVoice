import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import OnboardingRoute from '../onboarding';

const mockRestoreAccountSession = jest.fn();
const mockSetAccountSession = jest.fn();
const mockEnterDemoMode = jest.fn();
const mockReplace = jest.fn();
const mockFeatures = { publicAccountFirstOnboarding: false };
const mockIsContributorDemoForced = jest.fn(() => false);
let mockAccountSession: unknown = null;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: {
    Success: 'success',
  },
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('@/components/AuthExplainerScreen', () => ({
  AuthExplainerScreen: () => {
    const { Text } = require('react-native');
    return <Text>Auth Explainer Screen</Text>;
  },
}));

jest.mock('@/components/OnboardingScreen', () => ({
  OnboardingScreen: () => {
    const { Text } = require('react-native');
    return <Text>Onboarding Screen</Text>;
  },
}));

jest.mock('@/components/PasswordlessAuthScreen', () => ({
  PasswordlessAuthScreen: () => {
    const { Text } = require('react-native');
    return <Text>Passwordless Auth Screen</Text>;
  },
}));

jest.mock('@/lib/config', () => ({
  get features() {
    return mockFeatures;
  },
  isContributorDemoForced: () => mockIsContributorDemoForced(),
}));

jest.mock('@/lib/store', () => ({
  useAppStore: (selector: (state: any) => unknown) =>
    selector({
      accountSession: mockAccountSession,
      accountSessionLoading: false,
      restoreAccountSession: mockRestoreAccountSession,
      setAccountSession: mockSetAccountSession,
      enterDemoMode: mockEnterDemoMode,
    }),
}));

describe('OnboardingRoute', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatures.publicAccountFirstOnboarding = false;
    mockIsContributorDemoForced.mockImplementation(() => false);
    mockAccountSession = null;
    mockRestoreAccountSession.mockResolvedValue(null);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('shows the explainer and skips account-session restore when contributor demo is forced', async () => {
    mockIsContributorDemoForced.mockImplementation(() => true);

    const screen = render(<OnboardingRoute />);

    await waitFor(() => {
      expect(screen.getByText('Auth Explainer Screen')).toBeTruthy();
    });

    expect(mockRestoreAccountSession).not.toHaveBeenCalled();
  });

  it('lands on connect and skips restore when the account-first flag is off (default)', async () => {
    const screen = render(<OnboardingRoute />);

    await waitFor(() => {
      expect(screen.getByText('Onboarding Screen')).toBeTruthy();
    });

    expect(mockRestoreAccountSession).not.toHaveBeenCalled();
  });

  it('lands on the explainer when the account-first flag is on and no stored session exists', async () => {
    mockFeatures.publicAccountFirstOnboarding = true;
    mockRestoreAccountSession.mockResolvedValueOnce(null);

    const screen = render(<OnboardingRoute />);

    await waitFor(() => {
      expect(screen.getByText('Auth Explainer Screen')).toBeTruthy();
    });

    expect(mockRestoreAccountSession).toHaveBeenCalledTimes(1);
  });

  it('lands on connect without calling restore when the flag is on and accountSession is already in state', async () => {
    mockFeatures.publicAccountFirstOnboarding = true;
    mockAccountSession = {
      token: 't',
      refreshToken: 'r',
      user: { id: 'u', email: 'e@example.com' },
    };

    const screen = render(<OnboardingRoute />);

    await waitFor(() => {
      expect(screen.getByText('Onboarding Screen')).toBeTruthy();
    });

    expect(mockRestoreAccountSession).not.toHaveBeenCalled();
  });

  it('lands on connect when the flag is on and restoreAccountSession returns a session', async () => {
    mockFeatures.publicAccountFirstOnboarding = true;
    mockRestoreAccountSession.mockResolvedValueOnce({
      token: 't',
      refreshToken: 'r',
      user: { id: 'u', email: 'e@example.com' },
    });

    const screen = render(<OnboardingRoute />);

    await waitFor(() => {
      expect(screen.getByText('Onboarding Screen')).toBeTruthy();
    });

    expect(mockRestoreAccountSession).toHaveBeenCalledTimes(1);
  });

  it('falls back to the explainer when the flag is on and restoreAccountSession throws', async () => {
    mockFeatures.publicAccountFirstOnboarding = true;
    mockRestoreAccountSession.mockRejectedValueOnce(new Error('boom'));

    const screen = render(<OnboardingRoute />);

    await waitFor(() => {
      expect(screen.getByText('Auth Explainer Screen')).toBeTruthy();
    });

    expect(mockRestoreAccountSession).toHaveBeenCalledTimes(1);
  });

  it('stays on connect when the flag is off even if restoreAccountSession would reject', async () => {
    mockFeatures.publicAccountFirstOnboarding = false;
    mockRestoreAccountSession.mockRejectedValueOnce(new Error('boom'));

    const screen = render(<OnboardingRoute />);

    await waitFor(() => {
      expect(screen.getByText('Onboarding Screen')).toBeTruthy();
    });

    expect(mockRestoreAccountSession).not.toHaveBeenCalled();
  });
});
