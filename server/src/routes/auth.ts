/**
 * Auth Routes — Signup, Login, Current User
 * 
 * 📁 server/src/routes/auth.ts
 * Purpose: Authentication endpoints using Supabase Auth
 * Depends on: db/supabase, lib/types
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseAdmin, getSupabaseAuthClient } from '../db/supabase.js';
import type { AuthResponse, PlanTier } from '../lib/types.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppEnv } from '../lib/env.js';
import { getEffectivePlan, isFounderAccount } from '../lib/founder-access.js';

export const authRouter = new Hono<AppEnv>();

// ============================================================
// Validation Schemas
// ============================================================

const signupSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

const autoProvisionSchema = z.object({
  hostawayAccountId: z.string().min(1, 'hostawayAccountId is required'),
  stableAccountId: z.string().min(1, 'stableAccountId is required'),
});

// ============================================================
// POST /api/auth/signup
// ============================================================

authRouter.post('/signup', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { message: parsed.error.errors[0].message, code: 'VALIDATION_ERROR', status: 400 },
        400
      );
    }

    const { email, password, name } = parsed.data;
    const supabase = getSupabaseAdmin();

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for now
      user_metadata: { name },
    });

    if (authError) {
      const msg = authError.message.includes('already registered')
        ? 'Email already in use'
        : authError.message;
      return c.json({ message: msg, code: 'AUTH_ERROR', status: 400 }, 400);
    }

    const userId = authData.user.id;

    // Create user record
    const { error: userInsertError } = await supabase.from('users').insert({
      id: userId,
      email,
      name,
      plan: 'starter',
      trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (userInsertError) {
      console.error('[Auth] Failed to create user record:', userInsertError);
    }

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: `${name}'s Team`, owner_id: userId })
      .select('id')
      .single();

    if (orgError) {
      console.error('[Auth] Failed to create organization:', orgError);
    }

    if (org) {
      // Add as owner
      const { error: memberError } = await supabase.from('org_members').insert({
        org_id: org.id,
        user_id: userId,
        role: 'owner',
      });

      if (memberError) {
        console.error('[Auth] Failed to create org membership:', memberError);
      }

      // Create default settings
      const { error: settingsError } = await supabase.from('org_settings').insert({ org_id: org.id });
      if (settingsError) {
        console.error('[Auth] Failed to create org settings:', settingsError);
      }

      // Create default AI config (managed mode)
      const { error: aiConfigError } = await supabase.from('ai_configs').insert({
        org_id: org.id,
        mode: 'managed',
      });
      if (aiConfigError) {
        console.error('[Auth] Failed to create AI config:', aiConfigError);
      }
    } else {
      console.error('[Auth] Org was null after insert — user will have no organization');
    }

    // Sign in to get session tokens
    const authClient = getSupabaseAuthClient();
    const { data: signInData } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInData.session) {
      return c.json({ message: 'Account created but login failed', code: 'SESSION_ERROR', status: 500 }, 500);
    }

    const founderAccess = isFounderAccount(userId, email);
    const effectivePlan = getEffectivePlan('starter', userId, email);
    const response: AuthResponse = {
      token: signInData.session.access_token,
      refreshToken: signInData.session.refresh_token,
      user: {
        id: userId,
        email,
        name,
        createdAt: new Date(),
        plan: effectivePlan,
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    };

    return c.json({ ...response, founderAccess }, 201);
  } catch (err) {
    console.error('[Auth] Signup error:', err);
    return c.json({ message: 'Signup failed', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// POST /api/auth/login
// ============================================================

authRouter.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { message: parsed.error.errors[0].message, code: 'VALIDATION_ERROR', status: 400 },
        400
      );
    }

    const { email, password } = parsed.data;
    const supabase = getSupabaseAdmin();
    const authClient = getSupabaseAuthClient();

    const { data, error } = await authClient.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      return c.json({ message: 'Invalid email or password', code: 'INVALID_CREDENTIALS', status: 401 }, 401);
    }

    // Fetch user profile
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (!user) {
      return c.json({ message: 'User profile not found', code: 'USER_NOT_FOUND', status: 404 }, 404);
    }

    const founderAccess = isFounderAccount(user.id, user.email);
    const effectivePlan = getEffectivePlan((user.plan || 'starter') as PlanTier, user.id, user.email);
    const response: AuthResponse = {
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: new Date(user.created_at),
        plan: effectivePlan,
        trialEndsAt: user.trial_ends_at ? new Date(user.trial_ends_at) : null,
      },
    };

    return c.json({ ...response, founderAccess });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return c.json({ message: 'Login failed', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// GET /api/auth/me — Current user profile
// ============================================================

authRouter.get('/me', requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    const supabase = getSupabaseAdmin();

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!user) {
      return c.json({ message: 'User not found', code: 'NOT_FOUND', status: 404 }, 404);
    }

    // Get org info
    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id, role, organizations(name)')
      .eq('user_id', userId)
      .single();

    const founderAccess = isFounderAccount(user.id, user.email);
    const effectivePlan = getEffectivePlan((user.plan || 'starter') as PlanTier, user.id, user.email);

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: effectivePlan,
        basePlan: user.plan,
        trialEndsAt: user.trial_ends_at,
        createdAt: user.created_at,
      },
      founderAccess,
      organization: membership ? {
        id: membership.org_id,
        role: membership.role,
        name: (membership as any).organizations?.name,
      } : null,
    });
  } catch (err) {
    console.error('[Auth] Me error:', err);
    return c.json({ message: 'Failed to fetch profile', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// POST /api/auth/refresh — Refresh token
// ============================================================

authRouter.post('/refresh', async (c) => {
  try {
    const { refreshToken } = await c.req.json();

    if (!refreshToken) {
      return c.json({ message: 'Refresh token required', code: 'VALIDATION_ERROR', status: 400 }, 400);
    }

    const authClient = getSupabaseAuthClient();
    const { data, error } = await authClient.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session) {
      return c.json({ message: 'Invalid refresh token', code: 'INVALID_TOKEN', status: 401 }, 401);
    }

    return c.json({
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
    });
  } catch (err) {
    console.error('[Auth] Refresh error:', err);
    return c.json({ message: 'Token refresh failed', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// Rate Limiter — In-memory sliding window for auto-provision
// ============================================================

const autoProvisionRateLimit = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5;

function autoProvisionEnabled(): boolean {
  return process.env.ENABLE_INTERNAL_AUTO_PROVISION === 'true';
}

function getAutoProvisionInternalToken(): string | null {
  const token = process.env.AUTO_PROVISION_INTERNAL_TOKEN?.trim();
  return token || null;
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = autoProvisionRateLimit.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    autoProvisionRateLimit.set(ip, recent);
    return false;
  }
  recent.push(now);
  autoProvisionRateLimit.set(ip, recent);
  return true;
}

// Periodic cleanup to prevent memory leak (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of autoProvisionRateLimit) {
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) {
      autoProvisionRateLimit.delete(ip);
    } else {
      autoProvisionRateLimit.set(ip, recent);
    }
  }
}, 5 * 60_000);

// ============================================================
// POST /api/auth/auto-provision
// Maps a Hostaway stableAccountId to a Supabase user/org identity.
// NOT authenticated — this IS the mechanism that creates auth.
// Rate-limited: 5 calls/min per IP.
// ============================================================

authRouter.post('/auto-provision', async (c) => {
  try {
    if (!autoProvisionEnabled()) {
      return c.json(
        { message: 'Auto-provision is disabled', code: 'AUTO_PROVISION_DISABLED', status: 403 },
        403
      );
    }

    const internalToken = getAutoProvisionInternalToken();
    if (!internalToken) {
      console.error('[Auth] AUTO_PROVISION_INTERNAL_TOKEN is not configured');
      return c.json(
        { message: 'Server misconfigured', code: 'INTERNAL_ERROR', status: 500 },
        500
      );
    }

    const providedToken = c.req.header('x-rv-internal-provision');
    if (providedToken !== internalToken) {
      return c.json(
        { message: 'Internal provisioning header required', code: 'AUTO_PROVISION_FORBIDDEN', status: 403 },
        403
      );
    }

    // Rate limit check
    const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? c.req.header('x-real-ip') ?? 'unknown';
    if (!checkRateLimit(ip)) {
      return c.json(
        { message: 'Rate limit exceeded. Try again in 1 minute.', code: 'RATE_LIMITED', status: 429 },
        429
      );
    }

    const body = await c.req.json();
    const parsed = autoProvisionSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { message: parsed.error.errors[0].message, code: 'VALIDATION_ERROR', status: 400 },
        400
      );
    }

    const { hostawayAccountId, stableAccountId } = parsed.data;

    const secret = process.env.AUTO_PROVISION_SECRET;
    if (!secret) {
      console.error('[Auth] AUTO_PROVISION_SECRET is not configured');
      return c.json(
        { message: 'Server misconfigured', code: 'INTERNAL_ERROR', status: 500 },
        500
      );
    }

    const email = `hostaway-${stableAccountId}@rv.internal`;
    const password = `auto-${stableAccountId}-${secret}`;

    const supabase = getSupabaseAdmin();
    const authClient = getSupabaseAuthClient();

    // Try sign-in first — user may already exist
    const { data: signInData } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInData?.session) {
      // Existing user — fetch orgId
      const { data: membership } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', signInData.user!.id)
        .single();

      return c.json({
        orgId: membership?.org_id ?? null,
        accessToken: signInData.session.access_token,
        refreshToken: signInData.session.refresh_token,
        email,
        userId: signInData.user!.id,
        isNew: false,
      });
    }

    // Sign-in failed — create new user via admin API
    console.log(`[Auth] Auto-provisioning new user for stableAccountId=${stableAccountId}`);

    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { hostawayAccountId, stableAccountId, autoProvisioned: true },
    });

    if (createError) {
      // If user already exists but sign-in failed, the password may have changed
      // (shouldn't happen, but handle gracefully)
      if (createError.message.includes('already registered')) {
        console.error('[Auth] Auto-provision user exists but sign-in failed — password mismatch?');
        return c.json(
          { message: 'Account exists but credentials mismatch', code: 'CREDENTIAL_MISMATCH', status: 409 },
          409
        );
      }
      console.error('[Auth] Auto-provision create user failed:', createError);
      return c.json(
        { message: 'Failed to create account', code: 'AUTH_ERROR', status: 500 },
        500
      );
    }

    const userId = authData.user.id;

    // Create user record (match signup pattern: auth.ts:71-81)
    const { error: userInsertError } = await supabase.from('users').insert({
      id: userId,
      email,
      name: `Hostaway ${hostawayAccountId}`,
      plan: 'starter',
      trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (userInsertError) {
      console.error('[Auth] Auto-provision failed to create user record:', userInsertError);
    }

    // Create organization + org_members + org_settings + ai_configs (match signup: auth.ts:84-119)
    let orgId: string | null = null;

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: `Hostaway ${hostawayAccountId}`, owner_id: userId })
      .select('id')
      .single();

    if (orgError) {
      console.error('[Auth] Auto-provision failed to create organization:', orgError);
    }

    if (org) {
      orgId = org.id;

      const { error: memberError } = await supabase.from('org_members').insert({
        org_id: org.id,
        user_id: userId,
        role: 'owner',
      });

      if (memberError) {
        console.error('[Auth] Auto-provision failed to create org membership:', memberError);
      }

      const { error: settingsError } = await supabase.from('org_settings').insert({ org_id: org.id });
      if (settingsError) {
        console.error('[Auth] Auto-provision failed to create org settings:', settingsError);
      }

      const { error: aiConfigError } = await supabase.from('ai_configs').insert({
        org_id: org.id,
        mode: 'managed',
      });
      if (aiConfigError) {
        console.error('[Auth] Auto-provision failed to create AI config:', aiConfigError);
      }
    }

    // Sign in to get session tokens
    const { data: newSignInData, error: newSignInError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (newSignInError || !newSignInData.session) {
      console.error('[Auth] Auto-provision: account created but sign-in failed:', newSignInError);
      return c.json(
        { message: 'Account created but login failed', code: 'SESSION_ERROR', status: 500 },
        500
      );
    }

    return c.json({
      orgId,
      accessToken: newSignInData.session.access_token,
      refreshToken: newSignInData.session.refresh_token,
      email,
      userId,
      isNew: true,
    }, 201);
  } catch (err) {
    console.error('[Auth] Auto-provision error:', err);
    return c.json({ message: 'Auto-provision failed', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// DELETE /api/auth/account-data
// Deletes all user data and the auth user. App Store 5.1.1(v).
// Sequential: learning tables → org (cascades) → auth user.
// If a table delete fails, auth user is NOT deleted (retryable).
// ============================================================

const LEARNING_TABLES = [
  'learning_profiles',
  'few_shot_examples',
  'host_style_profiles',
  'edit_patterns',
  'learning_migration_snapshots',
] as const;

authRouter.delete('/account-data', requireAuth, async (c) => {
  try {
    const orgId = c.get('orgId');
    const userId = c.get('userId');
    const supabaseAdmin = getSupabaseAdmin();
    const tablesCleared: string[] = [];

    // Step 1: Delete learning tables
    for (const table of LEARNING_TABLES) {
      const { error } = await supabaseAdmin.from(table).delete().eq('org_id', orgId);
      if (error) {
        console.error(`[Auth] account-data: failed to delete ${table}:`, error);
        return c.json(
          { message: `Failed to delete ${table}`, code: 'PARTIAL_FAILURE', tablesCleared, status: 500 },
          500
        );
      }
      tablesCleared.push(table);
    }

    // Step 2: Delete organization (cascades to org_members, org_settings, ai_configs)
    const { error: orgError } = await supabaseAdmin.from('organizations').delete().eq('id', orgId);
    if (orgError) {
      console.error('[Auth] account-data: failed to delete organization:', orgError);
      return c.json(
        { message: 'Failed to delete organization', code: 'PARTIAL_FAILURE', tablesCleared, status: 500 },
        500
      );
    }
    tablesCleared.push('organizations');

    // Step 3 (last): Delete Supabase auth user
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error('[Auth] account-data: failed to delete auth user:', authDeleteError);
      return c.json(
        { message: 'Failed to delete auth user', code: 'PARTIAL_FAILURE', tablesCleared, status: 500 },
        500
      );
    }
    tablesCleared.push('auth_user');

    console.log(`[Auth] account-data: fully deleted userId=${userId} orgId=${orgId}`);
    return c.json({ deleted: true, tablesCleared });
  } catch (err) {
    console.error('[Auth] account-data error:', err);
    return c.json({ message: 'Account deletion failed', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// Export rate limiter for testing
export { checkRateLimit, autoProvisionRateLimit };
