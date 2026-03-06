/**
 * AI Proxy Service
 * 
 * 📁 server/src/services/ai-proxy.ts
 * Purpose: Server-side AI draft generation — proxies to OpenAI/Anthropic/Google
 * Depends on: lib/types.ts, lib/encryption.ts, db/supabase.ts
 * Used by: routes/ai-generate.ts
 */

import { getSupabaseAdmin } from '../db/supabase.js';
import type {
  AIGenerateRequest,
  AIGenerateResponse,
  AIProvider,
  ManagedModelTarget,
  PlanTier,
} from '../lib/types.js';
import { MANAGED_MODEL_POLICY } from '../lib/types.js';
import { reportOverageIfNeeded } from './stripe-billing.js';

interface AICallOptions {
  orgId: string;
  userId: string;
  request: AIGenerateRequest;
}

/**
 * Generate an AI draft for a guest message.
 * Uses managed provider config, calls the API, and tracks usage.
 */
export async function generateDraft(options: AICallOptions): Promise<AIGenerateResponse> {
  const { orgId, userId, request } = options;
  const supabase = getSupabaseAdmin();

  // 1. Get org user's plan for managed model policy
  const { data: user } = await supabase
    .from('users')
    .select('plan')
    .eq('id', userId)
    .single();

  const plan = (user?.plan || 'starter') as PlanTier;
  const modelPolicy = MANAGED_MODEL_POLICY[plan];
  const modelCandidates: ManagedModelTarget[] = [modelPolicy.primary, ...modelPolicy.fallbacks];

  // 2. Fetch style profile for prompt injection (non-blocking on failure)
  let styleProfile: Record<string, unknown> | null = null;
  try {
    const { data: profile } = await supabase
      .from('host_style_profiles')
      .select('profile_json')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    if (profile?.profile_json) {
      styleProfile = profile.profile_json as Record<string, unknown>;
    }
  } catch {
    // Style profile is optional — continue without it
  }

  // 3. Build the prompt
  const systemPrompt = buildSystemPrompt(request, styleProfile);
  const userMessage = request.message;

  // 4. Call managed provider chain (primary + fallback)
  let provider: AIProvider | null = null;
  let model: string | null = null;
  let result: ProviderResult | null = null;
  let lastError: unknown = null;
  let attempted = 0;
  let usedFallback = false;

  for (const [index, candidate] of modelCandidates.entries()) {
    const apiKey = getManagedApiKey(candidate.provider);
    if (!apiKey) {
      console.warn(`[AI Proxy] Missing managed key for ${candidate.provider}; skipping candidate ${candidate.model}`);
      continue;
    }

    attempted += 1;
    try {
      const startTime = Date.now();
      const candidateResult = await callProvider(
        candidate.provider,
        candidate.model,
        apiKey,
        systemPrompt,
        userMessage,
        request.conversationHistory,
        modelPolicy.maxOutputTokensPerDraft,
      );
      const duration = Date.now() - startTime;

      provider = candidate.provider;
      model = candidate.model;
      result = candidateResult;
      usedFallback = index > 0;
      console.log(`[AI Proxy] ${provider}/${model} responded in ${duration}ms, ${result.tokensUsed.input + result.tokensUsed.output} tokens`);
      break;
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[AI Proxy] Provider attempt failed (${candidate.provider}/${candidate.model}): ${message}`);
    }
  }

  if (!provider || !model || !result) {
    if (attempted === 0) {
      throw new Error('[AI Proxy] No managed provider API keys configured on server');
    }
    throw new Error(`[AI Proxy] All managed provider attempts failed for plan ${plan}: ${lastError instanceof Error ? lastError.message : 'Unknown provider error'}`);
  }

  // 5. Track usage (async, non-blocking)
  trackUsage(orgId, provider, result.tokensUsed).catch(err =>
    console.error('[AI Proxy] Usage tracking failed:', err)
  );

  // 6. Report overage to Stripe if needed (async, non-blocking)
  reportOverageIfNeeded(orgId, userId).catch(err =>
    console.error('[AI Proxy] Overage reporting failed:', err)
  );

  return {
    draft: result.content,
    confidence: result.confidence,
    detectedLanguage: result.detectedLanguage,
    provider,
    model,
    usedFallback,
    tokensUsed: result.tokensUsed,
  };
}

// ============================================================
// Internal Helpers
// ============================================================

function getManagedApiKey(provider: AIProvider): string | null {
  const envMap: Record<AIProvider, string> = {
    google: 'GOOGLE_API_KEY',
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
  };

  return process.env[envMap[provider]] || null;
}

function buildSystemPrompt(request: AIGenerateRequest, styleProfile?: Record<string, unknown> | null): string {
  const langInstruction = request.responseLanguageMode === 'host_default'
    ? `Always respond in ${request.hostDefaultLanguage || 'English'}.`
    : request.responseLanguageMode === 'match_guest'
      ? 'Match the language the guest wrote in.'
      : 'Respond in the same language as the guest message.';

  // Build style context from learned profile
  let styleContext = '';
  if (styleProfile && styleProfile.trained === true) {
    const parts: string[] = [];
    if (styleProfile.tonePreference === 'detailed') parts.push('Write longer, more detailed responses.');
    if (styleProfile.tonePreference === 'concise') parts.push('Keep responses short and to the point.');
    if (styleProfile.usesEmoji) parts.push('Use emojis occasionally where appropriate.');
    if (styleProfile.usesExclamation) parts.push('Use exclamation marks to convey enthusiasm.');
    if (Array.isArray(styleProfile.topPhrases) && styleProfile.topPhrases.length > 0) {
      parts.push(`The host often uses these phrases: "${(styleProfile.topPhrases as string[]).slice(0, 5).join('", "')}".`);
    }
    if (parts.length > 0) {
      styleContext = `\nHOST STYLE PREFERENCES (learned from previous edits):\n${parts.join('\n')}`;
    }
  }

  return `You are an AI assistant helping a vacation rental host respond to guest messages.
Your tone should be warm, professional, and helpful.
Keep responses concise but thorough.
${langInstruction}
${request.guestName ? `The guest's name is ${request.guestName}.` : ''}
Do not include any explicit, harmful, or inappropriate content.
If the guest message contains inappropriate content, respond professionally and redirect.${styleContext}`;
}

interface ProviderResult {
  content: string;
  confidence: number;
  detectedLanguage: string;
  tokensUsed: { input: number; output: number };
}

async function callProvider(
  provider: AIProvider,
  model: string,
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  history?: { role: string; content: string }[],
  maxOutputTokens = 1000,
): Promise<ProviderResult> {
  switch (provider) {
    case 'openai':
      return callOpenAI(model, apiKey, systemPrompt, userMessage, history, maxOutputTokens);
    case 'anthropic':
      return callAnthropic(model, apiKey, systemPrompt, userMessage, history, maxOutputTokens);
    case 'google':
      return callGoogle(model, apiKey, systemPrompt, userMessage, history, maxOutputTokens);
    default:
      throw new Error(`[AI Proxy] Unknown provider: ${provider}`);
  }
}

async function callOpenAI(
  model: string,
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  history?: { role: string; content: string }[],
  maxOutputTokens = 1000,
): Promise<ProviderResult> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...(history || []),
    { role: 'user', content: userMessage },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: maxOutputTokens }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[OpenAI] API error ${response.status}: ${err}`);
  }

  const data = await response.json() as {
    choices: { message: { content: string } }[];
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content: data.choices[0].message.content,
    confidence: 82,
    detectedLanguage: 'en',
    tokensUsed: { input: data.usage.prompt_tokens, output: data.usage.completion_tokens },
  };
}

