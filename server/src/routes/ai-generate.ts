/**
 * AI Generate Route
 * 
 * 📁 server/src/routes/ai-generate.ts
 * Purpose: POST /api/ai/generate — Server-side AI draft generation
 * Depends on: middleware/auth, middleware/rate-limit, services/ai-proxy, zod
 * Used by: Mobile app (commercial mode), web app
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth, getAuthContext } from '../middleware/auth.js';
import { aiRateLimit } from '../middleware/rate-limit.js';
import { generateDraft } from '../services/ai-proxy.js';

const aiRouter = new Hono();

// Zod schema for input validation (Architecture Contract: validate ALL inputs)
const generateSchema = z.object({
  message: z.string().min(1).max(10000),
  conversationHistory: z.array(z.object({
    role: z.string(),
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
aiRouter.post('/generate', requireAuth, aiRateLimit, async (c) => {
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

export { aiRouter };
