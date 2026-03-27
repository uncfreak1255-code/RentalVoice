import { createHash } from 'crypto';
import { getSupabaseAdmin } from '../db/supabase.js';
import { embedBatch } from './embedding.js';

export type VoiceOriginType = 'historical' | 'host_written' | 'ai_approved' | 'ai_edited';

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

  return examples;
}

export async function importVoiceExamplesForOrg(
  orgId: string,
  examples: VoiceImportExample[]
): Promise<{ inserted: number; skipped: number; total: number }> {
  if (examples.length === 0) {
    return { inserted: 0, skipped: 0, total: 0 };
  }

  const guestMessages = examples.map((example) => example.guestMessage);
  const embeddings = await embedBatch(guestMessages);
  const supabase = getSupabaseAdmin();

  const rows = examples.map((example, index) => ({
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
    total: examples.length,
  };
}
