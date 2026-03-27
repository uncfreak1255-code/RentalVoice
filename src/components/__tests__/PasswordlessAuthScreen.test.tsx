import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PasswordlessAuthScreen } from '../PasswordlessAuthScreen';

const mockRequestEmailCode = jest.fn();
const mockVerifyEmailCode = jest.fn();

jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const icon = (name: string) => {
    const MockIcon = (props: any) => <View testID={`icon-${name}`} {...props} />;
    MockIcon.displayName = `Mock${name}`;
    return MockIcon;
  };
  return {
    ArrowRight: icon('arrow-right'),
    Mail: icon('mail'),
    Shield: icon('shield'),
    ChevronLeft: icon('chevron-left'),
  };
});

jest.mock('@/lib/api-client', () => ({
  requestEmailCode: (...args: any[]) => mockRequestEmailCode(...args),
  verifyEmailCode: (...args: any[]) => mockVerifyEmailCode(...args),
}));

jest.mock('@/lib/design-tokens', () => ({
  colors: {
    bg: { base: '#FFF', card: '#FFF', elevated: '#F6F7F9', hover: '#EEF1F5', subtle: '#FAFBFC' },
    primary: { DEFAULT: '#14B8A6', light: '#2DD4BF', muted: '#DFF7F3' },
    accent: { DEFAULT: '#F97316', light: '#FB923C', muted: '#FFF3E8' },
    danger: { DEFAULT: '#EF4444', light: '#F87171', muted: '#FEE2E2' },
    text: { primary: '#1F2937', muted: '#6B7280', disabled: '#9CA3AF', inverse: '#FFFFFF' },
    border: { subtle: '#E5E7EB' },
  },
  spacing: { '2': 8, '3': 12, '4': 16, '5': 20, '6': 24, '8': 32, '10': 40, '12': 48 },
  typography: {
    fontFamily: { regular: 'System', medium: 'System', semibold: 'System', bold: 'System' },
  },
  radius: { md: 12, lg: 16, xl: 20, full: 9999 },
}));

describe('PasswordlessAuthScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestEmailCode.mockResolvedValue({ success: true });
    mockVerifyEmailCode.mockResolvedValue({
      token: 'token-123',
      refreshToken: 'refresh-456',
      user: {
        id: 'user-1',
        email: 'host@example.com',
        name: 'Host',
        plan: 'starter',
        trialEndsAt: null,
        createdAt: '2026-03-27T00:00:00.000Z',
      },
    });
  });

  it('requests an email code and advances to code verification', async () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <PasswordlessAuthScreen onAuthenticated={jest.fn()} />
    );

    fireEvent.changeText(getByTestId('passwordless-name-input'), 'Host');
    fireEvent.changeText(getByTestId('passwordless-email-input'), 'host@example.com');
    fireEvent.press(getByTestId('passwordless-send-code'));

    await waitFor(() => {
      expect(mockRequestEmailCode).toHaveBeenCalledWith('host@example.com', 'Host');
      expect(getByText('Enter the 6-digit code')).toBeTruthy();
      expect(queryByTestId('passwordless-code-input')).toBeTruthy();
    });
  });

  it('verifies the emailed code and returns the authenticated session', async () => {
    const onAuthenticated = jest.fn();
    const { getByTestId } = render(<PasswordlessAuthScreen onAuthenticated={onAuthenticated} />);

    fireEvent.changeText(getByTestId('passwordless-email-input'), 'host@example.com');
    fireEvent.press(getByTestId('passwordless-send-code'));

    await waitFor(() => {
      expect(mockRequestEmailCode).toHaveBeenCalled();
    });

    fireEvent.changeText(getByTestId('passwordless-code-input'), '123456');
    fireEvent.press(getByTestId('passwordless-verify-code'));

    await waitFor(() => {
      expect(mockVerifyEmailCode).toHaveBeenCalledWith('host@example.com', '123456');
      expect(onAuthenticated).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'token-123',
          user: expect.objectContaining({ email: 'host@example.com' }),
        })
      );
    });
  });
});
