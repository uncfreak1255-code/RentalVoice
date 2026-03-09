import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import GuestMemoryCard from '../GuestMemoryCard';
import type { GuestMemory } from '@/lib/advanced-training';

const memory: GuestMemory = {
  guestHash: 'guest_123',
  properties: ['property-a'],
  conversationHistory: [
    {
      date: new Date('2026-03-01'),
      property: 'Property A',
      topics: ['parking'],
      sentiment: 'positive',
      specialRequests: ['late check-in'],
    },
  ],
  preferences: {
    preferredTone: 'warm',
    typicalQuestions: ['parking'],
    hasChildren: false,
    hasPets: false,
    isReturning: true,
  },
  lastSeen: Date.now(),
};

describe('GuestMemoryCard', () => {
  it('renders expanded guest memory card', () => {
    const { getByText } = render(<GuestMemoryCard memory={memory} stayCount={3} />);

    expect(getByText('Guest memory')).toBeTruthy();
    expect(getByText('3 stays')).toBeTruthy();
    expect(getByText('Usually asks about parking')).toBeTruthy();
  });

  it('renders collapsed chip and toggles', () => {
    const onToggle = jest.fn();
    const { getByText } = render(
      <GuestMemoryCard memory={memory} stayCount={3} collapsed onToggle={onToggle} />
    );

    fireEvent.press(getByText('Guest memory'));
    expect(onToggle).toHaveBeenCalled();
  });
});
