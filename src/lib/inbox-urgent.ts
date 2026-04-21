import type { Conversation } from './store';
import type { SentimentType } from './sentiment-analysis';

/**
 * Sentiments that indicate a conversation needs the host's attention now.
 * `urgent` — explicit emergency signals (e.g. "emergency", "asap", "broken into")
 * `frustrated` — repeated complaint / escalation pattern
 */
export const URGENT_SENTIMENTS: ReadonlySet<SentimentType> = new Set<SentimentType>([
  'urgent',
  'frustrated',
]);

/**
 * Returns the first conversation in `candidates` that qualifies as urgent.
 * A conversation qualifies when `status === 'urgent'` OR its computed
 * sentiment is in URGENT_SENTIMENTS.
 *
 * Callers should pass the *active* (unarchived, optionally property-scoped)
 * conversation set rather than a filter-scoped view — otherwise the urgency
 * signal disappears whenever the urgent convo leaves the active filter (e.g.
 * marked-read drops it out of "Needs reply").
 */
export function findFirstUrgent(
  candidates: readonly Conversation[],
  sentimentById: ReadonlyMap<string, SentimentType>
): Conversation | undefined {
  return candidates.find(
    (c) =>
      c.status === 'urgent' ||
      URGENT_SENTIMENTS.has(sentimentById.get(c.id) ?? 'neutral')
  );
}

/**
 * Counts urgent conversations in `candidates` using the same qualification
 * logic as findFirstUrgent. Kept separate for callers that need a count
 * without allocating a find-short-circuit result.
 */
export function countUrgent(
  candidates: readonly Conversation[],
  sentimentById: ReadonlyMap<string, SentimentType>
): number {
  let n = 0;
  for (const c of candidates) {
    if (
      c.status === 'urgent' ||
      URGENT_SENTIMENTS.has(sentimentById.get(c.id) ?? 'neutral')
    ) {
      n += 1;
    }
  }
  return n;
}
