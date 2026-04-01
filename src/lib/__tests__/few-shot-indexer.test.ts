/**
 * Characterization tests for FewShotIndexer in advanced-training.ts.
 * Captures current behavior of:
 *   - findRelevantExamples() scoring and threshold (>= 30)
 *   - addExample() persistence via scheduled save
 *   - detectIntent() pattern matching
 *   - extractKeywords() stop-word filtering
 *   - getHostWrittenVoiceAnchors() diverse selection
 *   - getFewShotPrompt() prompt formatting
 *
 * These are characterization tests — they lock in CURRENT behavior as a
 * regression safety net before the scoring algorithm is modified.
 */

// Mock AsyncStorage before any imports that reference it
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn().mockResolvedValue(undefined),
    getItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(undefined),
    multiGet: jest.fn().mockResolvedValue([]),
    multiSet: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock account-scoped-storage to return key as-is
jest.mock('../account-scoped-storage', () => ({
  scopedKey: (key: string) => key,
}));

// Mock learning-sync (network dependency)
jest.mock('../learning-sync', () => ({
  syncLearningToCloud: jest.fn().mockResolvedValue(undefined),
}));

// Mock ai-learning (analyzeMessage is used by IncrementalTrainer, not FewShotIndexer directly)
jest.mock('../ai-learning', () => ({
  analyzeMessage: jest.fn().mockReturnValue({
    formalityLevel: 50,
    warmthLevel: 50,
    length: 100,
    hasEmoji: false,
  }),
  generateStyleInstructions: jest.fn().mockReturnValue(''),
}));

// Mock store (useAppStore is referenced transitively)
jest.mock('../store', () => ({
  useAppStore: {
    getState: jest.fn().mockReturnValue({
      calibrationEntries: [],
      hostStyleProfiles: {},
    }),
    setState: jest.fn(),
    getInitialState: jest.fn().mockReturnValue({}),
  },
}));

import {
  fewShotIndexer,
  temporalWeightManager,
  type FewShotExample,
} from '../advanced-training';

// ── Helpers ──

