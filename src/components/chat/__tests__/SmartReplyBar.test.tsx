import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SmartReplyBar } from '../SmartReplyBar';

// ── Mocks ──

jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: { createAnimatedComponent: (C: any) => C, View },
    useAnimatedStyle: () => ({}),
    useSharedValue: (v: any) => ({ value: v }),
    FadeInDown: { duration: () => ({}) },
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('@/lib/design-tokens', () => ({
  colors: {
    primary: { DEFAULT: '#14B', soft: '#14B25', muted: '#14B15' },
    text: { primary: '#1E2' },
  },
  typography: { fontFamily: { medium: 'System' } },
  spacing: { '2': 8, '4': 16 },
}));

const mockReplies = [
  { id: 'r1', label: 'Yes', icon: '✓', content: 'Yes, confirmed.' },
  { id: 'r2', label: 'Check-in info', icon: '🔑', content: 'Check-in is at 3pm.' },
];

jest.mock('@/lib/smart-replies', () => ({
  generateSmartReplies: jest.fn(() => mockReplies),
}));

// ── Tests ──

describe('SmartReplyBar', () => {
  it('renders smart reply chips', () => {
    const { getByText } = render(
      <SmartReplyBar guestMessage="What time is check-in?" onSelect={jest.fn()} />,
    );
    expect(getByText('Yes')).toBeTruthy();
    expect(getByText('Check-in info')).toBeTruthy();
  });

  it('calls onSelect when a chip is pressed', () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <SmartReplyBar guestMessage="What time is check-in?" onSelect={onSelect} />,
    );
    fireEvent.press(getByText('Yes'));
    expect(onSelect).toHaveBeenCalledWith(mockReplies[0]);
  });

  it('returns null when no replies generated', () => {
    const { generateSmartReplies } = require('@/lib/smart-replies');
    generateSmartReplies.mockReturnValueOnce([]);

    const { toJSON } = render(
      <SmartReplyBar guestMessage="ok" onSelect={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('triggers haptic feedback on press', () => {
    const Haptics = require('expo-haptics');
    const { getByText } = render(
      <SmartReplyBar guestMessage="Hello" onSelect={jest.fn()} />,
    );
    fireEvent.press(getByText('Check-in info'));
    expect(Haptics.impactAsync).toHaveBeenCalled();
  });
});
