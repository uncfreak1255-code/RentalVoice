import { detectIntent } from '../intent-detection';

describe('detectIntent checkout grounding', () => {
  it('recognizes real departure phrasing as checkout-related', () => {
    const result = detectIntent('We are leaving tomorrow morning around 8.');

    expect(result.intent).toBe('check_out');
  });

  it('does not treat asking a guest to leave as a checkout inquiry', () => {
    const result = detectIntent(
      "If it's not ok we will ask a guest to leave as we don't want to incur an extra charge."
    );

    expect(result.intent).not.toBe('check_out');
  });
});
