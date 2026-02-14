/**
 * Supabase Database Client
 * 
 * 📁 server/src/db/supabase.ts
 * Purpose: Initialize and export the Supabase client for server-side use
 * Depends on: @supabase/supabase-js, SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars
 * Used by: All route handlers and services that need database access
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

/**
 * Get the Supabase admin client (service role — bypasses RLS).
 * Use ONLY for server-side operations where the calling user is already authenticated.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      '[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
    );
  }

  supabaseInstance = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseInstance;
}

/**
 * Get a Supabase client scoped to a specific user's JWT (respects RLS).
 * Use for operations where RLS should enforce data access.
 */
export function getSupabaseForUser(jwt: string): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      '[Supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables'
    );
  }

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
