/**
 * Voice Routes
 *
 * 📁 server/src/routes/voice.ts
 * Purpose: pgvector-based voice example storage and retrieval
 *
 * Endpoints:
 *   POST /query  — embed guest message, similarity search, score + rank
 *   POST /import — batch embed + upsert historical examples (dedup)
 *   POST /learn  — embed single example, insert (continuous learning)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { createHash } from 'crypto';
import { getSupabaseAdmin } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { embedText, embedBatch } from '../services/embedding.js';
import type { AppEnv } from '../lib/env.js';

export const voiceRouter = new Hono<AppEnv>();

voiceRouter.use('*', requireAuth);

// ============================================================
// Types
// ============================================================

type OriginType = 'historical' | 'host_written' | 'ai_approved' | 'ai_edited';

interface RawVoiceExample {
  guest_message: string;
  host_response: string;
  intent: string | null;
  origin_type: OriginType | string;
  property_id: string | null;
  similarity: number;
}

interface ScoredExample extends RawVoiceExample {
  score: number;
}

// ============================================================
// Scoring
// ============================================================

const ORIGIN_BONUS: Record<string, number> = {
  host_written: 30,
  ai_edited: 15,
  ai_approved: 0,
  historical: 0,
};

/**
 * Score and rank raw similarity-search results.
 * Formula: (similarity * 100) + origin_bonus + property_bonus
 * Exported for unit testing.
 */
export function scoreAndRankExamples(
  examples: RawVoiceExample[],
  queryPropertyId: string | null
): ScoredExample[] {
  return examples
    .map((ex) => {
      const originBonus = ORIGIN_BONUS[ex.origin_type] ?? 0;
      const propertyBonus =
        queryPropertyId !== null && ex.property_id === queryPropertyId ? 20 : 0;
      const score = ex.similarity * 100 + originBonus + propertyBonus;
      return { ...ex, score };
    })
    .sort((a, b) => b.score - a.score);
}

// ============================================================
// Hash helper
// ============================================================

function messageHash(guestMessage: string, hostResponse: string): string {
  return createHash('sha256')
    .update(`${guestMessage}|||${hostResponse}`)
    .digest('hex')
    .slice(0, 16);
}

// ============================================================
// Schemas
// ============================================================

const querySchema = z.object({
  guestMessage: z.string().min(1).max(4000),
  propertyId: z.string().optional().nullable(),
  matchCount: z.number().int().min(1).max(20).optional().default(8),
});

const importExampleSchema = z.object({
  guestMessage: z.string().min(1).max(4000),
  hostResponse: z.string().min(1).max(8000),
  intent: z.string().max(100).optional().nullable(),
  originType: z.enum(['historical', 'host_written', 'ai_approved', 'ai_edited']).optional().default('historical'),
  propertyId: z.string().max(200).optional().nullable(),
  hostawayConversationId: z.string().max(200).optional().nullable(),
  sourceDate: z.string().optional().nullable(),
});

const importSchema = z.object({
  examples: z.array(importExampleSchema).min(1).max(500),
});

const learnSchema = z.object({
  guestMessage: z.string().min(1).max(4000),
  hostResponse: z.string().min(1).max(8000),
  intent: z.string().max(100).optional().nullable(),
  originType: z.enum(['host_written', 'ai_approved', 'ai_edited']).default('ai_approved'),
  propertyId: z.string().max(200).optional().nullable(),
  hostawayConversationId: z.string().max(200).optional().nullable(),
});

// ============================================================
// POST /query
// ============================================================

