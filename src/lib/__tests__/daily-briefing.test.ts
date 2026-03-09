import { buildDailyBriefing } from '../daily-briefing';
import type { Conversation, Issue, Message } from '@/lib/store';

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    content: 'Hello',
    sender: 'guest',
    timestamp: new Date('2026-03-07T12:00:00Z'),
    isRead: false,
    ...overrides,
  };
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  const now = new Date('2026-03-07T12:00:00Z');
  return {
    id: 'conv-1',
    guest: { id: 'guest-1', name: 'Anne Reeves', email: 'anne@example.com' },
    property: { id: 'prop-1', name: 'Dockside Dreams', address: '' },
    messages: [makeMessage()],
    lastMessage: makeMessage(),
    unreadCount: 1,
    status: 'active',
    platform: 'airbnb',
    hasAiDraft: false,
    checkInDate: new Date('2026-03-08T16:00:00Z'),
    checkOutDate: new Date('2026-03-10T10:00:00Z'),
    lastActivityTimestamp: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Conversation;
}

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'issue-1',
    conversationId: 'conv-1',
    category: 'utility',
    description: 'Water shutoff risk',
    status: 'open',
    priority: 'high',
    createdAt: new Date('2026-03-07T11:00:00Z'),
    ...overrides,
  };
}

describe('buildDailyBriefing', () => {
  const now = new Date('2026-03-07T12:00:00Z');

  it('returns null when there is nothing operational to surface', () => {
    const briefing = buildDailyBriefing({
      conversations: [
        makeConversation({
          unreadCount: 0,
          checkInDate: new Date('2026-03-20T16:00:00Z'),
          checkOutDate: new Date('2026-03-25T10:00:00Z'),
        }),
      ],
      issues: [],
      now,
    });

    expect(briefing).toBeNull();
  });

  it('prioritizes unresolved issues ahead of arrival and departure actions', () => {
    const briefing = buildDailyBriefing({
      conversations: [
        makeConversation(),
        makeConversation({
          id: 'conv-2',
          guest: { id: 'guest-2', name: 'Travis Groat' },
          checkInDate: new Date('2026-03-08T17:00:00Z'),
          checkOutDate: new Date('2026-03-12T10:00:00Z'),
        }),
      ],
      issues: [makeIssue()],
      now,
    });

    expect(briefing).not.toBeNull();
    expect(briefing?.counts.unresolvedIssues).toBe(1);
    expect(briefing?.actions[0].kind).toBe('issue');
    expect(briefing?.actions[0].conversationId).toBe('conv-1');
  });

  it('builds a compact summary from unresolved issues and stay transitions', () => {
    const briefing = buildDailyBriefing({
      conversations: [
        makeConversation({ checkInDate: new Date('2026-03-08T16:00:00Z') }),
        makeConversation({
          id: 'conv-2',
          guest: { id: 'guest-2', name: 'Dean Decker' },
          checkInDate: new Date('2026-03-20T16:00:00Z'),
          checkOutDate: new Date('2026-03-08T10:00:00Z'),
        }),
      ],
      issues: [makeIssue()],
      now,
    });

    expect(briefing?.summary).toContain('1 unresolved issue');
    expect(briefing?.summary).toContain('1 arrival');
    expect(briefing?.summary).toContain('1 departure');
    expect(briefing?.actions).toHaveLength(3);
  });
});
