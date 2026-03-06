import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from '../db/supabase.js';
import { decrypt } from '../lib/encryption.js';

type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
type JobPhase = 'idle' | 'conversations' | 'messages' | 'analyzing' | 'complete' | 'error';

interface HostawayConnectionRow {
  id: string;
  account_id: string;
  encrypted_credentials: string;
  oauth_token: string | null;
  token_expires_at: string | null;
  status: string;
}

export interface HostawayHistorySyncJobRecord {
  id: string;
  org_id: string;
  requested_by: string;
  status: JobStatus;
  phase: JobPhase;
  date_range_months: number;
  processed_conversations: number;
  total_conversations: number;
  processed_messages: number;
  total_messages: number;
  last_error: string | null;
  payload_json: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface HostawayConversation {
  id: number;
  listingMapId: number;
  reservationId?: number;
  guestName?: string;
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string;
  guestPhone?: string;
  guestPicture?: string;
  channelId?: number;
  channelName?: string;
  arrivalDate?: string;
  departureDate?: string;
  isArchived?: boolean;
  isRead?: boolean;
  lastMessage?: string;
  lastMessageSentAt?: string;
  listingName?: string;
  source?: string;
  guest?: {
    id?: number;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    picture?: string;
  };
  reservation?: {
    id?: number;
    guestName?: string;
    guestFirstName?: string;
    guestLastName?: string;
    guestEmail?: string;
    guestPhone?: string;
  };
  [key: string]: unknown;
}

interface HostawayMessage {
  id: number;
  conversationId: number;
  body: string;
  isIncoming: boolean;
  status: string;
  insertedOn: string;
  sentOn?: string;
  senderName?: string;
  [key: string]: unknown;
}

const HOSTAWAY_API_BASE = 'https://api.hostaway.com/v1';
const CONVERSATION_PAGE_SIZE = 100;
const MESSAGE_PAGE_SIZE = 100;
const STALE_JOB_MS = 15 * 60 * 1000;

const runningJobs = new Map<string, AbortController>();

function extractHostawayApiKey(encryptedCredentials: string): string {
  const decrypted = decrypt(encryptedCredentials);
  try {
    const parsed = JSON.parse(decrypted) as { apiKey?: string };
    if (parsed.apiKey) return parsed.apiKey;
  } catch {
    // Backward compatibility for legacy raw key storage.
  }
  return decrypted;
}

async function getActiveHostawayConnection(orgId: string): Promise<HostawayConnectionRow | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('pms_connections')
    .select('id, account_id, encrypted_credentials, oauth_token, token_expires_at, status')
    .eq('org_id', orgId)
    .eq('provider', 'hostaway')
    .single();

  if (!data || data.status !== 'active') return null;
  return data as HostawayConnectionRow;
}

async function ensureHostawayAccessToken(connection: HostawayConnectionRow): Promise<string> {
  const supabase = getSupabaseAdmin();
  const tokenExpired = connection.token_expires_at
    ? new Date(connection.token_expires_at) < new Date()
    : true;

  if (connection.oauth_token && !tokenExpired) {
    return connection.oauth_token;
  }

  const apiKey = extractHostawayApiKey(connection.encrypted_credentials);
  const tokenResponse = await fetch('https://api.hostaway.com/v1/accessTokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: connection.account_id,
      client_secret: apiKey,
      scope: 'general',
    }),
  });

  if (!tokenResponse.ok) {
    await supabase.from('pms_connections').update({ status: 'error' }).eq('id', connection.id);
    throw new Error('TOKEN_REFRESH_FAILED');
  }

  const tokenData = await tokenResponse.json() as { access_token: string; expires_in?: number };
  const tokenExpiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  await supabase
    .from('pms_connections')
    .update({
      oauth_token: tokenData.access_token,
      token_expires_at: tokenExpiresAt,
      status: 'active',
    })
    .eq('id', connection.id);

  connection.oauth_token = tokenData.access_token;
  connection.token_expires_at = tokenExpiresAt;
  return tokenData.access_token;
}

