import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { FounderAccessScreen } from '../FounderAccessScreen';

const mockUseAppStore = jest.fn();
const mockRequestEmailCode = jest.fn();
const mockVerifyEmailCode = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockSetFounderAuthSession = jest.fn();
const mockClearFounderAuthSession = jest.fn();
const mockSetFounderSession = jest.fn();
const mockMigrateLocalLearningToVerifiedFounderCommercial = jest.fn();
let mockStoreState: any;

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: function MockSafeAreaView({ children }: any) {
      return <View>{children}</View>;
    },
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));

jest.mock('@/lib/config', () => ({
  APP_MODE: 'personal',
}));

jest.mock('@/lib/api-client', () => ({
  requestEmailCode: (...args: any[]) => mockRequestEmailCode(...args),
  verifyEmailCode: (...args: any[]) => mockVerifyEmailCode(...args),
  getCurrentUser: (...args: any[]) => mockGetCurrentUser(...args),
}));

jest.mock('@/lib/commercial-migration', () => ({
  migrateLocalLearningToVerifiedFounderCommercial: (...args: any[]) =>
    mockMigrateLocalLearningToVerifiedFounderCommercial(...args),
}));

jest.mock('@/lib/store', () => {
  const mockedStore = (selector: any) => mockUseAppStore(selector);
  mockedStore.getState = () => mockStoreState;
  return {
    useAppStore: mockedStore,
  };
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

jest.mock('../ui/SettingsComponents', () => {
  const { Text, View, Pressable } = jest.requireActual('react-native');

  const ValueRow = ({ label, value }: any) => (
    <View>
      <Text>{label}</Text>
      <Text>{String(value)}</Text>
    </View>
  );

  const LinkRow = ({ label, onPress }: any) => (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Text>{label}</Text>
    </Pressable>
  );

  return {
    SectionHeader: ({ title }: any) => <Text>{title}</Text>,
    SectionFooter: ({ text }: any) => <Text>{text}</Text>,
    ValueRow,
    LinkRow,
    s: {
      card: {},
      row: {},
      iconBox: {},
      tealValue: {},
    },
  };
});

describe('FounderAccessScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockRequestEmailCode.mockResolvedValue({ success: true });
    mockVerifyEmailCode.mockResolvedValue({
      token: 'token-1',
      refreshToken: 'refresh-1',
      user: {
        id: 'user-1',
        email: 'sawyerbeck25@gmail.com',
        name: 'Sawyer',
        plan: 'enterprise',
        trialEndsAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });
    mockGetCurrentUser.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'sawyerbeck25@gmail.com',
        name: 'Sawyer',
        plan: 'enterprise',
        trialEndsAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      organization: { id: 'org-1', role: 'owner', name: 'Rental Voice' },
      founderAccess: true,
    });

    mockSetFounderSession.mockImplementation((session) => {
      mockStoreState = {
        ...mockStoreState,
        founderSession: session,
      };
    });

    mockStoreState = {
      founderSession: null,
      founderSessionLoading: false,
      restoreFounderSession: jest.fn().mockResolvedValue(null),
      clearFounderSession: jest.fn(),
      clearFounderAuthSession: mockClearFounderAuthSession,
      setFounderAuthSession: mockSetFounderAuthSession,
      setFounderSession: mockSetFounderSession,
    };

    mockUseAppStore.mockImplementation((selector: any) => selector(mockStoreState));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests an email code and verifies it into an active founder session', async () => {
    const { getByPlaceholderText, getByText } = render(
      <FounderAccessScreen onBack={jest.fn()} onNavigate={jest.fn()} />
    );

    fireEvent.changeText(getByPlaceholderText('Email'), 'sawyerbeck25@gmail.com');
    fireEvent.press(getByText('Send Code'));

    await waitFor(() => {
      expect(mockRequestEmailCode).toHaveBeenCalledWith('sawyerbeck25@gmail.com');
      expect(getByPlaceholderText('6-digit code')).toBeTruthy();
    });

    fireEvent.changeText(getByPlaceholderText('6-digit code'), '123456');
    fireEvent.press(getByText('Verify Code'));

    await waitFor(() => {
      expect(mockVerifyEmailCode).toHaveBeenCalledWith('sawyerbeck25@gmail.com', '123456');
      expect(mockGetCurrentUser).toHaveBeenCalled();
      expect(mockSetFounderAuthSession).toHaveBeenCalledWith(
        expect.objectContaining({
          accountSession: expect.objectContaining({
            token: 'token-1',
            refreshToken: 'refresh-1',
            user: expect.objectContaining({
              id: 'user-1',
              email: 'sawyerbeck25@gmail.com',
            }),
          }),
          founderSession: expect.objectContaining({
            userId: 'user-1',
            orgId: 'org-1',
            email: 'sawyerbeck25@gmail.com',
            accessToken: 'token-1',
            refreshToken: 'refresh-1',
            migrationState: 'pending',
            validatedAt: expect.any(String),
          }),
        })
      );
    });
  });

  it('clears leaked account auth when founder verification succeeds but org data is missing', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      user: {
        id: 'user-1',
        email: 'sawyerbeck25@gmail.com',
        name: 'Sawyer',
        plan: 'enterprise',
        trialEndsAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      organization: null,
      founderAccess: true,
    });

    const { getByPlaceholderText, getByText, queryByText } = render(
      <FounderAccessScreen onBack={jest.fn()} onNavigate={jest.fn()} />
    );

    fireEvent.changeText(getByPlaceholderText('Email'), 'sawyerbeck25@gmail.com');
    fireEvent.press(getByText('Send Code'));

    await waitFor(() => {
      expect(getByPlaceholderText('6-digit code')).toBeTruthy();
    });

    fireEvent.changeText(getByPlaceholderText('6-digit code'), '123456');
    fireEvent.press(getByText('Verify Code'));

    await waitFor(() => {
      expect(mockVerifyEmailCode).toHaveBeenCalledWith('sawyerbeck25@gmail.com', '123456');
      expect(mockClearFounderAuthSession).toHaveBeenCalled();
      expect(mockSetFounderAuthSession).not.toHaveBeenCalled();
      expect(queryByText('Founder Access Ready')).toBeNull();
      expect(getByText('That code did not work. Check the email and try again.')).toBeTruthy();
    });
  });

  it('clears founder and account auth when signing out', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Sign Out')?.onPress?.();
    });

    mockStoreState = {
      ...mockStoreState,
      founderSession: {
        userId: 'user-1',
        orgId: 'org-1',
        email: 'sawyerbeck25@gmail.com',
        accessToken: 'token-1',
        refreshToken: 'refresh-1',
        validatedAt: '2026-01-01T00:00:00.000Z',
        migrationState: 'pending',
      },
    };

    const { getByText } = render(
      <FounderAccessScreen onBack={jest.fn()} onNavigate={jest.fn()} />
    );

    fireEvent.press(getByText('Sign Out Founder'));

    await waitFor(() => {
      expect(mockClearFounderAuthSession).toHaveBeenCalled();
    });
  });

  it('resets the code step when the founder email changes', async () => {
    const { getByPlaceholderText, getByText, queryByPlaceholderText } = render(
      <FounderAccessScreen onBack={jest.fn()} onNavigate={jest.fn()} />
    );

    fireEvent.changeText(getByPlaceholderText('Email'), 'sawyerbeck25@gmail.com');
    fireEvent.press(getByText('Send Code'));

    await waitFor(() => {
      expect(getByPlaceholderText('6-digit code')).toBeTruthy();
    });

    fireEvent.changeText(getByPlaceholderText('Email'), 'different@example.com');

    await waitFor(() => {
      expect(queryByPlaceholderText('6-digit code')).toBeNull();
      expect(getByText('Send Code')).toBeTruthy();
    });
  });

  it('marks migration completed only after founder verification succeeds', async () => {
    mockMigrateLocalLearningToVerifiedFounderCommercial.mockResolvedValue({
      status: 'verified',
      importResponse: {
        snapshotId: 'org-1:user-1:snapshot-1',
        source: 'personal_local_store_to_founder_account_v1',
        stats: {
          importedAt: '2026-03-27T00:00:00.000Z',
          hostStyleProfilesReceived: 1,
          hostStyleProfilesUpserted: 1,
          learningEntriesReceived: 2,
          editPatternsInserted: 2,
          draftOutcomesReceived: 3,
          replyDeltasReceived: 4,
          calibrationEntriesReceived: 5,
          conversationFlowsReceived: 6,
        },
        imported: {
          hostStyleProfiles: 1,
          editPatterns: 2,
        },
      },
      verification: {
        hasSnapshot: true,
        latestSnapshot: {
          id: 'org-1:user-1:snapshot-1',
          source: 'personal_local_store_to_founder_account_v1',
          stableAccountId: 'stable-1',
          importedByUserId: 'user-1',
          importedAt: '2026-03-27T00:00:00.000Z',
          stats: {},
        },
        serverTotals: {
          hostStyleProfiles: 11,
          editPatterns: 22,
        },
      },
    });

    mockStoreState = {
      ...mockStoreState,
      founderSession: {
        userId: 'user-1',
        orgId: 'org-1',
        email: 'sawyerbeck25@gmail.com',
        accessToken: 'token-1',
        refreshToken: 'refresh-1',
        validatedAt: '2026-01-01T00:00:00.000Z',
        migrationState: 'pending',
      },
    };

    const { getByText } = render(
      <FounderAccessScreen onBack={jest.fn()} onNavigate={jest.fn()} />
    );

    fireEvent.press(getByText('Migrate Learning'));

    await waitFor(() => {
      expect(mockMigrateLocalLearningToVerifiedFounderCommercial).toHaveBeenCalledWith({
        founderEmail: 'sawyerbeck25@gmail.com',
        founderUserId: 'user-1',
      });
      expect(mockSetFounderSession).toHaveBeenCalledWith(
        expect.objectContaining({ migrationState: 'completed' }),
      );
      expect(getByText('Imported Counts')).toBeTruthy();
      expect(getByText('1 style profiles · 2 edit patterns')).toBeTruthy();
      expect(getByText('Imported Detail')).toBeTruthy();
      expect(getByText('2 learning entries · 3 draft outcomes · 4 reply deltas')).toBeTruthy();
      expect(getByText('Imported Snapshot')).toBeTruthy();
      expect(getByText('org-1:user-1:snapshot-1')).toBeTruthy();
    });
  });

  it('marks migration failed when founder verification errors', async () => {
    mockMigrateLocalLearningToVerifiedFounderCommercial.mockRejectedValue(
      new Error('Founder migration verification failed: snapshot mismatch'),
    );

    mockStoreState = {
      ...mockStoreState,
      founderSession: {
        userId: 'user-1',
        orgId: 'org-1',
        email: 'sawyerbeck25@gmail.com',
        accessToken: 'token-1',
        refreshToken: 'refresh-1',
        validatedAt: '2026-01-01T00:00:00.000Z',
        migrationState: 'pending',
      },
    };

    const { getByText } = render(
      <FounderAccessScreen onBack={jest.fn()} onNavigate={jest.fn()} />
    );

    fireEvent.press(getByText('Migrate Learning'));

    await waitFor(() => {
      expect(mockSetFounderSession).toHaveBeenCalledWith(
        expect.objectContaining({ migrationState: 'failed' }),
      );
      expect(getByText('Founder migration verification failed: snapshot mismatch')).toBeTruthy();
    });
  });

  it('does not downgrade a completed migration when rerun verification fails before import', async () => {
    mockMigrateLocalLearningToVerifiedFounderCommercial.mockRejectedValue(
      new Error('Network request failed'),
    );

    mockStoreState = {
      ...mockStoreState,
      founderSession: {
        userId: 'user-1',
        orgId: 'org-1',
        email: 'sawyerbeck25@gmail.com',
        accessToken: 'token-1',
        refreshToken: 'refresh-1',
        validatedAt: '2026-01-01T00:00:00.000Z',
        migrationState: 'completed',
      },
    };

    const { getByText } = render(
      <FounderAccessScreen onBack={jest.fn()} onNavigate={jest.fn()} />
    );

    fireEvent.press(getByText('Migrate Learning'));

    await waitFor(() => {
      expect(getByText('Network request failed')).toBeTruthy();
      expect(mockSetFounderSession).not.toHaveBeenCalled();
    });
  });

  it('does not resurrect a cleared founder session after migration resolves', async () => {
    let resolveMigration: ((value: {
      status: 'verified';
      importResponse: any;
      verification: any;
    }) => void) | null = null;
    mockMigrateLocalLearningToVerifiedFounderCommercial.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMigration = resolve;
        }),
    );

    mockStoreState = {
      ...mockStoreState,
      founderSession: {
        userId: 'user-1',
        orgId: 'org-1',
        email: 'sawyerbeck25@gmail.com',
        accessToken: 'token-1',
        refreshToken: 'refresh-1',
        validatedAt: '2026-01-01T00:00:00.000Z',
        migrationState: 'pending',
      },
    };

    const { getByText, queryByText } = render(
      <FounderAccessScreen onBack={jest.fn()} onNavigate={jest.fn()} />
    );

    fireEvent.press(getByText('Migrate Learning'));

    await waitFor(() => {
      expect(mockMigrateLocalLearningToVerifiedFounderCommercial).toHaveBeenCalledTimes(1);
      expect(getByText('In Progress')).toBeTruthy();
    });

    mockStoreState = {
      ...mockStoreState,
      founderSession: null,
    };

    if (!resolveMigration) {
      throw new Error('Expected migration promise resolver');
    }

    const resolver = resolveMigration as (value: {
      status: 'verified';
      importResponse: any;
      verification: any;
    }) => void;

    resolver({
      status: 'verified',
      importResponse: {
        snapshotId: 'org-1:user-1:snapshot-1',
        source: 'personal_local_store_to_founder_account_v1',
        stats: {
          importedAt: '2026-03-27T00:00:00.000Z',
          hostStyleProfilesReceived: 1,
          hostStyleProfilesUpserted: 1,
          learningEntriesReceived: 2,
          editPatternsInserted: 2,
          draftOutcomesReceived: 3,
          replyDeltasReceived: 4,
          calibrationEntriesReceived: 5,
          conversationFlowsReceived: 6,
        },
        imported: {
          hostStyleProfiles: 1,
          editPatterns: 2,
        },
      },
      verification: {
        hasSnapshot: true,
        latestSnapshot: {
          id: 'org-1:user-1:snapshot-1',
          source: 'personal_local_store_to_founder_account_v1',
          stableAccountId: 'stable-1',
          importedByUserId: 'user-1',
          importedAt: '2026-03-27T00:00:00.000Z',
          stats: {},
        },
        serverTotals: {
          hostStyleProfiles: 11,
          editPatterns: 22,
        },
      },
    });

    await waitFor(() => {
      expect(mockSetFounderSession).not.toHaveBeenCalled();
      expect(queryByText('Imported Snapshot')).toBeNull();
    });
  });
});
