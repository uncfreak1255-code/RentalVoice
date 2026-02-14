// Guest Type Detection Service
// Automatically detects guest type and adapts AI responses accordingly

import type { Conversation, Message } from './store';

export type GuestType =
  | 'family' // Families with children
  | 'couple' // Romantic couples
  | 'business' // Business travelers
  | 'group' // Group of friends
  | 'solo' // Solo travelers
  | 'unknown';

export type TravelPurpose =
  | 'vacation'
  | 'business'
  | 'wedding'
  | 'anniversary'
  | 'birthday'
  | 'reunion'
  | 'remote_work'
  | 'relocation'
  | 'event'
  | 'unknown';

export interface GuestProfile {
  type: GuestType;
  confidence: number; // 0-100
  purpose: TravelPurpose;
  purposeConfidence: number;

  // Detected characteristics
  hasChildren: boolean;
  hasPets: boolean;
  isFirstTime: boolean;
  isRepeatGuest: boolean;
  isLocalGuest: boolean;
  isInternationalGuest: boolean;

  // Communication preferences
  preferredTone: 'warm' | 'professional' | 'casual';
  responseDetail: 'brief' | 'detailed' | 'moderate';
  urgencyLevel: 'relaxed' | 'normal' | 'urgent';

  // Detected signals
  signals: string[];
}

// Family indicators
const FAMILY_SIGNALS = [
  /kids?|children|child|toddler|infant|baby|babies/i,
  /family|families/i,
  /crib|highchair|high chair|stroller|car seat/i,
  /playground|playroom|toys/i,
  /school|homework/i,
  /daughter|son|nephew|niece/i,
  /bedtime|nap time/i,
];

// Couple indicators
const COUPLE_SIGNALS = [
  /anniversary|honeymoon/i,
  /romantic|romance/i,
  /just (the )?two of us/i,
  /couples?|partner|spouse|wife|husband|boyfriend|girlfriend/i,
  /getaway for two/i,
  /valentine|proposal/i,
];

// Business indicators
const BUSINESS_SIGNALS = [
  /business|work|conference|meeting|seminar/i,
  /corporate|company/i,
  /laptop|wifi.*work|work.*wifi/i,
  /quiet.*work|work.*quiet/i,
  /early.*checkout|late.*checkin.*work/i,
  /invoice|receipt|expense/i,
  /remote work|working remotely/i,
];

// Group indicators
const GROUP_SIGNALS = [
  /friends|group|party|celebration/i,
  /bachelor|bachelorette/i,
  /reunion/i,
  /\b[4-9]\b.*guests?|\b1[0-9]\b.*guests?/i, // 4+ guests
  /everyone|all of us/i,
];

// Solo indicators
const SOLO_SIGNALS = [
  /just me|solo|alone|by myself/i,
  /\bone\b.*guest|\bsingle\b.*guest/i,
  /traveling alone/i,
];

// Purpose indicators
const PURPOSE_SIGNALS: Record<TravelPurpose, RegExp[]> = {
  vacation: [/vacation|holiday|getaway|trip|travel|explore/i],
  business: [/business|work|conference|meeting/i],
  wedding: [/wedding|bride|groom|marriage/i],
  anniversary: [/anniversary/i],
  birthday: [/birthday|bday/i],
  reunion: [/reunion|gathering/i],
  remote_work: [/remote work|working remotely|digital nomad|workation/i],
  relocation: [/moving|relocating|house hunting|apartment hunting/i],
  event: [/concert|festival|game|match|event/i],
  unknown: [],
};

/**
 * Detect guest type from conversation messages and reservation data
 */
