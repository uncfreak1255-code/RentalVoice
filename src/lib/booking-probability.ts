// Booking Probability Scoring Service
// Predicts likelihood of an inquiry converting to a booking

import type { Conversation } from './store';
import { differenceInHours } from 'date-fns';

export interface BookingProbabilityScore {
  score: number; // 0-100
  confidence: number; // 0-100
  category: 'very_likely' | 'likely' | 'moderate' | 'unlikely' | 'very_unlikely';

  // Factor breakdowns
  factors: {
    responseTime: number; // How quickly host responded
    messageVolume: number; // Number of back-and-forth messages
    questionSpecificity: number; // How specific guest questions are
    datesMentioned: number; // Whether specific dates discussed
    priceDiscussion: number; // Price/payment discussion signals
    guestEngagement: number; // How engaged the guest is
    urgencySignals: number; // Signs of urgency to book
    negativeSignals: number; // Red flags that reduce probability
  };

  // Insights
  positiveSignals: string[];
  negativeSignals: string[];
  recommendations: string[];
}

// Positive booking signals
const POSITIVE_SIGNALS = {
  specific_dates: /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}|\d{1,2}[\/\-]\d{1,2}|\bmonday|tuesday|wednesday|thursday|friday|saturday|sunday\b/i,
  guest_count: /\b\d+\s*(guests?|people|adults?|kids?|children)\b/i,
  booking_intent: /\b(book|reserve|available|vacancy|open)\b/i,
  payment_ready: /\b(pay|payment|card|price|total|cost|rate|deposit)\b/i,
  urgency: /\b(asap|soon|urgent|immediately|this week|next week|today|tomorrow)\b/i,
  confirmation_seeking: /\b(confirm|sure|definitely|absolutely|yes|sounds good|perfect|great)\b/i,
  specific_questions: /\b(parking|wifi|check.?in|check.?out|amenities|pool|beach|pet|kitchen)\b/i,
  repeat_guest: /\b(stayed before|return|back again|last time|previous)\b/i,
  recommender: /\b(friend|family|colleague)\s*(recommended|told|said)/i,
};

// Negative signals (reduce probability)
const NEGATIVE_SIGNALS = {
  price_concern: /\b(expensive|costly|budget|cheaper|discount|deal|negotiate|lower)\b/i,
  comparison_shopping: /\b(other options|other places|comparing|looking around|alternatives)\b/i,
  uncertainty: /\b(maybe|not sure|thinking|considering|might|possibly|if we)\b/i,
  cancellation_inquiry: /\b(cancel|refund|policy|flexible|change)\b/i,
  distant_future: /\b(next year|months away|planning ahead|far out)\b/i,
  just_browsing: /\b(just looking|browsing|curious|wondering)\b/i,
  complaints: /\b(complaint|problem|issue|bad review|negative)\b/i,
};

/**
 * Calculate booking probability for a conversation
 */
