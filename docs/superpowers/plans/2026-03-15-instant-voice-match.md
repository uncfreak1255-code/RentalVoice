# Instant Voice Match Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace keyword-based few-shot retrieval with semantic embedding search over 6 months of Hostaway conversation history, raising voice accuracy from ~45% to 80%+.

**Architecture:** New `voice_examples` table in Supabase with pgvector HNSW index. Server-side Gemini embedding + pgvector query via new `/api/voice/*` routes. Client calls server for semantic matches, falls back to existing `FewShotIndexer` when offline.

**Tech Stack:** Supabase pgvector, Gemini `gemini-embedding-001` (768d), Hono routes, Zod validation, AsyncStorage cache, TypeScript strict mode (ESNext modules on server).

**Spec:** `docs/superpowers/specs/2026-03-15-instant-voice-match-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260315000000_voice_examples.sql` | Table, HNSW index, RLS policy, `match_voice_examples` RPC function |
| `server/src/services/embedding.ts` | Gemini embedding API client (batch + single) |
| `server/src/routes/voice.ts` | `/api/voice/import`, `/api/voice/query`, `/api/voice/learn` endpoints |
| `src/lib/semantic-voice-index.ts` | Client module: query (via server), learn, local cache |
| `server/src/__tests__/embedding.test.ts` | Unit tests for embedding service |
| `server/src/__tests__/voice-routes.test.ts` | Integration tests for voice routes |
| `src/__tests__/semantic-voice-index.test.ts` | Unit tests for client module |
| `server/vitest.config.ts` | Vitest configuration for server tests |

### Modified Files

| File | What Changes |
|------|-------------|
| `server/src/index.ts` | Register voice routes: `import { voiceRouter } from './routes/voice.js'; app.route('/voice', voiceRouter);` |
| `src/lib/advanced-training.ts` (line 2154) | `buildAdvancedAIPrompt()` gets sibling function for semantic examples |
| `src/lib/ai-enhanced.ts` (line 2884 — inside `buildSystemPromptWithEditLearning`, called from `generateEnhancedAIResponse` at line 2217) | Semantic query replaces keyword match when online |
| `src/lib/ai-enhanced.ts` (line 3065 — inside `learnFromSentMessage`) | Also calls `semanticVoiceIndex.learn()` |

---

## Chunk 1: Database + Embedding Service

### Task 0: Test Infrastructure Setup

**Files:**
- Create: `server/vitest.config.ts`

- [ ] **Step 1: Install vitest in server**

```bash
cd /Users/sawbeck/Projects/RentalVoice/server && npm install -D vitest
```

- [ ] **Step 2: Create vitest config**

```typescript
// server/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: './src',
    environment: 'node',
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add server/vitest.config.ts server/package.json server/package-lock.json
git commit -m "chore: add vitest test infrastructure to server"
```

---

### Task 1: Supabase Migration

**Files:**
- Create: `supabase/migrations/20260315000000_voice_examples.sql`

- [ ] **Step 1: Write the migration (includes table, indexes, RLS, AND RPC function)**

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE voice_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id TEXT,
  guest_message TEXT NOT NULL,
  host_response TEXT NOT NULL,
  intent TEXT,
  origin_type TEXT DEFAULT 'historical', -- historical | host_written | ai_approved | ai_edited
  hostaway_conversation_id TEXT,
  message_hash TEXT, -- SHA-256 of guest_message + host_response for dedup
  embedding VECTOR(768) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  source_date TIMESTAMPTZ -- historical imports: message timestamp; continuous learning: now()
);

-- HNSW index: no reindexing needed, better recall at 2k-5k scale
CREATE INDEX voice_examples_embedding_idx
  ON voice_examples USING hnsw (embedding vector_cosine_ops);

CREATE INDEX voice_examples_property_idx
  ON voice_examples (org_id, property_id);

-- UNIQUE index for ON CONFLICT upsert dedup.
-- COALESCE handles NULL hostaway_conversation_id so uniqueness works for non-Hostaway examples too.
CREATE UNIQUE INDEX voice_examples_dedup_idx
  ON voice_examples (org_id, COALESCE(hostaway_conversation_id, ''), message_hash);

-- RLS: matches existing org_members subquery pattern
ALTER TABLE voice_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY voice_examples_org ON voice_examples
  FOR ALL USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