export function detectGuestType(conversation: Conversation): GuestProfile {
  const signals: string[] = [];
  let familyScore = 0;
  let coupleScore = 0;
  let businessScore = 0;
  let groupScore = 0;
  let soloScore = 0;

  // Analyze all guest messages
  const guestMessages = conversation.messages.filter(m => m.sender === 'guest');
  const allGuestText = guestMessages.map(m => m.content).join(' ');

  // Check family signals
  for (const pattern of FAMILY_SIGNALS) {
    if (pattern.test(allGuestText)) {
      familyScore += 20;
      signals.push(`Family signal: ${pattern.source}`);
    }
  }

  // Check couple signals
  for (const pattern of COUPLE_SIGNALS) {
    if (pattern.test(allGuestText)) {
      coupleScore += 20;
      signals.push(`Couple signal: ${pattern.source}`);
    }
  }

  // Check business signals
  for (const pattern of BUSINESS_SIGNALS) {
    if (pattern.test(allGuestText)) {
      businessScore += 20;
      signals.push(`Business signal: ${pattern.source}`);
    }
  }

  // Check group signals
  for (const pattern of GROUP_SIGNALS) {
    if (pattern.test(allGuestText)) {
      groupScore += 20;
      signals.push(`Group signal: ${pattern.source}`);
    }
  }

  // Check solo signals
  for (const pattern of SOLO_SIGNALS) {
    if (pattern.test(allGuestText)) {
      soloScore += 20;
      signals.push(`Solo signal: ${pattern.source}`);
    }
  }

  // Use guest count from reservation
  const guestCount = conversation.numberOfGuests || 1;
  if (guestCount === 1) {
    soloScore += 30;
  } else if (guestCount === 2) {
    coupleScore += 15;
  } else if (guestCount >= 3 && guestCount <= 5) {
    familyScore += 10;
  } else if (guestCount > 5) {
    groupScore += 20;
  }

  // Determine type based on highest score
  const scores = [
    { type: 'family' as GuestType, score: familyScore },
    { type: 'couple' as GuestType, score: coupleScore },
    { type: 'business' as GuestType, score: businessScore },
    { type: 'group' as GuestType, score: groupScore },
    { type: 'solo' as GuestType, score: soloScore },
  ];

  scores.sort((a, b) => b.score - a.score);
  const topType = scores[0];
  const confidence = Math.min(100, topType.score);

  // Detect purpose
  let purpose: TravelPurpose = 'unknown';
  let purposeConfidence = 0;

  for (const [p, patterns] of Object.entries(PURPOSE_SIGNALS)) {
    for (const pattern of patterns) {
      if (pattern.test(allGuestText)) {
        purpose = p as TravelPurpose;
        purposeConfidence = 70;
        break;
      }
    }
    if (purpose !== 'unknown') break;
  }

  // Detect additional characteristics
  const hasChildren = FAMILY_SIGNALS.some(p => p.test(allGuestText));
  const hasPets = /pet|dog|cat|puppy|kitten/i.test(allGuestText);
  const isFirstTime = /first time|never been|first visit/i.test(allGuestText);
  const isRepeatGuest = /back again|return|stayed before|last time/i.test(allGuestText);

  // Determine preferred tone based on guest type
  let preferredTone: 'warm' | 'professional' | 'casual' = 'warm';
  if (topType.type === 'business') {
    preferredTone = 'professional';
  } else if (topType.type === 'group') {
    preferredTone = 'casual';
  }

  // Determine response detail level
  let responseDetail: 'brief' | 'detailed' | 'moderate' = 'moderate';
  if (topType.type === 'business') {
    responseDetail = 'brief';
  } else if (topType.type === 'family' || isFirstTime) {
    responseDetail = 'detailed';
  }

  return {
    type: topType.score > 0 ? topType.type : 'unknown',
    confidence,
    purpose,
    purposeConfidence,
    hasChildren,
    hasPets,
    isFirstTime,
    isRepeatGuest,
    isLocalGuest: false, // Would need location data
    isInternationalGuest: false, // Would need location data
    preferredTone,
    responseDetail,
    urgencyLevel: 'normal',
    signals,
  };
}

/**
 * Get AI prompt adjustments based on guest profile
 */
