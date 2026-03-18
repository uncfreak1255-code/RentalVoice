# Instant Voice Match — Design Spec

**Date:** 2026-03-15
**Status:** Approved
**Author:** Claude (Sawyer Beck, founder review)

## Problem

RentalVoice voice accuracy is ~45%. The `FewShotIndexer` matches guest messages to historical examples using keyword overlap and intent classification. This fails when guests phrase questions differently than the stored examples — "Can we swing by a little early?" shares zero keywords with stored "early check-in" responses.

The system has ~50-100 drip-learned examples. Sawyer's Hostaway account has hundreds of real conversations — months of actual voice handling real guest scenarios — that are not being used.

## Solution

Bulk-import 6 months of Hostaway conversation history, generate semantic embeddings via Gemini, store in Supabase pgvector, and replace keyword matching with cosine similarity retrieval. The existing `FewShotIndexer` stays as an offline fallback.

## Success Criteria

| Metric | Current | Target |
|--------|---------|--------|
| promptfoo pass rate | 60.4% | 80%+ |
| Early check-in accuracy | Fails | Correct draft |
| Voice examples available | ~50-100 | 2,000-5,000 |
| Added draft latency | 0ms | <150ms |

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────┐
│                  ONE-TIME BULK IMPORT                │
│                                                     │
│  Hostaway API ──→ Chunk into pairs ──→ Gemini       │
│  (6 months)       (guest Q / host A)    embed API   │
│                                           │         │
│                                           ▼         │
│                                    Supabase pgvector │
│                                    (voice_examples)  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                 DRAFT GENERATION (LIVE)              │
│                                                     │
│  Guest message ──→ Gemini embed ──→ pgvector query  │
│                                       (top 5)       │
│                                         │           │
│                                         ▼           │
│  buildAdvancedAIPrompt() injects semantic matches   │
│  instead of keyword-matched few-shot examples       │
│                                         │           │
│                                         ▼           │
│  Gemini generates draft with real voice examples    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                 CONTINUOUS LEARNING                  │
│                                                     │
│  User approves/edits draft                          │
│       │                                             │
│       ▼                                             │
│  Embed new pair ──→ Upsert to pgvector              │
│       │                                             │
│       ▼                                             │
│  Update local cache (top 500)                       │
│       │                                             │
│       ▼                                             │
│  Existing FewShotIndexer (unchanged, fallback only) │
└─────────────────────────────────────────────────────┘
```

### Data Model

**Supabase table: `voice_examples`**

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE voice_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  property_id TEXT,
  guest_message TEXT NOT NULL,
  host_response TEXT NOT NULL,
  intent TEXT,
  origin_type TEXT DEFAULT 'historical',
  hostaway_conversation_id TEXT,
  embedding VECTOR(768) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  source_date TIMESTAMPTZ  -- historical imports: message timestamp from Hostaway; continuous learning: now()
);

-- HNSW index: no reindexing needed after bulk import, better recall at this scale (2k-5k rows)
CREATE INDEX voice_examples_embedding_idx
  ON voice_examples USING hnsw (embedding vector_cosine_ops);

CREATE INDEX voice_examples_property_idx ON voice_examples (org_id, property_id);

-- RLS: matches existing org_members subquery pattern used across all other tables
ALTER TABLE voice_examples ENABLE ROW LEVEL SECURITY;
CREATE POLICY voice_examples_org ON voice_examples
  FOR ALL USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
```

**Embedding model:** `gemini-embedding-001` with `output_dimensionality: 768`.

768 dimensions chosen over 3072 for 4x storage reduction and faster queries. Negligible accuracy difference for short conversational text (1-3 sentences).

### Retrieval Pipeline

**New module: `src/lib/semantic-voice-index.ts`**

Three operations: import, query, learn.

#### Import (one-time bulk)

```
fetchAllConversations() → all conversations (Hostaway has no date filter)
    ↓
For each conversation: fetchMessages(conversationId)
    ↓
Client-side date filter: keep only messages from last 6 months
    ↓
Parse into guest/host message pairs
    ↓
Deduplicate (skip if hostaway_conversation_id + message hash exists)
    ↓
Embed guest_message only via Gemini (up to 100 texts per batch)
    ↓
Upsert to Supabase voice_examples table
```

**Date filtering:** Hostaway API does not support date-range parameters on conversations. All conversations are fetched, then messages are filtered client-side to the last 6 months by message timestamp.

**Embedding input format:** Only the `guest_message` is embedded (not the host response). At query time we only have the incoming guest message — embedding the pair would create a mismatch between index and query vectors.

#### Query (every draft generation)

```
Incoming guest message
    ↓
Embed via Gemini embedding API (~50ms)
    ↓
pgvector similarity search:
  SELECT guest_message, host_response, intent, origin_type,
         1 - (embedding <=> $query_embedding) AS similarity
  FROM voice_examples
  WHERE org_id = $org_id
    AND (property_id = $property_id OR property_id IS NULL)
  ORDER BY embedding <=> $query_embedding
  LIMIT 5
    ↓
Score: (similarity * 100) + origin_bonus + property_bonus
  origin_bonus: +30 host_written, +15 ai_edited, 0 others
  property_bonus: +20 exact property match
    ↓
Sort by final score, return top 3 as few-shot examples
```

#### Learn (continuous, after user action)

