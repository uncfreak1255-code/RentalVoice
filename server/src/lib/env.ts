/**
 * App Environment — Typed Hono context variables
 * 
 * 📁 server/src/lib/env.ts
 * Purpose: Define typed context variables set by auth middleware
 * Used by: All route files that access c.get('userId'), c.get('orgId'), etc.
 */

import type { Env } from 'hono';

export interface AppEnv extends Env {
  Variables: {
    userId: string;
    userEmail: string;
    orgId: string;
    orgRole: string;
  };
}
