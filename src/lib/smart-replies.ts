/**
 * Smart Replies — Generates contextual quick-reply options
 * Based on detected intent + property knowledge + quick reply templates.
 *
 * These appear as small pill buttons in the chat screen,
 * giving hosts one-tap response options.
 */

import { GuestIntent, detectIntent } from './intent-detection';
import type { PropertyKnowledge } from './store';

export interface SmartReply {
  id: string;
  label: string;
  icon: string;
  /** The pre-filled reply content, or instructions for AI to generate a specific type */
  content: string;
  /** If true, content is a direct message. If false, content is a prompt modifier for AI. */
  isDirect: boolean;
}

// ─── Reply Templates by Intent ────────────────────────────────────────

type ReplyGenerator = (knowledge?: PropertyKnowledge) => SmartReply[];

const INTENT_REPLIES: Record<GuestIntent, ReplyGenerator> = {
  check_in: (knowledge) => {
    const replies: SmartReply[] = [];

    // Check-in instructions from property knowledge
    if (knowledge?.checkInInstructions) {
      replies.push({
        id: 'checkin_instructions',
        label: 'Send check-in info',
        icon: '📍',
        content: knowledge.checkInInstructions,
        isDirect: true,
      });
    } else {
      replies.push({
        id: 'checkin_instructions',
        label: 'Send check-in info',
        icon: '📍',
        content: 'Generate a friendly check-in instructions message including arrival time, access code, and parking details',
        isDirect: false,
      });
    }

    // WiFi from knowledge
    if (knowledge?.wifiName && knowledge?.wifiPassword) {
      replies.push({
        id: 'wifi_info',
        label: 'Send WiFi',
        icon: '📶',
        content: `Here's the WiFi info:\nNetwork: ${knowledge.wifiName}\nPassword: ${knowledge.wifiPassword}`,
        isDirect: true,
      });
    }

    replies.push({
      id: 'custom_checkin',
      label: 'Custom reply',
      icon: '✏️',
      content: '',
      isDirect: false,
    });

    return replies.slice(0, 3);
  },

  check_out: (knowledge) => {
    const replies: SmartReply[] = [];

    if (knowledge?.checkOutInstructions) {
      replies.push({
        id: 'checkout_instructions',
        label: 'Send check-out info',
        icon: '🏠',
        content: knowledge.checkOutInstructions,
        isDirect: true,
      });
    } else {
      replies.push({
        id: 'checkout_instructions',
        label: 'Check-out details',
        icon: '🏠',
        content: 'Generate a friendly check-out reminder with checkout time and any departure instructions',
        isDirect: false,
      });
    }

    replies.push({
      id: 'thank_stay',
      label: 'Thank & review',
      icon: '⭐',
      content: 'Generate a warm thank-you message and politely ask them to leave a review',
      isDirect: false,
    });

    return replies.slice(0, 3);
  },

  question: (knowledge) => {
    const replies: SmartReply[] = [];

    // WiFi is the most common question
    if (knowledge?.wifiName && knowledge?.wifiPassword) {
      replies.push({
        id: 'wifi_info',
        label: 'Send WiFi',
        icon: '📶',
        content: `Here's the WiFi info:\nNetwork: ${knowledge.wifiName}\nPassword: ${knowledge.wifiPassword}`,
        isDirect: true,
      });
    }

    if ((knowledge as any)?.parkingInstructions) {
      replies.push({
        id: 'parking_info',
        label: 'Parking details',
        icon: '🅿️',
        content: (knowledge as any).parkingInstructions,
        isDirect: true,
      });
    }

    replies.push({
      id: 'answer_question',
      label: 'Answer question',
      icon: '💬',
      content: 'Generate a helpful answer to the guest\'s question using property knowledge',
      isDirect: false,
    });

    return replies.slice(0, 3);
  },

  complaint: () => [
    {
      id: 'apologize',
      label: 'Apologize',
      icon: '😔',
      content: 'Generate an empathetic apology acknowledging the issue and promising to look into it',
      isDirect: false,
    },
    {
      id: 'investigate',
      label: 'Investigate',
      icon: '🔍',
      content: 'Generate a professional response asking for more details about the issue so you can resolve it',
      isDirect: false,
    },
  ],

  booking_inquiry: () => [
    {
      id: 'availability',
      label: 'Check availability',
      icon: '📅',
      content: 'Generate a response about availability, encouraging them to book through the platform',
      isDirect: false,
    },
    {
      id: 'property_info',
      label: 'Property info',
      icon: '🏡',
      content: 'Generate a response highlighting the property\'s best features and amenities',
      isDirect: false,
    },
  ],

  thanks: () => [
    {
      id: 'youre_welcome',
      label: 'You\'re welcome',
      icon: '😊',
      content: 'You\'re welcome! Let us know if you need anything else. Enjoy your stay! 🏖️',
      isDirect: true,
    },
    {
      id: 'ask_review',
      label: 'Ask for review',
      icon: '⭐',
      content: 'Generate a natural thank-you that subtly asks them to leave a review if they enjoyed their stay',
      isDirect: false,
    },
  ],

  emergency: () => [
    {
      id: 'emergency_response',
      label: 'Call 911 first',
      icon: '🚨',
      content: 'If this is an emergency, please call 911 immediately. I\'m reaching out to you right now and will help however I can.',
      isDirect: true,
    },
  ],

  general: () => [
    {
      id: 'friendly_reply',
      label: 'Friendly reply',
      icon: '👋',
      content: 'Generate a warm, friendly response',
      isDirect: false,
    },
    {
      id: 'custom',
      label: 'Custom reply',
      icon: '✏️',
      content: '',
      isDirect: false,
    },
  ],
};

/**
 * Generate smart reply options based on the last guest message.
 */
export function generateSmartReplies(
  guestMessage: string,
  propertyKnowledge?: PropertyKnowledge
): SmartReply[] {
  const { intent } = detectIntent(guestMessage);
  const generator = INTENT_REPLIES[intent];
  return generator(propertyKnowledge);
}
