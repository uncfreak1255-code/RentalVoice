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
import { aiRouter } from './routes/ai-generate.js';

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

// AI endpoints
app.route('/ai', aiRouter);

// TODO: Phase 2 routes (uncomment as implemented)
// app.route('/auth', authRouter);
// app.route('/hostaway', hostawayRouter);
// app.route('/knowledge', knowledgeRouter);
// app.route('/settings', settingsRouter);
// app.route('/billing', billingRouter);
// app.route('/webhooks', webhooksRouter);
// app.route('/account', accountRouter); // Includes DELETE for App Store compliance

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

// For Vercel: export as default
export default app;

// For local dev: start with `bun run --hot src/index.ts`
const port = parseInt(process.env.PORT || '3001', 10);

if (typeof Bun !== 'undefined') {
  console.log(`[Server] Rental Voice API running at http://localhost:${port}`);
}

export { app };