export function calculateBookingProbability(conversation: Conversation): BookingProbabilityScore {
  const { messages, checkInDate, checkOutDate } = conversation;

  // Filter to guest messages
  const guestMessages = messages.filter(m => m.sender === 'guest');
  const hostMessages = messages.filter(m => m.sender === 'host');
  const allGuestText = guestMessages.map(m => m.content).join(' ').toLowerCase();

  // Initialize factors
  const factors = {
    responseTime: 0,
    messageVolume: 0,
    questionSpecificity: 0,
    datesMentioned: 0,
    priceDiscussion: 0,
    guestEngagement: 0,
    urgencySignals: 0,
    negativeSignals: 0,
  };

  const positiveSignals: string[] = [];
  const negativeSignals: string[] = [];
  const recommendations: string[] = [];

  // ============================================
  // FACTOR: Response Time
  // ============================================
  if (guestMessages.length > 0 && hostMessages.length > 0) {
    const firstGuestMsg = guestMessages[0];
    const firstHostResponse = hostMessages.find(m =>
      new Date(m.timestamp) > new Date(firstGuestMsg.timestamp)
    );

    if (firstHostResponse) {
      const responseHours = differenceInHours(
        new Date(firstHostResponse.timestamp),
        new Date(firstGuestMsg.timestamp)
      );

      if (responseHours <= 1) {
        factors.responseTime = 100;
        positiveSignals.push('Fast response time (<1 hour)');
      } else if (responseHours <= 4) {
        factors.responseTime = 80;
        positiveSignals.push('Good response time (<4 hours)');
      } else if (responseHours <= 12) {
        factors.responseTime = 60;
      } else if (responseHours <= 24) {
        factors.responseTime = 40;
        recommendations.push('Try to respond faster to increase booking likelihood');
      } else {
        factors.responseTime = 20;
        negativeSignals.push('Slow initial response time');
        recommendations.push('Response time is critical - aim for under 1 hour');
      }
    }
  }

  // ============================================
  // FACTOR: Message Volume (Engagement)
  // ============================================
  const totalMessages = messages.length;
  if (totalMessages >= 10) {
    factors.messageVolume = 100;
    positiveSignals.push('High engagement (10+ messages)');
  } else if (totalMessages >= 6) {
    factors.messageVolume = 80;
    positiveSignals.push('Good engagement (6+ messages)');
  } else if (totalMessages >= 4) {
    factors.messageVolume = 60;
  } else if (totalMessages >= 2) {
    factors.messageVolume = 40;
  } else {
    factors.messageVolume = 20;
    recommendations.push('Engage more with the guest to build rapport');
  }

  // ============================================
  // FACTOR: Question Specificity
  // ============================================
  let specificityScore = 0;
  const specificPatterns = [
    POSITIVE_SIGNALS.specific_questions,
    POSITIVE_SIGNALS.guest_count,
    /\b(amenities|features|include|provide)\b/i,
  ];

  for (const pattern of specificPatterns) {
    if (pattern.test(allGuestText)) {
      specificityScore += 33;
    }
  }

  factors.questionSpecificity = Math.min(100, specificityScore);
  if (specificityScore >= 66) {
    positiveSignals.push('Asking specific, detailed questions');
  }

  // ============================================
  // FACTOR: Dates Mentioned
  // ============================================
  if (checkInDate && checkOutDate) {
    factors.datesMentioned = 100;
    positiveSignals.push('Specific dates already set');
  } else if (POSITIVE_SIGNALS.specific_dates.test(allGuestText)) {
    factors.datesMentioned = 80;
    positiveSignals.push('Discussing specific dates');
  } else if (/next|this\s+(week|month|weekend)/i.test(allGuestText)) {
    factors.datesMentioned = 50;
  } else {
    factors.datesMentioned = 20;
    recommendations.push('Ask guest about their preferred dates');
  }

  // ============================================
  // FACTOR: Price Discussion
  // ============================================
  if (POSITIVE_SIGNALS.payment_ready.test(allGuestText)) {
    const isPriceNegative = NEGATIVE_SIGNALS.price_concern.test(allGuestText);

    if (isPriceNegative) {
      factors.priceDiscussion = 40;
      negativeSignals.push('Price concerns mentioned');
      recommendations.push('Consider offering a small discount or highlighting value');
    } else {
      factors.priceDiscussion = 90;
      positiveSignals.push('Ready to discuss payment');
    }
  } else {
    factors.priceDiscussion = 30;
  }

  // ============================================
  // FACTOR: Guest Engagement
  // ============================================
  let engagementScore = 0;

  // Check for confirmation signals
  if (POSITIVE_SIGNALS.confirmation_seeking.test(allGuestText)) {
    engagementScore += 40;
    positiveSignals.push('Positive confirmation language');
  }

  // Check message length (longer = more engaged)
  const avgMessageLength = guestMessages.reduce((sum, m) => sum + m.content.length, 0) / (guestMessages.length || 1);
  if (avgMessageLength > 100) {
    engagementScore += 30;
  } else if (avgMessageLength > 50) {
    engagementScore += 15;
  }

  // Check for questions asked
  const questionCount = (allGuestText.match(/\?/g) || []).length;
  if (questionCount >= 3) {
    engagementScore += 30;
    positiveSignals.push('Multiple questions asked');
  }

  factors.guestEngagement = Math.min(100, engagementScore);

  // ============================================
  // FACTOR: Urgency Signals
  // ============================================
  if (POSITIVE_SIGNALS.urgency.test(allGuestText)) {
    factors.urgencySignals = 90;
    positiveSignals.push('Urgency signals detected');
  } else if (POSITIVE_SIGNALS.booking_intent.test(allGuestText)) {
    factors.urgencySignals = 60;
    positiveSignals.push('Booking intent expressed');
  } else {
    factors.urgencySignals = 30;
  }

  // ============================================
  // FACTOR: Negative Signals
  // ============================================
  let negativeScore = 100; // Start high, reduce for negatives

  for (const [key, pattern] of Object.entries(NEGATIVE_SIGNALS)) {
    if (pattern.test(allGuestText)) {
      negativeScore -= 15;
      const signalName = key.replace(/_/g, ' ');
      negativeSignals.push(`${signalName} detected`);
    }
  }

  factors.negativeSignals = Math.max(0, negativeScore);

  // Specific recommendations for negatives
  if (NEGATIVE_SIGNALS.price_concern.test(allGuestText)) {
    recommendations.push('Address price concerns - highlight unique value or offer a discount');
  }
  if (NEGATIVE_SIGNALS.comparison_shopping.test(allGuestText)) {
    recommendations.push('Emphasize what makes your property unique');
  }
  if (NEGATIVE_SIGNALS.uncertainty.test(allGuestText)) {
    recommendations.push('Provide reassurance and answer any lingering questions');
  }

  // ============================================
  // CALCULATE FINAL SCORE
  // ============================================
  // Weight factors
  const weights = {
    responseTime: 0.15,
    messageVolume: 0.15,
    questionSpecificity: 0.10,
    datesMentioned: 0.20,
    priceDiscussion: 0.10,
    guestEngagement: 0.10,
    urgencySignals: 0.10,
    negativeSignals: 0.10,
  };

  let weightedScore = 0;
  for (const [key, weight] of Object.entries(weights)) {
    weightedScore += factors[key as keyof typeof factors] * weight;
  }

  const score = Math.round(weightedScore);

  // Determine category
  let category: BookingProbabilityScore['category'];
  if (score >= 80) {
    category = 'very_likely';
  } else if (score >= 60) {
    category = 'likely';
  } else if (score >= 40) {
    category = 'moderate';
  } else if (score >= 20) {
    category = 'unlikely';
  } else {
    category = 'very_unlikely';
  }

  // Calculate confidence based on message volume
  const confidence = Math.min(100, 30 + (totalMessages * 10));

  return {
    score,
    confidence,
    category,
    factors,
    positiveSignals,
    negativeSignals,
    recommendations,
  };
}

/**
 * Get human-readable probability description
 */
export function getProbabilityDescription(score: BookingProbabilityScore): string {
  switch (score.category) {
    case 'very_likely':
      return 'Very likely to book';
    case 'likely':
      return 'Likely to book';
    case 'moderate':
      return 'Moderate chance';
    case 'unlikely':
      return 'Unlikely to book';
    case 'very_unlikely':
      return 'Very unlikely';
  }
}

/**
 * Get color for probability score
 */
export function getProbabilityColor(category: BookingProbabilityScore['category']): string {
  switch (category) {
    case 'very_likely':
      return '#22C55E'; // green-500
    case 'likely':
      return '#84CC16'; // lime-500
    case 'moderate':
      return '#EAB308'; // yellow-500
    case 'unlikely':
      return '#F97316'; // orange-500
    case 'very_unlikely':
      return '#EF4444'; // red-500
  }
}

/**
 * Get emoji for probability score
 */
export function getProbabilityEmoji(category: BookingProbabilityScore['category']): string {
  switch (category) {
    case 'very_likely':
      return '🔥';
    case 'likely':
      return '👍';
    case 'moderate':
      return '🤔';
    case 'unlikely':
      return '😕';
    case 'very_unlikely':
      return '❄️';
  }
}
