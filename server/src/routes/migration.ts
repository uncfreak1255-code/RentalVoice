/**
 * Migration Routes
 *
 * Purpose: Controlled migration of local learning/profile data into commercial backend.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseAdmin } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppEnv } from '../lib/env.js';

export const migrationRouter = new Hono<AppEnv>();

migrationRouter.use('*', requireAuth);

const importLocalLearningSchema = z.object({
  snapshotId: z.string().min(1).max(120).optional(),
  stableAccountId: z.string().min(1).max(120).optional(),
  source: z.string().min(1).max(80).optional(),
  hostStyleProfiles: z.record(z.string(), z.any()).optional(),
  aiLearningProgress: z.record(z.string(), z.any()).optional(),
  learningEntries: z.array(z.any()).optional(),
  draftOutcomes: z.array(z.any()).optional(),
  replyDeltas: z.array(z.any()).optional(),
  calibrationEntries: z.array(z.any()).optional(),
  conversationFlows: z.array(z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
}).passthrough();

function toIsoDate(value: unknown): string {
  if (typeof value === 'string' || value instanceof Date) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

function buildScopedSnapshotId(orgId: string, snapshotId: string): string {
  const safeOrgId = String(orgId).replace(/[^a-zA-Z0-9_-]/g, '');
  const safeSnapshotId = String(snapshotId).replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, 120);
  return `${safeOrgId}:${safeSnapshotId}`;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

function mergeStringArrays(existing: unknown, incoming: unknown, limit: number): string[] {
  const merged = [...toStringArray(existing), ...toStringArray(incoming)];
  return [...new Set(merged)].slice(0, limit);
}

function mergeLearningMetrics(
  existing: Record<string, unknown> | null,
  incoming: Record<string, unknown> | null,
): Record<string, unknown> {
  const prior = existing || {};
  const next = incoming || {};

  const sumMetric = (key: string): number =>
    Number(prior[key] || 0) + Number(next[key] || 0);

  return {
    ...prior,
    ...next,
    approvals: sumMetric('approvals'),
    edits: sumMetric('edits'),
    rejections: sumMetric('rejections'),
    independentReplies: sumMetric('independentReplies'),
    totalConfidence: sumMetric('totalConfidence'),
    confidenceSamples: sumMetric('confidenceSamples'),
    lastOutcomeType: next.lastOutcomeType || prior.lastOutcomeType || null,
    lastUpdatedAt: new Date().toISOString(),
  };
}

function weightedStyleNumber(
  existingValue: unknown,
  incomingValue: unknown,
  existingSamples: number,
  incomingSamples: number,
): number | undefined {
  if (typeof existingValue !== 'number' && typeof incomingValue !== 'number') {
    return undefined;
  }

  if (typeof existingValue !== 'number') return Number(incomingValue);
  if (typeof incomingValue !== 'number') return Number(existingValue);

  const totalSamples = Math.max(existingSamples, 0) + Math.max(incomingSamples, 0);
  if (totalSamples <= 0) {
    return Math.round((existingValue + incomingValue) / 2);
  }

  return Math.round(
    ((existingValue * Math.max(existingSamples, 0)) + (incomingValue * Math.max(incomingSamples, 0))) / totalSamples
  );
}

function mergeStyleProfile(
  existingProfile: Record<string, unknown> | null,
  incomingProfile: Record<string, unknown>,
  existingSamples: number,
  incomingSamples: number,
): { profile: Record<string, unknown>; samplesAnalyzed: number } {
  const merged = {
    ...incomingProfile,
    ...(existingProfile || {}),
  } as Record<string, unknown>;

  const formalityLevel = weightedStyleNumber(
    existingProfile?.formalityLevel,
    incomingProfile.formalityLevel,
    existingSamples,
    incomingSamples,
  );
  const warmthLevel = weightedStyleNumber(
    existingProfile?.warmthLevel,
    incomingProfile.warmthLevel,
    existingSamples,
    incomingSamples,
  );
  const averageResponseLength = weightedStyleNumber(
    existingProfile?.averageResponseLength,
    incomingProfile.averageResponseLength,
    existingSamples,
    incomingSamples,
  );
  const emojiFrequency = weightedStyleNumber(
    existingProfile?.emojiFrequency,
    incomingProfile.emojiFrequency,
    existingSamples,
    incomingSamples,
  );

  if (formalityLevel !== undefined) merged.formalityLevel = formalityLevel;
  if (warmthLevel !== undefined) merged.warmthLevel = warmthLevel;
  if (averageResponseLength !== undefined) merged.averageResponseLength = averageResponseLength;
  if (emojiFrequency !== undefined) merged.emojiFrequency = emojiFrequency;

  merged.usesEmojis = Boolean(existingProfile?.usesEmojis || incomingProfile.usesEmojis);
  merged.commonGreetings = mergeStringArrays(existingProfile?.commonGreetings, incomingProfile.commonGreetings, 5);
  merged.commonSignoffs = mergeStringArrays(existingProfile?.commonSignoffs, incomingProfile.commonSignoffs, 5);
  merged.commonPhrases = mergeStringArrays(existingProfile?.commonPhrases, incomingProfile.commonPhrases, 12);
  merged.learningMetrics = mergeLearningMetrics(
    (existingProfile?.learningMetrics as Record<string, unknown> | null) || null,
    (incomingProfile.learningMetrics as Record<string, unknown> | null) || null,
  );
  merged.lastUpdated = new Date().toISOString();

  return {
    profile: merged,
    samplesAnalyzed: Math.max(existingSamples, 0) + Math.max(incomingSamples, 0),
  };
}

migrationRouter.post('/local-learning/import', async (c) => {
  try {
    const orgId = c.get('orgId');
    const userId = c.get('userId');
    const body = await c.req.json();
    const parsed = importLocalLearningSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { message: 'Invalid migration payload', code: 'VALIDATION_ERROR', status: 400, details: parsed.error.flatten() },
        400
      );
    }

    const payload = parsed.data;
    const source = payload.source || 'mobile_local_store_v1';
    const rawSnapshotId = payload.snapshotId || `snapshot_${Date.now()}`;
    const snapshotId = buildScopedSnapshotId(orgId, `${userId}:${rawSnapshotId}`);
    const hostStyleProfiles = payload.hostStyleProfiles || {};
    const learningEntriesRaw = payload.learningEntries || [];
    const draftOutcomes = payload.draftOutcomes || [];
    const replyDeltas = payload.replyDeltas || [];
    const calibrationEntries = payload.calibrationEntries || [];
    const conversationFlows = payload.conversationFlows || [];
    const supabase = getSupabaseAdmin();

    const { data: existingProfiles } = await supabase
      .from('host_style_profiles')
      .select('id, property_id, profile_json, samples_analyzed')
      .eq('org_id', orgId);

    const existingProfileMap = new Map<string, { id: string; profile: Record<string, unknown> | null; samplesAnalyzed: number }>();
    for (const profile of existingProfiles || []) {
      const key = profile.property_id || '__global__';
      existingProfileMap.set(key, {
        id: profile.id,
        profile: (profile.profile_json as Record<string, unknown> | null) || null,
        samplesAnalyzed: profile.samples_analyzed || 0,
      });
    }

    let hostProfilesUpserted = 0;
    const profileEntries = Object.entries(hostStyleProfiles);
    for (const [profileKey, profileValue] of profileEntries) {
      if (!profileValue || typeof profileValue !== 'object') continue;

      const profile = profileValue as Record<string, unknown>;
      const propertyRaw = (profile.propertyId as string | undefined) || profileKey;
      const propertyId = !propertyRaw || propertyRaw === 'global' ? null : String(propertyRaw);
      const samplesAnalyzed = typeof profile.samplesAnalyzed === 'number' ? profile.samplesAnalyzed : 0;
      const lookupKey = propertyId || '__global__';
      const existingRecord = existingProfileMap.get(lookupKey);

      if (existingRecord) {
        const merged = mergeStyleProfile(
          existingRecord.profile,
          profile,
          existingRecord.samplesAnalyzed,
          samplesAnalyzed,
        );
        await supabase
          .from('host_style_profiles')
          .update({
            profile_json: merged.profile,
            samples_analyzed: merged.samplesAnalyzed,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRecord.id);
      } else {
        await supabase
          .from('host_style_profiles')
          .insert({
            org_id: orgId,
            property_id: propertyId,
            profile_json: profile,
            samples_analyzed: samplesAnalyzed,
            updated_at: new Date().toISOString(),
          });
      }

      hostProfilesUpserted += 1;
    }

    const editPatternRows = learningEntriesRaw
      .filter((entry) =>
        entry &&
        typeof entry === 'object' &&
        typeof entry.originalResponse === 'string' &&
        entry.originalResponse.trim().length > 0 &&
        typeof entry.editedResponse === 'string' &&
        entry.editedResponse.trim().length > 0
      )
      .slice(-2000)
      .map((entry) => ({
        org_id: orgId,
        original: String(entry.originalResponse).slice(0, 10000),
        edited: String(entry.editedResponse).slice(0, 10000),
        category: typeof entry.guestIntent === 'string' ? entry.guestIntent.slice(0, 50) : null,
        property_id: typeof entry.propertyId === 'string' ? entry.propertyId : null,
        created_at: toIsoDate(entry.timestamp),
      }));

    let editPatternsInserted = 0;
    if (editPatternRows.length > 0) {
      const batchSize = 400;
      for (let i = 0; i < editPatternRows.length; i += batchSize) {
        const batch = editPatternRows.slice(i, i + batchSize);
        await supabase.from('edit_patterns').insert(batch);
        editPatternsInserted += batch.length;
      }
    }

    const stats = {
      importedAt: new Date().toISOString(),
      hostStyleProfilesReceived: profileEntries.length,
      hostStyleProfilesUpserted: hostProfilesUpserted,
      learningEntriesReceived: learningEntriesRaw.length,
      editPatternsInserted,
      draftOutcomesReceived: draftOutcomes.length,
      replyDeltasReceived: replyDeltas.length,
      calibrationEntriesReceived: calibrationEntries.length,
      conversationFlowsReceived: conversationFlows.length,
    };

    const payloadPreview = {
      stableAccountId: payload.stableAccountId || null,
      aiLearningProgress: payload.aiLearningProgress || null,
      metadata: payload.metadata || {},
      hostStyleProfileKeys: profileEntries.map(([key]) => key),
      learningEntriesSample: learningEntriesRaw.slice(-5),
      draftOutcomesSample: draftOutcomes.slice(-5),
      replyDeltasSample: replyDeltas.slice(-5),
      calibrationEntriesSample: calibrationEntries.slice(-5),
      conversationFlowsSample: conversationFlows.slice(-5),
    };

    await supabase
      .from('learning_migration_snapshots')
      .upsert(
        {
          id: snapshotId,
          org_id: orgId,
          imported_by: userId,
          stable_account_id: payload.stableAccountId || null,
          source,
          stats_json: stats,
          payload_json: payloadPreview,
        },
        { onConflict: 'id' }
      );

    return c.json({
      snapshotId,
      source,
      stats,
      imported: {
        hostStyleProfiles: hostProfilesUpserted,
        editPatterns: editPatternsInserted,
      },
    });
  } catch (err) {
    console.error('[Migration] Import local learning error:', err);
    return c.json({ message: 'Failed to import local learning snapshot', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

migrationRouter.get('/local-learning/status', async (c) => {
  try {
    const orgId = c.get('orgId');
    const supabase = getSupabaseAdmin();
    const userId = c.get('userId');

    const { data: latestSnapshot } = await supabase
      .from('learning_migration_snapshots')
      .select('id, source, stable_account_id, stats_json, imported_at, imported_by')
      .eq('org_id', orgId)
      .eq('imported_by', userId)
      .order('imported_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const [hostProfilesCountResult, editPatternsCountResult] = await Promise.all([
      supabase.from('host_style_profiles').select('*', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('edit_patterns').select('*', { count: 'exact', head: true }).eq('org_id', orgId),
    ]);

    return c.json({
      hasSnapshot: !!latestSnapshot,
      latestSnapshot: latestSnapshot
        ? {
          id: latestSnapshot.id,
          source: latestSnapshot.source,
          stableAccountId: latestSnapshot.stable_account_id,
          importedByUserId: latestSnapshot.imported_by,
          importedAt: latestSnapshot.imported_at,
          stats: latestSnapshot.stats_json,
        }
        : null,
      serverTotals: {
        hostStyleProfiles: hostProfilesCountResult.count || 0,
        editPatterns: editPatternsCountResult.count || 0,
      },
    });
  } catch (err) {
    console.error('[Migration] Status check error:', err);
    return c.json({ message: 'Failed to fetch migration status', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});
