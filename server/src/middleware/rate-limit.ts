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
  /** Optional key resolver. Defaults to authenticated user ID or client IP. */
  keyGenerator?: (c: Context) => string;
}

/**
 * Create a rate limiting middleware with the given config.
 */
export function rateLimit(config: RateLimitConfig) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const key = config.keyGenerator?.(c) ?? getRateLimitPrincipal(c);
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
    if (rateLimitStore.size > 1000) {
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

function getRateLimitPrincipal(c: Context): string {
  const userId = c.get('userId') as string | undefined;
  if (userId) return `user:${userId}`;

  const forwardedFor = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  const clientIp =
    forwardedFor ||
    c.req.header('x-real-ip') ||
    c.req.header('cf-connecting-ip') ||
    c.req.header('fly-client-ip');

  return clientIp ? `ip:${clientIp}` : 'unauthenticated';
}

/**
 * Pre-configured rate limiters per architecture contract:
 * - AI drafts: 100/hour
 * - General API: 1000/hour
 */
export const aiRateLimit = rateLimit({ maxRequests: 100, windowMs: 60 * 60 * 1000 });
export const apiRateLimit = rateLimit({ maxRequests: 1000, windowMs: 60 * 60 * 1000 });
export const learnRateLimit = rateLimit({ maxRequests: 30, windowMs: 60 * 60 * 1000 });

// Periodic cleanup of expired entries to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitStore) {
    if (v.resetAt < now) rateLimitStore.delete(k);
  }
}, 60 * 1000); // Every 60 seconds