/** Build a FewShotExample with sensible defaults. */
function makeExample(overrides: Partial<FewShotExample> = {}): FewShotExample {
  return {
    id: `fs_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    guestMessage: 'What is the wifi password?',
    hostResponse: 'The wifi password is beach123.',
    intent: 'wifi',
    keywords: ['wifi', 'password'],
    timestamp: Date.now(),
    ...overrides,
  };
}

/**
 * Seed the indexer by calling addExample, which runs through the real
 * detectIntent + extractKeywords + index update path.
 */
async function seedExample(
  guestMessage: string,
  hostResponse: string,
  propertyId?: string,
  originType?: 'host_written' | 'ai_approved' | 'ai_edited',
): Promise<void> {
  await fewShotIndexer.addExample(guestMessage, hostResponse, propertyId, originType);
}

// ── Setup / Teardown ──

beforeEach(async () => {
  // The singleton accumulates examples across tests. loadIndex() only replaces
  // examples when AsyncStorage returns truthy data. So we feed it an empty array
  // to force a clean slate.
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({ examples: [] }));
  await fewShotIndexer.loadIndex();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ============================================================================
// findRelevantExamples — scoring algorithm
// ============================================================================

describe('FewShotIndexer.findRelevantExamples', () => {
  it('returns empty array when no examples exist', () => {
    const results = fewShotIndexer.findRelevantExamples('What is the wifi password?');
    expect(results).toEqual([]);
  });

  it('returns matching examples when intent matches (score >= 50)', async () => {
    await seedExample('What is the wifi password?', 'The wifi is beach123.', 'prop-1');
    const results = fewShotIndexer.findRelevantExamples('Can you tell me the wifi?', 'prop-1');
    expect(results.length).toBe(1);
    expect(results[0].intent).toBe('wifi');
  });

  it('gives intent match 50 points — always passes threshold', async () => {
    // Same intent (wifi) should score >= 50 and pass the >= 30 threshold easily
    await seedExample('Whats the internet password?', 'It is guest123.', 'prop-1');
    const results = fewShotIndexer.findRelevantExamples('wifi password please');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('adds 20 points for property match — boosts score', async () => {
    // Seed two examples with the same intent, one with property match, one without
    await seedExample('Check-in info?', 'At 3pm.', 'prop-1');
    await seedExample('Check-in details?', 'Door code is 4521.', 'prop-2');

    // Query same intent with prop-1 — both pass threshold, but prop-1 should rank higher
    const results = fewShotIndexer.findRelevantExamples('When is check-in?', 'prop-1', 5);
    expect(results.length).toBe(2);
    expect(results[0].propertyId).toBe('prop-1');
  });

  it('adds 10 points per keyword overlap', async () => {
    await seedExample(
      'Where can I park my car?',
      'Parking is in the back lot.',
      'prop-1',
    );
    // Query shares "park" keyword and "parking" intent
    const results = fewShotIndexer.findRelevantExamples('Is there parking nearby?', 'prop-2');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].intent).toBe('parking');
  });

  it('excludes examples below the >= 30 threshold', async () => {
    // Seed an example with "general" intent and unique keywords
    await seedExample('Tell me about the neighborhood nightlife', 'There are great bars on Main St.');
    // Query that yields a different intent and no keyword overlap
    // "How do I use the stove?" → "appliance" intent, no keyword match with "neighborhood nightlife"
    const results = fewShotIndexer.findRelevantExamples('How do I use the stove?');
    // These have different intents and different keywords → score should be < 30
    // Only temporal bonus could push it over, but that's ~15 max for recent items
    // Without intent match (50) or property match (20) or keyword overlap,
    // the only score source is temporal (max ~15) + origin bonus (0 for default)
    // 15 < 30, so it should be excluded
    expect(results).toEqual([]);
  });

  it('respects the limit parameter', async () => {
    // Seed 5 wifi examples
    for (let i = 0; i < 5; i++) {
      await seedExample(`What is the wifi password ${i}?`, `Password is guest${i}.`);
    }
    const results = fewShotIndexer.findRelevantExamples('wifi password?', undefined, 2);
    expect(results.length).toBe(2);
  });

  it('defaults limit to 3', async () => {
    for (let i = 0; i < 5; i++) {
      await seedExample(`Can you share the wifi info ${i}?`, `Sure, it is net${i}.`);
    }
    const results = fewShotIndexer.findRelevantExamples('wifi password?');
    expect(results.length).toBe(3);
  });

  it('sorts results by score descending', async () => {
    // Seed examples: one with intent match + property match + host_written, one with only intent match
    await seedExample('Wifi password?', 'Password is abc.', 'prop-1', 'host_written');
    await seedExample('What is the internet code?', 'Code is xyz.', 'prop-2');

    const results = fewShotIndexer.findRelevantExamples('Wifi info please', 'prop-1', 5);
    expect(results.length).toBeGreaterThanOrEqual(2);
    // First result should be the one with property match + host_written bonus
    expect(results[0].propertyId).toBe('prop-1');
  });

  it('gives host_written origin +30 bonus', async () => {
    await seedExample('Check in time?', 'Check in is at 3pm.', undefined, 'host_written');
    await seedExample('When is check in?', 'At 3pm.', undefined, 'ai_approved');

    const results = fewShotIndexer.findRelevantExamples('What time is check in?', undefined, 5);
    expect(results.length).toBeGreaterThanOrEqual(2);
    // host_written should rank higher due to +30 bonus
    expect(results[0].originType).toBe('host_written');
  });

  it('gives ai_edited origin +15 bonus', async () => {
    await seedExample('Parking info?', 'Park in the garage.', undefined, 'ai_edited');
    await seedExample('Where to park?', 'Use the driveway.', undefined, 'ai_approved');

    const results = fewShotIndexer.findRelevantExamples('Is there parking?', undefined, 5);
    expect(results.length).toBeGreaterThanOrEqual(2);
    // ai_edited should rank higher than ai_approved
    expect(results[0].originType).toBe('ai_edited');
  });
});

// ============================================================================
// addExample — persistence and indexing
// ============================================================================

describe('FewShotIndexer.addExample', () => {
  it('adds example and makes it findable', async () => {
    await seedExample('What is the pool temperature?', 'The pool is heated to 82 degrees.');
    const results = fewShotIndexer.findRelevantExamples('Is the pool warm?');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('schedules save with 1s debounce after each add', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    AsyncStorage.setItem.mockClear();

    await seedExample('Wifi?', 'beach123');

    // Save hasn't fired yet (debounced)
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    // Advance timers past the 1s debounce
    jest.advanceTimersByTime(1100);

    // Allow the async save promise to resolve
    await Promise.resolve();
    await Promise.resolve();

    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it('detects intent correctly for the added example', async () => {
    // "Can I check in early?" matches check_in first (check.?in precedes early_checkin)
    await seedExample('Can I check in early?', 'Sure, we can try to accommodate.');
    const results = fewShotIndexer.findRelevantExamples('When can I check in?');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].intent).toBe('check_in');
  });

  it('extracts keywords excluding stop words', async () => {
    await seedExample('Where is the nearest grocery store?', 'There is a Publix 5 min away.');
    const results = fewShotIndexer.findRelevantExamples('grocery store nearby');
    expect(results.length).toBeGreaterThanOrEqual(1);
    // "nearest" / "grocery" / "store" should be keywords; "is", "the" should not
  });

  it('stores originType on added examples', async () => {
    await seedExample('Pet policy?', 'We allow small dogs.', 'prop-1', 'host_written');
    const results = fewShotIndexer.findRelevantExamples('Can I bring my dog?', 'prop-1');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].originType).toBe('host_written');
  });
});

// ============================================================================
// loadIndex / saveIndex — persistence round-trip
// ============================================================================

describe('FewShotIndexer persistence', () => {
  it('loads examples from AsyncStorage and rebuilds indexes', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const savedExamples: FewShotExample[] = [
      makeExample({ intent: 'wifi', keywords: ['wifi', 'password'], guestMessage: 'wifi password?', hostResponse: 'beach123' }),
      makeExample({ intent: 'parking', keywords: ['parking', 'car'], guestMessage: 'parking info?', hostResponse: 'Use the garage.' }),
    ];

    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({ examples: savedExamples }));
    await fewShotIndexer.loadIndex();

    // Both should be findable now
    const wifiResults = fewShotIndexer.findRelevantExamples('wifi password?');
    expect(wifiResults.length).toBeGreaterThanOrEqual(1);

    const parkResults = fewShotIndexer.findRelevantExamples('Where to park?');
    expect(parkResults.length).toBeGreaterThanOrEqual(1);
  });

  it('caps saved examples at 5000', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    // Load 5500 examples
    const manyExamples = Array.from({ length: 5500 }, (_, i) =>
      makeExample({ id: `fs_${i}`, intent: 'wifi', keywords: ['wifi'] }),
    );

    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({ examples: manyExamples }));
    await fewShotIndexer.loadIndex();

    // Trigger save
    AsyncStorage.setItem.mockClear();
    await fewShotIndexer.saveIndex();

    const savedData = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
    expect(savedData.examples.length).toBe(5000);
  });
});

// ============================================================================
// detectIntent (tested indirectly through addExample + findRelevantExamples)
// ============================================================================

describe('FewShotIndexer intent detection', () => {
  // Intent detection uses Object.entries() iteration order.
  // Earlier patterns take precedence — e.g. "check.?out" matches before "late_checkout",
  // "not working" hits "maintenance" before "hvac", "store" hits "local_tips" before "question".
  const intentCases: Array<[string, string]> = [
    ['What is the wifi password?', 'wifi'],
    ['When is check-in?', 'check_in'],
    // "Can I check out late?" → check_out matches first (check.?out before late_checkout)
    ['Can I check out late?', 'check_out'],
    // "Is early check-in available?" → check_in matches first (check.?in before early_checkin)
    ['Is early check-in available?', 'check_in'],
    // To hit early_checkin, must not match check_in patterns (check.?in, arrive, key, code, lock, door)
    // Actually "arrive" is in check_in pattern too, so early_checkin is unreachable when
    // the message contains any check_in trigger word. Documenting this as current behavior:
    // early_checkin requires "early" + one of (check, arrive, in) but check_in catches
    // "arrive" and "check" first. The only way to match early_checkin is "early" + "in"
    // without other check_in triggers.
    ['Is earlier in the day possible?', 'early_checkin'],
    // To actually hit late_checkout, must use phrasing that dodges check_out:
    ['Is a later stay possible?', 'late_checkout'],
    ['Where do I park?', 'parking'],
    ['Can I bring my dog?', 'pet'],
    ['The AC is broken', 'maintenance'],
    ['Can you send fresh towels?', 'housekeeping'],
    ['How do I use the TV?', 'appliance'],
    ['Is there a pool?', 'amenity'],
    // "The heat is not working" → "not working" matches maintenance before \bheat matches hvac
    ['The heat is not working', 'maintenance'],
    // To hit hvac, use phrasing that dodges maintenance:
    ['The thermostat seems off', 'hvac'],
    ['The neighbors are so loud', 'noise'],
    ['Any good restaurants nearby?', 'local_tips'],
    ['There is a fire!', 'emergency'],
    ['I want a refund', 'refund'],
    ['Can I extend my reservation?', 'booking'],
    ['Thank you so much!', 'thanks'],
    // "Where is the nearest store?" → "store" matches local_tips before "where" matches question
    ['Where is the nearest store?', 'local_tips'],
    // To hit question, use phrasing that dodges all earlier patterns:
    ['How long until the shuttle?', 'question'],
    ['Hello there', 'general'],
  ];

  it.each(intentCases)('classifies "%s" as "%s"', async (message, expectedIntent) => {
    await seedExample(message, 'Response.', undefined);
    // The last added example should have the detected intent
    const results = fewShotIndexer.findRelevantExamples(message, undefined, 10);
    const matchingResult = results.find(r => r.guestMessage === message);
    expect(matchingResult).toBeDefined();
    expect(matchingResult!.intent).toBe(expectedIntent);
  });
});

// ============================================================================
// getHostWrittenVoiceAnchors — diverse voice sample selection
// ============================================================================

describe('FewShotIndexer.getHostWrittenVoiceAnchors', () => {
  it('returns empty array when no host-written examples exist', () => {
    const anchors = fewShotIndexer.getHostWrittenVoiceAnchors();
    expect(anchors).toEqual([]);
  });

  it('returns host-written examples with length >= 30', async () => {
    await seedExample('Wifi?', 'pw123', undefined, 'host_written'); // too short (< 30 chars)
    await seedExample(
      'Check in?',
      'Check-in is at 3pm, please use the code 4521 at the front door.',
      undefined,
      'host_written',
    );
    const anchors = fewShotIndexer.getHostWrittenVoiceAnchors();
    expect(anchors.length).toBe(1);
    expect(anchors[0].hostResponse.length).toBeGreaterThanOrEqual(30);
  });

  it('falls back to ai_edited when no host-written exist', async () => {
    await seedExample(
      'Parking?',
      'You can park in the garage behind the building, spot 4.',
      undefined,
      'ai_edited',
    );
    const anchors = fewShotIndexer.getHostWrittenVoiceAnchors();
    expect(anchors.length).toBe(1);
    expect(anchors[0].originType).toBe('ai_edited');
  });

  it('picks diverse intents (one per intent)', async () => {
    await seedExample(
      'Wifi password?',
      'The wifi password is beach123 — enjoy your stay!',
      undefined,
      'host_written',
    );
    await seedExample(
      'Another wifi question',
      'Sure the wifi network is BeachHouse, password beach123.',
      undefined,
      'host_written',
    );
    await seedExample(
      'When is check-in time?',
      'Check-in is at 3pm. The door code will be sent the morning of.',
      undefined,
      'host_written',
    );
    const anchors = fewShotIndexer.getHostWrittenVoiceAnchors(5);
    // Should have at most 2 unique intents (wifi + check_in), not 3 total
    const intents = new Set(anchors.map(a => a.intent));
    expect(intents.size).toBe(2);
  });

  it('respects the limit parameter', async () => {
    for (let i = 0; i < 10; i++) {
      await seedExample(
        `Question about topic ${i} — check-in details?`,
        `Here is a sufficiently long response for topic ${i} to pass the 30 char filter.`,
        undefined,
        'host_written',
      );
    }
    const anchors = fewShotIndexer.getHostWrittenVoiceAnchors(3);
    expect(anchors.length).toBeLessThanOrEqual(3);
  });
});

// ============================================================================
// getFewShotPrompt — prompt string formatting
// ============================================================================

describe('FewShotIndexer.getFewShotPrompt', () => {
  it('returns empty string when no examples exist', () => {
    // With a freshly-reset indexer (empty examples), no matches are possible
    const prompt = fewShotIndexer.getFewShotPrompt('xyzzy nonsense query');
    expect(prompt).toBe('');
  });

  it('formats examples with Guest/Your response labels', async () => {
    await seedExample('What is the wifi?', 'The wifi is beach123.', 'prop-1');
    const prompt = fewShotIndexer.getFewShotPrompt('wifi password?', 'prop-1');
    expect(prompt).toContain('RELEVANT EXAMPLES');
    expect(prompt).toContain('Guest:');
    expect(prompt).toContain('Your response:');
    expect(prompt).toContain('beach123');
  });

  it('includes guidance text for tone and style', async () => {
    await seedExample('Parking info?', 'Park in the garage, spot 4.', 'prop-1');
    const prompt = fewShotIndexer.getFewShotPrompt('Where to park?', 'prop-1');
    expect(prompt).toContain('Use these examples to guide your tone, style, and level of detail.');
  });
});

// ============================================================================
// getStats — summary statistics
// ============================================================================

describe('FewShotIndexer.getStats', () => {
  it('returns zero totals when empty', () => {
    const stats = fewShotIndexer.getStats();
    expect(stats.total).toBe(0);
    expect(stats.byIntent).toEqual({});
  });

  it('counts examples by intent', async () => {
    await seedExample('Wifi?', 'beach123');
    await seedExample('Another wifi q', 'network: BeachHouse');
    await seedExample('Check-in time?', '3pm');

    const stats = fewShotIndexer.getStats();
    expect(stats.total).toBe(3);
    expect(stats.byIntent['wifi']).toBe(2);
    expect(stats.byIntent['check_in']).toBe(1);
  });
});
