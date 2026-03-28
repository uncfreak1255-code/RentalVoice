/**
 * Voice Routes Tests
 *
 * 📁 server/src/__tests__/voice-routes.test.ts
 * Purpose: Unit tests for voice ranking and history->voice example extraction
 */

import { describe, it, expect } from 'vitest';
import { scoreAndRankExamples } from '../routes/voice.js';
import { buildVoiceExamplesFromHistory } from '../services/voice-import.js';

type RawExample = Parameters<typeof scoreAndRankExamples>[0][0];

const PROPERTY_ID = 'prop-beachfront-123';

function makeExample(
  override: Partial<RawExample> & Pick<RawExample, 'origin_type' | 'similarity'>
): RawExample {
  return {
    guest_message: 'Can I check in early?',
    host_response: 'Sure, 2pm works.',
    intent: 'early_checkin',
    property_id: null,
    ...override,
  };
}

describe('scoreAndRankExamples', () => {
  it('scores host_written with exact property match highest', () => {
    const examples: RawExample[] = [
      makeExample({ origin_type: 'historical', similarity: 0.95, property_id: null }),
      makeExample({ origin_type: 'ai_approved', similarity: 0.93, property_id: PROPERTY_ID }),
      makeExample({ origin_type: 'host_written', similarity: 0.92, property_id: PROPERTY_ID }),
    ];

    const ranked = scoreAndRankExamples(examples, PROPERTY_ID);

    // host_written + prop match: 0.92*100 + 30 + 20 = 142
    // ai_approved + prop match: 0.93*100 + 0 + 20 = 113
    // historical + no prop:     0.95*100 + 0 + 0  = 95
    expect(ranked[0].origin_type).toBe('host_written');
    expect(ranked[0].score).toBeCloseTo(142, 0);
  });

  it('ranks ai_edited above ai_approved with equal similarity', () => {
    const examples: RawExample[] = [
      makeExample({ origin_type: 'ai_approved', similarity: 0.9, property_id: null }),
      makeExample({ origin_type: 'ai_edited', similarity: 0.9, property_id: null }),
    ];

    const ranked = scoreAndRankExamples(examples, null);

    // ai_edited: 90 + 15 = 105
    // ai_approved: 90 + 0 = 90
    expect(ranked[0].origin_type).toBe('ai_edited');
    expect(ranked[0].score).toBeCloseTo(105, 0);
    expect(ranked[1].score).toBeCloseTo(90, 0);
  });

  it('applies property bonus only when property_id matches', () => {
    const examples: RawExample[] = [
      makeExample({ origin_type: 'historical', similarity: 0.8, property_id: 'other-prop' }),
      makeExample({ origin_type: 'historical', similarity: 0.8, property_id: PROPERTY_ID }),
    ];

    const ranked = scoreAndRankExamples(examples, PROPERTY_ID);

    // exact match: 80 + 20 = 100
    // other prop:  80 + 0  = 80
    expect(ranked[0].property_id).toBe(PROPERTY_ID);
    expect(ranked[0].score).toBeCloseTo(100, 0);
    expect(ranked[1].score).toBeCloseTo(80, 0);
  });

  it('returns examples sorted descending by score', () => {
    const examples: RawExample[] = [
      makeExample({ origin_type: 'historical', similarity: 0.5, property_id: null }),
      makeExample({ origin_type: 'host_written', similarity: 0.7, property_id: PROPERTY_ID }),
      makeExample({ origin_type: 'ai_edited', similarity: 0.6, property_id: null }),
    ];

    const ranked = scoreAndRankExamples(examples, PROPERTY_ID);
    const scores = ranked.map((r) => r.score);

    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it('handles null property_id query (no property bonus applied)', () => {
    const examples: RawExample[] = [
      makeExample({ origin_type: 'host_written', similarity: 0.9, property_id: PROPERTY_ID }),
    ];

    const ranked = scoreAndRankExamples(examples, null);

    // No property bonus when querying without a property
    expect(ranked[0].score).toBeCloseTo(120, 0); // 90 + 30 only
  });
});

describe('buildVoiceExamplesFromHistory', () => {
  it('builds voice examples from consecutive guest/host message pairs', () => {
    const examples = buildVoiceExamplesFromHistory(
      [{ id: 501, listingMapId: 777 }],
      {
        501: [
          {
            id: 1,
            conversationId: 501,
            body: 'Can we check in early?',
            isIncoming: true,
            insertedOn: '2026-03-01T10:00:00.000Z',
          },
          {
            id: 2,
            conversationId: 501,
            body: 'Yes, 2pm works for today.',
            isIncoming: false,
            insertedOn: '2026-03-01T10:05:00.000Z',
          },
          {
            id: 3,
            conversationId: 501,
            body: 'Thanks, what is the wifi password?',
            isIncoming: true,
            insertedOn: '2026-03-01T10:10:00.000Z',
          },
          {
            id: 4,
            conversationId: 501,
            body: 'It is on the fridge magnet when you arrive.',
            isIncoming: false,
            insertedOn: '2026-03-01T10:12:00.000Z',
          },
        ],
      }
    );

    expect(examples).toHaveLength(2);
    expect(examples[0]).toMatchObject({
      guestMessage: 'Can we check in early?',
      hostResponse: 'Yes, 2pm works for today.',
      originType: 'historical',
      propertyId: '777',
      hostawayConversationId: '501',
    });
    expect(examples[1]).toMatchObject({
      guestMessage: 'Thanks, what is the wifi password?',
      hostResponse: 'It is on the fridge magnet when you arrive.',
      originType: 'historical',
    });
  });
});
