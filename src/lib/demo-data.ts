/**
 * Demo Data Provider
 *
 * 📁 src/lib/demo-data.ts
 * Purpose: Provides realistic sample data for demo/review mode.
 *          Activates when no PMS (Hostaway/Guesty/Lodgify) API key is configured.
 *          Ensures Apple reviewers can fully test the app without a real account.
 *
 * Used by: InboxDashboard, CalendarScreen, ChatScreen
 */

import type { Conversation, Message, Guest, Property } from './store';

// ============================================================
// Demo Properties
// ============================================================

const demoProperties: Property[] = [
  {
    id: 'demo-prop-1',
    name: 'Oceanfront Paradise Villa',
    address: '742 Gulf Shore Blvd, Siesta Key, FL 34242',
  },
  {
    id: 'demo-prop-2',
    name: 'Downtown Luxury Loft',
    address: '100 Central Ave, Sarasota, FL 34236',
  },
  {
    id: 'demo-prop-3',
    name: 'Lakeside Family Retreat',
    address: '55 Lake View Dr, Bradenton, FL 34209',
  },
];

// ============================================================
// Demo Guests
// ============================================================

const demoGuests: Guest[] = [
  {
    id: 'demo-guest-1',
    name: 'Sarah Mitchell',
    email: 'sarah.m@example.com',
    language: 'en',
    previousStays: 2,
  },
  {
    id: 'demo-guest-2',
    name: 'Carlos Rodriguez',
    email: 'carlos.r@example.com',
    language: 'es',
    detectedLanguage: 'es',
  },
  {
    id: 'demo-guest-3',
    name: 'Emma Thompson',
    email: 'emma.t@example.com',
    language: 'en',
    previousStays: 0,
  },
  {
    id: 'demo-guest-4',
    name: 'James Cooper',
    email: 'james.c@example.com',
    language: 'en',
    isVip: true,
    previousStays: 5,
  },
  {
    id: 'demo-guest-5',
    name: 'Yuki Tanaka',
    email: 'yuki.t@example.com',
    language: 'ja',
    detectedLanguage: 'ja',
  },
];

// ============================================================
// Demo Messages
// ============================================================

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursAgo(n: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d;
}

function minutesAgo(n: number): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// Conversation 1: Check-in question (common scenario)
const conv1Messages: Message[] = [
  {
    id: 'demo-msg-1-1',
    conversationId: 'demo-conv-1',
    content: 'Hi! We just landed in Sarasota. What time can we check in today? Also, will there be towels provided?',
    sender: 'guest',
    timestamp: minutesAgo(15),
    isRead: false,
    sentiment: 'positive',
    detectedIntent: 'check_in_question',
  },
  {
    id: 'demo-msg-1-2',
    conversationId: 'demo-conv-1',
    content: 'Welcome to Florida, Sarah! 🌴 Check-in is at 4:00 PM. The lockbox code is on the front door — I\'ll send it shortly. Yes, fresh towels and linens are provided! Let me know if you need anything else.',
    sender: 'ai_draft',
    timestamp: minutesAgo(14),
    isRead: true,
    aiConfidence: 92,
    detectedIntent: 'check_in_response',
  },
];

// Conversation 2: Maintenance issue (urgent)
const conv2Messages: Message[] = [
  {
    id: 'demo-msg-2-1',
    conversationId: 'demo-conv-2',
    content: 'Hola, el aire acondicionado no funciona y hace mucho calor. ¿Pueden enviarnos a alguien para arreglarlo?',
    sender: 'guest',
    timestamp: minutesAgo(30),
    isRead: false,
    sentiment: 'negative',
    language: 'es',
    translatedContent: 'Hello, the air conditioning is not working and it is very hot. Can you send someone to fix it?',
    detectedIntent: 'maintenance_request',
  },
  {
    id: 'demo-msg-2-2',
    conversationId: 'demo-conv-2',
    content: 'Hola Carlos, I\'m so sorry about the AC. First, try the thermostat reset — hold the power button for 10 seconds. If that doesn\'t work, I\'ll have our HVAC tech there within 2 hours. We also have portable fans in the closet if you need them.',
    sender: 'host',
    timestamp: minutesAgo(25),
    isRead: true,
    sentiment: 'neutral',
  },
  {
    id: 'demo-msg-2-3',
    conversationId: 'demo-conv-2',
    content: 'Gracias, el reset funcionó! El aire ya está funcionando perfectamente. 🙏',
    sender: 'guest',
    timestamp: minutesAgo(10),
    isRead: false,
    sentiment: 'positive',
    language: 'es',
    translatedContent: 'Thanks, the reset worked! The air is working perfectly now. 🙏',
  },
];

