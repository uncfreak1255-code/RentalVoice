/**
 * AI Generate Route
 * 
 * 📁 server/src/routes/ai-generate.ts
 * Purpose: POST /api/ai/generate — Server-side AI draft generation
 *          POST /api/ai/autopilot — Auto-send if confidence meets threshold
 * Depends on: middleware/auth, middleware/rate-limit, services/ai-proxy, zod
 * Used by: Mobile app (commercial mode), web app
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth, getAuthContext } from '../middleware/auth.js';
import { aiRateLimit, learnRateLimit } from '../middleware/rate-limit.js';
import { checkDraftLimit } from '../middleware/draft-limit.js';
import { generateDraft } from '../services/ai-proxy.js';
import { getSupabaseAdmin } from '../db/supabase.js';
import { getAdapter } from '../adapters/pms-adapter.js';
import { decrypt } from '../lib/encryption.js';
import { PLAN_LIMITS } from '../lib/types.js';
import type { PlanTier } from '../lib/types.js';
import { getEffectivePlan } from '../lib/founder-access.js';

const aiRouter = new Hono();

// Zod schema for input validation (Architecture Contract: validate ALL inputs)
const generateSchema = z.object({
  message: z.string().min(1).max(10000),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
  propertyId: z.string().optional(),
  guestName: z.string().max(200).optional(),
  guestLanguage: z.string().max(10).optional(),
  responseLanguageMode: z.string().optional(),
  hostDefaultLanguage: z.string().max(10).optional(),
});

const autopilotSchema = z.object({
  message: z.string().min(1).max(10000),
  conversationId: z.string().min(1),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
  propertyId: z.string().optional(),
  guestName: z.string().max(200).optional(),
  guestLanguage: z.string().max(10).optional(),
  responseLanguageMode: z.string().optional(),
  hostDefaultLanguage: z.string().max(10).optional(),
});

/**
 * POST /api/ai/generate
 * Generate an AI draft response for a guest message.
 */
aiRouter.post('/generate', requireAuth, aiRateLimit, checkDraftLimit, async (c) => {
  try {
    // Validate input
    const body = await c.req.json();
    const parsed = generateSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          message: 'Invalid request body',
          code: 'VALIDATION_ERROR',
          status: 400,
          details: parsed.error.flatten(),
        },
        400
      );
    }

    const auth = getAuthContext(c);

    // Generate draft via AI proxy
    const result = await generateDraft({
      orgId: auth.orgId,
      userId: auth.userId,
      request: parsed.data,
    });

    return c.json(result);
  } catch (err) {
    console.error('[AI Generate] Error:', err);

    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json(
      { message, code: 'AI_ERROR', status: 500 },
      500
    );
  }
});

/**
 * POST /api/ai/autopilot
 * Evaluate a guest message and auto-send the AI reply if confidence meets threshold.
 * If confidence is below threshold, returns the draft for manual CoPilot review.
 */
