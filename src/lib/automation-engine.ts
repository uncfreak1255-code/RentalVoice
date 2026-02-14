/**
 * Automation Engine
 * Checks scheduled messages against reservation dates and sends them via Hostaway.
 * Integrates with InboxDashboard's existing 30s polling loop.
 */

import type { ScheduledMessage, Conversation, Property } from './store';
import { sendMessage as sendHostawayMessage } from './hostaway';

interface AutomationContext {
  conversations: Conversation[];
  properties: Property[];
  scheduledMessages: ScheduledMessage[];
  accountId: string;
  apiKey: string;
  hostName?: string;
}

interface AutomationResult {
  messageId: string;
  conversationId: string;
  success: boolean;
  error?: string;
  sentAt: Date;
}

// Track which messages have already been sent so we don't double-send
const sentMessageKeys = new Set<string>();

function getMessageKey(scheduledId: string, conversationId: string): string {
  return `${scheduledId}:${conversationId}`;
}

function resolveTemplateVariables(
  template: string,
  conversation: Conversation,
  property: Property,
  hostName?: string
): string {
  const replacements: Record<string, string> = {
    '{{guest_name}}': conversation.guest.name || 'Guest',
    '{{property_name}}': property.name || 'our property',
    '{{host_name}}': hostName || 'Your Host',
    '{{checkin_time}}': '3:00 PM',
    '{{checkout_time}}': '11:00 AM',
    '{{wifi_name}}': '',
    '{{wifi_password}}': '',
    '{{parking_info}}': '',
    '{{checkout_instructions}}': '',
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
  const { conversations, properties, scheduledMessages, accountId, apiKey, hostName } = context;
  const results: AutomationResult[] = [];
  const now = new Date();

  const activeScheduled = scheduledMessages.filter((m) => m.isActive);
  if (activeScheduled.length === 0) return results;

  for (const scheduled of activeScheduled) {
    // Only check conversations for the specified property
    const propertyConversations = conversations.filter(
      (c) => c.property.id === scheduled.propertyId && c.status === 'active'
    );
    const property = properties.find((p) => p.id === scheduled.propertyId);
    if (!property) continue;

    for (const conversation of propertyConversations) {
      const key = getMessageKey(scheduled.id, conversation.id);
      if (sentMessageKeys.has(key)) continue;

      if (!shouldTrigger(scheduled, conversation, now)) continue;

      // Mark as sent immediately to prevent double-send
      sentMessageKeys.add(key);

      const content = resolveTemplateVariables(
        scheduled.template,
        conversation,
        property,
        hostName
      );

      try {
        await sendHostawayMessage(accountId, apiKey, parseInt(conversation.id), content);
        results.push({
          messageId: scheduled.id,
          conversationId: conversation.id,
          success: true,
          sentAt: now,
        });
        console.log(
          `[AutomationEngine] Sent "${scheduled.name}" to conversation ${conversation.id}`
        );
      } catch (error) {
        // Remove from sent set so it retries next cycle
        sentMessageKeys.delete(key);
        results.push({
          messageId: scheduled.id,
          conversationId: conversation.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          sentAt: now,
        });
        console.error(
          `[AutomationEngine] Failed "${scheduled.name}" for conversation ${conversation.id}:`,
          error
        );
      }
    }
  }

  return results;
}

/**
 * Clear sent message tracking (e.g., when user manually resets).
 */
export function clearSentTracking(): void {
  sentMessageKeys.clear();
}
