/**
 * Server Entry Point
 * 
 * 📁 server/src/index.ts
 * Purpose: Hono web server — mounts all route handlers
 * Depends on: hono, routes/*, middleware/*
 * Used by: Deployed as Vercel serverless function or standalone Node.js
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { bodyLimit } from 'hono/body-limit';
import { initializeDatabase } from './db/supabase.js';
import { aiRouter } from './routes/ai-generate.js';
import { authRouter } from './routes/auth.js';
import { settingsRouter } from './routes/settings.js';
import { knowledgeRouter } from './routes/knowledge.js';
import { accountRouter } from './routes/account.js';
import { usageRouter } from './routes/usage.js';
import { analyticsRouter } from './routes/analytics.js';
import { hostawayRouter } from './routes/hostaway.js';
import './adapters/hostaway-adapter.js'; // Self-registers Hostaway adapter
import { billingRouter } from './routes/billing.js';
import { entitlementsRouter } from './routes/entitlements.js';
import { webhooksRouter } from './routes/webhooks.js';
import { migrationRouter } from './routes/migration.js';
import { learningSyncRouter } from './routes/learning-sync.js';
import { voiceRouter } from './routes/voice.js';
import { guestyRouter } from './routes/guesty.js';
import './adapters/guesty-adapter.js'; // Self-registers Guesty adapter
import { lodgifyRouter } from './routes/lodgify.js';
import './adapters/lodgify-adapter.js'; // Self-registers Lodgify adapter
import { aiProxyRouter } from './routes/ai-proxy-personal.js';

const app = new Hono().basePath('/api');

// ============================================================
// Global Middleware
// ============================================================

// CORS — allow mobile app and web billing portal
app.use('*', cors({
  origin: [
    'http://localhost:8081',   // Expo dev
    'http://localhost:3000',   // Web dev
    'https://rentalvoice.app',
    'https://app.rentalvoice.app',
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Request body size limit (1MB)
app.use('*', bodyLimit({ maxSize: 1024 * 1024 }));

// Request logging
app.use('*', logger());

// ============================================================
// Health Check
// ============================================================

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ============================================================
// Route Mounting
// ============================================================

app.route('/ai', aiRouter);
app.route('/auth', authRouter);
app.route('/settings', settingsRouter);
app.route('/knowledge', knowledgeRouter);
app.route('/account', accountRouter);
app.route('/usage', usageRouter);
app.route('/analytics', analyticsRouter);
app.route('/hostaway', hostawayRouter);
app.route('/billing', billingRouter);
app.route('/entitlements', entitlementsRouter);
app.route('/migration', migrationRouter);
app.route('/learning', learningSyncRouter);
app.route('/voice', voiceRouter);
app.route('/webhooks', webhooksRouter);
app.route('/guesty', guestyRouter);
app.route('/lodgify', lodgifyRouter);
app.route('/ai-proxy', aiProxyRouter);


// ============================================================
// 404 Handler
// ============================================================

app.notFound((c) => {
  return c.json(
    { message: 'Not found', code: 'NOT_FOUND', status: 404 },
    404
  );
});

// ============================================================
// Global Error Handler
// ============================================================

app.onError((err, c) => {
  console.error('[Server] Unhandled error:', err);
  return c.json(
    { message: 'Internal server error', code: 'INTERNAL_ERROR', status: 500 },
    500
  );
});

// ============================================================
// Export & Start
// ============================================================

// Fail fast if database env vars are missing
initializeDatabase();

// For Vercel: export as default
export default app;

// For local dev: start with `bun run --hot src/index.ts`
const port = parseInt(process.env.PORT || '3001', 10);

if (typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined') {
  console.log(`[Server] Rental Voice API running at http://localhost:${port}`);
}

export { app };
