/**
 * bulk-import-voice.ts
 *
 * One-time script: fetches 6 months of Hostaway conversations, extracts
 * consecutive guest→host message pairs, and imports them as voice_examples
 * via the /api/voice/import endpoint.
 *
 * Usage:
 *   npx tsx server/scripts/bulk-import-voice.ts
 *
 * Required env vars (in server/.env or exported before running):
 *   HOSTAWAY_ACCOUNT_ID  — Hostaway account ID (used as client_id)
 *   HOSTAWAY_API_KEY     — Hostaway API key (used as client_secret)
 *   SERVER_URL           — Base URL of the running server, e.g. http://localhost:3001
 *   AUTH_TOKEN           — Bearer token with org scope (server extracts orgId)
 */

import 'dotenv/config';

// ────────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────────

const HOSTAWAY_API_BASE = 'https://api.hostaway.com/v1';
const CONVERSATION_PAGE_SIZE = 100;
const MESSAGE_PAGE_SIZE = 100;
const IMPORT_BATCH_SIZE = 200;
const DATE_RANGE_MONTHS = 6;
const RATE_LIMIT_MS = 100;
const LOG_EVERY_N = 25;

// ────────────────────────────────────────────────────────────────────────────
// Env validation
// ────────────────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`[bulk-import-voice] Missing required env var: ${name}`);
    process.exit(1);
  }
  return val;
}

const HOSTAWAY_ACCOUNT_ID = requireEnv('HOSTAWAY_ACCOUNT_ID');
const HOSTAWAY_API_KEY = requireEnv('HOSTAWAY_API_KEY');
const SERVER_URL = requireEnv('SERVER_URL').replace(/\/$/, '');
const AUTH_TOKEN = requireEnv('AUTH_TOKEN');

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface HostawayConversation {
  id: number;
  listingMapId?: number;
  listingName?: string;
  lastMessageSentAt?: string;
  arrivalDate?: string;
  [key: string]: unknown;
}

interface HostawayMessage {
  id: number;
  conversationId: number;
  body: string;
  isIncoming: number | boolean;
  insertedOn: string;
  sentOn?: string;
  [key: string]: unknown;
}

interface VoicePair {
  guestMessage: string;
  hostResponse: string;
  hostawayConversationId: string;
  sourceDate: string;
  propertyId: string | null;
}

