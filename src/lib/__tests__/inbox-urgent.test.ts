/**
 * Regression: the urgent-attention banner used to compute its target from the
 * *filtered* conversation set (activeFilter-scoped). That meant once the user
 * opened the urgent convo and it got marked read, it left "Needs reply" and the
 * banner disappeared — even though urgency was still real.
 *
 * The banner now computes from the active (unarchived, optionally
 * property-scoped) set so it persists across filter changes.
 */

import { findFirstUrgent, URGENT_SENTIMENTS } from '../inbox-urgent';
import type { Conversation } from '../store';
import type { SentimentType } from '../sentiment-analysis';

function mkConvo(overrides: Partial<Conversation>): Conversation {
  return {
    id: overrides.id ?? 'c',
    guest: { id: 'g', name: 'Test Guest' },
    property: { id: 'p1', name: 'Test Property', address: '' },
    messages: [],
    unreadCount: 0,
    status: 'active',
    platform: 'airbnb',
    hasAiDraft: false,
    ...overrides,
  } as Conversation;
}

describe('findFirstUrgent', () => {
  it('finds a conversation flagged with status === "urgent"', () => {
    const urgent = mkConvo({ id: 'u1', status: 'urgent' });
    const normal = mkConvo({ id: 'n1' });
    const sentiments = new Map<string, SentimentType>();
    expect(findFirstUrgent([urgent, normal], sentiments)).toBe(urgent);
  });

  it('finds a conversation with an urgent-tier sentiment', () => {
    const needsAttention = mkConvo({ id: 'f1' });
    const fine = mkConvo({ id: 'ok1' });
    const sentiments = new Map<string, SentimentType>([
      ['f1', 'frustrated'],
      ['ok1', 'neutral'],
    ]);
    expect(findFirstUrgent([needsAttention, fine], sentiments)).toBe(needsAttention);
  });

  it('returns undefined when no conversation is urgent', () => {
    const a = mkConvo({ id: 'a' });
    const b = mkConvo({ id: 'b' });
    const sentiments = new Map<string, SentimentType>([
      ['a', 'neutral'],
      ['b', 'positive'],
    ]);
    expect(findFirstUrgent([a, b], sentiments)).toBeUndefined();
  });

  it('falls back to "neutral" when sentiment is missing', () => {
    const a = mkConvo({ id: 'a' });
    // a is not in the sentiment map — should treat as neutral and skip
    expect(findFirstUrgent([a], new Map())).toBeUndefined();
  });

  it('URGENT_SENTIMENTS includes both urgent and frustrated', () => {
    expect(URGENT_SENTIMENTS.has('urgent')).toBe(true);
    expect(URGENT_SENTIMENTS.has('frustrated')).toBe(true);
    expect(URGENT_SENTIMENTS.has('negative')).toBe(false);
    expect(URGENT_SENTIMENTS.has('neutral')).toBe(false);
  });
});
