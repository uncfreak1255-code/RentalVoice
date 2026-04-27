/**
 * Learning Sync Routes
 *
 * Purpose: Sync learning profiles and few-shot examples between mobile app and Supabase.
 * Tables: learning_profiles, few_shot_examples
 * Auth: All routes require authenticated user with orgId.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseAdmin } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppEnv } from '../lib/env.js';

export const learningSyncRouter = new Hono<AppEnv>();

learningSyncRouter.use('*', requireAuth);

// ─── Schema ────────────────────────────────────────────

const syncProfileSchema = z.object({
  styleProfiles: z.record(z.string(), z.any()).default({}),
  trainingProgress: z.record(z.string(), z.any()).default({}),
  incrementalState: z.record(z.string(), z.any()).default({}),
  temporalWeights: z.record(z.string(), z.any()).default({}),
  trainingQuality: z.record(z.string(), z.any()).default({}),
  conversationFlows: z.record(z.string(), z.any()).default({}),
  guestMemory: z.record(z.string(), z.any()).default({}),
  negativeExamples: z.record(z.string(), z.any()).default({}),
  draftOutcomes: z.record(z.string(), z.any()).default({}),
  totalExamplesSynced: z.number().int().min(0).default(0),
  syncVersion: z.number().int().min(1).default(1),
});

const fewShotExampleSchema = z.object({
  guestMessage: z.string().min(1),
  hostResponse: z.string().min(1),
  guestIntent: z.string().optional(),
  propertyId: z.string().optional(),
  originType: z.enum(['host_written', 'ai_approved', 'ai_edited']).default('host_written'),
});

const syncExamplesSchema = z.object({
  examples: z.array(fewShotExampleSchema).max(500),
  replaceAll: z.boolean().default(false),
});

// ─── PUT /profile — Upsert learning profile ────────────

learningSyncRouter.put('/profile', async (c) => {
  try {
    const orgId = c.get('orgId');
    const body = await c.req.json();
    const parsed = syncProfileSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ message: 'Invalid sync payload', code: 'VALIDATION_ERROR', status: 400, details: parsed.error.flatten() }, 400);
    }

    const p = parsed.data;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('learning_profiles')
      .upsert({
        org_id: orgId,
        style_profiles_json: p.styleProfiles,
        training_progress_json: p.trainingProgress,
        incremental_state_json: p.incrementalState,
        temporal_weights_json: p.temporalWeights,
        training_quality_json: p.trainingQuality,
        conversation_flows_json: p.conversationFlows,
        guest_memory_json: p.guestMemory,
        negative_examples_json: p.negativeExamples,
        draft_outcomes_json: p.draftOutcomes,
        total_examples_synced: p.totalExamplesSynced,
        sync_version: p.syncVersion,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'org_id' });

    if (error) {
      console.error('[LearningSync] Profile upsert failed:', error);
      return c.json({ message: 'Sync failed', code: 'DB_ERROR', status: 500 }, 500);
    }

    console.log(`[LearningSync] Profile synced for org ${orgId}`);
    return c.json({ success: true, syncedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[LearningSync] Profile sync error:', err);
    return c.json({ message: 'Internal server error', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ─── GET /profile — Fetch learning profile ─────────────

learningSyncRouter.get('/profile', async (c) => {
  try {
    const orgId = c.get('orgId');
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('learning_profiles')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[LearningSync] Profile fetch failed:', error);
      return c.json({ message: 'Fetch failed', code: 'DB_ERROR', status: 500 }, 500);
    }

    if (!data) {
      return c.json({ profile: null, exists: false });
    }

    return c.json({
      profile: {
        styleProfiles: data.style_profiles_json,
        trainingProgress: data.training_progress_json,
        incrementalState: data.incremental_state_json,
        temporalWeights: data.temporal_weights_json,
        trainingQuality: data.training_quality_json,
        conversationFlows: data.conversation_flows_json,
        guestMemory: data.guest_memory_json,
        negativeExamples: data.negative_examples_json,
        draftOutcomes: data.draft_outcomes_json,
        totalExamplesSynced: data.total_examples_synced,
        syncVersion: data.sync_version,
        lastSyncedAt: data.last_synced_at,
      },
      exists: true,
    });
  } catch (err) {
    console.error('[LearningSync] Profile fetch error:', err);
    return c.json({ message: 'Internal server error', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ─── POST /examples — Batch sync few-shot examples ─────

learningSyncRouter.post('/examples', async (c) => {
  try {
    const orgId = c.get('orgId');
    const body = await c.req.json();
    const parsed = syncExamplesSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ message: 'Invalid examples payload', code: 'VALIDATION_ERROR', status: 400, details: parsed.error.flatten() }, 400);
    }

    const { examples, replaceAll } = parsed.data;
    const supabase = getSupabaseAdmin();

    // If replaceAll, delete existing examples for this org first
    if (replaceAll) {
      const { error: deleteError } = await supabase
        .from('few_shot_examples')
        .delete()
        .eq('org_id', orgId);

      if (deleteError) {
        console.error('[LearningSync] Examples delete failed:', deleteError);
        return c.json({ message: 'Failed to clear existing examples', code: 'DB_ERROR', status: 500 }, 500);
      }
    }

    // Batch insert in chunks of 200
    let inserted = 0;
    const BATCH_SIZE = 200;

    for (let i = 0; i < examples.length; i += BATCH_SIZE) {
      const batch = examples.slice(i, i + BATCH_SIZE).map((ex) => ({
        org_id: orgId,
        guest_message: ex.guestMessage,
        host_response: ex.hostResponse,
        guest_intent: ex.guestIntent || null,
        property_id: ex.propertyId || null,
        origin_type: ex.originType,
      }));

      const { error } = await supabase.from('few_shot_examples').insert(batch);

      if (error) {
        console.error(`[LearningSync] Examples batch insert failed at offset ${i}:`, error);
        return c.json({
          message: `Batch insert failed at offset ${i}`,
          code: 'DB_ERROR',
          status: 500,
          inserted,
        }, 500);
      }

      inserted += batch.length;
    }

    console.log(`[LearningSync] Synced ${inserted} examples for org ${orgId}`);
    return c.json({ success: true, inserted, syncedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[LearningSync] Examples sync error:', err);
    return c.json({ message: 'Internal server error', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ─── GET /examples — Fetch few-shot examples ───────────

learningSyncRouter.get('/examples', async (c) => {
  try {
    const orgId = c.get('orgId');
    const limit = Math.min(Number(c.req.query('limit') || '500'), 2000);
    const offset = Number(c.req.query('offset') || '0');
    const originType = c.req.query('originType'); // optional filter
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('few_shot_examples')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const VALID_ORIGIN_TYPES = ['host_written', 'ai_approved', 'ai_edited'];
    if (originType && VALID_ORIGIN_TYPES.includes(originType)) {
      query = query.eq('origin_type', originType);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[LearningSync] Examples fetch failed:', error);
      return c.json({ message: 'Fetch failed', code: 'DB_ERROR', status: 500 }, 500);
    }

    const examples = (data || []).map((row) => ({
      id: row.id,
      guestMessage: row.guest_message,
      hostResponse: row.host_response,
      guestIntent: row.guest_intent,
      propertyId: row.property_id,
      originType: row.origin_type,
      createdAt: row.created_at,
    }));

    return c.json({ examples, total: count || 0, offset, limit });
  } catch (err) {
    console.error('[LearningSync] Examples fetch error:', err);
    return c.json({ message: 'Internal server error', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});
