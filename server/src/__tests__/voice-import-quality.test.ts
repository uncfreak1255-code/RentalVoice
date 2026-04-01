/**
 * Voice Import Quality Filter Tests
 *
 * server/src/__tests__/voice-import-quality.test.ts
 * Purpose: Verify quality filtering rejects poisoned training data
 */

import { describe, it, expect } from 'vitest';
import {
  isQualityVoiceExample,
  filterQualityExamples,
  buildVoiceExamplesFromHistory,
  type VoiceImportExample,
  type HistoryConversationLike,
  type HistoryMessageLike,
} from '../services/voice-import.js';

// ─── isQualityVoiceExample ──────────────────────────────

describe('isQualityVoiceExample', () => {
  describe('rejects short host responses', () => {
    it('rejects 1-word response', () => {
      expect(isQualityVoiceExample('Can I check in early?', 'Sure')).toBe(false);
    });

    it('rejects 2-word response', () => {
      expect(isQualityVoiceExample('What is the wifi password?', 'Its skynet')).toBe(false);
    });

    it('rejects 4-word response', () => {
      expect(isQualityVoiceExample('Where is parking?', 'Right behind the building')).toBe(false);
    });

    it('accepts exactly 5-word response', () => {
      expect(
        isQualityVoiceExample('Where is parking?', 'Parking is right behind building')
      ).toBe(true);
    });

    it('accepts 6+ word response', () => {
      expect(
        isQualityVoiceExample(
          'Can I check in early?',
          'Absolutely, early check-in is available at 2pm for your reservation.'
        )
      ).toBe(true);
    });
  });

  describe('rejects throwaway responses', () => {
    it.each([
      'ok',
      'Ok',
      'OK',
      'okay',
      'thanks',
      'Thanks!',
      'thank you',
      'Thank you!',
      'got it',
      'Got it.',
      'noted',
      'will do',
      'sure',
      'yes',
      'no',
      'done',
      'perfect',
      'great',
      'sounds good',
      'no problem',
      'np',
      'k',
      'yep',
      'yup',
      'nope',
      'cool',
      'roger',
      'copy',
      'understood',
      'ty',
      'thx',
    ])('rejects "%s"', (response) => {
      expect(isQualityVoiceExample('Thanks for the info!', response)).toBe(false);
    });

    it('rejects throwaway with trailing punctuation', () => {
      expect(isQualityVoiceExample('Thanks!', 'Got it...')).toBe(false);
    });

    it('rejects throwaway with emoji', () => {
      expect(isQualityVoiceExample('See you tomorrow', 'Thanks! 👍')).toBe(false);
    });
  });

  describe('rejects system/admin guest messages', () => {
    it('rejects automated message', () => {
      expect(
        isQualityVoiceExample(
          'This is an automated message from the booking system',
          'Thank you for your reservation, we look forward to hosting you.'
        )
      ).toBe(false);
    });

    it('rejects booking confirmed notification', () => {
      expect(
        isQualityVoiceExample(
          'Booking confirmed for dates March 15-20',
          'Great, we will have everything ready for your arrival on March 15th.'
        )
      ).toBe(false);
    });

    it('rejects payment processed notification', () => {
      expect(
        isQualityVoiceExample(
          'Payment processed successfully for reservation #12345',
          'We received your payment and your booking is all set.'
        )
      ).toBe(false);
    });

    it('rejects reservation confirmed notification', () => {
      expect(
        isQualityVoiceExample(
          'Reservation confirmed - check in March 15',
          'Welcome, we are excited to host you at our property.'
        )
      ).toBe(false);
    });

    it('rejects auto-reply message', () => {
      expect(
        isQualityVoiceExample(
          'Auto-reply: We will get back to you shortly',
          'Hi there, I wanted to follow up on your inquiry about the property.'
        )
      ).toBe(false);
    });

    it('rejects noreply message', () => {
      expect(
        isQualityVoiceExample(
          'noreply: Your booking status has been updated',
          'Let me know if you have any questions about your updated booking.'
        )
      ).toBe(false);
    });

    it('does not reject normal guest message containing "system" as substring', () => {
      // "system" alone should not match -- we require "system notification"
      expect(
        isQualityVoiceExample(
          'The heating system seems broken in the bathroom',
          'I am so sorry about that, I will send our maintenance team right away.'
        )
      ).toBe(true);
    });
  });

  describe('rejects emoji-only host responses', () => {
    it('rejects single emoji', () => {
      expect(isQualityVoiceExample('Thanks!', '👍')).toBe(false);
    });

    it('rejects multiple emoji', () => {
      expect(isQualityVoiceExample('See you soon!', '👋😊🎉')).toBe(false);
    });

    it('rejects emoji with whitespace', () => {
      expect(isQualityVoiceExample('How is the weather?', '  🌞  ')).toBe(false);
    });
  });

  describe('rejects empty inputs', () => {
    it('rejects empty guest message', () => {
      expect(
        isQualityVoiceExample('', 'Thank you for reaching out about your reservation.')
      ).toBe(false);
    });

    it('rejects empty host response', () => {
      expect(isQualityVoiceExample('When can I check in?', '')).toBe(false);
    });

    it('rejects whitespace-only guest message', () => {
      expect(
        isQualityVoiceExample('   ', 'Thank you for reaching out about your reservation.')
      ).toBe(false);
    });

    it('rejects whitespace-only host response', () => {
      expect(isQualityVoiceExample('When can I check in?', '   ')).toBe(false);
    });
  });

  describe('passes good quality pairs', () => {
    it('passes a normal guest question with substantive host answer', () => {
      expect(
        isQualityVoiceExample(
          'What time is check-in?',
          'Check-in time is 4pm but I can arrange early check-in if you need it.'
        )
      ).toBe(true);
    });

    it('passes a complaint with a real apology response', () => {
      expect(
        isQualityVoiceExample(
          'The wifi is not working at all',
          'I am really sorry about the wifi issue, let me reset the router for you right away.'
        )
      ).toBe(true);
    });

    it('passes a logistics question with directions', () => {
      expect(
        isQualityVoiceExample(
          'How do I get to the property from the airport?',
          'Take the I-95 south exit and then turn right on Main Street, the property is on your left.'
        )
      ).toBe(true);
    });

    it('passes a request with a helpful multi-sentence response', () => {
      expect(
        isQualityVoiceExample(
          'Can we bring our dog?',
          'Yes, we are pet-friendly! There is a $50 pet fee and we ask that you keep dogs off the furniture.'
        )
      ).toBe(true);
    });
  });
});

