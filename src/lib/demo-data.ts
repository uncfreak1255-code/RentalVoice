/**
 * Demo Data Provider — Apple Reviewer Demo Mode
 *
 * src/lib/demo-data.ts
 * Purpose: Deterministic canned data for Apple reviewer demo mode.
 *          Zero network calls. All conversations, reservations, and AI drafts
 *          come from this file. Simulates a real property experience.
 *
 * Property: "Sunset Beach House" at 123 Gulf Dr, Bradenton Beach, FL 34217
 * 3 conversations with pre-generated AI drafts at different confidence levels
 * 5 reservations for the next 2 weeks
 */

import type { Conversation, Message, Guest, Property, PropertyKnowledge } from './store';

// ============================================================
// Relative date helpers (deterministic from "now")
// ============================================================

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(15, 0, 0, 0); // default 3pm for check-in times
  return d;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(15, 0, 0, 0);
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

// ============================================================
// Demo Property
// ============================================================

export const DEMO_PROPERTY: Property = {
  id: 'demo-prop-sunset',
  name: 'Sunset Beach House',
  address: '123 Gulf Dr, Bradenton Beach, FL 34217',
};

export const DEMO_PROPERTY_KNOWLEDGE: PropertyKnowledge = {
  propertyId: 'demo-prop-sunset',
  propertyType: 'vacation_rental',
  wifiName: 'SunsetBeach_Guest',
  wifiPassword: 'beach2024!',
  parkingInfo: 'Two-car driveway. Street parking also available.',
  houseRules: 'No smoking indoors. Quiet hours 10pm-8am. Max 8 guests.',
  checkInInstructions: 'Keyless entry. Code will be sent the morning of check-in.',
  checkInTime: '3:00 PM',
  checkOutTime: '11:00 AM',
  checkOutInstructions: 'Please start dishwasher, take out trash, and lock up. Leave keys on counter.',
  localRecommendations: 'The Sandbar Restaurant (2 min walk), Gulf Drive Cafe for breakfast, Anna Maria Island beaches.',
  earlyCheckInAvailable: true,
  earlyCheckInFee: 50,
  lateCheckOutAvailable: true,
  lateCheckOutFee: 50,
  petsAllowed: false,
  tonePreference: 'friendly',
  emergencyContacts: 'Property Manager: (941) 555-0123',
  customNotes: 'Pool heater takes ~4 hours to warm up. Beach chairs and towels in garage.',
};

// ============================================================
// Demo Guests
// ============================================================

const guestSarah: Guest = {
  id: 'demo-guest-sarah',
  name: 'Sarah K.',
  email: 'sarah.k@example.com',
  language: 'en',
  previousStays: 0,
};

const guestMike: Guest = {
  id: 'demo-guest-mike',
  name: 'Mike R.',
  email: 'mike.r@example.com',
  language: 'en',
  previousStays: 1,
};

const guestJennifer: Guest = {
  id: 'demo-guest-jennifer',
  name: 'Jennifer L.',
  email: 'jennifer.l@example.com',
  language: 'en',
  previousStays: 0,
};

const guestDavid: Guest = {
  id: 'demo-guest-david',
  name: 'David M.',
  email: 'david.m@example.com',
  language: 'en',
  previousStays: 0,
};

const guestLisa: Guest = {
  id: 'demo-guest-lisa',
  name: 'Lisa P.',
  email: 'lisa.p@example.com',
  language: 'en',
  previousStays: 2,
};

// ============================================================
// Conversation 1: Sarah K. — Early check-in request (78% confidence)
// ============================================================

