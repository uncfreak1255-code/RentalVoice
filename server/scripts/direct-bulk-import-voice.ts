// server/scripts/direct-bulk-import-voice.ts
//
// One-time script: fetches 6 months of Hostaway conversations,
// chunks into guest/host pairs, embeds via Gemini, inserts directly to Supabase.
// Uses service role key — no auth token needed.
//
// Usage: npx tsx server/scripts/direct-bulk-import-voice.ts
//
// Reads from:
//   .env: EXPO_PUBLIC_HOSTAWAY_ACCOUNT_ID, EXPO_PUBLIC_HOSTAWAY_API_KEY, EXPO_PUBLIC_VIBECODE_GOOGLE_API_KEY
//   server/.env.live.local: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load both env files
config({ path: resolve(__dirname, '../../.env') });
config({ path: resolve(__dirname, '../.env.live.local') });

const HOSTAWAY_ACCOUNT_ID = process.env.EXPO_PUBLIC_HOSTAWAY_ACCOUNT_ID;
const HOSTAWAY_API_KEY = process.env.EXPO_PUBLIC_HOSTAWAY_API_KEY;
const GOOGLE_AI_API_KEY = process.env.EXPO_PUBLIC_VIBECODE_GOOGLE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Founder org from Live project
const FOUNDER_ORG_ID = '600c7934-8e01-425f-a60c-14c5e7b5c36c';

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;
const MAX_BATCH_SIZE = 100;
const BATCH_DELAY_MS = 150;
const CONVERSATION_PAGE_SIZE = 100;

if (!HOSTAWAY_ACCOUNT_ID || !HOSTAWAY_API_KEY) {
  console.error('[BULK_IMPORT] Missing HOSTAWAY credentials in .env');
  process.exit(1);
}
if (!GOOGLE_AI_API_KEY) {
  console.error('[BULK_IMPORT] Missing EXPO_PUBLIC_VIBECODE_GOOGLE_API_KEY in .env');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[BULK_IMPORT] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env.live.local');
  process.exit(1);
}

interface HostawayMessage {
  id: number;
  conversationId: number;
  body: string;
  isIncoming: number;
  insertedOn: string;
}

interface Pair {
  guestMessage: string;
  hostResponse: string;
  propertyId?: string;
  hostawayConversationId: string;
  sourceDate: string;
}

// ─── Hostaway API ──────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const response = await fetch('https://api.hostaway.com/v1/accessTokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: HOSTAWAY_ACCOUNT_ID!,
      client_secret: HOSTAWAY_API_KEY!,
      scope: 'general',
    }),
  });
  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`[BULK_IMPORT] Hostaway auth failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function fetchAllConversations(token: string): Promise<any[]> {
  const conversations: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `https://api.hostaway.com/v1/conversations?limit=${CONVERSATION_PAGE_SIZE}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    const page = data.result || [];
    conversations.push(...page);

    hasMore = page.length === CONVERSATION_PAGE_SIZE;
    offset += CONVERSATION_PAGE_SIZE;

    console.log(`[BULK_IMPORT] Fetched ${conversations.length} conversations...`);

    if (hasMore) await new Promise((r) => setTimeout(r, 100));
  }

  return conversations;
}