aiRouter.post('/autopilot', requireAuth, aiRateLimit, checkDraftLimit, async (c) => {
  try {
    const body = await c.req.json();
    const parsed = autopilotSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { message: 'Invalid request body', code: 'VALIDATION_ERROR', status: 400, details: parsed.error.flatten() },
        400
      );
    }

    const auth = getAuthContext(c);
    const supabase = getSupabaseAdmin();

    // 1. Check if user is on a plan that supports autopilot
    const { data: user } = await supabase
      .from('users')
      .select('plan')
      .eq('id', auth.userId)
      .single();

    const basePlan = (user?.plan || 'starter') as PlanTier;
    const plan = getEffectivePlan(basePlan, auth.userId, auth.email);
    const limits = PLAN_LIMITS[plan];

    if (!limits.autopilot) {
      return c.json({
        action: 'upgrade_required',
        draft: null,
        confidence: 0,
        reason: 'Autopilot requires Professional or Business plan',
      });
    }

    // 2. Get autopilot settings
    const { data: settings } = await supabase
      .from('org_settings')
      .select('autopilot_enabled, autopilot_threshold')
      .eq('org_id', auth.orgId)
      .single();

    if (!settings?.autopilot_enabled) {
      return c.json({
        action: 'autopilot_disabled',
        draft: null,
        confidence: 0,
        reason: 'Autopilot is disabled in settings',
      });
    }

    const threshold = settings.autopilot_threshold || 80;

    // 3. Generate the AI draft
    const result = await generateDraft({
      orgId: auth.orgId,
      userId: auth.userId,
      request: parsed.data,
    });

    const confidencePercent = Math.round(result.confidence ?? 50);
    const meetsThreshold = confidencePercent >= threshold;

    // 4. If confidence meets threshold, attempt to auto-send via PMS
    let action: string;
    let reason: string;
    let sentVia: string | null = null;
    let pmsError: string | null = null;

    if (result.usedFallback) {
      action = 'routed_to_copilot';
      reason = 'Fallback model used - manual review required';
    } else if (meetsThreshold) {
      try {
        // Look up PMS connection for this org
        const { data: pmsConn } = await supabase
          .from('pms_connections')
          .select('provider, encrypted_credentials, account_id')
          .eq('org_id', auth.orgId)
          .eq('status', 'connected')
          .single();

        if (pmsConn) {
          const adapter = getAdapter(pmsConn.provider);
          const decryptedCredentials = decrypt(pmsConn.encrypted_credentials);
          let parsedCredentials: Record<string, unknown> = {};
          try {
            parsedCredentials = JSON.parse(decryptedCredentials) as Record<string, unknown>;
          } catch {
            // Backward compatibility for older Hostaway records that stored raw apiKey.
            parsedCredentials = { apiKey: decryptedCredentials };
          }
          const credentials = {
            accountId: pmsConn.account_id,
            ...parsedCredentials,
          };

          await adapter.sendMessage(credentials, parsed.data.conversationId, result.draft);
          action = 'auto_sent';
          reason = `Confidence ${confidencePercent}% ≥ threshold ${threshold}%`;
          sentVia = pmsConn.provider;
        } else {
          action = 'routed_to_copilot';
          reason = `No PMS connection — draft ready for manual send`;
        }
      } catch (sendErr) {
        const errMsg = sendErr instanceof Error ? sendErr.message : 'Unknown PMS error';
        console.error('[Autopilot] PMS send failed:', sendErr);
        action = 'routed_to_copilot';
        reason = `PMS send failed — draft ready for manual send`;
        pmsError = errMsg;
      }
    } else {
      action = 'routed_to_copilot';
      reason = `Confidence ${confidencePercent}% < threshold ${threshold}%`;
    }

    // 5. Log the decision (async, non-blocking, with retry)
    const logData = {
      org_id: auth.orgId,
      conversation_id: parsed.data.conversationId,
      property_id: parsed.data.propertyId || null,
      action,
      confidence: result.confidence,
      draft_preview: result.draft.slice(0, 200),
      reason,
      guest_message_preview: parsed.data.message.slice(0, 200),
    };
    logAutopilotAction(supabase, logData, confidencePercent);

    return c.json({
      action,
      draft: result.draft,
      confidence: result.confidence,
      reason,
      sentVia,
      pmsError,
      provider: result.provider,
      model: result.model,
      usedFallback: result.usedFallback,
      tokensUsed: result.tokensUsed,
    });
  } catch (err) {
    console.error('[Autopilot] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ message, code: 'AUTOPILOT_ERROR', status: 500 }, 500);
  }
});

/**
 * POST /api/ai/learn
 * Record host edit feedback to improve AI style over time.
 * Stores the edit pattern and updates the style profile.
 */
const learnSchema = z.object({
  original: z.string().min(1).max(10000),
  edited: z.string().min(1).max(10000),
  category: z.string().max(50).optional(),
  propertyId: z.string().optional(),
});

const outcomeSchema = z.object({
  outcomeType: z.enum(['approved', 'edited', 'rejected', 'independent']),
  propertyId: z.string().optional(),
  guestIntent: z.string().max(100).optional(),
  confidence: z.number().min(0).max(100).optional(),
  aiDraft: z.string().max(10000).optional(),
  hostReply: z.string().max(10000).optional(),
  guestMessage: z.string().max(10000).optional(),
});

