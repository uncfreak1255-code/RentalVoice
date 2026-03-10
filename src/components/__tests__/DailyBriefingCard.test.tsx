import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { DailyBriefingCard, type DailyBriefingViewModel } from '../DailyBriefingCard';

jest.mock('@/lib/design-tokens', () => ({
  colors: {
    bg: { elevated: '#FFFFFF', subtle: '#F8FAFC' },
    border: { subtle: '#E2E8F0' },
    text: { primary: '#0F172A', muted: '#64748B' },
    primary: { DEFAULT: '#14B8A6', muted: '#CCFBF1' },
  },
  typography: {
    fontFamily: { regular: 'System', medium: 'System', semibold: 'System', bold: 'System' },
  },
  spacing: { '1': 4, '2': 8, '3': 12, '4': 16, '5': 20 },
  radius: { md: 16, lg: 20 },
}));

const briefing: DailyBriefingViewModel = {
  title: "Today's briefing",
  summary: '1 unresolved issue · 1 arrival in the next 48 hours',
  counts: {
    unresolvedIssues: 1,
    arrivals: 1,
    departures: 0,
  },
  actions: [
    {
      id: 'issue-1',
      kind: 'issue',
      conversationId: 'conv-1',
      label: 'Follow up with Anne Reeves',
      meta: 'Utility issue · Dockside Dreams',
    },
  ],
};

describe('DailyBriefingCard', () => {
  it('renders expanded card content', () => {
    const { getByText } = render(
      <DailyBriefingCard briefing={briefing} collapsed={false} onToggleCollapsed={jest.fn()} onPressAction={jest.fn()} />
    );

    expect(getByText("Today's briefing")).toBeTruthy();
    expect(getByText('Follow up with Anne Reeves')).toBeTruthy();
  });

  it('renders collapsed chip and expands on tap', () => {
    const onToggleCollapsed = jest.fn();
    const { getByText } = render(
      <DailyBriefingCard briefing={briefing} collapsed={true} onToggleCollapsed={onToggleCollapsed} onPressAction={jest.fn()} />
    );

    fireEvent.press(getByText(/Today's briefing/));
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });
});