async function callAnthropic(
  model: string,
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  history?: { role: string; content: string }[],
  maxOutputTokens = 1000,
): Promise<ProviderResult> {
  const messages = [
    ...(history || []).map(m => ({ role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, content: m.content })),
    { role: 'user' as const, content: userMessage },
  ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, system: systemPrompt, messages, max_tokens: maxOutputTokens }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[Anthropic] API error ${response.status}: ${err}`);
  }

  const data = await response.json() as {
    content: { text: string }[];
    usage: { input_tokens: number; output_tokens: number };
  };

  return {
    content: data.content[0].text,
    confidence: 82,
    detectedLanguage: 'en',
    tokensUsed: { input: data.usage.input_tokens, output: data.usage.output_tokens },
  };
}

async function callGoogle(
  model: string,
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  history?: { role: string; content: string }[],
  maxOutputTokens = 1000,
): Promise<ProviderResult> {
  const contents = [
    ...(history || []).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[Google] API error ${response.status}: ${err}`);
  }

  const data = await response.json() as {
    candidates: { content: { parts: { text: string }[] } }[];
    usageMetadata: { promptTokenCount: number; candidatesTokenCount: number };
  };

  return {
    content: data.candidates[0].content.parts[0].text,
    confidence: 82,
    detectedLanguage: 'en',
    tokensUsed: {
      input: data.usageMetadata?.promptTokenCount || 0,
      output: data.usageMetadata?.candidatesTokenCount || 0,
    },
  };
}

async function trackUsage(
  orgId: string,
  provider: AIProvider,
  tokensUsed: { input: number; output: number },
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM

  // Upsert usage record
  const { data: existing } = await supabase
    .from('ai_usage')
    .select('id, requests, tokens_in, tokens_out')
    .eq('org_id', orgId)
    .eq('month', month)
    .eq('provider', provider)
    .single();

  if (existing) {
    await supabase
      .from('ai_usage')
      .update({
        requests: existing.requests + 1,
        tokens_in: existing.tokens_in + tokensUsed.input,
        tokens_out: existing.tokens_out + tokensUsed.output,
      })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('ai_usage')
      .insert({
        org_id: orgId,
        month,
        provider,
        requests: 1,
        tokens_in: tokensUsed.input,
        tokens_out: tokensUsed.output,
        cost_usd: 0, // Calculated in billing job
      });
  }
}
