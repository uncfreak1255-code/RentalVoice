import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import IssueTriageCard from '../IssueTriageCard';
import type { IssueTriageResult } from '@/lib/issue-triage';

const triage: IssueTriageResult = {
  isIssue: true,
  category: 'maintenance',
  priority: 'high',
  summary: 'Guest is reporting a maintenance problem.',
  guestImpact: 'Property functionality may be reduced.',
  suggestedAction: 'Collect the exact affected item and prepare a maintenance handoff.',
};

describe('IssueTriageCard', () => {
  it('renders issue content', () => {
    const { getByText } = render(
      <IssueTriageCard
        triage={triage}
        collapsed={false}
        onToggleCollapsed={jest.fn()}
        onNeedsFollowUp={jest.fn()}
        onCreateHandoff={jest.fn()}
        onMarkResolved={jest.fn()}
      />
    );

    expect(getByText('Issue detected')).toBeTruthy();
    expect(getByText('Guest is reporting a maintenance problem.')).toBeTruthy();
    expect(getByText('high')).toBeTruthy();
  });

  it('fires action callbacks', () => {
    const onNeedsFollowUp = jest.fn();
    const onCreateHandoff = jest.fn();
    const onMarkResolved = jest.fn();

    const { getByText } = render(
      <IssueTriageCard
        triage={triage}
        collapsed={false}
        onToggleCollapsed={jest.fn()}
        onNeedsFollowUp={onNeedsFollowUp}
        onCreateHandoff={onCreateHandoff}
        onMarkResolved={onMarkResolved}
      />
    );

    fireEvent.press(getByText('Needs follow-up'));
    fireEvent.press(getByText('Create handoff'));
    fireEvent.press(getByText('Mark resolved'));

    expect(onNeedsFollowUp).toHaveBeenCalled();
    expect(onCreateHandoff).toHaveBeenCalled();
    expect(onMarkResolved).toHaveBeenCalled();
  });

  it('renders collapsed chip and expands on tap', () => {
    const onToggleCollapsed = jest.fn();

    const { getByText } = render(
      <IssueTriageCard
        triage={triage}
        collapsed={true}
        onToggleCollapsed={onToggleCollapsed}
        onNeedsFollowUp={jest.fn()}
        onCreateHandoff={jest.fn()}
        onMarkResolved={jest.fn()}
      />
    );

    fireEvent.press(getByText('Issue detected'));
    expect(onToggleCollapsed).toHaveBeenCalled();
  });

  it('shows resume handoff when a saved handoff exists', () => {
    const onResumeHandoff = jest.fn();

    const { getByText } = render(
      <IssueTriageCard
        triage={triage}
        collapsed={false}
        hasSavedHandoff={true}
        onToggleCollapsed={jest.fn()}
        onNeedsFollowUp={jest.fn()}
        onCreateHandoff={jest.fn()}
        onResumeHandoff={onResumeHandoff}
        onMarkResolved={jest.fn()}
      />
    );

    fireEvent.press(getByText('Resume handoff'));
    expect(onResumeHandoff).toHaveBeenCalled();
  });
});
