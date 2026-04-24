import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseAdmin } from '../db/supabase.js';
import type { AppEnv } from '../lib/env.js';
import { waitlistRateLimit } from '../middleware/rate-limit.js';

export const waitlistRouter = new Hono<AppEnv>();

const waitlistSignupSchema = z.object({
  email: z.string().trim().email('Invalid email').max(320).transform((email) => email.toLowerCase()),
  source: z.string().trim().min(1).max(100).optional().default('landing'),
});

type SupabaseError = {
  code?: string;
  message?: string;
};

function isDuplicateEmailError(error: SupabaseError | null): boolean {
  return error?.code === '23505';
}

waitlistRouter.post('/', waitlistRateLimit, async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ message: 'Invalid JSON body', code: 'VALIDATION_ERROR', status: 400 }, 400);
  }

  const parsed = waitlistSignupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { message: 'Validation failed', code: 'VALIDATION_ERROR', status: 400, details: parsed.error.flatten() },
      400
    );
  }

  const { email, source } = parsed.data;
  const supabase = getSupabaseAdmin();

  const { data: existingSignup, error: lookupError } = await supabase
    .from('waitlist_signups')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (lookupError) {
    console.error('[Waitlist] Failed to check existing signup:', lookupError);
    return c.json({ message: 'Failed to submit waitlist signup', code: 'DB_ERROR', status: 500 }, 500);
  }

  if (existingSignup) {
    return c.json({ message: 'Email is already on the waitlist', code: 'DUPLICATE_EMAIL', status: 409 }, 409);
  }

  const { error: insertError } = await supabase
    .from('waitlist_signups')
    .insert({ email, source })
    .select('id')
    .single();

  if (isDuplicateEmailError(insertError)) {
    return c.json({ message: 'Email is already on the waitlist', code: 'DUPLICATE_EMAIL', status: 409 }, 409);
  }

  if (insertError) {
    console.error('[Waitlist] Failed to insert signup:', insertError);
    return c.json({ message: 'Failed to submit waitlist signup', code: 'DB_ERROR', status: 500 }, 500);
  }

  return c.json({ ok: true }, 201);
});
