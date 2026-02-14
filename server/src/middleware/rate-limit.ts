/**
 * Rate Limiting Middleware
 * 
 * 📁 server/src/middleware/rate-limit.ts
 * Purpose: Per-user rate limiting on API endpoints
 * Depends on: Hono context (userId from auth middleware)
 * Used by: Route handlers that need rate limiting (AI generate, etc.)
 */

import type { Context, Next } from 'hono';

// In-memory rate limit store (replace with Redis in production at scale)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

interface RateLimitConfig {
  /** Max requests per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

/**
 * Create a rate limiting middleware with the given config.
 */
export function rateLimit(config: RateLimitConfig) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const userId = c.get('userId') as string | undefined;
    const key = userId || c.req.header('x-forwarded-for') || 'anonymous';
    const storeKey = `${key}:${c.req.path}`;

    const now = Date.now();
    const entry = rateLimitStore.get(storeKey);

    if (entry && entry.resetAt > now) {
      if (entry.count >= config.maxRequests) {
        c.header('X-RateLimit-Limit', config.maxRequests.toString());
        c.header('X-RateLimit-Remaining', '0');
        c.header('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());

        return c.json(
          {
            message: 'Rate limit exceeded. Please try again later.',
            code: 'RATE_LIMITED',
            status: 429,
          },
          429
        );
      }
      entry.count++;
    } else {
      rateLimitStore.set(storeKey, {
        count: 1,
        resetAt: now + config.windowMs,
      });
    }

    // Clean up expired entries periodically
    if (rateLimitStore.size > 10000) {
      for (const [k, v] of rateLimitStore) {
        if (v.resetAt < now) rateLimitStore.delete(k);
      }
    }

    const current = rateLimitStore.get(storeKey);
    c.header('X-RateLimit-Limit', config.maxRequests.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, config.maxRequests - (current?.count || 0)).toString());

    await next();
  };
}

/**
 * Pre-configured rate limiters per architecture contract:
 * - AI drafts: 100/hour
 * - General API: 1000/hour
 */
export const aiRateLimit = rateLimit({ maxRequests: 100, windowMs: 60 * 60 * 1000 });
export const apiRateLimit = rateLimit({ maxRequests: 1000, windowMs: 60 * 60 * 1000 });
