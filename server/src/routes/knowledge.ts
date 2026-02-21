/**
 * Knowledge Routes — Property knowledge CRUD
 * 
 * 📁 server/src/routes/knowledge.ts
 * Purpose: Manage per-property knowledge (WiFi, check-in, rules, etc.)
 * Depends on: db/supabase, middleware/auth
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseAdmin } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppEnv } from '../lib/env.js';

export const knowledgeRouter = new Hono<AppEnv>();

knowledgeRouter.use('*', requireAuth);

// ============================================================
// GET /api/knowledge — All property knowledge for org
// ============================================================

knowledgeRouter.get('/', async (c) => {
  try {
    const orgId = c.get('orgId');
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('property_knowledge')
      .select('*')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false });

    if (error) {
      return c.json({ message: 'Failed to fetch knowledge', code: 'DB_ERROR', status: 500 }, 500);
    }

    return c.json({ properties: data || [] });
  } catch (err) {
    console.error('[Knowledge] List error:', err);
    return c.json({ message: 'Failed to fetch knowledge', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// GET /api/knowledge/:propertyId — Single property
// ============================================================

knowledgeRouter.get('/:propertyId', async (c) => {
  try {
    const orgId = c.get('orgId');
    const propertyId = c.req.param('propertyId');
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('property_knowledge')
      .select('*')
      .eq('org_id', orgId)
      .eq('property_id', propertyId)
      .single();

    if (error || !data) {
      return c.json({ message: 'Property knowledge not found', code: 'NOT_FOUND', status: 404 }, 404);
    }

    return c.json(data);
  } catch (err) {
    console.error('[Knowledge] Get error:', err);
    return c.json({ message: 'Failed to fetch property', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// PUT /api/knowledge/:propertyId — Upsert property knowledge
// ============================================================

const upsertKnowledgeSchema = z.object({
  wifiName: z.string().optional(),
  wifiPassword: z.string().optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  parking: z.string().optional(),
  rules: z.string().optional(),
  tone: z.string().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

knowledgeRouter.put('/:propertyId', async (c) => {
  try {
    const orgId = c.get('orgId');
    const propertyId = c.req.param('propertyId');
    const body = await c.req.json();
    const parsed = upsertKnowledgeSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { message: parsed.error.errors[0].message, code: 'VALIDATION_ERROR', status: 400 },
        400
      );
    }

    const supabase = getSupabaseAdmin();
    const row: Record<string, unknown> = {
      org_id: orgId,
      property_id: propertyId,
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.wifiName !== undefined) row.wifi_name = parsed.data.wifiName;
    if (parsed.data.wifiPassword !== undefined) row.wifi_password = parsed.data.wifiPassword;
    if (parsed.data.checkIn !== undefined) row.check_in = parsed.data.checkIn;
    if (parsed.data.checkOut !== undefined) row.check_out = parsed.data.checkOut;
    if (parsed.data.parking !== undefined) row.parking = parsed.data.parking;
    if (parsed.data.rules !== undefined) row.rules = parsed.data.rules;
    if (parsed.data.tone !== undefined) row.tone = parsed.data.tone;
    if (parsed.data.customFields !== undefined) row.custom_fields = parsed.data.customFields;

    const { error } = await supabase
      .from('property_knowledge')
      .upsert(row, { onConflict: 'org_id,property_id' });

    if (error) {
      return c.json({ message: 'Failed to save knowledge', code: 'DB_ERROR', status: 500 }, 500);
    }

    return c.json({ message: 'Property knowledge saved' });
  } catch (err) {
    console.error('[Knowledge] Upsert error:', err);
    return c.json({ message: 'Failed to save knowledge', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});
