/**
 * Regression: analyzeMessageSentiment used to crash with
 *   TypeError: Cannot read property 'toLowerCase' of undefined
 * when any sentiment regex had optional capture groups whose slots came back
 * as undefined. That took the whole Inbox down once InboxDashboard started
 * running sentiment analysis on every conversation (not just urgent-sort).
 */

import { analyzeMessageSentiment } from '../sentiment-analysis';
import type { Message } from '../store';

describe('analyzeMessageSentiment — undefined regex capture groups', () => {
  function mkMessage(content: string): Message {
    return {
      id: 'test-msg-1',
      conversationId: 'test-convo-1',
      content,
      sender: 'guest',
      timestamp: new Date(),
      isRead: false,
    } as Message;
  }

  it('does not throw when content contains text that would mint undefined capture slots', () => {
    // Any normal-looking guest message should survive; the crash happened at
    // regex-match time regardless of content, once a pattern with optional
    // groups found a hit.
    const samples = [
      'Hi, is parking available near the property?',
      'THE HOT TUB IS NOT WORKING!!!',
      '¡Hola! ¿Hay estacionamiento?',
      'Thank you! We had a great time.',
      '', // empty string edge case
    ];
    for (const content of samples) {
      expect(() => analyzeMessageSentiment(mkMessage(content))).not.toThrow();
    }
  });

  it('returns a sentiment result with keywords as strings (no undefined)', () => {
    const result = analyzeMessageSentiment(mkMessage('This is terrible and unacceptable!'));
    expect(result.keywords.every((k) => typeof k === 'string')).toBe(true);
  });
});
