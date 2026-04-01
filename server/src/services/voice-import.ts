import { createHash } from 'crypto';
import { getSupabaseAdmin } from '../db/supabase.js';
import { embedBatch } from './embedding.js';

export type VoiceOriginType = 'historical' | 'host_written' | 'ai_approved' | 'ai_edited';

// ─── Quality Filtering ───────────────────────────────────

/** Phrases that indicate a system/admin guest message, not a real guest */
const SYSTEM_MESSAGE_MARKERS = [
  'system notification',
  'your booking is confirmed',
  'booking cancelled',
  'booking modified',
  'auto-reply',
  'auto reply',
  'do not reply',
  'do-not-reply',
  'noreply',
  'no-reply',
  'this is an automated',
  'reservation confirmed',
  'payment has been received',
  'payment processed',
];

/** Throwaway host responses that carry zero voice signal */
const THROWAWAY_RESPONSES = [
  'ok',
  'okay',
  'thanks',
  'thank you',
  'got it',
  'noted',
  'will do',
  'sure',
  'yes',
  'no',
  'done',
  'perfect',
  'great',
  'sounds good',
  'no problem',
  'np',
  'k',
  'yep',
  'yup',
  'nope',
  'cool',
  'roger',
  'copy',
  'understood',
  'ack',
  'ty',
  'thx',
];

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function isSystemOrAdminMessage(guestMessage: string): boolean {
  const lower = guestMessage.toLowerCase();
  return SYSTEM_MESSAGE_MARKERS.some((marker) => lower.includes(marker));
}

function isThrowawayResponse(hostResponse: string): boolean {
  // Strip punctuation and emoji for comparison
  const cleaned = hostResponse
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/[.,!?;:'"()\-\u2026]/g, '')
    .trim()
    .toLowerCase();
  return THROWAWAY_RESPONSES.includes(cleaned);
}

function isEmojiOnly(text: string): boolean {
  const stripped = text
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]/gu, '')
    .trim();
  return stripped.length === 0;
}

/**
 * Returns true if a guest->host pair is high enough quality to use as a voice example.
 *
 * Rejects:
 * - Host responses with fewer than 5 words (too short to learn voice from)
 * - Host responses that are throwaway phrases ("ok", "thanks", "got it", etc.)
 * - Host responses that are emoji-only
 * - Guest messages that look like system/admin notifications
 */
export function isQualityVoiceExample(guestMessage: string, hostResponse: string): boolean {
  // Reject empty inputs
  if (!guestMessage.trim() || !hostResponse.trim()) return false;

  // Reject system/admin guest messages
  if (isSystemOrAdminMessage(guestMessage)) return false;

  // Reject emoji-only host responses
  if (isEmojiOnly(hostResponse)) return false;

  // Reject throwaway host responses
  if (isThrowawayResponse(hostResponse)) return false;

  // Reject host responses under 5 words
  if (countWords(hostResponse) < 5) return false;

  return true;
}

/**
 * Filters a batch of examples, also removing duplicate host responses
 * (template detection -- same response used for multiple guest messages).
 */
export function filterQualityExamples(examples: VoiceImportExample[]): VoiceImportExample[] {
  // First pass: individual quality checks
  const qualityPassed = examples.filter((ex) =>
    isQualityVoiceExample(ex.guestMessage, ex.hostResponse)
  );

  // Second pass: detect duplicate/template host responses
  const responseCounts = new Map<string, number>();
  for (const ex of qualityPassed) {
    const normalized = ex.hostResponse.toLowerCase().trim();
    responseCounts.set(normalized, (responseCounts.get(normalized) ?? 0) + 1);
  }

  // Keep only responses that appear at most twice (allow one coincidence)
  return qualityPassed.filter((ex) => {
    const normalized = ex.hostResponse.toLowerCase().trim();
    return (responseCounts.get(normalized) ?? 0) <= 2;
  });
}

export interface HistoryConversationLike {
  id: number;
  listingMapId?: number | null;
}

export interface HistoryMessageLike {
  id: number;
  conversationId: number;
  body: string;
  isIncoming: boolean | number;
  insertedOn: string;
}

export interface VoiceImportExample {
  guestMessage: string;
  hostResponse: string;
  intent?: string | null;
  originType: VoiceOriginType;
  propertyId?: string | null;
  hostawayConversationId?: string | null;
  sourceDate?: string | null;
}