interface HostawayApiResponse<T> {
  result: T;
  status: string;
  count?: number;
  total?: number;
  limit?: number;
  offset?: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Hostaway auth
// ────────────────────────────────────────────────────────────────────────────

async function getHostawayAccessToken(): Promise<string> {
  console.log('[bulk-import-voice] Fetching Hostaway access token...');

  const res = await fetch(`${HOSTAWAY_API_BASE}/accessTokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: HOSTAWAY_ACCOUNT_ID,
      client_secret: HOSTAWAY_API_KEY,
      scope: 'general',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Hostaway token request failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { access_token: string };
  console.log('[bulk-import-voice] Got Hostaway access token.');
  return data.access_token;
}

// ────────────────────────────────────────────────────────────────────────────
// Hostaway fetch helpers
// ────────────────────────────────────────────────────────────────────────────

async function fetchHostawayPage<T>(
  token: string,
  path: string
): Promise<T[]> {
  const res = await fetch(`${HOSTAWAY_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Hostaway API error [${res.status}] ${path}: ${body}`);
  }

  const json = (await res.json()) as HostawayApiResponse<T[]>;
  return json.result ?? [];
}

async function fetchAllConversations(token: string): Promise<HostawayConversation[]> {
  const all: HostawayConversation[] = [];
  let offset = 0;
  let hasMore = true;

  console.log('[bulk-import-voice] Fetching conversations (all pages)...');

  while (hasMore) {
    const page = await fetchHostawayPage<HostawayConversation>(
      token,
      `/conversations?limit=${CONVERSATION_PAGE_SIZE}&offset=${offset}`
    );
    all.push(...page);
    hasMore = page.length === CONVERSATION_PAGE_SIZE;
    offset += CONVERSATION_PAGE_SIZE;

    if (page.length > 0) {
      console.log(`[bulk-import-voice] Conversations fetched so far: ${all.length}`);
    }
  }

  console.log(`[bulk-import-voice] Total conversations fetched: ${all.length}`);
  return all;
}

async function fetchAllMessages(
  token: string,
  conversationId: number
): Promise<HostawayMessage[]> {
  const all: HostawayMessage[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await fetchHostawayPage<HostawayMessage>(
      token,
      `/conversations/${conversationId}/messages?limit=${MESSAGE_PAGE_SIZE}&offset=${offset}`
    );
    all.push(...page);
    hasMore = page.length === MESSAGE_PAGE_SIZE;
    offset += MESSAGE_PAGE_SIZE;
  }

  return all;
}

// ────────────────────────────────────────────────────────────────────────────
// Date filtering
// ────────────────────────────────────────────────────────────────────────────

function cutoffDate(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - DATE_RANGE_MONTHS);
  return d;
}

function messageIsWithinRange(msg: HostawayMessage, cutoff: Date): boolean {
  if (!msg.insertedOn) return false;
  return new Date(msg.insertedOn) >= cutoff;
}

// ────────────────────────────────────────────────────────────────────────────
// Pair extraction
// ────────────────────────────────────────────────────────────────────────────

function extractPairs(
  messages: HostawayMessage[],
  conversationId: number,
  propertyId: string | null,
  cutoff: Date
): VoicePair[] {
  // Filter to date range and sort ascending
  const filtered = messages
    .filter((m) => messageIsWithinRange(m, cutoff))
    .sort((a, b) => new Date(a.insertedOn).getTime() - new Date(b.insertedOn).getTime());

  const pairs: VoicePair[] = [];

  for (let i = 0; i < filtered.length - 1; i++) {
    const current = filtered[i];
    const next = filtered[i + 1];

    const currentIsGuest = current.isIncoming === 1 || current.isIncoming === true;
    const nextIsHost = next.isIncoming === 0 || next.isIncoming === false;

    if (!currentIsGuest || !nextIsHost) continue;

    const guestMessage = (current.body ?? '').trim();
    const hostResponse = (next.body ?? '').trim();

    if (!guestMessage || !hostResponse) continue;

    pairs.push({
      guestMessage,
      hostResponse,
      hostawayConversationId: String(conversationId),
      sourceDate: current.insertedOn,
      propertyId,
    });
  }

  return pairs;
}

// ────────────────────────────────────────────────────────────────────────────
// Import to server
// ────────────────────────────────────────────────────────────────────────────

interface ImportResult {
  inserted: number;
  skipped: number;
  total: number;
}

async function importBatch(pairs: VoicePair[]): Promise<ImportResult> {
  const body = {
    examples: pairs.map((p) => ({
      guestMessage: p.guestMessage,
      hostResponse: p.hostResponse,
      originType: 'historical' as const,
      hostawayConversationId: p.hostawayConversationId,
      sourceDate: p.sourceDate,
      propertyId: p.propertyId,
    })),
  };

  const res = await fetch(`${SERVER_URL}/api/voice/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Import request failed: ${res.status} ${errBody}`);
  }

  return (await res.json()) as ImportResult;
}

// ────────────────────────────────────────────────────────────────────────────
// Sleep helper
// ────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('[bulk-import-voice] Starting bulk voice import.');
  console.log(`[bulk-import-voice] Date range: last ${DATE_RANGE_MONTHS} months`);
  console.log(`[bulk-import-voice] Server: ${SERVER_URL}`);

  const token = await getHostawayAccessToken();
  const cutoff = cutoffDate();
  console.log(`[bulk-import-voice] Cutoff date: ${cutoff.toISOString()}`);

  // Fetch all conversations (no date filter — Hostaway has none)
  const allConversations = await fetchAllConversations(token);

  // Collect all pairs
  const allPairs: VoicePair[] = [];
  let processedCount = 0;

  for (const conversation of allConversations) {
    processedCount++;

    if (processedCount % LOG_EVERY_N === 0) {
      console.log(
        `[bulk-import-voice] Processing conversation ${processedCount}/${allConversations.length} ` +
        `(pairs so far: ${allPairs.length})`
      );
    }

    let messages: HostawayMessage[];
    try {
      messages = await fetchAllMessages(token, conversation.id);
    } catch (err) {
      console.warn(`[bulk-import-voice] Failed to fetch messages for conversation ${conversation.id}:`, err);
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    const propertyId = conversation.listingMapId ? String(conversation.listingMapId) : null;
    const pairs = extractPairs(messages, conversation.id, propertyId, cutoff);
    allPairs.push(...pairs);

    await sleep(RATE_LIMIT_MS);
  }

  console.log(`[bulk-import-voice] Finished processing ${processedCount} conversations.`);
  console.log(`[bulk-import-voice] Total pairs extracted: ${allPairs.length}`);

  if (allPairs.length === 0) {
    console.log('[bulk-import-voice] No pairs found. Exiting.');
    return;
  }

  // Send in batches
  let totalInserted = 0;
  let totalSkipped = 0;
  let batchNum = 0;

  for (let i = 0; i < allPairs.length; i += IMPORT_BATCH_SIZE) {
    batchNum++;
    const batch = allPairs.slice(i, i + IMPORT_BATCH_SIZE);
    console.log(
      `[bulk-import-voice] Importing batch ${batchNum} ` +
      `(${i + 1}–${Math.min(i + IMPORT_BATCH_SIZE, allPairs.length)} of ${allPairs.length})...`
    );

    try {
      const result = await importBatch(batch);
      totalInserted += result.inserted;
      totalSkipped += result.skipped;
      console.log(
        `[bulk-import-voice] Batch ${batchNum} done — inserted: ${result.inserted}, skipped: ${result.skipped}`
      );
    } catch (err) {
      console.error(`[bulk-import-voice] Batch ${batchNum} failed:`, err);
      // Continue to next batch rather than aborting the whole run
    }
  }

  console.log('[bulk-import-voice] ─────────────────────────────────────');
  console.log(`[bulk-import-voice] Total pairs processed: ${allPairs.length}`);
  console.log(`[bulk-import-voice] Inserted: ${totalInserted}`);
  console.log(`[bulk-import-voice] Skipped (duplicates): ${totalSkipped}`);
  console.log('[bulk-import-voice] Done.');
}

main().catch((err) => {
  console.error('[bulk-import-voice] Fatal error:', err);
  process.exit(1);
});
