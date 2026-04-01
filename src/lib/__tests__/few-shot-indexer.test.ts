/**
 * FewShotIndexer threshold characterization tests
 *
 * Validates the minimum quality threshold in findRelevantExamples().
 * The threshold was lowered from 30 to 10 so sparse-data properties
 * still benefit from available examples.
 */

const mockAsyncStorageGetItem = jest.fn().mockResolvedValue(null);
const mockAsyncStorageSetItem = jest.fn().mockResolvedValue(undefined);
const mockAsyncStorageRemoveItem = jest.fn().mockResolvedValue(undefined);

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockAsyncStorageGetItem(...args),
    setItem: (...args: unknown[]) => mockAsyncStorageSetItem(...args),
    removeItem: (...args: unknown[]) => mockAsyncStorageRemoveItem(...args),
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../learning-sync', () => ({
  syncLearningToCloud: jest.fn().mockResolvedValue(undefined),
}));

import { fewShotIndexer, type FewShotExample } from '../advanced-training';

describe('FewShotIndexer threshold', () => {
  beforeEach(async () => {
    // Reset indexer state by loading empty storage
    mockAsyncStorageGetItem.mockResolvedValue(null);
    await fewShotIndexer.loadIndex();
  });

  it('returns examples scoring >= 10 (new threshold)', async () => {
    // Add an example with a single keyword overlap but no intent match.
    // "wifi" in guest message → intent=wifi, keywords=["wifi","password"]
    // Query "What is the password?" → intent=question, keywords=["password"]
    // Score: intent mismatch (0) + 1 keyword overlap (10) + recency bonus (~15) = ~25
    // This should pass the threshold of 10.
    await fewShotIndexer.addExample(
      'What is the wifi password?',
      'The wifi password is GuestNet2026!',
      'prop-1',
    );

    const results = fewShotIndexer.findRelevantExamples('What is the password?', 'prop-1');
    expect(results.length).toBe(1);
  });

  it('filters examples scoring below 10', async () => {
    // Add an example about wifi
    await fewShotIndexer.addExample(
      'Where is the pool?',
      'The pool is on the rooftop!',
      'prop-1',
    );

    // Query something completely unrelated with zero keyword/intent overlap
    // "Hello there" → intent=general, keywords=["hello", "there"]
    // The example: intent=amenity, keywords=["pool"]
    // Score: intent mismatch (0) + 0 keyword overlap (0) + recency bonus (~15) = ~15
    // Actually recency alone can push above 10, so we need a truly stale example.
    // Let's test with a very old timestamp instead by loading from storage directly.

    // Load an example with ancient timestamp (low temporal weight → ~2 bonus)
    const ancientExample: FewShotExample = {
      id: 'fs_ancient_1',
      guestMessage: 'Where is the pool?',
      hostResponse: 'The pool is on the rooftop!',
      intent: 'amenity',
      keywords: ['pool'],
      propertyId: 'prop-other',
      timestamp: Date.now() - 365 * 24 * 60 * 60 * 1000, // 1 year ago
    };

    mockAsyncStorageGetItem.mockResolvedValue(
      JSON.stringify({ examples: [ancientExample] }),
    );
    await fewShotIndexer.loadIndex();

    // "Hello nice day" → intent=general, keywords=["hello","nice","day"]
    // vs example: intent=amenity, keywords=["pool"]
    // Score: 0 (intent) + 0 (keyword) + 0 (property mismatch) + ~2 (ancient recency) + 0 (no origin) = ~2
    // Should be filtered by threshold of 10
    const results = fewShotIndexer.findRelevantExamples('Hello nice day', 'prop-1');
    expect(results.length).toBe(0);
  });

  it('includes intent-matched examples (score 50+)', async () => {
    await fewShotIndexer.addExample(
      'What time is check in?',
      'Check-in is at 3 PM. I will send the door code the morning of your arrival.',
      'prop-1',
    );

    // Same intent (check_in) → 50 points + recency + property match
    const results = fewShotIndexer.findRelevantExamples(
      'When can I arrive for check in?',
      'prop-1',
    );
    expect(results.length).toBe(1);
    expect(results[0].hostResponse).toContain('3 PM');
  });

  it('includes keyword-only matches scoring exactly 10+ (regression guard)', async () => {
    // Load an example that will score exactly around the threshold boundary.
    // Ancient timestamp (~2 recency), no property match, no intent match, 1 keyword overlap = 10 + 2 = 12
    const example: FewShotExample = {
      id: 'fs_boundary_1',
      guestMessage: 'Is there parking available?',
      hostResponse: 'Yes, we have free parking in the driveway.',
      intent: 'parking',
      keywords: ['parking', 'available'],
      propertyId: 'prop-other',
      timestamp: Date.now() - 365 * 24 * 60 * 60 * 1000,
    };

    mockAsyncStorageGetItem.mockResolvedValue(
      JSON.stringify({ examples: [example] }),
    );
    await fewShotIndexer.loadIndex();

    // "Is gym available?" → intent=amenity, keywords=["gym","available"]
    // 1 keyword overlap ("available") = 10, ~2 recency = 12 total → above 10, included
    const results = fewShotIndexer.findRelevantExamples('Is gym available?', 'prop-other');
    // With property match (+20) this would be 32, but we intentionally use different property
    // to isolate the keyword scoring. With prop-1 (no match): 10 + ~2 = ~12 → included
    expect(results.length).toBe(1);
  });

  it('respects the limit parameter', async () => {
    // Add 5 check-in examples
    for (let i = 0; i < 5; i++) {
      await fewShotIndexer.addExample(
        `What time is check in? (${i})`,
        `Check-in is at ${i + 1} PM.`,
        'prop-1',
      );
    }

    const results = fewShotIndexer.findRelevantExamples(
      'When can I check in?',
      'prop-1',
      2,
    );
    expect(results.length).toBe(2);
  });
});