// Conversation 3: Pre-arrival excitement
const conv3Messages: Message[] = [
  {
    id: 'demo-msg-3-1',
    conversationId: 'demo-conv-3',
    content: 'We are SO excited for our trip! This is our first time visiting Sarasota. Any recommendations for restaurants near the beach? We have two kids (ages 5 and 8).',
    sender: 'guest',
    timestamp: hoursAgo(3),
    isRead: true,
    sentiment: 'positive',
    detectedIntent: 'local_recommendations',
  },
  {
    id: 'demo-msg-3-2',
    conversationId: 'demo-conv-3',
    content: 'How exciting! You\'ll love it here. For family-friendly beach dining, I recommend The Old Salty Dog on Siesta Key — great fish tacos and the kids can play on the beach. Also check out Big Olaf Creamery for the best ice cream on the island! For a special dinner, Sun Garden Cafe has amazing seafood.',
    sender: 'host',
    timestamp: hoursAgo(2),
    isRead: true,
    sentiment: 'positive',
  },
  {
    id: 'demo-msg-3-3',
    conversationId: 'demo-conv-3',
    content: 'Perfect, thank you! One more question — is there a pool at the property? The listing said heated pool but I just want to confirm.',
    sender: 'guest',
    timestamp: minutesAgo(45),
    isRead: false,
    sentiment: 'positive',
    detectedIntent: 'amenity_question',
  },
];

// Conversation 4: VIP returning guest checkout
const conv4Messages: Message[] = [
  {
    id: 'demo-msg-4-1',
    conversationId: 'demo-conv-4',
    content: 'Hey! Just checking out now. Everything was perfect as always. Already planning our next visit! Quick question — could we get a discount for booking directly next time?',
    sender: 'guest',
    timestamp: hoursAgo(1),
    isRead: true,
    sentiment: 'positive',
    detectedIntent: 'checkout_feedback',
  },
];

// Conversation 5: Late check-in request
const conv5Messages: Message[] = [
  {
    id: 'demo-msg-5-1',
    conversationId: 'demo-conv-5',
    content: 'すみません、フライトが遅れて到着は夜11時頃になりそうです。遅いチェックインは可能でしょうか？',
    sender: 'guest',
    timestamp: minutesAgo(5),
    isRead: false,
    sentiment: 'neutral',
    language: 'ja',
    translatedContent: 'Excuse me, my flight is delayed and I will probably arrive around 11 PM. Is a late check-in possible?',
    detectedIntent: 'late_checkin_request',
  },
];

// ============================================================
// Demo Conversations
// ============================================================

export const demoConversations: Conversation[] = [
  {
    id: 'demo-conv-1',
    guest: demoGuests[0],
    property: demoProperties[0],
    messages: conv1Messages,
    lastMessage: conv1Messages[conv1Messages.length - 1],
    unreadCount: 1,
    status: 'active',
    workflowStatus: 'inbox',
    checkInDate: new Date(),
    checkOutDate: daysFromNow(5),
    numberOfGuests: 4,
    platform: 'airbnb',
    hasAiDraft: true,
    aiDraftContent: 'Welcome to Florida, Sarah! 🌴 Check-in is at 4:00 PM. The lockbox code is on the front door — I\'ll send it shortly. Yes, fresh towels and linens are provided! Let me know if you need anything else.',
    aiDraftConfidence: 92,
    lastActivityTimestamp: minutesAgo(15),
    lastActivityType: 'message_received',
  },
  {
    id: 'demo-conv-2',
    guest: demoGuests[1],
    property: demoProperties[0],
    messages: conv2Messages,
    lastMessage: conv2Messages[conv2Messages.length - 1],
    unreadCount: 1,
    status: 'urgent',
    workflowStatus: 'resolved',
    checkInDate: daysAgo(2),
    checkOutDate: daysFromNow(3),
    numberOfGuests: 2,
    platform: 'booking',
    hasAiDraft: false,
    lastActivityTimestamp: minutesAgo(10),
    lastActivityType: 'message_received',
  },
  {
    id: 'demo-conv-3',
    guest: demoGuests[2],
    property: demoProperties[2],
    messages: conv3Messages,
    lastMessage: conv3Messages[conv3Messages.length - 1],
    unreadCount: 1,
    status: 'active',
    workflowStatus: 'inbox',
    checkInDate: daysFromNow(3),
    checkOutDate: daysFromNow(10),
    numberOfGuests: 4,
    platform: 'vrbo',
    hasAiDraft: true,
    aiDraftContent: 'Yes! The pool is heated to a comfortable 84°F year-round. It\'s right in the backyard with a safety fence around it — perfect for the kids. There are also pool towels in the outdoor storage bench. You\'re going to love it!',
    aiDraftConfidence: 88,
    lastActivityTimestamp: minutesAgo(45),
    lastActivityType: 'message_received',
  },
  {
    id: 'demo-conv-4',
    guest: demoGuests[3],
    property: demoProperties[1],
    messages: conv4Messages,
    lastMessage: conv4Messages[conv4Messages.length - 1],
    unreadCount: 0,
    status: 'active',
    workflowStatus: 'follow_up',
    checkInDate: daysAgo(7),
    checkOutDate: new Date(),
    numberOfGuests: 2,
    platform: 'direct',
    hasAiDraft: true,
    aiDraftContent: 'Thank you so much, James! It\'s always a pleasure hosting you. Absolutely — as a returning guest, I can offer you 15% off your next direct booking. Just reach out when you\'re ready to plan your next trip! Safe travels home. 🏖️',
    aiDraftConfidence: 95,
    lastActivityTimestamp: hoursAgo(1),
    lastActivityType: 'message_received',
  },
  {
    id: 'demo-conv-5',
    guest: demoGuests[4],
    property: demoProperties[0],
    messages: conv5Messages,
    lastMessage: conv5Messages[conv5Messages.length - 1],
    unreadCount: 1,
    status: 'active',
    workflowStatus: 'inbox',
    checkInDate: new Date(),
    checkOutDate: daysFromNow(4),
    numberOfGuests: 1,
    platform: 'airbnb',
    hasAiDraft: true,
    aiDraftContent: 'No problem at all, Yuki! Late check-in is perfectly fine — our property uses keyless entry so you can arrive anytime. I\'ll send you the door code shortly. Welcome and safe travels! 🗝️',
    aiDraftConfidence: 90,
    lastActivityTimestamp: minutesAgo(5),
    lastActivityType: 'message_received',
  },
];