async function fetchMessages(token: string, conversationId: number): Promise<HostawayMessage[]> {
  const messages: HostawayMessage[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `https://api.hostaway.com/v1/conversations/${conversationId}/messages?limit=100&offset=${offset}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    const page = data.result || [];
    messages.push(...page);
    hasMore = page.length === 100;
    offset += 100;
  }

  return messages;
}

// ─── Chunking ──────────────────────────────────────────

function chunkIntoPairs(messages: HostawayMessage[], conversationId: number, propertyId?: string): Pair[] {
  const cutoff = Date.now() - SIX_MONTHS_MS;
  const pairs: Pair[] = [];

  const sorted = [...messages].sort(
    (a, b) => new Date(a.insertedOn).getTime() - new Date(b.insertedOn).getTime()
  );

  for (let i = 0; i < sorted.length - 1; i++) {
    const msg = sorted[i];
    const next = sorted[i + 1];

    if (msg.isIncoming === 1 && next.isIncoming === 0) {
      const msgDate = new Date(msg.insertedOn).getTime();
      if (msgDate < cutoff) continue;

      if (msg.body?.trim() && next.body?.trim()) {
        pairs.push({
          guestMessage: msg.body.trim(),
          hostResponse: next.body.trim(),
          propertyId,
          hostawayConversationId: String(conversationId),
          sourceDate: msg.insertedOn,
        });
      }
    }
  }

  return pairs;
}

// ─── Gemini Embedding ──────────────────────────────────

async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const chunk = texts.slice(i, i + MAX_BATCH_SIZE);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${GOOGLE_AI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        requests: chunk.map((text) => ({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          outputDimensionality: EMBEDDING_DIMENSIONS,
        })),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`[BULK_IMPORT] Gemini embedding error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    for (const emb of data.embeddings) {
      results.push(emb.values as number[]);
    }

    if (i + MAX_BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  return results;
}

// ─── Supabase Direct Insert ────────────────────────────

function messageHash(guest: string, host: string): string {
  return crypto.createHash('sha256').update(`${guest}|||${host}`).digest('hex').slice(0, 16);
}

async function insertBatch(pairs: Pair[], embeddings: number[][]): Promise<{ imported: number; skipped: number }> {
  const rows = pairs.map((pair, i) => ({
    org_id: FOUNDER_ORG_ID,
    property_id: pair.propertyId ?? null,
    guest_message: pair.guestMessage,
    host_response: pair.hostResponse,
    intent: null,
    origin_type: 'historical',
    hostaway_conversation_id: pair.hostawayConversationId,
    message_hash: messageHash(pair.guestMessage, pair.hostResponse),
    embedding: `[${embeddings[i].join(',')}]`,
    source_date: pair.sourceDate,
  }));

  // Use Supabase REST API with service role key
  const response = await fetch(`${SUPABASE_URL}/rest/v1/voice_examples`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[BULK_IMPORT] Supabase insert error: ${response.status} — ${errText}`);
    return { imported: 0, skipped: rows.length };
  }

  return { imported: rows.length, skipped: 0 };
}

// ─── Main ──────────────────────────────────────────────

async function main() {
  console.log('[BULK_IMPORT] Starting direct bulk import to Live...');
  console.log(`[BULK_IMPORT] Target org: ${FOUNDER_ORG_ID}`);

  // 1. Fetch conversations from Hostaway
  const token = await getAccessToken();
  console.log('[BULK_IMPORT] Got Hostaway access token');

  const conversations = await fetchAllConversations(token);
  console.log(`[BULK_IMPORT] Found ${conversations.length} total conversations`);

  // 2. Chunk into guest/host pairs
  const allPairs: Pair[] = [];

  for (let idx = 0; idx < conversations.length; idx++) {
    const conv = conversations[idx];
    const messages = await fetchMessages(token, conv.id);
    const pairs = chunkIntoPairs(
      messages,
      conv.id,
      conv.listingMapId ? String(conv.listingMapId) : undefined
    );
    allPairs.push(...pairs);

    if ((idx + 1) % 25 === 0) {
      console.log(`[BULK_IMPORT] Processed ${idx + 1}/${conversations.length} conversations, ${allPairs.length} pairs`);
    }

    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`[BULK_IMPORT] Total pairs: ${allPairs.length}`);

  if (allPairs.length === 0) {
    console.log('[BULK_IMPORT] No pairs found in last 6 months. Done.');
    return;
  }

  // 3. Embed + insert in batches of 50 (to keep Gemini batches manageable)
  const IMPORT_BATCH = 50;
  let totalImported = 0;
  let totalSkipped = 0;

  for (let i = 0; i < allPairs.length; i += IMPORT_BATCH) {
    const batch = allPairs.slice(i, i + IMPORT_BATCH);
    const guestTexts = batch.map((p) => p.guestMessage);

    try {
      const embeddings = await embedBatch(guestTexts);
      const result = await insertBatch(batch, embeddings);
      totalImported += result.imported;
      totalSkipped += result.skipped;
      console.log(
        `[BULK_IMPORT] Batch ${Math.floor(i / IMPORT_BATCH) + 1}/${Math.ceil(allPairs.length / IMPORT_BATCH)}: ${result.imported} imported, ${result.skipped} skipped`
      );
    } catch (err) {
      console.error(`[BULK_IMPORT] Batch ${Math.floor(i / IMPORT_BATCH) + 1} failed:`, err);
      totalSkipped += batch.length;
    }

    // Small delay between batches
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n[BULK_IMPORT] DONE. ${totalImported} imported, ${totalSkipped} skipped out of ${allPairs.length} total pairs.`);
}

main().catch((err) => {
  console.error('[BULK_IMPORT] Fatal error:', err);
  process.exit(1);
});