voiceRouter.post('/query', async (c) => {
  try {
    const orgId = c.get('orgId');
    const body = await c.req.json();
    const parsed = querySchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { message: 'Invalid request', code: 'VALIDATION_ERROR', status: 400, details: parsed.error.flatten() },
        400
      );
    }

    const { guestMessage, propertyId = null, matchCount } = parsed.data;

    const embedding = await embedText(guestMessage);
    const supabase = getSupabaseAdmin();

    const { data: rows, error } = await supabase.rpc('match_voice_examples', {
      query_embedding: `[${embedding.join(',')}]`,
      query_org_id: orgId,
      query_property_id: propertyId ?? null,
      match_count: matchCount,
    });

    if (error) {
      console.error('[Voice] match_voice_examples RPC error:', error);
      return c.json({ message: 'Similarity search failed', code: 'DB_ERROR', status: 500 }, 500);
    }

    const ranked = scoreAndRankExamples((rows ?? []) as RawVoiceExample[], propertyId ?? null);

    return c.json({ examples: ranked, count: ranked.length });
  } catch (err) {
    console.error('[Voice] Query error:', err);
    return c.json({ message: 'Query failed', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// POST /import
// ============================================================

voiceRouter.post('/import', async (c) => {
  try {
    const orgId = c.get('orgId');
    const body = await c.req.json();
    const parsed = importSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { message: 'Invalid request', code: 'VALIDATION_ERROR', status: 400, details: parsed.error.flatten() },
        400
      );
    }

    const { examples } = parsed.data;
    const guestMessages = examples.map((ex) => ex.guestMessage);
    const embeddings = await embedBatch(guestMessages);

    const supabase = getSupabaseAdmin();
    const rows = examples.map((ex, i) => ({
      org_id: orgId,
      property_id: ex.propertyId ?? null,
      guest_message: ex.guestMessage,
      host_response: ex.hostResponse,
      intent: ex.intent ?? null,
      origin_type: ex.originType,
      hostaway_conversation_id: ex.hostawayConversationId ?? null,
      message_hash: messageHash(ex.guestMessage, ex.hostResponse),
      embedding: `[${embeddings[i].join(',')}]`,
      source_date: ex.sourceDate ?? null,
    }));

    let inserted = 0;
    let skipped = 0;

    // Insert in batches of 50 with conflict handling
    const BATCH = 50;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error, data } = await supabase
        .from('voice_examples')
        .insert(batch)
        .select('id');

      if (error) {
        // Unique constraint violation → skip duplicates gracefully
        if (error.code === '23505') {
          // Fall back to row-by-row for this batch
          for (const row of batch) {
            const { error: rowErr } = await supabase.from('voice_examples').insert(row);
            if (rowErr?.code === '23505') {
              skipped += 1;
            } else if (!rowErr) {
              inserted += 1;
            }
          }
        } else {
          console.error('[Voice] Import batch insert error:', error);
        }
      } else {
        inserted += data?.length ?? batch.length;
      }
    }

    return c.json({ inserted, skipped, total: examples.length });
  } catch (err) {
    console.error('[Voice] Import error:', err);
    return c.json({ message: 'Import failed', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// POST /learn
// ============================================================

voiceRouter.post('/learn', async (c) => {
  try {
    const orgId = c.get('orgId');
    const body = await c.req.json();
    const parsed = learnSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { message: 'Invalid request', code: 'VALIDATION_ERROR', status: 400, details: parsed.error.flatten() },
        400
      );
    }

    const { guestMessage, hostResponse, intent, originType, propertyId, hostawayConversationId } = parsed.data;

    const embedding = await embedText(guestMessage);
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from('voice_examples').insert({
      org_id: orgId,
      property_id: propertyId ?? null,
      guest_message: guestMessage,
      host_response: hostResponse,
      intent: intent ?? null,
      origin_type: originType,
      hostaway_conversation_id: hostawayConversationId ?? null,
      message_hash: messageHash(guestMessage, hostResponse),
      embedding: `[${embedding.join(',')}]`,
      source_date: new Date().toISOString(),
    });

    if (error) {
      if (error.code === '23505') {
        return c.json({ learned: false, reason: 'duplicate' });
      }
      console.error('[Voice] Learn insert error:', error);
      return c.json({ message: 'Learn failed', code: 'DB_ERROR', status: 500 }, 500);
    }

    return c.json({ learned: true });
  } catch (err) {
    console.error('[Voice] Learn error:', err);
    return c.json({ message: 'Learn failed', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});
