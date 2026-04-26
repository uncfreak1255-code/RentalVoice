import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import OnboardingRoute from '../onboarding';

const mockRestoreAccountSession = jest.fn();
const mockSetAccountSession = jest.fn();
const mockEnterDemoMode = jest.fn();
const mockReplace = jest.fn();

const mockFeatures = { publicAccountFirstOnboarding: false };
const mockStoreState: {
  accountSession: { token: string; refreshToken: string; user: unknown } | null;
  accountSessionLoading: boolean;
  restoreAccountSession: (...args: unknown[]) => unknown;
  setAccountSession: (...args: unknown[]) => unknown;
  enterDemoMode: (...args: unknown[]) => unknown;
} = {
  accountSession: null,
  accountSessionLoading: false,
  restoreAccountSession: (...args: unknown[]) => mockRestoreAccountSession(...args),
  setAccountSession: (...args: unknown[]) => mockSetAccountSession(...args),
  enterDemoMode: (...args: unknown[]) => mockEnterDemoMode(...args),
};

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

// The getter defers `mockFeatures` lookup until each access, so tests can flip
// `mockFeatures.publicAccountFirstOnboarding` in `beforeEach` without running
// into Jest's `jest.mock` hoisting above the `const` initializer.
jest.mock('@/lib/config', () => ({
  get features() {
    return mockFeatures;
  },
  isContributorDemoForced: () => process.env.EXPO_PUBLIC_FORCE_DEMO === '1',
}));

jest.mock('@/lib/store', () => ({
  useAppStore: (selector: (state: any) => unknown) => selector(mockStoreState),
}));

describe('OnboardingRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.EXPO_PUBLIC_FORCE_DEMO;
    mockFeatures.publicAccountFirstOnboarding = false;
    mockStoreState.accountSession = null;
    mockStoreState.accountSessionLoading = false;
    mockRestoreAccountSession.mockResolvedValue(null);
  });

  it('defaults directly to connect flow and does not restore the account session when the flag is off', async () => {
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

  it('shows the explainer when the flag is on and no session can be restored', async () => {
    mockFeatures.publicAccountFirstOnboarding = true;
    mockRestoreAccountSession.mockResolvedValueOnce(null);

    const screen = render(<OnboardingRoute />);

    await waitFor(() => {
      expect(screen.getByText('Auth Explainer Screen')).toBeTruthy();
    });

    expect(mockRestoreAccountSession).toHaveBeenCalledTimes(1);
  });

  it('routes to connect when the flag is on and an account session is already in state', async () => {
    mockFeatures.publicAccountFirstOnboarding = true;
    mockStoreState.accountSession = { token: 't', refreshToken: 'r', user: { id: 'u' } };

    const screen = render(<OnboardingRoute />);

    await waitFor(() => {
      expect(screen.getByText('Onboarding Screen')).toBeTruthy();
    });

    expect(mockRestoreAccountSession).not.toHaveBeenCalled();
  });

  it('routes to connect when the flag is on and the stored session is successfully restored', async () => {
    mockFeatures.publicAccountFirstOnboarding = true;
    mockRestoreAccountSession.mockResolvedValueOnce({ token: 't', refreshToken: 'r', user: { id: 'u' } });

    const screen = render(<OnboardingRoute />);

    await waitFor(() => {
      expect(screen.getByText('Onboarding Screen')).toBeTruthy();
    });

    expect(mockRestoreAccountSession).toHaveBeenCalledTimes(1);
  });

  it('falls back to the explainer when the flag is on and session restore throws', async () => {
    mockFeatures.publicAccountFirstOnboarding = true;
    mockRestoreAccountSession.mockRejectedValueOnce(new Error('boom'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const screen = render(<OnboardingRoute />);

      await waitFor(() => {
        expect(screen.getByText('Auth Explainer Screen')).toBeTruthy();
      });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('routes to the explainer for forced demo even when the account-first flag is on', async () => {
    process.env.EXPO_PUBLIC_FORCE_DEMO = '1';
    mockFeatures.publicAccountFirstOnboarding = true;
    mockStoreState.accountSession = { token: 't', refreshToken: 'r', user: { id: 'u' } };

    const screen = render(<OnboardingRoute />);

    await waitFor(() => {
      expect(screen.getByText('Auth Explainer Screen')).toBeTruthy();
    });

    expect(mockRestoreAccountSession).not.toHaveBeenCalled();
  });

  it('routes flag-off to connect even when an account session is already in state', async () => {
    mockFeatures.publicAccountFirstOnboarding = false;
    mockStoreState.accountSession = { token: 't', refreshToken: 'r', user: { id: 'u' } };

    const screen = render(<OnboardingRoute />);

    await waitFor(() => {
      expect(screen.getByText('Onboarding Screen')).toBeTruthy();
    });

    expect(mockRestoreAccountSession).not.toHaveBeenCalled();
  });
});