// ─── filterQualityExamples (duplicate/template detection) ─

describe('filterQualityExamples', () => {
  function makeExample(guest: string, host: string): VoiceImportExample {
    return {
      guestMessage: guest,
      hostResponse: host,
      originType: 'historical',
    };
  }

  it('removes duplicate template responses used 3+ times', () => {
    const templateResponse =
      'Thank you for your booking, we look forward to hosting you soon.';
    const examples: VoiceImportExample[] = [
      makeExample('Hi, just booked!', templateResponse),
      makeExample('Looking forward to my stay', templateResponse),
      makeExample('Just made a reservation', templateResponse),
      makeExample(
        'What time is check-in?',
        'Check-in time is 4pm, but early check-in may be available.'
      ),
    ];

    const filtered = filterQualityExamples(examples);

    // The template (3 occurrences) should be removed; the unique response stays
    expect(filtered).toHaveLength(1);
    expect(filtered[0].guestMessage).toBe('What time is check-in?');
  });

  it('keeps responses that appear only twice (coincidence, not template)', () => {
    const response = 'Sure thing, I will get that taken care of for you right away.';
    const examples: VoiceImportExample[] = [
      makeExample('Can you send extra towels?', response),
      makeExample('Can you bring more pillows?', response),
      makeExample(
        'What is the wifi password?',
        'The wifi password is on the card next to the router.'
      ),
    ];

    const filtered = filterQualityExamples(examples);
    expect(filtered).toHaveLength(3);
  });

  it('still applies individual quality filters', () => {
    const examples: VoiceImportExample[] = [
      makeExample('Booking confirmed for March 15', 'Great, we are ready for you.'),
      makeExample('What is checkout time?', 'ok'),
      makeExample(
        'Where do I park?',
        'You can park in the driveway, there is space for two cars.'
      ),
    ];

    const filtered = filterQualityExamples(examples);

    // First: system message. Second: throwaway + short. Only third survives.
    expect(filtered).toHaveLength(1);
    expect(filtered[0].guestMessage).toBe('Where do I park?');
  });

  it('returns empty array for all-bad input', () => {
    const examples: VoiceImportExample[] = [
      makeExample('This is an automated notification', 'Got it'),
      makeExample('Booking cancelled', 'ok'),
    ];

    expect(filterQualityExamples(examples)).toHaveLength(0);
  });

  it('handles empty input', () => {
    expect(filterQualityExamples([])).toHaveLength(0);
  });
});

// ─── buildVoiceExamplesFromHistory integration ──────────

describe('buildVoiceExamplesFromHistory quality filtering', () => {
  function msg(
    id: number,
    conversationId: number,
    body: string,
    isIncoming: boolean,
    insertedOn: string
  ): HistoryMessageLike {
    return { id, conversationId, body, isIncoming, insertedOn };
  }

  it('filters out short host responses during build', () => {
    const conversations: HistoryConversationLike[] = [{ id: 1 }];
    const messages: Record<number, HistoryMessageLike[]> = {
      1: [
        msg(1, 1, 'Can I check in early?', true, '2026-03-01T10:00:00Z'),
        msg(2, 1, 'Sure', false, '2026-03-01T10:05:00Z'),
        msg(3, 1, 'What is the wifi password?', true, '2026-03-01T11:00:00Z'),
        msg(
          4,
          1,
          'The wifi password is on the card by the router in the kitchen.',
          false,
          '2026-03-01T11:05:00Z'
        ),
      ],
    };

    const examples = buildVoiceExamplesFromHistory(conversations, messages);

    expect(examples).toHaveLength(1);
    expect(examples[0].guestMessage).toBe('What is the wifi password?');
  });

  it('filters out system message guest inputs during build', () => {
    const conversations: HistoryConversationLike[] = [{ id: 1 }];
    const messages: Record<number, HistoryMessageLike[]> = {
      1: [
        msg(
          1,
          1,
          'Booking confirmed for dates March 15-20',
          true,
          '2026-03-01T10:00:00Z'
        ),
        msg(
          2,
          1,
          'Welcome to our property, we are happy to have you.',
          false,
          '2026-03-01T10:05:00Z'
        ),
      ],
    };

    const examples = buildVoiceExamplesFromHistory(conversations, messages);
    expect(examples).toHaveLength(0);
  });

  it('still passes good quality pairs through', () => {
    const conversations: HistoryConversationLike[] = [{ id: 1 }];
    const messages: Record<number, HistoryMessageLike[]> = {
      1: [
        msg(1, 1, 'Is there parking available at the property?', true, '2026-03-01T10:00:00Z'),
        msg(
          2,
          1,
          'Yes there is a dedicated parking spot in the driveway for guests.',
          false,
          '2026-03-01T10:05:00Z'
        ),
      ],
    };

    const examples = buildVoiceExamplesFromHistory(conversations, messages);
    expect(examples).toHaveLength(1);
    expect(examples[0].hostResponse).toContain('dedicated parking spot');
  });
});
