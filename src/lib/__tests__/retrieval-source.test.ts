import AsyncStorageMock from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import { createRetrievalSourceReader } from '../retrieval-source';

jest.mock('@react-native-async-storage/async-storage', () => AsyncStorageMock);

function makeReader(overrides: Partial<Parameters<typeof createRetrievalSourceReader>[0]> = {}) {
  return createRetrievalSourceReader({
    now: () => 1_744_136_000_000,
    getFewShotStats: () => ({
      total: 6,
      byIntent: {
        wifi: 4,
        early_checkin: 2,
      },
    }),
    findRelevantExamples: () => [{ id: 'ex-1' }, { id: 'ex-2' }],
    getStoredEditPatterns: async () => [
      {
        propertyId: 'property-1',
        timestamp: 1_744_136_000_000 - 10_000,
      },
      {
        propertyId: 'property-2',
        timestamp: 1_744_136_000_000 - 10_000,
      },
      {
        propertyId: 'property-1',
        timestamp: 1_744_136_000_000 - 60 * 24 * 60 * 60 * 1000,
      },
    ],
    ...overrides,
  });
}

describe('createRetrievalSourceReader', () => {
  it('reports coverage from the local few-shot index', () => {
    const reader = makeReader();

    const source = reader.getCoverageSource();

    expect(source.mode).toBe('local_few_shot');
    expect(source.patternCount).toBe(6);
    expect(source.byIntent).toEqual({
      wifi: 4,
      early_checkin: 2,
    });
    expect(source.indexedPatterns).toEqual([
      { guestIntent: 'wifi' },
      { guestIntent: 'wifi' },
      { guestIntent: 'wifi' },
      { guestIntent: 'wifi' },
      { guestIntent: 'early_checkin' },
      { guestIntent: 'early_checkin' },
    ]);
  });

  it('builds draft proof from similar examples plus recent corrections for the same property', async () => {
    const reader = makeReader();

    const proof = await reader.getDraftLearningProof(
      'Can we check in early tomorrow?',
      'property-1',
    );

    expect(proof).toEqual({
      mode: 'local_few_shot',
      similarExamplesCount: 2,
      recentCorrectionsCount: 1,
      summary: 'Using 2 similar examples and 1 recent correction',
    });
  });

  it('returns no summary when there are no examples or recent corrections', async () => {
    const reader = makeReader({
      findRelevantExamples: () => [],
      getStoredEditPatterns: async () => [],
    });

    const proof = await reader.getDraftLearningProof('What is the wifi password?', 'property-1');

    expect(proof.summary).toBeNull();
    expect(proof.similarExamplesCount).toBe(0);
    expect(proof.recentCorrectionsCount).toBe(0);
  });
});