-- RPC function for pgvector similarity search
CREATE OR REPLACE FUNCTION match_voice_examples(
  query_embedding VECTOR(768),
  query_org_id UUID,
  query_property_id TEXT DEFAULT NULL,
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  guest_message TEXT,
  host_response TEXT,
  intent TEXT,
  origin_type TEXT,
  property_id TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ve.guest_message,
    ve.host_response,
    ve.intent,
    ve.origin_type,
    ve.property_id,
    1 - (ve.embedding <=> query_embedding) AS similarity
  FROM voice_examples ve
  WHERE ve.org_id = query_org_id
    AND (query_property_id IS NULL OR ve.property_id = query_property_id OR ve.property_id IS NULL)
  ORDER BY ve.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

- [ ] **Step 2: Apply migration to test project**

Run: `cd /Users/sawbeck/Projects/RentalVoice && npx supabase db push --db-url "$TEST_DB_URL"`

Expected: Migration applies cleanly. Verify with:
```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'voice_examples';
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260315000000_voice_examples.sql
git commit -m "feat: add voice_examples table with pgvector HNSW index and match RPC"
```

---

### Task 2: Embedding Service

**Files:**
- Create: `server/src/services/embedding.ts`
- Create: `server/src/__tests__/embedding.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/__tests__/embedding.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { embedText, embedBatch } from '../services/embedding.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('embedding service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_AI_API_KEY = 'test-key';
  });

  describe('embedText', () => {
    it('returns 768-dimensional vector for a single text', async () => {
      const fakeEmbedding = Array.from({ length: 768 }, (_, i) => i * 0.001);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embedding: { values: fakeEmbedding },
        }),
      });

      const result = await embedText('Can we check in early?');

      expect(result).toHaveLength(768);
      expect(result[0]).toBe(0);
      expect(result[1]).toBeCloseTo(0.001);
      expect(mockFetch).toHaveBeenCalledOnce();
      // Verify correct API URL and model
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('gemini-embedding-001');
      expect(callUrl).toContain('embedContent');
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limited',
      });

      await expect(embedText('test')).rejects.toThrow('Embedding API error: 429');
    });
  });

  describe('embedBatch', () => {
    it('embeds multiple texts in one call', async () => {
      const fakeEmbeddings = [
        { values: Array.from({ length: 768 }, () => 0.1) },
        { values: Array.from({ length: 768 }, () => 0.2) },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embeddings: fakeEmbeddings }),
      });

      const result = await embedBatch(['text one', 'text two']);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveLength(768);
      expect(result[1]).toHaveLength(768);
    });

    it('chunks large batches into groups of 100', async () => {
      const texts = Array.from({ length: 150 }, (_, i) => `text ${i}`);
      const fakeBatch = (count: number) => ({
        ok: true,
        json: async () => ({
          embeddings: Array.from({ length: count }, () => ({
            values: Array.from({ length: 768 }, () => 0.1),
          })),
        }),
      });

      mockFetch
        .mockResolvedValueOnce(fakeBatch(100))
        .mockResolvedValueOnce(fakeBatch(50));

      const result = await embedBatch(texts);

      expect(result).toHaveLength(150);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/sawbeck/Projects/RentalVoice/server && npx vitest run src/__tests__/embedding.test.ts`

Expected: FAIL — module `../services/embedding.js` not found.

- [ ] **Step 3: Write the embedding service**

```typescript
// server/src/services/embedding.ts

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;
const MAX_BATCH_SIZE = 100;
const BATCH_DELAY_MS = 100; // Rate limit protection

function getApiKey(): string {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new Error('[EMBEDDING] GOOGLE_AI_API_KEY not set');
  return key;
}

/**
 * Embed a single text using Gemini embedding API.
 * Returns a 768-dimensional float array.
 */
export async function embedText(text: string): Promise<number[]> {
  const apiKey = getApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const data = await response.json();
  return data.embedding.values as number[];
}

/**
 * Embed multiple texts in batches of 100.
 * Returns array of 768-dimensional vectors in same order as input.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const chunk = texts.slice(i, i + MAX_BATCH_SIZE);

    const apiKey = getApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        requests: chunk.map((text) => ({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          outputDimensionality: EMBEDDING_DIMENSIONS,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding batch API error: ${response.status}`);
    }

    const data = await response.json();
    for (const emb of data.embeddings) {
      results.push(emb.values as number[]);
    }

    // Rate limit protection between batches
    if (i + MAX_BATCH_SIZE < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/sawbeck/Projects/RentalVoice/server && npx vitest run src/__tests__/embedding.test.ts`

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/embedding.ts server/src/__tests__/embedding.test.ts
git commit -m "feat: add Gemini embedding service with batch support"
```

---

### Task 3: Voice Routes — Query, Import, Learn Endpoints

**Files:**
- Create: `server/src/routes/voice.ts`
- Create: `server/src/__tests__/voice-routes.test.ts`
- Modify: `server/src/index.ts` (register routes)

**Pattern reference:** All route patterns match `server/src/routes/migration.ts`:
- Named export (`export const voiceRouter = new Hono<AppEnv>()`)
- `import type { AppEnv } from '../lib/env.js'` for Hono type param
- `voiceRouter.use('*', requireAuth)` as blanket middleware
- `import { getSupabaseAdmin } from '../db/supabase.js'` (NOT `../lib/supabase.js`)
- Zod validation via `safeParse` pattern (NOT `@hono/zod-validator` which is not installed)
- `orgId` comes from auth context (`c.get('orgId')`), NEVER from request body

- [ ] **Step 1: Write the failing test for query**

```typescript
// server/src/__tests__/voice-routes.test.ts
import { describe, it, expect, vi } from 'vitest';
import { scoreAndRankExamples } from '../routes/voice.js';

vi.mock('../services/embedding.js', () => ({
  embedText: vi.fn().mockResolvedValue(Array.from({ length: 768 }, () => 0.1)),
}));

describe('voice query', () => {
  it('returns scored examples sorted by final score', () => {
    const rawResults = [
      {
        guest_message: 'Can I check in early?',
        host_response: 'Sure! Check-in is at 4pm but you can come at 2.',
        intent: 'early_checkin',
        origin_type: 'host_written',
        property_id: 'prop_1',
        similarity: 0.92,
      },
      {
        guest_message: 'Early check-in possible?',
        host_response: 'Absolutely, we can do 2pm.',
        intent: 'early_checkin',
        origin_type: 'ai_edited',
        property_id: 'prop_2',
        similarity: 0.88,
      },
      {
        guest_message: 'What time is checkout?',
        host_response: 'Checkout is 10am.',
        intent: 'check_out',
        origin_type: 'historical',
        property_id: 'prop_1',
        similarity: 0.95,
      },
    ];

    const scored = scoreAndRankExamples(rawResults, 'prop_1', 3);

    // host_written (0.92*100 + 30 + 20) = 142
    // historical prop match (0.95*100 + 0 + 20) = 115
    // ai_edited no prop match (0.88*100 + 15 + 0) = 103
    expect(scored[0].guest_message).toBe('Can I check in early?');
    expect(scored[0].score).toBe(142);
    expect(scored).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/sawbeck/Projects/RentalVoice/server && npx vitest run src/__tests__/voice-routes.test.ts`

Expected: FAIL — module `../routes/voice.js` not found.

- [ ] **Step 3: Write the voice routes**

```typescript
// server/src/routes/voice.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { getSupabaseAdmin } from '../db/supabase.js';
import { embedText, embedBatch } from '../services/embedding.js';
import type { AppEnv } from '../lib/env.js';
import crypto from 'crypto';

export const voiceRouter = new Hono<AppEnv>();

voiceRouter.use('*', requireAuth);

// ─── Scoring ────────────────────────────────────────────

interface RawVoiceResult {
  guest_message: string;
  host_response: string;
  intent: string | null;
  origin_type: string;
  property_id: string | null;
  similarity: number;
}

interface ScoredVoiceResult extends RawVoiceResult {
  score: number;
}

const ORIGIN_BONUS: Record<string, number> = {
  host_written: 30,
  ai_edited: 15,
  ai_approved: 0,
  historical: 0,
};

export function scoreAndRankExamples(
  results: RawVoiceResult[],
  queryPropertyId: string | null,
  limit: number
): ScoredVoiceResult[] {
  return results
    .map((r) => {
      const similarityScore = r.similarity * 100;
      const originBonus = ORIGIN_BONUS[r.origin_type] ?? 0;
      const propertyBonus =
        queryPropertyId && r.property_id === queryPropertyId ? 20 : 0;
      return {
        ...r,
        score: Math.round((similarityScore + originBonus + propertyBonus) * 100) / 100,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ─── Query Endpoint ─────────────────────────────────────

// orgId comes from auth context, NOT from request body
const querySchema = z.object({
  guestMessage: z.string().min(1).max(5000),
  propertyId: z.string().optional(),
  limit: z.number().int().min(1).max(10).default(3),
});

voiceRouter.post('/query', async (c) => {
  const orgId = c.get('orgId');
  const body = await c.req.json();
  const parsed = querySchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error }, 400);
  }

  const { guestMessage, propertyId, limit } = parsed.data;

  try {
    // 1. Embed the guest message
    const embedding = await embedText(guestMessage);

    // 2. pgvector similarity search
    const supabase = getSupabaseAdmin();
    const embeddingStr = `[${embedding.join(',')}]`;

    const { data, error } = await supabase.rpc('match_voice_examples', {
      query_embedding: embeddingStr,
      query_org_id: orgId,
      query_property_id: propertyId ?? null,
      match_count: limit + 5, // Fetch extra for post-scoring
    });

    if (error) {
      console.error('[VOICE] pgvector query error:', error);
      return c.json({ error: 'Voice query failed' }, 500);
    }

    // 3. Score and rank
    const scored = scoreAndRankExamples(
      (data ?? []) as RawVoiceResult[],
      propertyId ?? null,
      limit
    );

    return c.json({
      examples: scored.map((s) => ({
        guestMessage: s.guest_message,
        hostResponse: s.host_response,
        intent: s.intent,
        originType: s.origin_type,
        similarity: s.similarity,
        score: s.score,
      })),
    });
  } catch (err) {
    console.error('[VOICE] Query error:', err);
    return c.json({ error: 'Voice query failed' }, 500);
  }
});

// ─── Import Endpoint ────────────────────────────────────

// Note: global bodyLimit is 1MB (set in server/src/index.ts).
// At batch size 200, each pair is ~500 bytes average = ~100KB per request, well within limits.
// If larger batches are needed in the future, add a route-specific bodyLimit override.

const importPairSchema = z.object({
  guestMessage: z.string().min(1),
  hostResponse: z.string().min(1),
  propertyId: z.string().optional(),
  intent: z.string().optional(),
  originType: z.string().default('historical'),
  hostawayConversationId: z.string().optional(),
  sourceDate: z.string().optional(), // ISO timestamp
});

// orgId comes from auth context, NOT from request body
const importSchema = z.object({
  pairs: z.array(importPairSchema).min(1).max(500),
});

function messageHash(guest: string, host: string): string {
  return crypto
    .createHash('sha256')
    .update(`${guest}|||${host}`)
    .digest('hex')
    .slice(0, 16);
}

voiceRouter.post('/import', async (c) => {
  const orgId = c.get('orgId');
  const body = await c.req.json();
  const parsed = importSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error }, 400);
  }

  const { pairs } = parsed.data;

  try {
    // 1. Embed all guest messages in batch
    const guestTexts = pairs.map((p) => p.guestMessage);
    const embeddings = await embedBatch(guestTexts);

    // 2. Build rows with dedup hashes
    const rows = pairs.map((pair, i) => ({
      org_id: orgId,
      property_id: pair.propertyId ?? null,
      guest_message: pair.guestMessage,
      host_response: pair.hostResponse,
      intent: pair.intent ?? null,
      origin_type: pair.originType,
      hostaway_conversation_id: pair.hostawayConversationId ?? null,
      message_hash: messageHash(pair.guestMessage, pair.hostResponse),
      embedding: `[${embeddings[i].join(',')}]`,
      source_date: pair.sourceDate ?? new Date().toISOString(),
    }));

    // 3. Upsert in batches of 100
    const supabase = getSupabaseAdmin();
    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);

      const { data, error } = await supabase
        .from('voice_examples')
        .upsert(batch, {
          onConflict: 'org_id,COALESCE(hostaway_conversation_id,\'\'),message_hash',
          ignoreDuplicates: true,
        })
        .select('id');

      if (error) {
        console.error('[VOICE] Import batch error:', error);
        // Continue with next batch — partial success is OK
        skipped += batch.length;
      } else {
        imported += data?.length ?? 0;
        skipped += batch.length - (data?.length ?? 0);
      }
    }

    console.log(
      `[VOICE] Import complete: ${imported} imported, ${skipped} skipped/duped`
    );

    return c.json({ imported, skipped, total: pairs.length });
  } catch (err) {
    console.error('[VOICE] Import error:', err);
    return c.json({ error: 'Voice import failed' }, 500);
  }
});

// ─── Learn Endpoint (single example) ───────────────────

// orgId comes from auth context, NOT from request body
const learnSchema = z.object({
  guestMessage: z.string().min(1),
  hostResponse: z.string().min(1),
  propertyId: z.string().optional(),
  intent: z.string().optional(),
  originType: z.enum(['host_written', 'ai_approved', 'ai_edited']),
});

voiceRouter.post('/learn', async (c) => {
  const orgId = c.get('orgId');
  const body = await c.req.json();
  const parsed = learnSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error }, 400);
  }

  const { guestMessage, hostResponse, propertyId, intent, originType } = parsed.data;

  try {
    const embedding = await embedText(guestMessage);
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from('voice_examples').insert({
      org_id: orgId,
      property_id: propertyId ?? null,
      guest_message: guestMessage,
      host_response: hostResponse,
      intent: intent ?? null,
      origin_type: originType,
      message_hash: messageHash(guestMessage, hostResponse),
      embedding: `[${embedding.join(',')}]`,
      source_date: new Date().toISOString(),
    });

    if (error) {
      console.error('[VOICE] Learn insert error:', error);
      return c.json({ error: 'Learn failed' }, 500);
    }

    return c.json({ ok: true });
  } catch (err) {
    console.error('[VOICE] Learn error:', err);
    return c.json({ error: 'Learn failed' }, 500);
  }
});
```

- [ ] **Step 4: Register voice routes in server index**

In `server/src/index.ts`, add the import alongside existing route imports (around line 27):

```typescript
import { voiceRouter } from './routes/voice.js';
```

And in the Route Mounting section (around line 89, after `app.route('/lodgify', lodgifyRouter);`):

```typescript
app.route('/voice', voiceRouter);
```

- [ ] **Step 5: Run tests to verify all pass**

Run: `cd /Users/sawbeck/Projects/RentalVoice/server && npx vitest run src/__tests__/voice-routes.test.ts src/__tests__/embedding.test.ts`

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/voice.ts server/src/services/embedding.ts server/src/__tests__/voice-routes.test.ts server/src/index.ts supabase/migrations/20260315000000_voice_examples.sql
git commit -m "feat: add voice query, import, and learn endpoints with pgvector"
```

---

### Task 4: Verify Server Compiles

- [ ] **Step 1: TypeScript compile check**

Run: `cd /Users/sawbeck/Projects/RentalVoice/server && npx tsc --noEmit`

Expected: No type errors. If errors, fix them before proceeding.

- [ ] **Step 2: Commit any type fixes**

```bash
git add -u && git commit -m "fix: resolve type errors in voice routes"
```

---

## Chunk 2: Client Integration

### Task 5: Semantic Voice Index Client Module

**Files:**
- Create: `src/lib/semantic-voice-index.ts`
- Create: `src/__tests__/semantic-voice-index.test.ts`

**Important patterns (from `src/lib/learning-sync.ts` and `src/lib/store.ts`):**
- `import { API_BASE_URL } from './config'` for server URL (NOT `useAppStore.getState().serverUrl` which does not exist)
- `const founderSession = useAppStore.getState().founderSession` for auth
- `founderSession?.orgId` for org ID
- `founderSession?.accessToken` for auth token
- Client must NOT send `orgId` in request body — the server gets it from the auth token

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/semantic-voice-index.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock store
vi.mock('../lib/store', () => ({
  useAppStore: {
    getState: vi.fn().mockReturnValue({
      founderSession: {
        orgId: 'test-org-uuid',
        accessToken: 'test-token',
      },
    }),
  },
}));

// Mock config
vi.mock('../lib/config', () => ({
  API_BASE_URL: 'http://localhost:3001',
}));

describe('SemanticVoiceIndex', () => {
  describe('formatAsPrompt', () => {
    it('formats scored examples into few-shot prompt text', async () => {
      const { formatAsPrompt } = await import('../lib/semantic-voice-index.js');

      const examples = [
        {
          guestMessage: 'Can we check in early?',
          hostResponse: 'Of course! Check-in is 4pm but 2pm works.',
          intent: 'early_checkin',
          originType: 'host_written',
          similarity: 0.92,
          score: 142,
        },
      ];

      const prompt = formatAsPrompt(examples);

      expect(prompt).toContain('Can we check in early?');
      expect(prompt).toContain('Of course! Check-in is 4pm but 2pm works.');
      expect(prompt).toContain('Guest:');
      expect(prompt).toContain('Host:');
    });

    it('returns empty string for no examples', async () => {
      const { formatAsPrompt } = await import('../lib/semantic-voice-index.js');
      expect(formatAsPrompt([])).toBe('');
    });
  });

  describe('query', () => {
    it('calls server /api/voice/query and returns examples', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          examples: [
            {
              guestMessage: 'Early check-in?',
              hostResponse: 'Sure, 2pm works!',
              intent: 'early_checkin',
              originType: 'host_written',
              similarity: 0.9,
              score: 140,
            },
          ],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const { query } = await import('../lib/semantic-voice-index.js');
      const result = await query('Can we swing by early?', 'prop_1');

      expect(result).toHaveLength(1);
      expect(result[0].guestMessage).toBe('Early check-in?');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/voice/query',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/sawbeck/Projects/RentalVoice && npx vitest run src/__tests__/semantic-voice-index.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write the client module**

```typescript
// src/lib/semantic-voice-index.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './config';
import { useAppStore } from './store';

const CACHE_KEY = 'semantic_voice_cache';
const CACHE_MAX = 500;
const CACHE_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export interface VoiceExample {
  guestMessage: string;
  hostResponse: string;
  intent: string | null;
  originType: string;
  similarity: number;
  score: number;
}

// ─── Internal helpers ────────────────────────────────────

function getAuthContext(): { orgId: string; accessToken: string } | null {
  const founderSession = useAppStore.getState().founderSession;
  if (!founderSession?.orgId || !founderSession?.accessToken) return null;
  return { orgId: founderSession.orgId, accessToken: founderSession.accessToken };
}

// ─── Query ──────────────────────────────────────────────

/**
 * Query for semantically similar voice examples.
 * Checks local cache first for a basic match, then falls through to server.
 * On server failure (offline), returns cached examples as fallback.
 */
export async function query(
  guestMessage: string,
  propertyId: string | undefined,
  limit: number = 3
): Promise<VoiceExample[]> {
  const auth = getAuthContext();
  if (!auth) return [];

  // Check local cache first — if we have cached examples, use them as a safety net
  const cached = await getCachedExamples();

  try {
    const response = await fetch(`${API_BASE_URL}/api/voice/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify({
        guestMessage,
        propertyId,
        limit,
      }),
    });

    if (!response.ok) {
      console.log('[SEMANTIC_VOICE] Query failed, status:', response.status);
      // Offline fallback: return cached examples if available
      return cached.slice(0, limit);
    }

    const data = await response.json();
    const examples = data.examples as VoiceExample[];

    // Update cache with fresh results
    if (examples.length > 0) {
      await updateCache(examples);
    }

    return examples;
  } catch (err) {
    console.log('[SEMANTIC_VOICE] Query error (offline?), falling back to cache:', err);
    // Offline fallback: return cached examples
    return cached.slice(0, limit);
  }
}

// ─── Learn ──────────────────────────────────────────────

export async function learn(
  guestMessage: string,
  hostResponse: string,
  propertyId: string | undefined,
  originType: 'host_written' | 'ai_approved' | 'ai_edited' = 'ai_approved',
  intent?: string
): Promise<boolean> {
  const auth = getAuthContext();
  if (!auth) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/api/voice/learn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify({
        guestMessage,
        hostResponse,
        propertyId,
        intent,
        originType,
      }),
    });

    if (!response.ok) {
      console.log('[SEMANTIC_VOICE] Learn failed, status:', response.status);
      return false;
    }

    return true;
  } catch (err) {
    console.log('[SEMANTIC_VOICE] Learn error (offline?):', err);
    return false;
  }
}

// ─── Format as Prompt ───────────────────────────────────

export function formatAsPrompt(examples: VoiceExample[]): string {
  if (examples.length === 0) return '';

  const lines = ['\n--- Voice examples (semantic match) ---\n'];

  for (const ex of examples) {
    lines.push(`Guest: ${ex.guestMessage}`);
    lines.push(`Host: ${ex.hostResponse}\n`);
  }

  return lines.join('\n');
}

// ─── Local Cache ────────────────────────────────────────

interface CacheState {
  examples: VoiceExample[];
  lastRefresh: number;
}

export async function getCachedExamples(): Promise<VoiceExample[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const state: CacheState = JSON.parse(raw);
    return state.examples;
  } catch {
    return [];
  }
}

/**
 * Merge new examples into the cache.
 * Deduplicates by guestMessage content before merging.
 * Evicts oldest entries beyond CACHE_MAX.
 */
export async function updateCache(newExamples: VoiceExample[]): Promise<void> {
  try {
    const existing = await getCachedExamples();

    // Deduplicate by guestMessage content
    const seen = new Set<string>();
    const merged: VoiceExample[] = [];

    // New examples take priority
    for (const ex of newExamples) {
      const key = ex.guestMessage;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(ex);
      }
    }
    // Then existing
    for (const ex of existing) {
      const key = ex.guestMessage;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(ex);
      }
    }

    const state: CacheState = {
      examples: merged.slice(0, CACHE_MAX),
      lastRefresh: Date.now(),
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch (err) {
    console.log('[SEMANTIC_VOICE] Cache update error:', err);
  }
}

export async function shouldRefreshCache(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return true;
    const state: CacheState = JSON.parse(raw);
    return Date.now() - state.lastRefresh > CACHE_REFRESH_INTERVAL_MS;
  } catch {
    return true;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/sawbeck/Projects/RentalVoice && npx vitest run src/__tests__/semantic-voice-index.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/semantic-voice-index.ts src/__tests__/semantic-voice-index.test.ts
git commit -m "feat: add semantic voice index client module with query, learn, cache"
```

---

### Task 6: Wire Semantic Index into buildAdvancedAIPrompt

**Files:**
- Modify: `src/lib/advanced-training.ts` (line 2154)

- [ ] **Step 1: Add import at top of advanced-training.ts**

At the top of `src/lib/advanced-training.ts`, add:

```typescript
import * as semanticVoiceIndex from './semantic-voice-index';
```

- [ ] **Step 2: Add sibling function that accepts semantic examples**

The current `buildAdvancedAIPrompt()` at line 2154 is synchronous. Add a new function directly after it (do NOT modify the original — callers without semantic results keep using the original):

```typescript
/**
 * Build the prompt with semantic voice examples when available.
 * Falls back to keyword-based FewShotIndexer when semanticExamples is empty.
 */
export function buildAdvancedAIPromptWithSemantic(
  guestMessage: string,
  semanticExamples: { guestMessage: string; hostResponse: string }[],
  propertyId?: string,
  guestEmail?: string,
  guestPhone?: string
): string {
  let additionalPrompt = '';

  // 1. Property lexicon (unchanged)
  additionalPrompt += propertyLexiconManager.getLexiconPrompt(propertyId || '');

  // 2. Voice examples — semantic if available, keyword fallback if not
  if (semanticExamples.length > 0) {
    additionalPrompt += semanticVoiceIndex.formatAsPrompt(
      semanticExamples.map((ex) => ({
        ...ex,
        intent: null,
        originType: 'historical',
        similarity: 1,
        score: 100,
      }))
    );
  } else {
    additionalPrompt += fewShotIndexer.getFewShotPrompt(guestMessage, propertyId);
  }

  // 3. Negative examples (unchanged)
  additionalPrompt += negativeExampleManager.getNegativeExamplesPrompt();

  // 4. Guest memory (unchanged)
  additionalPrompt += guestMemoryManager.getGuestMemoryPrompt(guestEmail, guestPhone);

  // 5. Property conversation knowledge (unchanged)
  if (propertyId) {
    additionalPrompt += propertyConversationKnowledge.getKnowledgePrompt(propertyId);
  }

  return additionalPrompt;
}
```

- [ ] **Step 3: Run TypeScript compile check**

Run: `cd /Users/sawbeck/Projects/RentalVoice && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/advanced-training.ts
git commit -m "feat: add buildAdvancedAIPromptWithSemantic for semantic voice examples"
```

---

### Task 7: Wire Semantic Index into learnFromSentMessage

**Files:**
- Modify: `src/lib/ai-enhanced.ts` (line 3065 — inside `learnFromSentMessage`)

- [ ] **Step 1: Add import at top of ai-enhanced.ts**

```typescript
import * as semanticVoiceIndex from './semantic-voice-index';
```

- [ ] **Step 2: Add semantic learn call inside learnFromSentMessage**

The `learnFromSentMessage` function is at line 3043. After the existing `fewShotIndexer.addExample()` call at line 3065, add:

```typescript
    // Semantic voice index — learn to pgvector (non-blocking, fire-and-forget)
    const founderSession = useAppStore.getState().founderSession;
    if (founderSession?.orgId) {
      semanticVoiceIndex.learn(
        guestMessage,
        hostResponse,
        propertyId,
        originType ?? (wasEdited ? 'ai_edited' : 'ai_approved'),
      ).catch((err) => {
        console.log('[AI_ENHANCED] Semantic learn failed (non-blocking):', err);
      });
    }
```

This is fire-and-forget — it does not block the learning flow. If the server is unreachable, it logs and moves on. The existing `FewShotIndexer` path is unaffected. Note: `useAppStore` is already imported in `ai-enhanced.ts`.

- [ ] **Step 3: Run TypeScript compile check**

Run: `cd /Users/sawbeck/Projects/RentalVoice && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai-enhanced.ts
git commit -m "feat: wire semantic voice learn into learnFromSentMessage (non-blocking)"
```

---

### Task 8: Wire Semantic Query into Draft Generation

**Files:**
- Modify: `src/lib/ai-enhanced.ts`

**Exact call site:** `buildAdvancedAIPrompt` is called at **line 2884** inside the function `buildSystemPromptWithEditLearning` (defined at line 2835). That function is called at **line 2217** from `generateEnhancedAIResponse` (defined at line 1990). The surrounding code:

```typescript
// Line 2882-2893 in src/lib/ai-enhanced.ts:
    // ADVANCED TRAINING: Add property lexicon, few-shot examples, negative examples, guest memory
    if (guestMessage) {
      const advancedPrompt = buildAdvancedAIPrompt(
        guestMessage,
        propertyId,
        guestEmail,
        guestPhone
      );
      if (advancedPrompt) {
        prompt += advancedPrompt;
      }
    }
```

- [ ] **Step 1: Make `buildSystemPromptWithEditLearning` use semantic query when available**

Replace the block at lines 2882-2893 with:

```typescript
    // ADVANCED TRAINING: Add property lexicon, few-shot examples, negative examples, guest memory
    if (guestMessage) {
      let advancedPrompt: string;

      // Try semantic voice match first (server-side pgvector query)
      const founderSession = useAppStore.getState().founderSession;
      if (founderSession?.orgId) {
        try {
          const semanticExamples = await semanticVoiceIndex.query(
            guestMessage,
            propertyId,
          );

          if (semanticExamples.length > 0) {
            advancedPrompt = buildAdvancedAIPromptWithSemantic(
              guestMessage,
              semanticExamples,
              propertyId,
              guestEmail,
              guestPhone,
            );
          } else {
            // No semantic results — use keyword fallback
            advancedPrompt = buildAdvancedAIPrompt(guestMessage, propertyId, guestEmail, guestPhone);
          }
        } catch {
          // Semantic query failed — use keyword fallback
          advancedPrompt = buildAdvancedAIPrompt(guestMessage, propertyId, guestEmail, guestPhone);
        }
      } else {
        // No founder session — use keyword fallback
        advancedPrompt = buildAdvancedAIPrompt(guestMessage, propertyId, guestEmail, guestPhone);
      }

      if (advancedPrompt) {
        prompt += advancedPrompt;
      }
    }
```

Note: `buildSystemPromptWithEditLearning` is already `async`, so `await` works here. Also add the import for `buildAdvancedAIPromptWithSemantic` at the top of the file alongside the existing `buildAdvancedAIPrompt` import (line 16):

```typescript
import {
  buildAdvancedAIPrompt,
  buildAdvancedAIPromptWithSemantic,
  // ... other existing imports
} from './advanced-training';
```

- [ ] **Step 2: Run TypeScript compile check**

Run: `cd /Users/sawbeck/Projects/RentalVoice && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai-enhanced.ts
git commit -m "feat: wire semantic voice query into draft generation with keyword fallback"
```

---

## Chunk 3: Bulk Import + Evaluation

### Task 9: Bulk Import Script

**Files:**
- Create: `server/scripts/bulk-import-voice.ts`

**Important:** This script does NOT send `orgId` in the request body — the server extracts it from the auth token. The script must paginate both conversations and messages (matching the pattern from `server/src/services/hostaway-history-sync.ts` lines 228-286).

- [ ] **Step 1: Write the bulk import script**

```typescript
// server/scripts/bulk-import-voice.ts
//
// One-time script: fetches 6 months of Hostaway conversations,
// chunks into guest/host pairs, and imports to voice_examples via /api/voice/import.
//
// Usage: npx tsx server/scripts/bulk-import-voice.ts
//
// Requires env vars: HOSTAWAY_ACCOUNT_ID, HOSTAWAY_API_KEY, SERVER_URL, AUTH_TOKEN

import 'dotenv/config';

const HOSTAWAY_ACCOUNT_ID = process.env.HOSTAWAY_ACCOUNT_ID;
const HOSTAWAY_API_KEY = process.env.HOSTAWAY_API_KEY;
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

// Pagination sizes — match server/src/services/hostaway-history-sync.ts
const CONVERSATION_PAGE_SIZE = 100;
const MESSAGE_PAGE_SIZE = 100;

if (!HOSTAWAY_ACCOUNT_ID || !HOSTAWAY_API_KEY || !AUTH_TOKEN) {
  console.error('Missing required env vars: HOSTAWAY_ACCOUNT_ID, HOSTAWAY_API_KEY, AUTH_TOKEN');
  process.exit(1);
}

interface HostawayMessage {
  id: number;
  conversationId: number;
  body: string;
  isIncoming: number; // 1 = guest, 0 = host
  insertedOn: string;
}

interface Pair {
  guestMessage: string;
  hostResponse: string;
  propertyId?: string;
  hostawayConversationId: string;
  sourceDate: string;
}

async function getAccessToken(): Promise<string> {
  const response = await fetch('https://api.hostaway.com/accessTokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: HOSTAWAY_ACCOUNT_ID!,
      client_secret: HOSTAWAY_API_KEY!,
      scope: 'general',
    }),
  });
  const data = await response.json();
  return data.access_token;
}

/**
 * Fetch ALL conversations with pagination.
 * Pattern from server/src/services/hostaway-history-sync.ts lines 228-255.
 */
async function fetchAllConversations(token: string): Promise<any[]> {
  const conversations: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `https://api.hostaway.com/v1/conversations?limit=${CONVERSATION_PAGE_SIZE}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    const page = data.result || [];
    conversations.push(...page);

    hasMore = page.length === CONVERSATION_PAGE_SIZE;
    offset += CONVERSATION_PAGE_SIZE;

    console.log(`[BULK_IMPORT] Fetched ${conversations.length} conversations so far...`);

    // Rate limit — 100ms between pages
    if (hasMore) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return conversations;
}

/**
 * Fetch ALL messages for a conversation with pagination.
 * Pattern from server/src/services/hostaway-history-sync.ts lines 274-286.
 */
async function fetchAllMessages(token: string, conversationId: number): Promise<HostawayMessage[]> {
  const messages: HostawayMessage[] = [];
  let messageOffset = 0;
  let hasMoreMessages = true;

  while (hasMoreMessages) {
    const response = await fetch(
      `https://api.hostaway.com/v1/conversations/${conversationId}/messages?limit=${MESSAGE_PAGE_SIZE}&offset=${messageOffset}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    const page = data.result || [];

    messages.push(...page);
    hasMoreMessages = page.length === MESSAGE_PAGE_SIZE;
    messageOffset += MESSAGE_PAGE_SIZE;
  }

  return messages;
}

function chunkIntoPairs(messages: HostawayMessage[], conversationId: number, propertyId?: string): Pair[] {
  const cutoff = Date.now() - SIX_MONTHS_MS;
  const pairs: Pair[] = [];

  // Sort by time ascending
  const sorted = [...messages].sort(
    (a, b) => new Date(a.insertedOn).getTime() - new Date(b.insertedOn).getTime()
  );

  for (let i = 0; i < sorted.length - 1; i++) {
    const msg = sorted[i];
    const next = sorted[i + 1];

    // Only keep pairs where guest message is followed by host response
    if (msg.isIncoming === 1 && next.isIncoming === 0) {
      const msgDate = new Date(msg.insertedOn).getTime();
      if (msgDate < cutoff) continue; // Skip messages older than 6 months

      if (msg.body?.trim() && next.body?.trim()) {
        pairs.push({
          guestMessage: msg.body.trim(),
          hostResponse: next.body.trim(),
          propertyId,
          hostawayConversationId: String(conversationId),
          sourceDate: msg.insertedOn,
        });
      }
    }
  }

  return pairs;
}

// Note: orgId is NOT sent in the body — server extracts it from AUTH_TOKEN
async function importBatch(pairs: Pair[]): Promise<{ imported: number; skipped: number }> {
  const response = await fetch(`${SERVER_URL}/api/voice/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      pairs: pairs.map((p) => ({
        guestMessage: p.guestMessage,
        hostResponse: p.hostResponse,
        propertyId: p.propertyId,
        originType: 'historical',
        hostawayConversationId: p.hostawayConversationId,
        sourceDate: p.sourceDate,
      })),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Import failed: ${response.status} — ${text}`);
  }

  return response.json();
}

async function main() {
  console.log('[BULK_IMPORT] Starting...');

  const token = await getAccessToken();
  console.log('[BULK_IMPORT] Got Hostaway token');

  const conversations = await fetchAllConversations(token);
  console.log(`[BULK_IMPORT] Found ${conversations.length} total conversations`);

  const allPairs: Pair[] = [];

  for (let idx = 0; idx < conversations.length; idx++) {
    const conv = conversations[idx];
    const messages = await fetchAllMessages(token, conv.id);
    const pairs = chunkIntoPairs(messages, conv.id, conv.listingMapId ? String(conv.listingMapId) : undefined);
    allPairs.push(...pairs);

    if ((idx + 1) % 25 === 0) {
      console.log(`[BULK_IMPORT] Processed ${idx + 1}/${conversations.length} conversations, ${allPairs.length} pairs so far`);
    }

    // Rate limit — 100ms between conversation message fetches
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`[BULK_IMPORT] Chunked ${allPairs.length} guest/host pairs from ${conversations.length} conversations`);

  // Import in batches of 200 (well within 1MB body limit at ~500 bytes/pair = ~100KB)
  let totalImported = 0;
  let totalSkipped = 0;

  for (let i = 0; i < allPairs.length; i += 200) {
    const batch = allPairs.slice(i, i + 200);
    try {
      const result = await importBatch(batch);
      totalImported += result.imported;
      totalSkipped += result.skipped;
      console.log(`[BULK_IMPORT] Batch ${Math.floor(i / 200) + 1}: ${result.imported} imported, ${result.skipped} skipped`);
    } catch (err) {
      console.error(`[BULK_IMPORT] Batch ${Math.floor(i / 200) + 1} failed:`, err);
      totalSkipped += batch.length;
    }
  }

  console.log(`[BULK_IMPORT] Done. ${totalImported} imported, ${totalSkipped} skipped out of ${allPairs.length} total pairs.`);
}

main().catch(console.error);
```

- [ ] **Step 2: Commit**

```bash
git add server/scripts/bulk-import-voice.ts
git commit -m "feat: add bulk Hostaway voice import script with pagination"
```

---

### Task 10: Apply Migration to Live and Run Import

**Warning: This task touches the live Supabase project. Follow the supabase-environment-workflow runbook.**

- [ ] **Step 1: Apply migration to Rental Voice Live**

Run: `cd /Users/sawbeck/Projects/RentalVoice && npx supabase db push --db-url "$LIVE_DB_URL"`

Verify: `SELECT count(*) FROM voice_examples;` should return 0.

- [ ] **Step 2: Run the bulk import script**

Create a `.env.import` file with Hostaway + Live credentials (do NOT commit):
```
HOSTAWAY_ACCOUNT_ID=<from .secrets.env>
HOSTAWAY_API_KEY=<from .secrets.env>
SERVER_URL=<live server URL>
AUTH_TOKEN=<founder auth token>
```

Run: `cd /Users/sawbeck/Projects/RentalVoice && env $(cat .env.import | xargs) npx tsx server/scripts/bulk-import-voice.ts`

Expected: Script logs progress and completes with 1,000-5,000 pairs imported.

- [ ] **Step 3: Verify import**

```sql
SELECT count(*) FROM voice_examples;
SELECT intent, count(*) FROM voice_examples GROUP BY intent ORDER BY count DESC LIMIT 10;
SELECT origin_type, count(*) FROM voice_examples GROUP BY origin_type;
```

---

### Task 11: Run Evaluation

- [ ] **Step 1: Run promptfoo eval suite**

Run: `cd /Users/sawbeck/Projects/RentalVoice && npx promptfoo eval -c evals/promptfooconfig.yaml`

Expected: Pass rate should be higher than the 60.4% baseline.

- [ ] **Step 2: Manual semantic test**

In the app (or via API), send the message: **"Can we swing by a little early?"**

Verify: The system retrieves early check-in examples from the semantic index and generates an appropriate draft about early check-in.

- [ ] **Step 3: Side-by-side comparison**

For 10 representative guest queries, compare:
- Old: keyword-matched top-3 from `FewShotIndexer`
- New: semantic top-3 from `/api/voice/query`

Document which retrieval is better for each query.

- [ ] **Step 4: Log results and commit**

```bash
git add evals/results/
git commit -m "chore: add post-import eval results for Instant Voice Match"
```

---

## Summary

| Chunk | Tasks | Key Deliverable |
|-------|-------|----------------|
| 1: Database + Server | Tasks 0-4 | vitest infra, `voice_examples` table, embedding service, voice routes |
| 2: Client Integration | Tasks 5-8 | Semantic query in draft generation, learn on approve |
| 3: Bulk Import + Eval | Tasks 9-11 | Import script with pagination, run against live, measure results |

**Total commits:** ~11
**Estimated time:** 3-4 hours of agent execution
**Risk level:** Low — fallback to FewShotIndexer preserves current behavior at every step
