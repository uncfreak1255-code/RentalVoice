import type { Conversation, Property, Guest, Message } from './store';

// Demo properties
export const demoProperties: Property[] = [
  {
    id: 'prop-1',
    name: 'Oceanview Villa',
    address: '123 Coastal Highway, Malibu, CA',
    image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=400',
  },
  {
    id: 'prop-2',
    name: 'Downtown Loft',
    address: '456 Main Street, Austin, TX',
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400',
  },
  {
    id: 'prop-3',
    name: 'Mountain Retreat',
    address: '789 Alpine Road, Aspen, CO',
    image: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=400',
  },
];

// Demo guests
const demoGuests: Guest[] = [
  {
    id: 'guest-1',
    name: 'Sarah Johnson',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
    email: 'sarah.j@email.com',
    phone: '+1 (555) 123-4567',
  },
  {
    id: 'guest-2',
    name: 'Michael Chen',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
    email: 'mchen@email.com',
    phone: '+1 (555) 234-5678',
  },
  {
    id: 'guest-3',
    name: 'Emma Williams',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100',
    email: 'emma.w@email.com',
    phone: '+1 (555) 345-6789',
  },
  {
    id: 'guest-4',
    name: 'James Rodriguez',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
    email: 'jrodriguez@email.com',
    phone: '+1 (555) 456-7890',
  },
  {
    id: 'guest-5',
    name: 'Lisa Thompson',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100',
    email: 'lisa.t@email.com',
    phone: '+1 (555) 567-8901',
  },
];

// Helper to create messages
const createMessage = (
  id: string,
  conversationId: string,
  content: string,
  sender: 'guest' | 'host' | 'ai_draft',
  hoursAgo: number,
  aiConfidence?: number
): Message => ({
  id,
  conversationId,
  content,
  sender,
  timestamp: new Date(Date.now() - hoursAgo * 60 * 60 * 1000),
  isRead: sender !== 'guest',
  aiConfidence,
  isApproved: sender === 'host',
});

