import type { Conversation, Message } from '../store';
import { isRenderableUnreadConversation } from '../inbox-trust';

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    content: 'Need the wifi password',
    sender: 'guest',
    timestamp: new Date('2026-03-09T12:00:00Z'),
    isRead: false,
    ...overrides,
  };
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    platform: 'airbnb',
    guest: { id: 'guest-1', name: 'Dean Decker', email: 'dean@example.com' },
    property: { id: 'prop-1', name: '75th ST', address: '75th Street' },
    messages: [],
    lastMessage: makeMessage(),
    unreadCount: 1,
    hasAiDraft: false,
    createdAt: new Date('2026-03-09T12:00:00Z'),
    updatedAt: new Date('2026-03-09T12:00:00Z'),
    ...overrides,
  } as Conversation;
}

describe('isRenderableUnreadConversation', () => {
  it('accepts real unread guest threads', () => {
    expect(isRenderableUnreadConversation(makeConversation())).toBe(true);
  });

  it('rejects unread counters when the host already replied last', () => {
    expect(
      isRenderableUnreadConversation(
        makeConversation({
          lastMessage: makeMessage({ sender: 'host', content: 'I sent the code above.' }),
        })
      )
    ).toBe(false);
  });

  it('rejects unread counters for threads without a trustworthy guest identity', () => {
    expect(
      isRenderableUnreadConversation(
        makeConversation({
          guest: { id: 'guest-1', name: 'Unknown Guest' },
        })
      )
    ).toBe(false);
  });

  it('rejects unread counters when the latest message content is empty', () => {
    expect(
      isRenderableUnreadConversation(
        makeConversation({
          lastMessage: makeMessage({ content: '   ' }),
        })
      )
    ).toBe(false);
  });

  it('rejects unread counters when unreadCount is zero', () => {
    expect(
      isRenderableUnreadConversation(
        makeConversation({
          unreadCount: 0,
        })
      )
    ).toBe(false);
  });
});