aiRouter.post('/learn', requireAuth, learnRateLimit, async (c) => {
  try {
    const body = await c.req.json();
    const parsed = learnSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ message: 'Invalid request body', code: 'VALIDATION_ERROR', status: 400 }, 400);
    }

    const auth = getAuthContext(c);
    const supabase = getSupabaseAdmin();

    const scopedPropertyId = await resolveScopedPropertyId(supabase, auth.orgId, parsed.data.propertyId);

    // 1. Store the edit pattern
    await supabase.from('edit_patterns').insert({
      org_id: auth.orgId,
      original: parsed.data.original,
      edited: parsed.data.edited,
      category: parsed.data.category || null,
      property_id: scopedPropertyId,
    });

    // 2. Fetch recent edit patterns to build/update style profile
    const { data: patterns } = await supabase
      .from('edit_patterns')
      .select('original, edited, category')
      .eq('org_id', auth.orgId)
      .order('created_at', { ascending: false })
      .limit(100);

    // 3. Build a lightweight style profile from patterns
    const styleProfile = buildStyleProfile(patterns || []);

    // 4. Upsert the style profile
    await upsertStyleProfile(supabase, auth.orgId, scopedPropertyId, styleProfile, patterns?.length || 0);

    console.log(`[StyleLearn] Stored edit + updated profile for org ${auth.orgId} (${patterns?.length} patterns)`);

    return c.json({ success: true, patternsAnalyzed: patterns?.length || 0 });
  } catch (err) {
    console.error('[StyleLearn] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ message, code: 'LEARN_ERROR', status: 500 }, 500);
  }
});

aiRouter.post('/outcome', requireAuth, learnRateLimit, async (c) => {
  try {
    const body = await c.req.json();
    const parsed = outcomeSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ message: 'Invalid request body', code: 'VALIDATION_ERROR', status: 400 }, 400);
    }

    const auth = getAuthContext(c);
    const supabase = getSupabaseAdmin();
    const propertyId = await resolveScopedPropertyId(supabase, auth.orgId, parsed.data.propertyId);

    const inserts: EditPattern[] = [];
    if (parsed.data.outcomeType === 'edited' && parsed.data.aiDraft && parsed.data.hostReply) {
      inserts.push({
        original: parsed.data.aiDraft,
        edited: parsed.data.hostReply,
        category: parsed.data.guestIntent || 'edited_outcome',
      });
    } else if (parsed.data.outcomeType === 'approved' && parsed.data.aiDraft) {
      inserts.push({
        original: parsed.data.aiDraft,
        edited: parsed.data.aiDraft,
        category: parsed.data.guestIntent || 'approved_outcome',
      });
    }

    if (inserts.length > 0) {
      await supabase.from('edit_patterns').insert(
        inserts.map((entry) => ({
          org_id: auth.orgId,
          original: entry.original,
          edited: entry.edited,
          category: entry.category,
          property_id: propertyId,
        }))
      );
    }

    const { data: patterns } = await supabase
      .from('edit_patterns')
      .select('original, edited, category')
      .eq('org_id', auth.orgId)
      .order('created_at', { ascending: false })
      .limit(100);

    const existingProfileRow = await getExistingStyleProfileRow(supabase, auth.orgId, propertyId);
    const metrics = mergeLearningMetrics(
      (existingProfileRow?.profile_json as Record<string, unknown> | null) || null,
      parsed.data.outcomeType,
      parsed.data.confidence
    );
    const styleProfile = {
      ...buildStyleProfile(patterns || []),
      learningMetrics: metrics,
    };

    await upsertStyleProfile(
      supabase,
      auth.orgId,
      propertyId,
      styleProfile,
      patterns?.length || 0
    );

    return c.json({
      success: true,
      outcomeType: parsed.data.outcomeType,
      patternsAnalyzed: patterns?.length || 0,
      learningMetrics: metrics,
    });
  } catch (err) {
    console.error('[DraftOutcome] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ message, code: 'OUTCOME_ERROR', status: 500 }, 500);
  }
});

/**
 * GET /api/ai/style-profile
 * Returns the current style profile for prompt injection.
 */
