/**
 * Embedding Service
 *
 * 📁 server/src/services/embedding.ts
 * Purpose: Wrap Gemini gemini-embedding-001 for 768-dim text embeddings
 * Depends on: GOOGLE_AI_API_KEY env var
 * Used by: voice routes (query, import, learn)
 */

const GEMINI_EMBED_MODEL = 'gemini-embedding-001';
const OUTPUT_DIMENSIONALITY = 768;
const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 100;

function getApiKey(): string {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new Error('[Embedding] GOOGLE_AI_API_KEY is not set');
  return key;
}

/**
 * Embed a single text string. Returns a 768-dimensional vector.
 */
export async function embedText(text: string): Promise<number[]> {
  const key = getApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBED_MODEL}:embedContent?key=${key}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${GEMINI_EMBED_MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: OUTPUT_DIMENSIONALITY,
    }),
  });

  if (!res.ok) {
    throw new Error(`[Embedding] embedContent API error: ${res.status}`);
  }

  const data = (await res.json()) as { embedding: { values: number[] } };
  return data.embedding.values;
}

/**
 * Embed a batch of texts. Splits into chunks of 100 with 100ms delay between chunks.
 * Returns vectors in the same order as the input texts.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const key = getApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBED_MODEL}:batchEmbedContents?key=${key}`;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    if (i > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }

    const chunk = texts.slice(i, i + BATCH_SIZE);
    const requests = chunk.map((text) => ({
      model: `models/${GEMINI_EMBED_MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: OUTPUT_DIMENSIONALITY,
    }));

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    });

    if (!res.ok) {
      throw new Error(`[Embedding] batchEmbedContents API error: ${res.status}`);
    }

    const data = (await res.json()) as { embeddings: { values: number[] }[] };
    for (const emb of data.embeddings) {
      results.push(emb.values);
    }
  }

  return results;
}
