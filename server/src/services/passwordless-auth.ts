import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { getSupabaseAdmin, getSupabaseAuthClient } from '../db/supabase.js';
import type { AuthResponse, PlanTier } from '../lib/types.js';
import { getEffectivePlan, isFounderAccount } from '../lib/founder-access.js';

interface UserRow {
  id: string;
  email: string;
  name: string;
  created_at: string;
  plan: PlanTier | null;
  trial_ends_at: string | null;
}

export class PasswordlessAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
  }
}

function isNotFoundError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'PGRST116'
  );
}

function defaultNameForEmail(email: string): string {
  const localPart = email.split('@')[0] ?? 'Host';
  return localPart.trim() || 'Host';
}

function deriveDisplayName(user: SupabaseUser): string {
  const metadataName = user.user_metadata?.name;
  if (typeof metadataName === 'string' && metadataName.trim().length > 0) {
    return metadataName.trim();
  }

  return defaultNameForEmail(user.email ?? 'Host');
}

async function ensureUserRow(user: SupabaseUser): Promise<UserRow> {
  const supabase = getSupabaseAdmin();

  const { data: existingUser, error: existingUserError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (existingUserError && !isNotFoundError(existingUserError)) {
    throw new PasswordlessAuthError('Failed to load user profile', 'PROFILE_LOOKUP_FAILED', 500);
  }

  if (!existingUser) {
    const { error: insertUserError } = await supabase.from('users').insert({
      id: user.id,
      email: user.email,
      name: deriveDisplayName(user),
      plan: 'starter',
      trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (insertUserError) {
      throw new PasswordlessAuthError('Failed to create user profile', 'PROFILE_CREATE_FAILED', 500);
    }
  }

  const { data: membership, error: membershipError } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single();

  if (membershipError && !isNotFoundError(membershipError)) {
    throw new PasswordlessAuthError('Failed to load organization membership', 'ORG_LOOKUP_FAILED', 500);
  }

  if (!membership) {
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: `${deriveDisplayName(user)}'s Team`,
        owner_id: user.id,
      })
      .select('id')
      .single();

    if (orgError || !org) {
      throw new PasswordlessAuthError('Failed to create organization', 'ORG_CREATE_FAILED', 500);
    }

    const { error: memberInsertError } = await supabase.from('org_members').insert({
      org_id: org.id,
      user_id: user.id,
      role: 'owner',
    });

    if (memberInsertError) {
      throw new PasswordlessAuthError('Failed to create organization membership', 'ORG_MEMBER_CREATE_FAILED', 500);
    }

    const { error: settingsError } = await supabase.from('org_settings').insert({
      org_id: org.id,
    });

    if (settingsError) {
      throw new PasswordlessAuthError('Failed to create org settings', 'ORG_SETTINGS_CREATE_FAILED', 500);
    }

    const { error: aiConfigError } = await supabase.from('ai_configs').insert({
      org_id: org.id,
      mode: 'managed',
    });

    if (aiConfigError) {
      throw new PasswordlessAuthError('Failed to create AI config', 'AI_CONFIG_CREATE_FAILED', 500);
    }
  }

  const { data: hydratedUser, error: hydratedUserError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (hydratedUserError || !hydratedUser) {
    throw new PasswordlessAuthError('Failed to hydrate user profile', 'PROFILE_HYDRATE_FAILED', 500);
  }

  return hydratedUser as UserRow;
}

function buildAuthResponse(user: UserRow, session: Session): AuthResponse & { founderAccess: boolean } {
  const founderAccess = isFounderAccount(user.id, user.email);
  const effectivePlan = getEffectivePlan((user.plan || 'starter') as PlanTier, user.id, user.email);

  return {
    token: session.access_token,
    refreshToken: session.refresh_token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: new Date(user.created_at),
      plan: effectivePlan,
      trialEndsAt: user.trial_ends_at ? new Date(user.trial_ends_at) : null,
    },
    founderAccess,
  };
}

export async function requestEmailCode(email: string, name?: string): Promise<void> {
  const authClient = getSupabaseAuthClient();
  const { error } = await authClient.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: name ? { name } : {},
    },
  });

  if (error) {
    throw new PasswordlessAuthError(error.message, 'AUTH_ERROR', 400);
  }
}

export async function verifyEmailCode(
  email: string,
  code: string
): Promise<AuthResponse & { founderAccess: boolean }> {
  const authClient = getSupabaseAuthClient();
  const { data, error } = await authClient.auth.verifyOtp({
    email,
    token: code,
    type: 'email',
  });

  if (error || !data.user || !data.session) {
    throw new PasswordlessAuthError('Invalid or expired code', 'INVALID_CODE', 401);
  }

  const hydratedUser = await ensureUserRow(data.user);
  return buildAuthResponse(hydratedUser, data.session);
}

export async function consumeMagicLink(
  code: string
): Promise<AuthResponse & { founderAccess: boolean }> {
  const authClient = getSupabaseAuthClient();
  const { data, error } = await authClient.auth.exchangeCodeForSession(code);

  if (error || !data.user || !data.session) {
    throw new PasswordlessAuthError('Invalid or expired magic link', 'INVALID_MAGIC_LINK', 401);
  }

  const hydratedUser = await ensureUserRow(data.user);
  return buildAuthResponse(hydratedUser, data.session);
}