export function getGuestTypePromptAdjustments(profile: GuestProfile): string {
  if (profile.type === 'unknown' && profile.confidence < 30) {
    return '';
  }

  const adjustments: string[] = [];

  // Type-specific guidance
  switch (profile.type) {
    case 'family':
      adjustments.push('This appears to be a FAMILY with children.');
      adjustments.push('Use warm, helpful tone. Mention family-friendly amenities.');
      adjustments.push('Be patient and thorough with explanations.');
      if (profile.hasChildren) {
        adjustments.push('They have children - mention safety features, cribs, highchairs if available.');
      }
      break;

    case 'couple':
      adjustments.push('This appears to be a COUPLE, possibly on a romantic trip.');
      adjustments.push('Use warm but not overly casual tone.');
      if (profile.purpose === 'anniversary' || profile.purpose === 'wedding') {
        adjustments.push('Acknowledge their special occasion with a brief congratulations.');
      }
      adjustments.push('Mention any romantic amenities (views, privacy, local date spots).');
      break;

    case 'business':
      adjustments.push('This appears to be a BUSINESS traveler.');
      adjustments.push('Use professional, efficient tone. Be concise.');
      adjustments.push('Prioritize WiFi, workspace, and early/late flexibility info.');
      adjustments.push('Avoid excessive friendliness - keep it professional.');
      break;

    case 'group':
      adjustments.push('This appears to be a GROUP of friends.');
      adjustments.push('Use friendly, upbeat tone.');
      adjustments.push('Mention house rules clearly but nicely (noise, parties, etc.).');
      adjustments.push('Highlight group-friendly amenities (parking, common areas).');
      break;

    case 'solo':
      adjustments.push('This appears to be a SOLO traveler.');
      adjustments.push('Be friendly but respect their independence.');
      adjustments.push('Mention safety features and local tips for solo visitors.');
      break;
  }

  // Purpose-specific guidance
  if (profile.purpose !== 'unknown') {
    switch (profile.purpose) {
      case 'vacation':
        adjustments.push('Purpose: Vacation - include local recommendations and fun activities.');
        break;
      case 'business':
        adjustments.push('Purpose: Business - focus on work amenities and efficiency.');
        break;
      case 'wedding':
        adjustments.push('Purpose: Wedding - offer congratulations, be extra accommodating.');
        break;
      case 'anniversary':
        adjustments.push('Purpose: Anniversary - acknowledge the special occasion.');
        break;
      case 'birthday':
        adjustments.push('Purpose: Birthday celebration - be celebratory in tone.');
        break;
    }
  }

  // First-time guest guidance
  if (profile.isFirstTime) {
    adjustments.push('FIRST-TIME GUEST: Provide extra detail about check-in, location, and amenities.');
  }

  // Repeat guest guidance
  if (profile.isRepeatGuest) {
    adjustments.push('REPEAT GUEST: Acknowledge their return, reference previous stays warmly.');
  }

  // Pet guidance
  if (profile.hasPets) {
    adjustments.push('They have PETS: Mention pet policies and any pet-friendly features.');
  }

  if (adjustments.length === 0) {
    return '';
  }

  return `\n\n### Guest Profile Detected (confidence: ${profile.confidence}%):\n${adjustments.map(a => `- ${a}`).join('\n')}`;
}

/**
 * Get a human-readable summary of the guest profile
 */
export function getGuestProfileSummary(profile: GuestProfile): string {
  const parts: string[] = [];

  if (profile.type !== 'unknown') {
    parts.push(profile.type.charAt(0).toUpperCase() + profile.type.slice(1));
  }

  if (profile.purpose !== 'unknown') {
    parts.push(`(${profile.purpose})`);
  }

  const extras: string[] = [];
  if (profile.hasChildren) extras.push('with kids');
  if (profile.hasPets) extras.push('with pets');
  if (profile.isFirstTime) extras.push('first time');
  if (profile.isRepeatGuest) extras.push('returning');

  if (extras.length > 0) {
    parts.push(`- ${extras.join(', ')}`);
  }

  return parts.join(' ') || 'Unknown guest type';
}
