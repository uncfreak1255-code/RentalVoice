/**
 * Langfuse Tracing Service
 *
 * server/src/services/langfuse.ts
 * Purpose: Observable AI generation tracing — prompt, response, latency, tokens, voice examples
 * Depends on: langfuse
 * Used by: services/ai-proxy.ts
 *
 * Gracefully no-ops when LANGFUSE_PUBLIC_KEY is not set.
 */

import { Langfuse } from 'langfuse';
import type { ManagedVoiceGrounding } from './voice-grounding.js';

// ---------------------------------------------------------------------------
// Singleton client — null when keys are missing
// ---------------------------------------------------------------------------

let _langfuse: Langfuse | null = null;

function getLangfuse(): Langfuse | null {
  if (_langfuse) return _langfuse;

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;

  if (!publicKey || !secretKey) return null;

  try {
    _langfuse = new Langfuse({
      publicKey,
      secretKey,
      baseUrl: process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com',
      // Flush events in background — don't block the request
      flushAt: 5,
      flushInterval: 1000,
    });
  } catch (err) {
    console.warn('[Langfuse] Failed to initialize client:', err instanceof Error ? err.message : err);
    return null;
  }

  return _langfuse;
}

/**
 * Whether tracing is active (Langfuse keys are configured).
 */
export function isTracingEnabled(): boolean {
  return getLangfuse() !== null;
}

// ---------------------------------------------------------------------------
// Trace handle — returned to callers for adding spans
// ---------------------------------------------------------------------------

export interface GenerationTrace {
  /** Record voice example retrieval (what was retrieved and scored). */
  traceVoiceRetrieval(grounding: ManagedVoiceGrounding): void;

  /** Record the LLM generation call. */
  traceGeneration(params: {
    provider: string;
    model: string;
    systemPrompt: string;
    userMessage: string;
    completion: string;
    durationMs: number;
    tokensUsed: { input: number; output: number };
    confidence: number | null;
    usedFallback: boolean;
  }): void;

  /** Finalize the trace (flush metadata). Call once when the request is done. */
  finalize(params: {
    success: boolean;
    error?: string;
  }): void;
}

/** No-op implementation used when tracing is disabled. */
const NOOP_TRACE: GenerationTrace = {
  traceVoiceRetrieval() {},
  traceGeneration() {},
  finalize() {},
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start a new trace for an AI generation request.
 * Returns a handle that callers use to record spans.
 * If Langfuse is not configured, returns a silent no-op.
 */
export function startGenerationTrace(params: {
  orgId: string;
  userId: string;
  propertyId?: string | null;
}): GenerationTrace {
  const langfuse = getLangfuse();
  if (!langfuse) return NOOP_TRACE;

  let trace;
  try {
    trace = langfuse.trace({
      name: 'ai-draft-generation',
      metadata: {
        orgId: params.orgId,
        userId: params.userId,
        propertyId: params.propertyId ?? null,
      },
      tags: ['ai-proxy', params.propertyId ? 'property-scoped' : 'org-level'],
    });
  } catch (err) {
    console.warn('[Langfuse] Failed to create trace:', err instanceof Error ? err.message : err);
    return NOOP_TRACE;
  }

  return {
    traceVoiceRetrieval(grounding: ManagedVoiceGrounding) {
      try {
        trace.span({
          name: 'voice-example-retrieval',
          metadata: {
            propertyId: grounding.propertyId,
            exampleCount: grounding.semanticExamples.length,
            examples: grounding.semanticExamples.map((ex) => ({
              originType: ex.origin_type,
              similarity: ex.similarity,
              guestMessagePreview: ex.guest_message.slice(0, 100),
              hostResponsePreview: ex.host_response.slice(0, 100),
            })),
            editPatternCount: grounding.recentEditPatterns.length,
            hasStyleProfile: grounding.styleProfile !== null,
            styleProfileTrained: grounding.styleProfile?.trained === true,
          },
        });
      } catch {
        // Tracing failures must never break the request
      }
    },

    traceGeneration(genParams) {
      try {
        trace.generation({
          name: 'llm-call',
          model: `${genParams.provider}/${genParams.model}`,
          input: [
            { role: 'system', content: genParams.systemPrompt },
            { role: 'user', content: genParams.userMessage },
          ],
          output: genParams.completion,
          usage: {
            input: genParams.tokensUsed.input,
            output: genParams.tokensUsed.output,
          },
          metadata: {
            provider: genParams.provider,
            model: genParams.model,
            durationMs: genParams.durationMs,
            confidence: genParams.confidence,
            usedFallback: genParams.usedFallback,
          },
        });
      } catch {
        // Tracing failures must never break the request
      }
    },

    finalize(finalParams) {
      try {
        trace.update({
          metadata: {
            orgId: params.orgId,
            userId: params.userId,
            propertyId: params.propertyId ?? null,
            success: finalParams.success,
            ...(finalParams.error ? { error: finalParams.error } : {}),
          },
        });
      } catch {
        // Tracing failures must never break the request
      }
    },
  };
}

/**
 * Flush any pending Langfuse events. Call on server shutdown.
 */
export async function shutdownLangfuse(): Promise<void> {
  const langfuse = getLangfuse();
  if (langfuse) {
    await langfuse.shutdownAsync();
    _langfuse = null;
  }
}
