/**
 * Auth Routes — Signup, Login, Current User
 * 
 * 📁 server/src/routes/auth.ts
 * Purpose: Authentication endpoints using Supabase Auth
 * Depends on: db/supabase, lib/types
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseAdmin } from '../db/supabase.js';
import type { AuthResponse } from '../lib/types.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppEnv } from '../lib/env.js';

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
    const { data: signInData } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInData.session) {
      return c.json({ message: 'Account created but login failed', code: 'SESSION_ERROR', status: 500 }, 500);
    }

    const response: AuthResponse = {
      token: signInData.session.access_token,
      refreshToken: signInData.session.refresh_token,
      user: {
        id: userId,
        email,
        name,
        createdAt: new Date(),
        plan: 'starter',
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    };

    return c.json(response, 201);
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

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

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

    const response: AuthResponse = {
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: new Date(user.created_at),
        plan: user.plan,
        trialEndsAt: user.trial_ends_at ? new Date(user.trial_ends_at) : null,
      },
    };

    return c.json(response);
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

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        trialEndsAt: user.trial_ends_at,
        createdAt: user.created_at,
      },
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

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

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