const sarahMessages: Message[] = [
  {
    id: 'demo-msg-sarah-1',
    conversationId: 'demo-conv-sarah',
    content: 'Hi there! We\'re flying in from Chicago and our flight lands at 11am. Any chance we could check in a bit early? So excited for the beach!',
    sender: 'guest',
    timestamp: minutesAgo(22),
    isRead: false,
    sentiment: 'positive',
    detectedIntent: 'early_checkin_request',
  },
  {
    id: 'demo-msg-sarah-draft',
    conversationId: 'demo-conv-sarah',
    content: 'Hey Sarah! \u{1F60A} Early check-in is usually around 1pm \u2014 I can check if the cleaners can get done sooner. What time were you thinking? Let me know! Best, Sawyer',
    sender: 'ai_draft',
    timestamp: minutesAgo(21),
    isRead: true,
    aiConfidence: 78,
    detectedIntent: 'early_checkin_response',
  },
];

// ============================================================
// Conversation 2: Mike R. — Late checkout request (82% confidence)
// ============================================================

const mikeMessages: Message[] = [
  {
    id: 'demo-msg-mike-1',
    conversationId: 'demo-conv-mike',
    content: 'Hey! Quick question about our checkout on Sunday. The kids are having so much fun at the pool \u2014 any chance we could stay a bit later than 11am?',
    sender: 'guest',
    timestamp: hoursAgo(2),
    isRead: false,
    sentiment: 'positive',
    detectedIntent: 'late_checkout_request',
  },
  {
    id: 'demo-msg-mike-draft',
    conversationId: 'demo-conv-mike',
    content: 'Hey Mike! Late checkout on Sunday should work \u2014 I don\'t have anyone checking in until the evening. How does 1pm sound? \u{1F3D6}\u{FE0F}',
    sender: 'ai_draft',
    timestamp: hoursAgo(2),
    isRead: true,
    aiConfidence: 82,
    detectedIntent: 'late_checkout_response',
  },
];

// ============================================================
// Conversation 3: Jennifer L. — Wifi not working (65% confidence)
// ============================================================

const jenniferMessages: Message[] = [
  {
    id: 'demo-msg-jennifer-1',
    conversationId: 'demo-conv-jennifer',
    content: 'Hi, the wifi doesn\'t seem to be working. We\'ve tried restarting our phones but nothing connects. My husband needs it for a work call in an hour. Can you help?',
    sender: 'guest',
    timestamp: minutesAgo(8),
    isRead: false,
    sentiment: 'negative',
    detectedIntent: 'maintenance_request',
  },
  {
    id: 'demo-msg-jennifer-draft',
    conversationId: 'demo-conv-jennifer',
    content: 'Hey Jennifer, sorry about the wifi! \u{1F62C} Try unplugging the router by the TV for 30 seconds then plugging it back in. That usually fixes it. If it\'s still down let me know and I\'ll send someone over.',
    sender: 'ai_draft',
    timestamp: minutesAgo(7),
    isRead: true,
    aiConfidence: 65,
    detectedIntent: 'maintenance_response',
  },
];

// ============================================================
// Demo Conversations
// ============================================================