aiRouter.get('/style-profile', requireAuth, async (c) => {
  try {
    const auth = getAuthContext(c);
    const propertyId = c.req.query('propertyId');
    const supabase = getSupabaseAdmin();

    // Try property-specific profile first, fall back to org-level
    let profile = null;
    if (propertyId) {
      const { data } = await supabase
        .from('host_style_profiles')
        .select('profile_json, samples_analyzed, updated_at')
        .eq('org_id', auth.orgId)
        .eq('property_id', propertyId)
        .single();
      profile = data;
    }

    if (!profile) {
      const { data } = await supabase
        .from('host_style_profiles')
        .select('profile_json, samples_analyzed, updated_at')
        .eq('org_id', auth.orgId)
        .is('property_id', null)
        .single();
      profile = data;
    }

    return c.json({
      hasProfile: !!profile,
      profile: profile?.profile_json || null,
      samplesAnalyzed: profile?.samples_analyzed || 0,
      updatedAt: profile?.updated_at || null,
    });
  } catch (err) {
    console.error('[StyleProfile] Error:', err);
    return c.json({ hasProfile: false, profile: null, samplesAnalyzed: 0, updatedAt: null });
  }
});

/**
 * POST /api/ai/review-response
 * Generate an AI response to a guest review on Airbnb/Vrbo.
 */
const reviewResponseSchema = z.object({
  review: z.string().min(1).max(5000),
  rating: z.number().min(1).max(5),
  propertyId: z.string().optional(),
  guestName: z.string().max(200).optional(),
  platform: z.string().max(50).optional(),
});