interface BuildVoiceExamplesOptions {
  cutoffDate?: Date | null;
}

export function buildVoiceMessageHash(guestMessage: string, hostResponse: string): string {
  return createHash('sha256')
    .update(`${guestMessage}|||${hostResponse}`)
    .digest('hex')
    .slice(0, 16);
}

function isGuestMessage(message: HistoryMessageLike): boolean {
  return message.isIncoming === true || message.isIncoming === 1;
}

function isHostMessage(message: HistoryMessageLike): boolean {
  return message.isIncoming === false || message.isIncoming === 0;
}

function isWithinCutoff(message: HistoryMessageLike, cutoffDate?: Date | null): boolean {
  if (!cutoffDate) return true;
  if (!message.insertedOn) return false;
  return new Date(message.insertedOn) >= cutoffDate;
}

export function buildVoiceExamplesFromHistory(
  conversations: HistoryConversationLike[],
  messagesByConversation: Record<number, HistoryMessageLike[]>,
  options: BuildVoiceExamplesOptions = {}
): VoiceImportExample[] {
  const examples: VoiceImportExample[] = [];

  for (const conversation of conversations) {
    const propertyId =
      conversation.listingMapId !== undefined && conversation.listingMapId !== null
        ? String(conversation.listingMapId)
        : null;

    const orderedMessages = (messagesByConversation[conversation.id] || [])
      .filter((message) => isWithinCutoff(message, options.cutoffDate))
      .sort(
        (left, right) =>
          new Date(left.insertedOn).getTime() - new Date(right.insertedOn).getTime()
      );

    for (let index = 0; index < orderedMessages.length - 1; index++) {
      const guestMessage = orderedMessages[index];
      const hostResponse = orderedMessages[index + 1];

      if (!isGuestMessage(guestMessage) || !isHostMessage(hostResponse)) continue;

      const guestBody = (guestMessage.body || '').trim();
      const hostBody = (hostResponse.body || '').trim();
      if (!guestBody || !hostBody) continue;

      // Quality gate: skip low-quality pairs before they enter the dataset
      if (!isQualityVoiceExample(guestBody, hostBody)) continue;

      examples.push({
        guestMessage: guestBody,
        hostResponse: hostBody,
        intent: null,
        originType: 'historical',
        propertyId,
        hostawayConversationId: String(conversation.id),
        sourceDate: guestMessage.insertedOn,
      });
    }
  }

  // Batch-level template detection: remove duplicate host responses (3+ occurrences)
  return filterQualityExamples(examples);
}

export async function importVoiceExamplesForOrg(
  orgId: string,
  examples: VoiceImportExample[]
): Promise<{ inserted: number; skipped: number; total: number }> {
  // Apply quality + template filtering before import
  const filtered = filterQualityExamples(examples);

  if (filtered.length === 0) {
    return { inserted: 0, skipped: 0, total: 0 };
  }

  const guestMessages = filtered.map((example) => example.guestMessage);
  const embeddings = await embedBatch(guestMessages);
  const supabase = getSupabaseAdmin();

  const rows = filtered.map((example, index) => ({
    org_id: orgId,
    property_id: example.propertyId ?? null,
    guest_message: example.guestMessage,
    host_response: example.hostResponse,
    intent: example.intent ?? null,
    origin_type: example.originType,
    hostaway_conversation_id: example.hostawayConversationId ?? null,
    message_hash: buildVoiceMessageHash(example.guestMessage, example.hostResponse),
    embedding: `[${embeddings[index].join(',')}]`,
    source_date: example.sourceDate ?? null,
  }));

  let inserted = 0;
  let skipped = 0;
  const BATCH_SIZE = 50;

  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const batch = rows.slice(index, index + BATCH_SIZE);
    const { error, data } = await supabase.from('voice_examples').insert(batch).select('id');

    if (error) {
      if (error.code === '23505') {
        for (const row of batch) {
          const { error: rowError } = await supabase.from('voice_examples').insert(row);
          if (rowError?.code === '23505') {
            skipped += 1;
          } else if (!rowError) {
            inserted += 1;
          }
        }
      } else {
        throw new Error(`VOICE_IMPORT_FAILED: ${error.message}`);
      }
    } else {
      inserted += data?.length ?? batch.length;
    }
  }

  return {
    inserted,
    skipped,
    total: filtered.length,
  };
}
