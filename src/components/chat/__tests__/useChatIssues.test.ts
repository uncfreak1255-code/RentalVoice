import { renderHook, act } from '@testing-library/react-native';
import { useChatIssues } from '../useChatIssues';

// ── Mocks ──

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

const mockAddIssue = jest.fn();
const mockUpdateIssue = jest.fn();
const mockResolveIssue = jest.fn();
const mockIncrementAnalytic = jest.fn();

const mockConversation = {
  id: 'conv-1',
  guest: { name: 'Alice' },
  property: { id: 'p1', name: 'Beach House' },
  messages: [
    { id: 'm1', sender: 'guest', content: 'The toilet is broken', timestamp: new Date() },
  ],
  checkInDate: '2026-04-01',
  checkOutDate: '2026-04-05',
};

jest.mock('@/lib/store', () => ({
  useAppStore: (selector: any) => {
    const state = {
      conversations: [mockConversation],
      issues: [],
      addIssue: mockAddIssue,
      updateIssue: mockUpdateIssue,
      resolveIssue: mockResolveIssue,
      incrementAnalytic: mockIncrementAnalytic,
    };
    return selector(state);
  },
}));

jest.mock('@/lib/issue-triage', () => ({
  triageIssueFromMessage: jest.fn((msg: string) => {
    if (msg.includes('broken')) {
      return {
        isIssue: true,
        category: 'maintenance',
        priority: 'high',
        summary: 'Broken fixture reported',
        guestImpact: 'Cannot use toilet',
        suggestedAction: 'Send maintenance',
      };
    }
    return { isIssue: false, category: 'other', priority: 'low', summary: '', guestImpact: '', suggestedAction: '' };
  }),
  buildIssueHandoffDraft: jest.fn(() => 'Handoff: maintenance issue...'),
}));

// ── Tests ──

describe('useChatIssues', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('detects a triaged issue from the last guest message', () => {
    const { result } = renderHook(() =>
      useChatIssues({ conversationId: 'conv-1', currentEnhancedDraft: null }),
    );
    expect(result.current.triagedIssue).toBeTruthy();
    expect(result.current.triagedIssue?.category).toBe('maintenance');
  });

  it('returns null triagedIssue when no conversation found', () => {
    const { result } = renderHook(() =>
      useChatIssues({ conversationId: 'nonexistent', currentEnhancedDraft: null }),
    );
    expect(result.current.triagedIssue).toBeNull();
  });

  it('handleIssueNeedsFollowUp creates and updates an issue', () => {
    const { result } = renderHook(() =>
      useChatIssues({ conversationId: 'conv-1', currentEnhancedDraft: null }),
    );
    act(() => {
      result.current.handleIssueNeedsFollowUp();
    });
    expect(mockAddIssue).toHaveBeenCalledTimes(1);
    expect(mockUpdateIssue).toHaveBeenCalledTimes(1);
  });

  it('handleIssueMarkResolved calls resolveIssue for active issues', () => {
    // No active issue exists, so this should be a no-op
    const { result } = renderHook(() =>
      useChatIssues({ conversationId: 'conv-1', currentEnhancedDraft: null }),
    );
    act(() => {
      result.current.handleIssueMarkResolved();
    });
    // No active issue yet, so resolve should not be called
    expect(mockResolveIssue).not.toHaveBeenCalled();
  });

  it('toggleIssueTriageCollapsed toggles the collapsed state', async () => {
    const { result } = renderHook(() =>
      useChatIssues({ conversationId: 'conv-1', currentEnhancedDraft: null }),
    );

    const initial = result.current.issueTriageCollapsed;
    await act(async () => {
      await result.current.toggleIssueTriageCollapsed();
    });
    expect(result.current.issueTriageCollapsed).toBe(!initial);
  });
});