```
User approves or edits draft
    ↓
Embed the guest_message via Gemini
    ↓
Upsert to Supabase voice_examples
    ↓
Update local cache (AsyncStorage, top 500 by recency)
    ↓
Existing FewShotIndexer.addExample() still fires (offline fallback)
```

#### Query Architecture

Semantic queries run **server-side** via `/api/voice/query`. The client sends the guest message to the server, which handles embedding (Gemini API key stays server-side) and pgvector query, then returns the matched examples. This keeps the Gemini API key out of the mobile app and matches the existing pattern where `ai-proxy.ts` handles all LLM calls server-side.

#### Deduplication Strategy

Double-writing to both `FewShotIndexer` (AsyncStorage) and `voice_examples` (pgvector) is intentional — they serve different availability paths (offline vs online). Each system handles dedup independently:
- `voice_examples`: dedup by `hostaway_conversation_id` + message content hash
- `FewShotIndexer`: existing dedup by example ID

After semantic search becomes primary, the `FewShotIndexer` continues growing as the offline fallback but is no longer the primary retrieval path.

#### Local Cache Lifecycle

- **Initial hydration:** On first app launch after bulk import, fetch the 500 most recent `voice_examples` and cache in AsyncStorage
- **Eviction:** LRU by `source_date` — when cache exceeds 500 entries, drop the oldest
- **Refresh:** On app foreground after 1+ hour since last refresh, fetch any new examples added since last cache update
- **Cache miss:** Falls through to server-side `/api/voice/query` (always available when online)

#### Fallback Logic

```typescript
if (networkAvailable && supabaseAuthenticated) {
  examples = await semanticVoiceIndex.query(guestMessage, propertyId);
} else {
  examples = fewShotIndexer.findRelevantExamples(guestMessage, propertyId);
}
```

### Integration Points

**Files modified:**

| File | Change | Risk |
|------|--------|------|
| `src/lib/advanced-training.ts` | `buildAdvancedAIPrompt()` calls `semanticVoiceIndex.query()` when online | Low — fallback preserves current behavior |
| `src/lib/ai-enhanced.ts` | `learnFromSentMessage()` also calls `semanticVoiceIndex.learn()` | Low — additive |
| `server/src/routes/migration.ts` | New `/api/voice/import` endpoint for bulk import | None — new route |
| `server/src/routes/migration.ts` | New `/api/voice/query` endpoint (server-side embed + pgvector query) | None — new route |
| Supabase migration | Add `voice_examples` table + pgvector extension | None — new table |

**Files NOT modified:**

- `FewShotIndexer` — stays intact as offline fallback
- `MultiPassTrainer` — still runs, still stores phrases
- `TemporalWeightManager` — still weights examples
- `NegativeExampleManager` — still catches banned phrases
- `PropertyLexiconManager` — still injects property knowledge
- Confidence calculation — unchanged
- `ai-proxy.ts` — unchanged
- `ChatScreen.tsx` — unchanged

### Latency Budget

| Step | Time |
|------|------|
| Gemini embed call | ~50-100ms |
| pgvector query | ~20-50ms |
| Total added | ~100-150ms |
| Current generation time | 2,000-4,000ms |

Added latency is imperceptible relative to generation time.

### Cost

- **Gemini embedding API:** included in existing Google AI Studio plan. Embedding is orders of magnitude cheaper than generation. Bulk import of 5,000 pairs costs pennies.
- **Supabase pgvector:** included in existing Supabase plan (Postgres extension, no extra charge).
- **Ongoing:** one embedding per guest message per draft. Negligible.
- **No new paid infrastructure required.**

### Chunking Strategy

Each database row = one guest-message / host-response pair. Multi-exchange conversations produce multiple rows. This is the natural retrieval unit — when a guest asks a similar question, we want the specific exchange, not the whole thread.

Messages are stored at full length (no truncation). The previous truncation bug (400/600 char limits) was already fixed.

### Scope

**In scope:**
- Personal/founder mode only
- Supabase `Rental Voice Live` project (`zsitbuwzxtsgfqzhtged`)
- 6 months of Hostaway conversation history
- `gemini-embedding-001` with 768 dimensions
- Local AsyncStorage cache (top 500 examples)
- Offline fallback to existing FewShotIndexer

**Out of scope:**
- App Store billing/payment flows
- Commercial multi-tenant support
- Reranking models (Cohere etc.)
- Fine-tuned embeddings
- UI changes (improvement is invisible — better drafts, same UX)
- Auto-pilot threshold changes (still gated on 80% confidence)

### Evaluation Plan

After bulk import, re-run the promptfoo eval suite (24 test cases, 48 assertions). If pass rate doesn't cross 75%, investigate chunking or embedding quality before proceeding.

Manual test: input "Can we swing by a little early?" and verify the system retrieves early check-in examples and generates an appropriate draft.

Side-by-side comparison: for 10 representative guest queries, compare old keyword-matched top-3 vs new semantic top-3 to validate retrieval quality.

### Risks

| Risk | Mitigation |
|------|-----------|
| Gemini embedding API rate limits during bulk import | Batch with 100ms delays between calls |
| pgvector query latency on large datasets | HNSW index; 768 dims keeps vectors small |
| Historical conversations include inconsistent/early voice | 6-month window (not all-time); origin_type tagging; quality bonuses favor recent host-written examples |
| Network unavailable during draft generation | Fallback to FewShotIndexer (existing behavior preserved) |
| Supabase Live project data integrity | RLS policies; founder-only access; no casual dev against Live |