function filterByDateRange(conversations: HostawayConversation[], dateRangeMonths: number): HostawayConversation[] {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - dateRangeMonths);

  return conversations.filter((conversation) => {
    const lastMessageDate = conversation.lastMessageSentAt ? new Date(conversation.lastMessageSentAt) : null;
    const arrivalDate = conversation.arrivalDate ? new Date(conversation.arrivalDate) : null;
    const candidate = lastMessageDate || arrivalDate;
    return candidate ? candidate >= cutoffDate : true;
  });
}

async function updateJob(jobId: string, patch: Record<string, unknown>): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from('hostaway_history_sync_jobs')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}

async function fetchHostawayJson<T>(
  connection: HostawayConnectionRow,
  path: string,
  signal: AbortSignal
): Promise<T> {
  const accessToken = await ensureHostawayAccessToken(connection);
  const response = await fetch(`${HOSTAWAY_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HOSTAWAY_${response.status}: ${error}`);
  }

  const data = await response.json() as { result?: T };
  return (data.result || []) as T;
}

async function runHistorySyncJob(jobId: string, orgId: string, dateRangeMonths: number): Promise<void> {
  const controller = runningJobs.get(jobId);
  if (!controller) return;

  try {
    const connection = await getActiveHostawayConnection(orgId);
    if (!connection) throw new Error('NOT_CONNECTED');

    await updateJob(jobId, {
      status: 'running',
      phase: 'conversations',
      started_at: new Date().toISOString(),
      last_error: null,
    });

    const conversations: HostawayConversation[] = [];
    let offset = 0;
    let hasMore = true;
    let firstPage = true;

    while (hasMore) {
      if (controller.signal.aborted) throw new Error('SYNC_CANCELLED');

      const page = await fetchHostawayJson<HostawayConversation[]>(
        connection,
        `/conversations?limit=${CONVERSATION_PAGE_SIZE}&offset=${offset}&includeResources=1`,
        controller.signal
      );
      const filtered = filterByDateRange(page || [], dateRangeMonths);
      conversations.push(...filtered);

      const totalEstimate = page.length === CONVERSATION_PAGE_SIZE
        ? Math.max(
            conversations.length + CONVERSATION_PAGE_SIZE,
            firstPage ? CONVERSATION_PAGE_SIZE * 2 : conversations.length
          )
        : conversations.length;

      await updateJob(jobId, {
        phase: 'conversations',
        processed_conversations: conversations.length,
        total_conversations: totalEstimate,
      });

      hasMore = page.length === CONVERSATION_PAGE_SIZE;
      offset += CONVERSATION_PAGE_SIZE;
      firstPage = false;
    }

    const messages: Record<number, HostawayMessage[]> = {};
    let processedMessages = 0;

    await updateJob(jobId, {
      phase: 'messages',
      total_conversations: conversations.length,
      total_messages: conversations.length * 10,
    });

    for (let index = 0; index < conversations.length; index++) {
      if (controller.signal.aborted) throw new Error('SYNC_CANCELLED');

      const conversation = conversations[index];
      const conversationMessages: HostawayMessage[] = [];
      let messageOffset = 0;
      let hasMoreMessages = true;

      while (hasMoreMessages) {
        if (controller.signal.aborted) throw new Error('SYNC_CANCELLED');

        const page = await fetchHostawayJson<HostawayMessage[]>(
          connection,
          `/conversations/${conversation.id}/messages?limit=${MESSAGE_PAGE_SIZE}&offset=${messageOffset}&includeScheduledMessages=1`,
          controller.signal
        );

        conversationMessages.push(...(page || []));
        hasMoreMessages = page.length === MESSAGE_PAGE_SIZE;
        messageOffset += MESSAGE_PAGE_SIZE;
      }

      messages[conversation.id] = conversationMessages;
      processedMessages += conversationMessages.length;

      await updateJob(jobId, {
        phase: 'messages',
        processed_conversations: index + 1,
        total_conversations: conversations.length,
        processed_messages: processedMessages,
        total_messages: Math.max(processedMessages, conversations.length * 10),
      });
    }

    await updateJob(jobId, {
      status: 'completed',
      phase: 'complete',
      processed_conversations: conversations.length,
      total_conversations: conversations.length,
      processed_messages: processedMessages,
      total_messages: processedMessages,
      payload_json: {
        conversations,
        messages,
      },
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown history sync error';
    const cancelled = message === 'SYNC_CANCELLED';

    await updateJob(jobId, {
      status: cancelled ? 'cancelled' : 'failed',
      phase: cancelled ? 'idle' : 'error',
      last_error: cancelled ? null : message,
      completed_at: new Date().toISOString(),
    });
  } finally {
    runningJobs.delete(jobId);
  }
}

export function isHostawayHistorySyncRunning(jobId: string): boolean {
  return runningJobs.has(jobId);
}

export async function getLatestHostawayHistorySyncJob(orgId: string): Promise<HostawayHistorySyncJobRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('hostaway_history_sync_jobs')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as HostawayHistorySyncJobRecord | null) || null;
}