// Demo conversations
export const demoConversations: Conversation[] = [
  {
    id: 'conv-1',
    guest: demoGuests[0],
    property: demoProperties[0],
    status: 'urgent',
    platform: 'airbnb',
    unreadCount: 2,
    hasAiDraft: true,
    checkInDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    checkOutDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    messages: [
      createMessage('m1-1', 'conv-1', 'Hi! I just booked your beautiful villa for next week. So excited!', 'guest', 48),
      createMessage('m1-2', 'conv-1', 'Welcome Sarah! We\'re thrilled to have you. The villa has stunning ocean views - you\'re going to love it. Let me know if you need any local recommendations!', 'host', 47),
      createMessage('m1-3', 'conv-1', 'Thank you! Quick question - is early check-in possible? Our flight arrives at 11am.', 'guest', 24),
      createMessage('m1-4', 'conv-1', 'I\'ll check with our cleaning team. Usually we can accommodate early arrivals for a small fee. I\'ll confirm by tomorrow!', 'host', 23),
      createMessage('m1-5', 'conv-1', 'Perfect, thanks! Also, is the hot tub working? We\'d love to use it during our stay.', 'guest', 2),
      createMessage('m1-6', 'conv-1', 'One more thing - do you have any beach towels we can use?', 'guest', 1),
      createMessage('m1-7', 'conv-1', 'Hi Sarah! Great news - early check-in at 11am is available for $30. The hot tub is fully operational and freshly maintained! We provide 4 plush beach towels in the closet near the back door. Would you like me to arrange the early check-in?', 'ai_draft', 0.5, 92),
    ],
    get lastMessage() {
      return this.messages[this.messages.length - 1];
    },
  },
  {
    id: 'conv-2',
    guest: demoGuests[1],
    property: demoProperties[1],
    status: 'active',
    platform: 'booking',
    unreadCount: 1,
    hasAiDraft: true,
    checkInDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    checkOutDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
    messages: [
      createMessage('m2-1', 'conv-2', 'Hello, I\'m interested in your downtown loft. Is parking included?', 'guest', 72),
      createMessage('m2-2', 'conv-2', 'Hi Michael! Yes, one parking spot in the garage is included. There\'s also street parking if you have a second vehicle.', 'host', 71),
      createMessage('m2-3', 'conv-2', 'Great! I\'ve just completed my booking. Looking forward to exploring Austin!', 'guest', 48),
      createMessage('m2-4', 'conv-2', 'Awesome! You\'ll love the area. We have a digital guidebook with all our favorite spots - I\'ll send the link closer to your arrival.', 'host', 47),
      createMessage('m2-5', 'conv-2', 'Can you recommend any good restaurants within walking distance?', 'guest', 3),
      createMessage('m2-6', 'conv-2', 'Hey Michael! There are some fantastic options nearby. For BBQ, try Franklin\'s (15 min walk). Uchi is amazing for sushi (10 min). And Odd Duck for farm-to-table cuisine (5 min walk). I\'ll include all details in the guidebook! Any cuisine preferences I should highlight?', 'ai_draft', 0.3, 88),
    ],
    get lastMessage() {
      return this.messages[this.messages.length - 1];
    },
  },
  {
    id: 'conv-3',
    guest: demoGuests[2],
    property: demoProperties[2],
    status: 'active',
    platform: 'vrbo',
    unreadCount: 0,
    hasAiDraft: false,
    checkInDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    checkOutDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    messages: [
      createMessage('m3-1', 'conv-3', 'The mountain retreat is absolutely beautiful! We arrived safely.', 'guest', 48),
      createMessage('m3-2', 'conv-3', 'So happy to hear that Emma! Enjoy your stay. The sunset views from the deck are incredible.', 'host', 47),
      createMessage('m3-3', 'conv-3', 'You were right about the sunset! Magical. Thanks for the wine recommendation too.', 'guest', 24),
      createMessage('m3-4', 'conv-3', 'My pleasure! Let me know if you need anything else during your stay.', 'host', 23),
    ],
    get lastMessage() {
      return this.messages[this.messages.length - 1];
    },
  },
  {
    id: 'conv-4',
    guest: demoGuests[3],
    property: demoProperties[0],
    status: 'archived',
    platform: 'airbnb',
    unreadCount: 0,
    hasAiDraft: false,
    checkInDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    checkOutDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    messages: [
      createMessage('m4-1', 'conv-4', 'Thank you for an amazing stay! The villa exceeded our expectations.', 'guest', 240),
      createMessage('m4-2', 'conv-4', 'Thank you James! It was a pleasure hosting you. We\'d love to have you back anytime. Safe travels!', 'host', 238),
      createMessage('m4-3', 'conv-4', 'Left you a 5-star review! Definitely coming back next summer.', 'guest', 236),
      createMessage('m4-4', 'conv-4', 'You\'re too kind! We\'ll have a returning guest discount waiting for you. Take care!', 'host', 235),
    ],
    get lastMessage() {
      return this.messages[this.messages.length - 1];
    },
  },
  {
    id: 'conv-5',
    guest: demoGuests[4],
    property: demoProperties[1],
    status: 'urgent',
    platform: 'direct',
    unreadCount: 3,
    hasAiDraft: true,
    checkInDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    checkOutDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    messages: [
      createMessage('m5-1', 'conv-5', 'Hi, I booked directly through your website. Super excited for tomorrow!', 'guest', 12),
      createMessage('m5-2', 'conv-5', 'Welcome Lisa! Thanks for booking direct. We\'ve got you all set up. Check-in is at 3pm.', 'host', 11),
      createMessage('m5-3', 'conv-5', 'Quick question - what\'s the door code?', 'guest', 4),
      createMessage('m5-4', 'conv-5', 'Also where do I pick up the keys?', 'guest', 3.5),
      createMessage('m5-5', 'conv-5', 'And is there a grocery store nearby?', 'guest', 3),
      createMessage('m5-6', 'conv-5', 'Hi Lisa! Great questions. The door code is 4521# - I\'ll send it again in your check-in message tomorrow morning. There\'s a keypad on the front door, so no physical keys needed! The nearest grocery store is Whole Foods, just 2 blocks south on Main Street. They\'re open until 10pm. Need anything else before your arrival?', 'ai_draft', 0.2, 95),
    ],
    get lastMessage() {
      return this.messages[this.messages.length - 1];
    },
  },
];

// AI response suggestions for different scenarios
export const aiResponseTemplates = {
  earlyCheckIn: 'Early check-in is available at {{time}} for an additional ${{fee}}. Would you like me to arrange this for you?',
  lateCheckOut: 'Late checkout until {{time}} is possible for ${{fee}}. Let me know if you\'d like to add this to your reservation!',
  parking: 'We have {{type}} parking available. {{details}}',
  amenities: 'Great question! The property includes {{amenities}}. Let me know if you need any specifics about how to use them.',
  localRecommendations: 'Here are some local favorites: {{recommendations}}. I\'ve included all details in your digital guidebook!',
  checkInInstructions: 'Looking forward to your arrival! Your check-in code is {{code}}. The property is located at {{address}}. Let me know when you\'ve arrived safely!',
};
