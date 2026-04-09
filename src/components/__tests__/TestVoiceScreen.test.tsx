import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TestVoiceScreen } from '../TestVoiceScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return new Proxy(
    {},
    {
      get: (_, iconName: string) => (props: any) => <Text {...props}>{iconName}</Text>,
    },
  );
});

const mockGenerateEnhancedAIResponse = jest.fn();
jest.mock('@/lib/ai-enhanced', () => ({
  generateEnhancedAIResponse: (...args: any[]) => mockGenerateEnhancedAIResponse(...args),
}));

const mockRecordLearningEvent = jest.fn();
jest.mock('@/lib/learning-events', () => ({
  recordLearningEvent: (event: any) => mockRecordLearningEvent(event),
}));

jest.mock('@/lib/store', () => ({
  useAppStore: (selector: any) =>
    selector({
      properties: [{ id: 'property-1', name: 'Beach House', address: '1 Ocean Ave' }],
      propertyKnowledge: {},
      hostStyleProfiles: {},
    }),
}));

describe('TestVoiceScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateEnhancedAIResponse.mockResolvedValue({
      content: 'Check-in is at 3 PM.',
      confidence: { overall: 82 },
    });
  });

  it('saves a changed test-my-voice reply as an ai_edited event', async () => {
    mockRecordLearningEvent.mockResolvedValue({
      summary: 'Saved correction pattern: shorter • warmer',
    });

    const screen = render(<TestVoiceScreen onBack={jest.fn()} />);

    fireEvent.press(screen.getByText('Check-in'));

    await waitFor(() => {
      expect(screen.getByText('AI Draft')).toBeTruthy();
    });

    fireEvent.changeText(
      screen.getByPlaceholderText('Type your real response...'),
      'Check-in starts at 4 PM if the cleaner finishes early.',
    );
    fireEvent.press(screen.getByText('Compare'));

    await waitFor(() => {
      expect(mockRecordLearningEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ai_edited',
          source: 'test_my_voice',
          aiDraft: 'Check-in is at 3 PM.',
          finalReply: 'Check-in starts at 4 PM if the cleaner finishes early.',
        }),
      );
    });

    expect(screen.getByText('Saved correction pattern: shorter • warmer')).toBeTruthy();
  });

  it('saves an unchanged test-my-voice reply as an ai_approved event', async () => {
    mockRecordLearningEvent.mockResolvedValue({
      summary: 'Saved approved reply as a strong example',
    });

    const screen = render(<TestVoiceScreen onBack={jest.fn()} />);

    fireEvent.press(screen.getByText('Check-in'));

    await waitFor(() => {
      expect(screen.getByText('AI Draft')).toBeTruthy();
    });

    fireEvent.changeText(
      screen.getByPlaceholderText('Type your real response...'),
      'Check-in is at 3 PM.',
    );
    fireEvent.press(screen.getByText('Compare'));

    await waitFor(() => {
      expect(mockRecordLearningEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ai_approved',
          source: 'test_my_voice',
          aiDraft: 'Check-in is at 3 PM.',
          finalReply: 'Check-in is at 3 PM.',
        }),
      );
    });

    expect(screen.getByText('Saved approved reply as a strong example')).toBeTruthy();
  });
});