export async function markLatestHostawayHistorySyncJobStaleIfNeeded(orgId: string): Promise<HostawayHistorySyncJobRecord | null> {
  const latest = await getLatestHostawayHistorySyncJob(orgId);
  if (!latest) return null;

  const isStale = (latest.status === 'queued' || latest.status === 'running')
    && !isHostawayHistorySyncRunning(latest.id)
    && Date.now() - new Date(latest.updated_at).getTime() > STALE_JOB_MS;

  if (!isStale) return latest;

  await updateJob(latest.id, {
    status: 'failed',
    phase: 'error',
    last_error: 'Background sync worker stopped. Please restart the sync.',
    completed_at: new Date().toISOString(),
  });

  return getLatestHostawayHistorySyncJob(orgId);
}

export async function startHostawayHistorySyncJob(
  orgId: string,
  userId: string,
  dateRangeMonths: number
): Promise<HostawayHistorySyncJobRecord> {
  const latest = await markLatestHostawayHistorySyncJobStaleIfNeeded(orgId);
  if (latest && (latest.status === 'queued' || latest.status === 'running')) {
    return latest;
  }

  const supabase = getSupabaseAdmin();
  const jobId = `rv_hostaway_history_${randomUUID()}`;
  const now = new Date().toISOString();

  const insertPayload: HostawayHistorySyncJobRecord = {
    id: jobId,
    org_id: orgId,
    requested_by: userId,
    status: 'queued',
    phase: 'idle',
    date_range_months: dateRangeMonths,
    processed_conversations: 0,
    total_conversations: 0,
    processed_messages: 0,
    total_messages: 0,
    last_error: null,
    payload_json: {},
    started_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('hostaway_history_sync_jobs')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`FAILED_TO_CREATE_HISTORY_SYNC_JOB: ${error?.message || 'unknown'}`);
  }

  runningJobs.set(jobId, new AbortController());
  void runHistorySyncJob(jobId, orgId, dateRangeMonths);

  return data as HostawayHistorySyncJobRecord;
}

export async function clearHostawayHistorySyncJobs(orgId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: activeJobs } = await supabase
    .from('hostaway_history_sync_jobs')
    .select('id')
    .eq('org_id', orgId)
    .in('status', ['queued', 'running']);

  for (const job of activeJobs || []) {
    const controller = runningJobs.get(job.id);
    if (controller) {
      controller.abort();
      runningJobs.delete(job.id);
    }
  }

  await supabase
    .from('hostaway_history_sync_jobs')
    .delete()
    .eq('org_id', orgId);
}
