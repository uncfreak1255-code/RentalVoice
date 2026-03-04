/**
 * Automation Engine
 * Checks scheduled messages against reservation dates and sends them via Hostaway.
 * Integrates with InboxDashboard's existing 30s polling loop.
 * Supports undo delay window — messages queue for N seconds before actual send.
 */

import type { ScheduledMessage, Conversation, Property, PropertyKnowledge } from './store';
import { sendMessage as sendHostawayMessage } from './hostaway';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SENT_KEYS_STORAGE = 'automation_sent_keys';
const SENT_KEYS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const UNDO_DELAY_MS = 15_000; // 15-second undo window

interface AutomationContext {
  conversations: Conversation[];
  properties: Property[];
  scheduledMessages: ScheduledMessage[];
  accountId: string;
  apiKey: string;
  hostName?: string;
  propertyKnowledge?: Record<string, PropertyKnowledge>;
}

interface AutomationResult {
  messageId: string;
  conversationId: string;
  success: boolean;
  error?: string;
  sentAt: Date;
}

// Track which messages have already been sent so we don't double-send
// Now persisted to AsyncStorage and survives app restarts
const sentMessageKeys = new Map<string, number>(); // key → timestamp
let keysLoaded = false;

// --- Undo Delay Queue ---
export interface PendingMessage {
  key: string;
  scheduledName: string;
  conversationId: string;
  guestName: string;
  content: string;
  queuedAt: number;
  timerId: ReturnType<typeof setTimeout>;
}

const pendingMessages = new Map<string, PendingMessage>();

/** Get all currently pending (not yet sent) messages */
export function getPendingMessages(): PendingMessage[] {
  return Array.from(pendingMessages.values());
}

/** Number of messages waiting in the undo window */
export function getPendingMessageCount(): number {
  return pendingMessages.size;
}

/** Cancel a pending message before it sends. Returns true if cancelled. */
export function cancelPendingMessage(key: string): boolean {
  const pending = pendingMessages.get(key);
  if (!pending) return false;
  clearTimeout(pending.timerId);
  pendingMessages.delete(key);
  // Remove from sent tracking so that it can re-trigger later if still in window
  sentMessageKeys.delete(key);
  console.log(`[AutomationEngine] ✋ Cancelled pending message: ${pending.scheduledName} for conversation ${pending.conversationId}`);
  return true;
}

async function loadSentKeys(): Promise<void> {
  if (keysLoaded) return;
  try {
    const stored = await AsyncStorage.getItem(SENT_KEYS_STORAGE);
    if (stored) {
      const entries: [string, number][] = JSON.parse(stored);
      const now = Date.now();
      for (const [key, ts] of entries) {
        // Only restore keys less than 7 days old
        if (now - ts < SENT_KEYS_MAX_AGE_MS) {
          sentMessageKeys.set(key, ts);
        }
      }
    }
  } catch {
    // Silently continue — worst case we re-send, better than crashing
  }
  keysLoaded = true;
}

async function persistSentKeys(): Promise<void> {
  try {
    const entries = Array.from(sentMessageKeys.entries());
    await AsyncStorage.setItem(SENT_KEYS_STORAGE, JSON.stringify(entries));
  } catch {
    // Non-blocking — in-memory tracking still works as fallback
  }
}

function getMessageKey(scheduledId: string, conversationId: string): string {
  return `${scheduledId}:${conversationId}`;
}