export const demoConversations: Conversation[] = [
  // Sarah K. — checking in in 2 days
  {
    id: 'demo-conv-sarah',
    guest: guestSarah,
    property: DEMO_PROPERTY,
    messages: sarahMessages,
    lastMessage: sarahMessages[sarahMessages.length - 1],
    unreadCount: 1,
    status: 'active',
    workflowStatus: 'inbox',
    checkInDate: daysFromNow(2),
    checkOutDate: daysFromNow(5),
    numberOfGuests: 2,
    platform: 'airbnb',
    hasAiDraft: true,
    aiDraftContent: 'Hey Sarah! \u{1F60A} Early check-in is usually around 1pm \u2014 I can check if the cleaners can get done sooner. What time were you thinking? Let me know! Best, Sawyer',
    aiDraftConfidence: 78,
    lastActivityTimestamp: minutesAgo(22),
    lastActivityType: 'message_received',
  },
  // Mike R. — checking in in 5 days, currently 4 nights
  {
    id: 'demo-conv-mike',
    guest: guestMike,
    property: DEMO_PROPERTY,
    messages: mikeMessages,
    lastMessage: mikeMessages[mikeMessages.length - 1],
    unreadCount: 1,
    status: 'active',
    workflowStatus: 'inbox',
    checkInDate: daysFromNow(5),
    checkOutDate: daysFromNow(9),
    numberOfGuests: 6,
    platform: 'vrbo',
    hasAiDraft: true,
    aiDraftContent: 'Hey Mike! Late checkout on Sunday should work \u2014 I don\'t have anyone checking in until the evening. How does 1pm sound? \u{1F3D6}\u{FE0F}',
    aiDraftConfidence: 82,
    lastActivityTimestamp: hoursAgo(2),
    lastActivityType: 'message_received',
  },
  // Jennifer L. — currently staying, checkout tomorrow
  {
    id: 'demo-conv-jennifer',
    guest: guestJennifer,
    property: DEMO_PROPERTY,
    messages: jenniferMessages,
    lastMessage: jenniferMessages[jenniferMessages.length - 1],
    unreadCount: 1,
    status: 'urgent',
    workflowStatus: 'inbox',
    checkInDate: daysAgo(3),
    checkOutDate: daysFromNow(1),
    numberOfGuests: 2,
    platform: 'booking',
    hasAiDraft: true,
    aiDraftContent: 'Hey Jennifer, sorry about the wifi! \u{1F62C} Try unplugging the router by the TV for 30 seconds then plugging it back in. That usually fixes it. If it\'s still down let me know and I\'ll send someone over.',
    aiDraftConfidence: 65,
    lastActivityTimestamp: minutesAgo(8),
    lastActivityType: 'message_received',
  },
];

// ============================================================
// Demo Calendar / Reservation Data
// ============================================================

export interface DemoReservation {
  id: string;
  guestName: string;
  guestCount: number;
  startDate: Date;
  endDate: Date;
  nights: number;
  platform: 'airbnb' | 'booking' | 'vrbo' | 'direct';
  status: 'confirmed' | 'checked_in' | 'upcoming';
}

export function getDemoReservations(): DemoReservation[] {
  return [
    {
      id: 'demo-res-sarah',
      guestName: 'Sarah K.',
      guestCount: 2,
      startDate: daysFromNow(2),
      endDate: daysFromNow(5),
      nights: 3,
      platform: 'airbnb',
      status: 'upcoming',
    },
    {
      id: 'demo-res-mike',
      guestName: 'Mike R.',
      guestCount: 6, // 4 adults 2 kids
      startDate: daysFromNow(5),
      endDate: daysFromNow(9),
      nights: 4,
      platform: 'vrbo',
      status: 'upcoming',
    },
    {
      id: 'demo-res-jennifer',
      guestName: 'Jennifer L.',
      guestCount: 2,
      startDate: daysAgo(3),
      endDate: daysFromNow(1),
      nights: 4,
      platform: 'booking',
      status: 'checked_in',
    },
    {
      id: 'demo-res-david',
      guestName: 'David M.',
      guestCount: 2,
      startDate: daysFromNow(8),
      endDate: daysFromNow(15),
      nights: 7,
      platform: 'airbnb',
      status: 'upcoming',
    },
    {
      id: 'demo-res-lisa',
      guestName: 'Lisa P.',
      guestCount: 3,
      startDate: daysFromNow(12),
      endDate: daysFromNow(15),
      nights: 3,
      platform: 'direct',
      status: 'upcoming',
    },
  ];
}

// ============================================================
// Public API
// ============================================================

/**
 * Returns demo conversations with fresh Date objects.
 * Called each time demo mode activates to ensure timestamps are current.
 */
export function getDemoConversations(): Conversation[] {
  return demoConversations.map(conv => ({
    ...conv,
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

/**
 * Returns the demo property list (single property: Sunset Beach House).
 */
export function getDemoProperties(): Property[] {
  return [DEMO_PROPERTY];
}

/**
 * Returns demo property knowledge for the Sunset Beach House.
 */
export function getDemoPropertyKnowledge(): Record<string, PropertyKnowledge> {
  return { [DEMO_PROPERTY.id]: { ...DEMO_PROPERTY_KNOWLEDGE } };
}
