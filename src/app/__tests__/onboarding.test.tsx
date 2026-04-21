import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import OnboardingRoute from '../onboarding';

const mockRestoreAccountSession = jest.fn();
const mockSetAccountSession = jest.fn();
const mockEnterDemoMode = jest.fn();
const mockReplace = jest.fn();

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
  features: {
    publicAccountFirstOnboarding: false,
  },
  isContributorDemoForced: () => process.env.EXPO_PUBLIC_FORCE_DEMO === '1',
}));

jest.mock('@/lib/store', () => ({
  useAppStore: (selector: (state: any) => unknown) =>
    selector({
      accountSession: null,
      accountSessionLoading: false,
      restoreAccountSession: (...args: unknown[]) => mockRestoreAccountSession(...args),
      setAccountSession: (...args: unknown[]) => mockSetAccountSession(...args),
      enterDemoMode: (...args: unknown[]) => mockEnterDemoMode(...args),
    }),
}));

describe('OnboardingRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.EXPO_PUBLIC_FORCE_DEMO;
    mockRestoreAccountSession.mockResolvedValue(null);
  });

  it('defaults directly to connect flow and skips account-session restore when account-first onboarding is not enabled', async () => {
    const screen = render(<OnboardingRoute />);

    await waitFor(() => {
      expect(screen.getByText('Onboarding Screen')).toBeTruthy();
    });

    expect(mockRestoreAccountSession).not.toHaveBeenCalled();
  });

  it('shows the explainer and skips account-session restore when contributor demo is forced', async () => {
    process.env.EXPO_PUBLIC_FORCE_DEMO = '1';

    const screen = render(<OnboardingRoute />);

    await waitFor(() => {
      expect(screen.getByText('Auth Explainer Screen')).toBeTruthy();
    });

    expect(mockRestoreAccountSession).not.toHaveBeenCalled();
  });
});