function resolveTemplateVariables(
  template: string,
  conversation: Conversation,
  property: Property,
  hostName?: string,
  knowledge?: PropertyKnowledge
): string {
  const replacements: Record<string, string> = {
    '{{guest_name}}': conversation.guest.name || 'Guest',
    '{{property_name}}': property.name || 'our property',
    '{{host_name}}': hostName || 'Your Host',
    '{{checkin_time}}': knowledge?.checkInTime || '3:00 PM',
    '{{checkout_time}}': knowledge?.checkOutTime || '11:00 AM',
    '{{wifi_name}}': knowledge?.wifiName || '',
    '{{wifi_password}}': knowledge?.wifiPassword || '',
    '{{parking_info}}': knowledge?.parkingInfo || '',
    '{{checkout_instructions}}': knowledge?.checkOutInstructions || '',
  };

  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

function shouldTrigger(
  scheduled: ScheduledMessage,
  conversation: Conversation,
  now: Date
): boolean {
  const { triggerType, triggerHours } = scheduled;
  const offsetMs = triggerHours * 60 * 60 * 1000;

  let targetDate: Date | undefined;

  switch (triggerType) {
    case 'before_checkin':
      targetDate = conversation.checkInDate
        ? new Date(new Date(conversation.checkInDate).getTime() - offsetMs)
        : undefined;
      break;
    case 'after_checkin':
      targetDate = conversation.checkInDate
        ? new Date(new Date(conversation.checkInDate).getTime() + offsetMs)
        : undefined;
      break;
    case 'before_checkout':
      targetDate = conversation.checkOutDate
        ? new Date(new Date(conversation.checkOutDate).getTime() - offsetMs)
        : undefined;
      break;
    case 'after_checkout':
      targetDate = conversation.checkOutDate
        ? new Date(new Date(conversation.checkOutDate).getTime() + offsetMs)
        : undefined;
      break;
    default:
      return false;
  }

  if (!targetDate) return false;

  // Trigger if we're within a 30-minute window of the target time
  const diffMs = now.getTime() - targetDate.getTime();
  return diffMs >= 0 && diffMs <= 30 * 60 * 1000;
}

/**
 * Check all scheduled messages against current conversations.
 * Called during each sync cycle (every 30s from InboxDashboard).
 */
export async function checkAndSendScheduledMessages(
  context: AutomationContext
): Promise<AutomationResult[]> {
  const { conversations, properties, scheduledMessages, accountId, apiKey, hostName, propertyKnowledge } = context;
  const results: AutomationResult[] = [];
  const now = new Date();

  // Restore sent keys from storage on first run
  await loadSentKeys();

  const activeScheduled = scheduledMessages.filter((m) => m.isActive);
  if (activeScheduled.length === 0) return results;

  // Index active conversations by propertyId for O(1) lookup instead of O(n) filter per scheduled message
  const conversationsByProperty = new Map<string, typeof conversations>();
  for (const c of conversations) {
    if (c.status !== 'active') continue;
    const propId = c.property.id;
    if (!conversationsByProperty.has(propId)) {
      conversationsByProperty.set(propId, []);
    }
    conversationsByProperty.get(propId)!.push(c);
  }

  let keysChanged = false;

  for (const scheduled of activeScheduled) {
    // O(1) lookup via index
    const propertyConversations = conversationsByProperty.get(scheduled.propertyId) || [];
    const property = properties.find((p) => p.id === scheduled.propertyId);
    if (!property) continue;

    const knowledge = propertyKnowledge?.[property.id];

    for (const conversation of propertyConversations) {
      const key = getMessageKey(scheduled.id, conversation.id);
      if (sentMessageKeys.has(key)) continue;

      if (!shouldTrigger(scheduled, conversation, now)) continue;

      // Mark as sent immediately to prevent double-send
      sentMessageKeys.set(key, now.getTime());
      keysChanged = true;

      const content = resolveTemplateVariables(
        scheduled.template,
        conversation,
        property,
        hostName,
        knowledge
      );

      // Queue with undo delay instead of sending immediately
      const timerId = setTimeout(async () => {
        try {
          await sendHostawayMessage(accountId, apiKey, parseInt(conversation.id), content);
          console.log(
            `[AutomationEngine] ✅ Sent "${scheduled.name}" to conversation ${conversation.id}`
          );
        } catch (error) {
          // Remove from sent set so it retries next cycle
          sentMessageKeys.delete(key);
          persistSentKeys();
          console.error(
            `[AutomationEngine] ❌ Failed "${scheduled.name}" for conversation ${conversation.id}:`,
            error
          );
        } finally {
          pendingMessages.delete(key);
        }
      }, UNDO_DELAY_MS);

      pendingMessages.set(key, {
        key,
        scheduledName: scheduled.name,
        conversationId: conversation.id,
        guestName: conversation.guest.name || 'Guest',
        content,
        queuedAt: now.getTime(),
        timerId,
      });

      results.push({
        messageId: scheduled.id,
        conversationId: conversation.id,
        success: true,
        sentAt: now,
      });
      console.log(
        `[AutomationEngine] ⏳ Queued "${scheduled.name}" for conversation ${conversation.id} (${UNDO_DELAY_MS / 1000}s undo window)`
      );
    }
  }

  // Persist to storage if anything changed
  if (keysChanged) {
    await persistSentKeys();
  }

  return results;
}

/**
 * Clear sent message tracking (e.g., when user manually resets).
 */
export async function clearSentTracking(): Promise<void> {
  sentMessageKeys.clear();
  await AsyncStorage.removeItem(SENT_KEYS_STORAGE);
}
