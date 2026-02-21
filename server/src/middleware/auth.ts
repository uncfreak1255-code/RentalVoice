/**
 * Auth Middleware
 * 
 * 📁 server/src/middleware/auth.ts
 * Purpose: Verify JWT tokens and attach user context to requests
 * Depends on: @supabase/supabase-js, lib/types.ts
 * Used by: All protected route handlers
 */

import type { Context, Next } from 'hono';
import { getSupabaseAdmin } from '../db/supabase.js';
import type { AuthTokenPayload } from '../lib/types.js';
import type { AppEnv } from '../lib/env.js';

/**
 * Middleware: Require authentication.
 * Verifies the Supabase JWT from the Authorization header.
 * Sets `c.set('userId', ...)` and `c.set('orgId', ...)` for downstream handlers.
 */
export async function requireAuth(c: Context<AppEnv>, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(
      { message: 'Missing or invalid Authorization header', code: 'UNAUTHORIZED', status: 401 },
      401
    );
  }

  const token = authHeader.slice(7);

  try {
    const supabase = getSupabaseAdmin();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return c.json(
        { message: 'Invalid or expired token', code: 'UNAUTHORIZED', status: 401 },
        401
      );
    }

    // Fetch org membership
    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return c.json(
        { message: 'User has no organization', code: 'NO_ORG', status: 403 },
        403
      );
    }

    // Attach to context for downstream handlers
    c.set('userId', user.id);
    c.set('userEmail', user.email ?? '');
    c.set('orgId', membership.org_id);
    c.set('orgRole', membership.role);

    await next();
  } catch (err) {
    console.error('[Auth] Token verification failed:', err);
    return c.json(
      { message: 'Authentication failed', code: 'AUTH_ERROR', status: 500 },
      500
    );
  }
}

/**
 * Helper: Extract auth context from a request (after requireAuth middleware).
 */
export function getAuthContext(c: Context): AuthTokenPayload {
  return {
    userId: c.get('userId') as string,
    orgId: c.get('orgId') as string,
    email: c.get('userEmail') as string,
    plan: 'starter', // Fetched from DB when needed
    iat: 0,
    exp: 0,
  };
}
