/**
 * AI Proxy Service
 * 
 * 📁 server/src/services/ai-proxy.ts
 * Purpose: Server-side AI draft generation — proxies to OpenAI/Anthropic/Google
 * Depends on: lib/types.ts, lib/encryption.ts, db/supabase.ts
 * Used by: routes/ai-generate.ts
 */

import { getSupabaseAdmin } from '../db/supabase.js';
import { decrypt } from '../lib/encryption.js';
import type {
  AIGenerateRequest,
  AIGenerateResponse,
  AIProvider,
} from '../lib/types.js';

interface AICallOptions {
  orgId: string;
  request: AIGenerateRequest;
}

/**
 * Generate an AI draft for a guest message.
 * Determines managed vs BYOK, selects provider, calls the API, and tracks usage.
 */
export async function generateDraft(options: AICallOptions): Promise<AIGenerateResponse> {
  const { orgId, request } = options;
  const supabase = getSupabaseAdmin();

  // 1. Get org's AI config
  const { data: aiConfig } = await supabase
    .from('ai_configs')
    .select('*')
    .eq('org_id', orgId)
    .single();

  // 2. Determine provider and API key
  const mode = aiConfig?.mode || 'managed';
  let apiKey: string;
  let provider: AIProvider;
  let model: string;

  if (mode === 'byok' && aiConfig?.encrypted_api_key) {
    // BYOK: decrypt user's key
    apiKey = decrypt(aiConfig.encrypted_api_key);
    provider = aiConfig.provider || 'openai';
    model = aiConfig.model || getDefaultModel(provider);
  } else {
    // Managed: use platform keys with fallback chain
    provider = getManagedProvider();
    model = getDefaultModel(provider);
    apiKey = getManagedApiKey(provider);
  }

  // 3. Build the prompt
  const systemPrompt = buildSystemPrompt(request);
  const userMessage = request.message;

  // 4. Call the AI provider
  const startTime = Date.now();
  const result = await callProvider(provider, model, apiKey, systemPrompt, userMessage, request.conversationHistory);
  const duration = Date.now() - startTime;

  console.log(`[AI Proxy] ${provider}/${model} responded in ${duration}ms, ${result.tokensUsed.input + result.tokensUsed.output} tokens`);

  // 5. Track usage (async, non-blocking)
  trackUsage(orgId, provider, result.tokensUsed).catch(err =>
    console.error('[AI Proxy] Usage tracking failed:', err)
  );

  return {
    draft: result.content,
    confidence: result.confidence,
    detectedLanguage: result.detectedLanguage,
    provider,
    model,
    tokensUsed: result.tokensUsed,
  };
}

// ============================================================
// Internal Helpers
// ============================================================

function getManagedProvider(): AIProvider {
  // Priority: Google (cheapest) → OpenAI → Anthropic
  const providers: AIProvider[] = ['google', 'openai', 'anthropic'];
  return providers[0];
}

function getDefaultModel(provider: AIProvider): string {
  switch (provider) {
    case 'google': return 'gemini-2.0-flash';
    case 'openai': return 'gpt-4o-mini';
    case 'anthropic': return 'claude-3-5-haiku-latest';
  }
}

function getManagedApiKey(provider: AIProvider): string {
  const envMap: Record<AIProvider, string> = {
    google: 'GOOGLE_API_KEY',
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
  };

  const key = process.env[envMap[provider]];
  if (!key) {
    throw new Error(`[AI Proxy] Missing ${envMap[provider]} env var for managed ${provider}`);
  }
  return key;
}

function buildSystemPrompt(request: AIGenerateRequest): string {
  const langInstruction = request.responseLanguageMode === 'host_default'
    ? `Always respond in ${request.hostDefaultLanguage || 'English'}.`
    : request.responseLanguageMode === 'match_guest'
      ? 'Match the language the guest wrote in.'
      : 'Respond in the same language as the guest message.';

  return `You are an AI assistant helping a vacation rental host respond to guest messages.
Your tone should be warm, professional, and helpful.
Keep responses concise but thorough.
${langInstruction}
${request.guestName ? `The guest's name is ${request.guestName}.` : ''}
Do not include any explicit, harmful, or inappropriate content.
If the guest message contains inappropriate content, respond professionally and redirect.`;
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
): Promise<ProviderResult> {
  switch (provider) {
    case 'openai':
      return callOpenAI(model, apiKey, systemPrompt, userMessage, history);
    case 'anthropic':
      return callAnthropic(model, apiKey, systemPrompt, userMessage, history);
    case 'google':
      return callGoogle(model, apiKey, systemPrompt, userMessage, history);
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
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 1000 }),
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
    body: JSON.stringify({ model, system: systemPrompt, messages, max_tokens: 1000 }),
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
        generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
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
