import { buildIssueHandoffDraft, triageIssueFromMessage } from '../issue-triage';

describe('triageIssueFromMessage', () => {
  it('classifies access issues as urgent', () => {
    const result = triageIssueFromMessage('We are locked out and the door code will not work.');

    expect(result.isIssue).toBe(true);
    expect(result.category).toBe('access');
    expect(result.priority).toBe('urgent');
  });

  it('classifies cleanliness issues', () => {
    const result = triageIssueFromMessage('The bathroom is dirty and smells bad.');

    expect(result.isIssue).toBe(true);
    expect(result.category).toBe('cleanliness');
    expect(result.priority).toBe('high');
  });

  it('classifies water shutoff issues as utility problems', () => {
    const result = triageIssueFromMessage('I am frustrated about the water being shut off on Thursday.');

    expect(result.isIssue).toBe(true);
    expect(result.category).toBe('utility');
    expect(result.priority).toBe('high');
  });

  it('classifies compensation requests as refund risk', () => {
    const result = triageIssueFromMessage('We would appreciate some financial consideration and a partial refund for the inconvenience.');

    expect(result.isIssue).toBe(true);
    expect(result.category).toBe('refund_risk');
    expect(result.priority).toBe('high');
  });

  it('classifies fee disputes as policy or billing concerns', () => {
    const result = triageIssueFromMessage('Can you explain the daily fee for pool heating and why we were charged extra?');

    expect(result.isIssue).toBe(true);
    expect(result.category).toBe('policy_billing');
    expect(result.priority).toBe('medium');
  });

  it('returns no issue for routine guest questions', () => {
    const result = triageIssueFromMessage('What time is check-in tomorrow?');

    expect(result.isIssue).toBe(false);
  });
});

describe('buildIssueHandoffDraft', () => {
  it('builds a structured handoff draft', () => {
    const draft = buildIssueHandoffDraft({
      propertyName: 'Dockside Retreat',
      guestName: 'Candy Patenaude',
      guestMessage: 'We are locked out and the code does not work',
      stayWindow: 'May 23 – May 29',
      issue: triageIssueFromMessage('We are locked out and the code does not work'),
    });

    expect(draft).toContain('Dockside Retreat');
    expect(draft).toContain('Candy Patenaude');
    expect(draft).toContain('Priority: URGENT');
  });
});