// ============================================================
// Demo Calendar Data
// ============================================================

export interface DemoCalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  propertyId: string;
  propertyName: string;
  guestName: string;
  platform: 'airbnb' | 'booking' | 'vrbo' | 'direct';
  status: 'confirmed' | 'pending' | 'checkout_today' | 'checkin_today';
}

export const demoCalendarEvents: DemoCalendarEvent[] = [
  {
    id: 'demo-cal-1',
    title: 'Sarah Mitchell',
    startDate: new Date(),
    endDate: daysFromNow(5),
    propertyId: 'demo-prop-1',
    propertyName: 'Oceanfront Paradise Villa',
    guestName: 'Sarah Mitchell',
    platform: 'airbnb',
    status: 'checkin_today',
  },
  {
    id: 'demo-cal-2',
    title: 'Carlos Rodriguez',
    startDate: daysAgo(2),
    endDate: daysFromNow(3),
    propertyId: 'demo-prop-1',
    propertyName: 'Oceanfront Paradise Villa',
    guestName: 'Carlos Rodriguez',
    platform: 'booking',
    status: 'confirmed',
  },
  {
    id: 'demo-cal-3',
    title: 'Emma Thompson',
    startDate: daysFromNow(3),
    endDate: daysFromNow(10),
    propertyId: 'demo-prop-3',
    propertyName: 'Lakeside Family Retreat',
    guestName: 'Emma Thompson',
    platform: 'vrbo',
    status: 'confirmed',
  },
  {
    id: 'demo-cal-4',
    title: 'James Cooper',
    startDate: daysAgo(7),
    endDate: new Date(),
    propertyId: 'demo-prop-2',
    propertyName: 'Downtown Luxury Loft',
    guestName: 'James Cooper',
    platform: 'direct',
    status: 'checkout_today',
  },
  {
    id: 'demo-cal-5',
    title: 'Yuki Tanaka',
    startDate: new Date(),
    endDate: daysFromNow(4),
    propertyId: 'demo-prop-1',
    propertyName: 'Oceanfront Paradise Villa',
    guestName: 'Yuki Tanaka',
    platform: 'airbnb',
    status: 'checkin_today',
  },
  // Future bookings
  {
    id: 'demo-cal-6',
    title: 'Michael & Lisa Chen',
    startDate: daysFromNow(12),
    endDate: daysFromNow(19),
    propertyId: 'demo-prop-2',
    propertyName: 'Downtown Luxury Loft',
    guestName: 'Michael Chen',
    platform: 'airbnb',
    status: 'confirmed',
  },
  {
    id: 'demo-cal-7',
    title: 'Anna Petrov',
    startDate: daysFromNow(15),
    endDate: daysFromNow(22),
    propertyId: 'demo-prop-3',
    propertyName: 'Lakeside Family Retreat',
    guestName: 'Anna Petrov',
    platform: 'booking',
    status: 'pending',
  },
];

// ============================================================
// Demo Mode Detection
// ============================================================

/**
 * Returns true when no PMS API key is configured.
 * In this state, the app uses demo data for Apple review / first-time exploration.
 */
export function isDemoMode(apiKey: string | null | undefined): boolean {
  return !apiKey || apiKey.trim() === '';
}

/**
 * Loads demo conversations into the store.
 */
export function getDemoConversations(): Conversation[] {
  return demoConversations.map(conv => ({
    ...conv,
    // Ensure dates are fresh Date objects (not stale from module load)
    messages: conv.messages.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp),
    })),
    lastMessage: conv.lastMessage ? {
      ...conv.lastMessage,
      timestamp: new Date(conv.lastMessage.timestamp),
    } : undefined,
    checkInDate: conv.checkInDate ? new Date(conv.checkInDate) : undefined,
    checkOutDate: conv.checkOutDate ? new Date(conv.checkOutDate) : undefined,
    lastActivityTimestamp: conv.lastActivityTimestamp ? new Date(conv.lastActivityTimestamp) : undefined,
  }));
}