aiRouter.post('/review-response', requireAuth, aiRateLimit, checkDraftLimit, async (c) => {
  try {
    const body = await c.req.json();
    const parsed = reviewResponseSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ message: 'Invalid request body', code: 'VALIDATION_ERROR', status: 400 }, 400);
    }

    const auth = getAuthContext(c);

    // Build a review-specific prompt
    const reviewPrompt = buildReviewResponsePrompt(parsed.data);

    const result = await generateDraft({
      orgId: auth.orgId,
      userId: auth.userId,
      request: {
        message: reviewPrompt,
        propertyId: parsed.data.propertyId,
        guestName: parsed.data.guestName,
      },
    });

    return c.json({
      response: result.draft,
      confidence: result.confidence,
      provider: result.provider,
      model: result.model,
      tokensUsed: result.tokensUsed,
    });
  } catch (err) {
    console.error('[ReviewResponse] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ message, code: 'REVIEW_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// Helper: Build style profile from edit patterns
// ============================================================

interface EditPattern {
  original: string;
  edited: string;
  category: string | null;
}

interface StyleProfileRow {
  id: string;
  profile_json: Record<string, unknown> | null;
}

async function getExistingStyleProfileRow(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  orgId: string,
  propertyId: string | null
): Promise<StyleProfileRow | null> {
  let query = supabase
    .from('host_style_profiles')
    .select('id, profile_json')
    .eq('org_id', orgId)
    .limit(1);

  query = propertyId ? query.eq('property_id', propertyId) : query.is('property_id', null);

  const { data } = await query.maybeSingle();
  return (data as StyleProfileRow | null) || null;
}

async function resolveScopedPropertyId(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  orgId: string,
  propertyId?: string
): Promise<string | null> {
  if (!propertyId) {
    return null;
  }

  const { data: prop } = await supabase
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .eq('org_id', orgId)
    .maybeSingle();

  return prop?.id || null;
}

async function upsertStyleProfile(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  orgId: string,
  propertyId: string | null,
  styleProfile: Record<string, unknown>,
  samplesAnalyzed: number
): Promise<void> {
  const existing = await getExistingStyleProfileRow(supabase, orgId, propertyId);

  if (existing) {
    await supabase
      .from('host_style_profiles')
      .update({
        profile_json: styleProfile,
        samples_analyzed: samplesAnalyzed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return;
  }

  await supabase.from('host_style_profiles').insert({
    org_id: orgId,
    property_id: propertyId,
    profile_json: styleProfile,
    samples_analyzed: samplesAnalyzed,
  });
}

function mergeLearningMetrics(
  existingProfile: Record<string, unknown> | null,
  outcomeType: 'approved' | 'edited' | 'rejected' | 'independent',
  confidence?: number
): Record<string, unknown> {
  const prior = (existingProfile?.learningMetrics as Record<string, unknown> | undefined) || {};
  const approvals = Number(prior.approvals || 0);
  const edits = Number(prior.edits || 0);
  const rejections = Number(prior.rejections || 0);
  const independentReplies = Number(prior.independentReplies || 0);
  const totalConfidence = Number(prior.totalConfidence || 0);
  const confidenceSamples = Number(prior.confidenceSamples || 0);

  return {
    approvals: approvals + (outcomeType === 'approved' ? 1 : 0),
    edits: edits + (outcomeType === 'edited' ? 1 : 0),
    rejections: rejections + (outcomeType === 'rejected' ? 1 : 0),
    independentReplies: independentReplies + (outcomeType === 'independent' ? 1 : 0),
    totalConfidence: totalConfidence + (typeof confidence === 'number' ? confidence : 0),
    confidenceSamples: confidenceSamples + (typeof confidence === 'number' ? 1 : 0),
    lastOutcomeType: outcomeType,
    lastUpdatedAt: new Date().toISOString(),
  };
}

function buildStyleProfile(patterns: EditPattern[]): Record<string, unknown> {
  if (patterns.length === 0) return { trained: false };

  // Analyze edit patterns to extract style preferences
  const editTypes: Record<string, number> = {};
  let totalLengthChange = 0;
  let usesEmoji = false;
  let usesExclamation = false;
  const commonPhrases: string[] = [];

  for (const p of patterns) {
    if (p.category) {
      editTypes[p.category] = (editTypes[p.category] || 0) + 1;
    }
    totalLengthChange += p.edited.length - p.original.length;
    if (/[\u{1F600}-\u{1F64F}]/u.test(p.edited)) usesEmoji = true;
    if (p.edited.includes('!')) usesExclamation = true;

    // Extract short phrases the host commonly adds
    const addedWords = p.edited.split(/\s+/).filter(w => !p.original.includes(w));
    if (addedWords.length <= 5 && addedWords.length > 0) {
      commonPhrases.push(addedWords.join(' '));
    }
  }

  const avgLengthChange = totalLengthChange / patterns.length;
  const tonePreference = avgLengthChange > 20 ? 'detailed' : avgLengthChange < -20 ? 'concise' : 'balanced';

  return {
    trained: true,
    samplesCount: patterns.length,
    tonePreference,
    usesEmoji,
    usesExclamation,
    editCategories: editTypes,
    topPhrases: [...new Set(commonPhrases)].slice(0, 10),
    avgLengthChangeChars: Math.round(avgLengthChange),
  };
}

// ============================================================
// Helper: Build review response prompt
// ============================================================

function buildReviewResponsePrompt(data: {
  review: string;
  rating: number;
  guestName?: string;
  platform?: string;
}): string {
  const platform = data.platform || 'Airbnb';
  const guestRef = data.guestName ? `The guest's name is ${data.guestName}. ` : '';
  const ratingContext = data.rating >= 4
    ? 'This is a positive review. Thank the guest warmly.'
    : data.rating >= 3
      ? 'This is a mixed review. Acknowledge positives and professionally address concerns.'
      : 'This is a negative review. Be professional, empathetic, and address specific concerns without being defensive.';

  return `Write a ${platform} review response for this ${data.rating}-star review.
${guestRef}${ratingContext}
Keep the response professional, warm, and under 150 words.
Do not include a subject line or greeting format — just the response text.

GUEST REVIEW:
"${data.review}"`;
}

// ============================================================
// Helper: Log autopilot action with retry
// ============================================================

async function logAutopilotAction(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  data: Record<string, unknown>,
  confidencePercent: number,
): Promise<void> {
  try {
    await supabase.from('autopilot_actions').insert(data);
    console.log(`[Autopilot] Logged: ${data.action} (${confidencePercent}%)`);
  } catch (err) {
    console.warn('[Autopilot] Log failed, retrying once...');
    try {
      await new Promise((r) => setTimeout(r, 1000));
      await supabase.from('autopilot_actions').insert(data);
      console.log(`[Autopilot] Logged on retry: ${data.action} (${confidencePercent}%)`);
    } catch (retryErr) {
      console.error('[Autopilot] Log permanently failed:', JSON.stringify(data), retryErr);
    }
  }
}

export { aiRouter };
