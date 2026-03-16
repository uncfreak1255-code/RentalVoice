/**
 * Embedding Service Tests
 *
 * 📁 server/src/__tests__/embedding.test.ts
 * Purpose: Unit tests for Gemini embedding service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally before importing the module under test
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import after stubbing global fetch
const { embedText, embedBatch } = await import('../services/embedding.js');

const FAKE_768_VECTOR = Array.from({ length: 768 }, (_, i) => i / 768);

function makeSingleEmbedResponse(vector: number[]) {
  return {
    ok: true,
    json: async () => ({
      embedding: { values: vector },
    }),
  };
}

function makeBatchEmbedResponse(vectors: number[][]) {
  return {
    ok: true,
    json: async () => ({
      embeddings: vectors.map((values) => ({ values })),
    }),
  };
}

describe('embedText', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_AI_API_KEY', 'test-key');
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a 768-dimensional vector', async () => {
    mockFetch.mockResolvedValueOnce(makeSingleEmbedResponse(FAKE_768_VECTOR));

    const result = await embedText('Hello, how do I check in?');

    expect(result).toHaveLength(768);
    expect(result[0]).toBeCloseTo(0);
    expect(result[767]).toBeCloseTo(767 / 768);
  });

  it('calls the correct Gemini endpoint', async () => {
    mockFetch.mockResolvedValueOnce(makeSingleEmbedResponse(FAKE_768_VECTOR));

    await embedText('test message');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('gemini-embedding-001:embedContent'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws with status code on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limit exceeded' } }),
    });

    await expect(embedText('test')).rejects.toThrow('429');
  });
});

describe('embedBatch', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_AI_API_KEY', 'test-key');
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('embeds multiple texts and returns matching number of vectors', async () => {
    const texts = ['message one', 'message two', 'message three'];
    const vectors = texts.map((_, i) =>
      Array.from({ length: 768 }, () => i * 0.1)
    );

    mockFetch.mockResolvedValueOnce(makeBatchEmbedResponse(vectors));

    const results = await embedBatch(texts);

    expect(results).toHaveLength(3);
    results.forEach((vec) => expect(vec).toHaveLength(768));
  });

  it('calls the batchEmbedContents endpoint', async () => {
    mockFetch.mockResolvedValueOnce(makeBatchEmbedResponse([[0.1, 0.2]]));

    await embedBatch(['single text']);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('gemini-embedding-001:batchEmbedContents'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('chunks large batches into groups of 100', async () => {
    // 250 texts → 3 API calls (100 + 100 + 50)
    const texts = Array.from({ length: 250 }, (_, i) => `message ${i}`);
    const makeVec = () => Array.from({ length: 768 }, () => 0);

    // Batch 1: 100 texts
    mockFetch.mockResolvedValueOnce(
      makeBatchEmbedResponse(Array.from({ length: 100 }, makeVec))
    );
    // Batch 2: 100 texts
    mockFetch.mockResolvedValueOnce(
      makeBatchEmbedResponse(Array.from({ length: 100 }, makeVec))
    );
    // Batch 3: 50 texts
    mockFetch.mockResolvedValueOnce(
      makeBatchEmbedResponse(Array.from({ length: 50 }, makeVec))
    );

    const results = await embedBatch(texts);

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(results).toHaveLength(250);
  });

  it('throws with status code on batch API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Internal error' } }),
    });

    await expect(embedBatch(['test'])).rejects.toThrow('500');
  });
});
