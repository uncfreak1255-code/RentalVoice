/**
 * Real-time Guest Sentiment Analysis Service
 *
 * Analyzes incoming guest messages to classify sentiment and help prioritize responses.
 * Supports: Positive, Neutral, Negative, Frustrated, Urgent, Excited
 */

import type { Message, Conversation } from './store';

export type SentimentType = 'positive' | 'neutral' | 'negative' | 'frustrated' | 'urgent' | 'excited';

export interface SentimentResult {
  type: SentimentType;
  confidence: number; // 0-100
  keywords: string[];
  requiresEscalation: boolean;
}

export interface ConversationSentiment {
  conversationId: string;
  currentSentiment: SentimentType;
  sentimentHistory: SentimentHistoryEntry[];
  overallTrend: 'improving' | 'stable' | 'declining';
  escalationRequired: boolean;
  lastAnalyzedAt: Date;
}

export interface SentimentHistoryEntry {
  messageId: string;
  sentiment: SentimentType;
  confidence: number;
  timestamp: Date;
}

export interface SentimentStats {
  positive: number;
  neutral: number;
  negative: number;
  frustrated: number;
  urgent: number;
  excited: number;
  total: number;
}

export interface PropertySentimentStats {
  propertyId: string;
  propertyName: string;
  stats: SentimentStats;
  trend: 'improving' | 'stable' | 'declining';
}

// Sentiment color mapping for UI badges
export const SENTIMENT_COLORS: Record<SentimentType, { bg: string; text: string; border: string; icon: string }> = {
  positive: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: '#34D399' },
  neutral: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30', icon: '#6B7280' },
  negative: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: '#F87171' },
  frustrated: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', icon: '#FB923C' },
  urgent: { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30', icon: '#FB7185' },
  excited: { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30', icon: '#A78BFA' },
};

// Sentiment labels for display
export const SENTIMENT_LABELS: Record<SentimentType, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
  frustrated: 'Frustrated',
  urgent: 'Urgent',
  excited: 'Excited',
};

// Sentiment priority for sorting (higher = more priority)
export const SENTIMENT_PRIORITY: Record<SentimentType, number> = {
  urgent: 100,
  frustrated: 90,
  negative: 80,
  excited: 40,
  neutral: 20,
  positive: 10,
};

// Keywords and patterns for sentiment detection
const SENTIMENT_PATTERNS: Record<SentimentType, { keywords: RegExp[]; phrases: RegExp[] }> = {
  urgent: {
    keywords: [
      /\b(urgent|emergency|asap|immediately|now|help|stuck|locked|stranded)\b/i,
      /\b(can't get in|can't access|no entry|won't open|doesn't work)\b/i,
    ],
    phrases: [
      /need help (right )?now/i,
      /please respond/i,
      /this is urgent/i,
      /can('t| not) (get|come) (in|inside)/i,
      /locked out/i,
      /flight (leaves?|departs?)/i,
      /arriving (in|within) \d+ (minutes?|hours?)/i,
    ],
  },
  frustrated: {
    keywords: [
      /\b(frustrated|annoyed|disappointed|unacceptable|ridiculous|terrible|awful)\b/i,
      /\b(still waiting|no response|ignored|again|multiple times)\b/i,
    ],
    phrases: [
      /this is (not|isn't) (ok|okay|acceptable)/i,
      /i('ve| have) (been waiting|asked|messaged|contacted)/i,
      /why (hasn't|hasn't|won't|isn't)/i,
      /how (many|much) (more )?times/i,
      /waste of (time|money)/i,
      /never (again|booking|staying)/i,
    ],
  },
  negative: {
    keywords: [
      /\b(problem|issue|broken|dirty|noisy|uncomfortable|cold|hot|smell|stain)\b/i,
      /\b(not working|doesn't work|won't work|malfunctioning)\b/i,
      /\b(unhappy|unsatisfied|dissatisfied|complaint)\b/i,
    ],
    phrases: [
      /not (what|as) (i |we )?(expected|advertised|described)/i,
      /need(s)? (to be )?(fixed|cleaned|replaced)/i,
      /there('s| is) (a|an) (problem|issue)/i,
      /something('s| is) wrong/i,
      /(refund|compensation|discount)/i,
    ],
  },
  excited: {
    keywords: [
      /\b(excited|amazing|wonderful|fantastic|incredible|awesome|love|perfect)\b/i,
      /\b(can't wait|looking forward|thrilled|delighted)\b/i,
    ],
    phrases: [
      /so excited/i,
      /can('t| not) wait/i,
      /this (is|looks) (amazing|incredible|perfect)/i,
      /thank you so much/i,
      /you('re| are) (the best|amazing|wonderful)/i,
      /!{2,}/,
    ],
  },
  positive: {
    keywords: [
      /\b(thank|thanks|great|good|nice|lovely|beautiful|clean|comfortable)\b/i,
      /\b(appreciate|grateful|pleased|satisfied|happy|enjoyed)\b/i,
    ],
    phrases: [
      /thank(s| you)/i,
      /great (place|stay|host|location)/i,
      /(really|very) (nice|good|clean)/i,
      /will (definitely )?recommend/i,
      /had a (great|wonderful|lovely) (time|stay)/i,
    ],
  },
  neutral: {
    keywords: [
      /\b(question|wondering|curious|asking|inquiry|information)\b/i,
      /\b(what|where|when|how|which|who)\b/i,
    ],
    phrases: [
      /can (i|you|we)/i,
      /is (it|there|this)/i,
      /do (you|i|we)/i,
      /could (you|i|we)/i,
      /would (you|it) be/i,
    ],
  },
};

/**
 * Analyze a single message for sentiment
 */
export function analyzeMessageSentiment(message: Message): SentimentResult {
  // Only analyze guest messages
  if (message.sender !== 'guest') {
    return {
      type: 'neutral',
      confidence: 100,
      keywords: [],
      requiresEscalation: false,
    };
  }

  const content = message.content;
  const scores: Record<SentimentType, { score: number; keywords: string[] }> = {
    urgent: { score: 0, keywords: [] },
    frustrated: { score: 0, keywords: [] },
    negative: { score: 0, keywords: [] },
    excited: { score: 0, keywords: [] },
    positive: { score: 0, keywords: [] },
    neutral: { score: 0, keywords: [] },
  };

  // Check each sentiment type
  for (const [sentimentType, patterns] of Object.entries(SENTIMENT_PATTERNS)) {
    const sentiment = sentimentType as SentimentType;

    // Check keywords
    for (const pattern of patterns.keywords) {
      const matches = content.match(pattern);
      if (matches) {
        scores[sentiment].score += 10;
        scores[sentiment].keywords.push(...matches.map(m => m.toLowerCase()));
      }
    }

    // Check phrases (weighted higher)
    for (const pattern of patterns.phrases) {
      const matches = content.match(pattern);
      if (matches) {
        scores[sentiment].score += 15;
        scores[sentiment].keywords.push(...matches.map(m => m.toLowerCase()));
      }
    }
  }

  // Additional scoring factors
  // Exclamation marks suggest stronger emotion
  const exclamationCount = (content.match(/!/g) || []).length;
  if (exclamationCount > 0) {
    // Could be excited or frustrated
    if (scores.excited.score > 0) scores.excited.score += exclamationCount * 3;
    if (scores.frustrated.score > 0) scores.frustrated.score += exclamationCount * 3;
    if (scores.urgent.score > 0) scores.urgent.score += exclamationCount * 3;
  }

  // Question marks suggest inquiry
  const questionCount = (content.match(/\?/g) || []).length;
  if (questionCount > 0 && scores.neutral.score === 0) {
    scores.neutral.score += questionCount * 5;
  }

  // ALL CAPS suggests urgency or frustration
  const capsWords = content.match(/\b[A-Z]{3,}\b/g) || [];
  if (capsWords.length > 0) {
    if (scores.frustrated.score > 0) scores.frustrated.score += capsWords.length * 5;
    if (scores.urgent.score > 0) scores.urgent.score += capsWords.length * 5;
  }

  // Message length consideration
  if (content.length > 500) {
    // Long messages might indicate frustration or detailed complaints
    if (scores.negative.score > 0 || scores.frustrated.score > 0) {
      scores.negative.score += 5;
      scores.frustrated.score += 5;
    }
  }

  // Find the highest scoring sentiment
  let maxSentiment: SentimentType = 'neutral';
  let maxScore = 0;

  for (const [sentiment, data] of Object.entries(scores)) {
    if (data.score > maxScore) {
      maxScore = data.score;
      maxSentiment = sentiment as SentimentType;
    }
  }

  // Calculate confidence based on score magnitude and separation from next highest
  const sortedScores = Object.entries(scores).sort((a, b) => b[1].score - a[1].score);
  const topScore = sortedScores[0][1].score;
  const secondScore = sortedScores[1]?.[1].score || 0;

  let confidence = 50; // Base confidence
  if (topScore > 0) {
    // Higher score = more confidence
    confidence += Math.min(30, topScore);
    // Larger gap from second = more confidence
    confidence += Math.min(20, (topScore - secondScore) * 2);
  }
  confidence = Math.min(100, confidence);

  // Determine if escalation is required
  const requiresEscalation =
    maxSentiment === 'urgent' ||
    maxSentiment === 'frustrated' ||
    (maxSentiment === 'negative' && confidence >= 70);

  return {
    type: maxSentiment,
    confidence,
    keywords: [...new Set(scores[maxSentiment].keywords)].slice(0, 5),
    requiresEscalation,
  };
}

/**
 * Analyze overall conversation sentiment
 */
export function analyzeConversationSentiment(conversation: Conversation): ConversationSentiment {
  const guestMessages = conversation.messages.filter(m => m.sender === 'guest');

  if (guestMessages.length === 0) {
    return {
      conversationId: conversation.id,
      currentSentiment: 'neutral',
      sentimentHistory: [],
      overallTrend: 'stable',
      escalationRequired: false,
      lastAnalyzedAt: new Date(),
    };
  }

  // Analyze each guest message
  const sentimentHistory: SentimentHistoryEntry[] = guestMessages.map(msg => {
    const result = analyzeMessageSentiment(msg);
    return {
      messageId: msg.id,
      sentiment: result.type,
      confidence: result.confidence,
      timestamp: msg.timestamp,
    };
  });

  // Get current sentiment (from most recent message)
  const lastEntry = sentimentHistory[sentimentHistory.length - 1];
  const currentSentiment = lastEntry?.sentiment || 'neutral';

  // Calculate trend
  const overallTrend = calculateSentimentTrend(sentimentHistory);

  // Determine if escalation is required
  const recentMessages = sentimentHistory.slice(-3);
  const hasRecentNegative = recentMessages.some(
    entry => entry.sentiment === 'negative' || entry.sentiment === 'frustrated' || entry.sentiment === 'urgent'
  );
  const escalationRequired = hasRecentNegative || currentSentiment === 'urgent';

  return {
    conversationId: conversation.id,
    currentSentiment,
    sentimentHistory,
    overallTrend,
    escalationRequired,
    lastAnalyzedAt: new Date(),
  };
}

/**
 * Calculate sentiment trend from history
 */
function calculateSentimentTrend(history: SentimentHistoryEntry[]): 'improving' | 'stable' | 'declining' {
  if (history.length < 2) return 'stable';

  // Assign numeric values to sentiments
  const sentimentValues: Record<SentimentType, number> = {
    positive: 2,
    excited: 2,
    neutral: 0,
    negative: -1,
    frustrated: -2,
    urgent: -2,
  };

  // Compare first half average to second half average
  const midpoint = Math.floor(history.length / 2);
  const firstHalf = history.slice(0, midpoint);
  const secondHalf = history.slice(midpoint);

  const firstAvg = firstHalf.reduce((sum, e) => sum + sentimentValues[e.sentiment], 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, e) => sum + sentimentValues[e.sentiment], 0) / secondHalf.length;

  const diff = secondAvg - firstAvg;

  if (diff > 0.5) return 'improving';
  if (diff < -0.5) return 'declining';
  return 'stable';
}

/**
 * Calculate sentiment statistics for conversations
 */
export function calculateSentimentStats(conversations: Conversation[]): SentimentStats {
  const stats: SentimentStats = {
    positive: 0,
    neutral: 0,
    negative: 0,
    frustrated: 0,
    urgent: 0,
    excited: 0,
    total: 0,
  };

  for (const conv of conversations) {
    const sentiment = analyzeConversationSentiment(conv);
    stats[sentiment.currentSentiment]++;
    stats.total++;
  }

  return stats;
}

/**
 * Calculate sentiment statistics grouped by property
 */
export function calculatePropertySentimentStats(
  conversations: Conversation[]
): PropertySentimentStats[] {
  const propertyMap = new Map<string, { name: string; conversations: Conversation[] }>();

  // Group conversations by property
  for (const conv of conversations) {
    const propertyId = conv.property.id;
    if (!propertyMap.has(propertyId)) {
      propertyMap.set(propertyId, { name: conv.property.name, conversations: [] });
    }
    propertyMap.get(propertyId)!.conversations.push(conv);
  }

  // Calculate stats for each property
  const results: PropertySentimentStats[] = [];

  for (const [propertyId, data] of propertyMap) {
    const stats = calculateSentimentStats(data.conversations);

    // Calculate overall trend for property
    const sentiments = data.conversations.map(c => analyzeConversationSentiment(c));
    const trends = sentiments.map(s => s.overallTrend);
    const improvingCount = trends.filter(t => t === 'improving').length;
    const decliningCount = trends.filter(t => t === 'declining').length;

    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (improvingCount > decliningCount * 1.5) trend = 'improving';
    else if (decliningCount > improvingCount * 1.5) trend = 'declining';

    results.push({
      propertyId,
      propertyName: data.name,
      stats,
      trend,
    });
  }

  return results.sort((a, b) => {
    // Sort by negative sentiment ratio (highest first for attention)
    const aNegRatio = (a.stats.negative + a.stats.frustrated + a.stats.urgent) / Math.max(1, a.stats.total);
    const bNegRatio = (b.stats.negative + b.stats.frustrated + b.stats.urgent) / Math.max(1, b.stats.total);
    return bNegRatio - aNegRatio;
  });
}

/**
 * Sort conversations by sentiment priority
 * Negative/Urgent conversations appear first
 */
export function sortConversationsBySentiment(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => {
    const sentimentA = analyzeConversationSentiment(a);
    const sentimentB = analyzeConversationSentiment(b);

    const priorityA = SENTIMENT_PRIORITY[sentimentA.currentSentiment];
    const priorityB = SENTIMENT_PRIORITY[sentimentB.currentSentiment];

    // Higher priority first
    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }

    // If same priority, sort by most recent message
    const timeA = a.lastMessage?.timestamp.getTime() || 0;
    const timeB = b.lastMessage?.timestamp.getTime() || 0;
    return timeB - timeA;
  });
}

/**
 * Check if AutoPilot should escalate based on sentiment
 */
export function shouldEscalateForSentiment(conversation: Conversation): boolean {
  const sentiment = analyzeConversationSentiment(conversation);
  return sentiment.escalationRequired;
}

/**
 * Get sentiment percentage breakdown
 */
export function getSentimentPercentages(stats: SentimentStats): Record<SentimentType, number> {
  const total = stats.total || 1;
  return {
    positive: Math.round((stats.positive / total) * 100),
    neutral: Math.round((stats.neutral / total) * 100),
    negative: Math.round((stats.negative / total) * 100),
    frustrated: Math.round((stats.frustrated / total) * 100),
    urgent: Math.round((stats.urgent / total) * 100),
    excited: Math.round((stats.excited / total) * 100),
  };
}

/**
 * Calculate time-based sentiment trends (for dashboard)
 */
export function calculateSentimentTrends(
  conversations: Conversation[],
  days: number = 7
): { date: string; positive: number; negative: number; neutral: number }[] {
  const now = new Date();
  const trends: { date: string; positive: number; negative: number; neutral: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    // Filter conversations that had messages on this day
    const dayConversations = conversations.filter(conv => {
      return conv.messages.some(msg => {
        const msgDate = new Date(msg.timestamp).toISOString().split('T')[0];
        return msgDate === dateStr;
      });
    });

    const stats = calculateSentimentStats(dayConversations);
    const total = stats.total || 1;

    trends.push({
      date: dateStr,
      positive: Math.round(((stats.positive + stats.excited) / total) * 100),
      negative: Math.round(((stats.negative + stats.frustrated + stats.urgent) / total) * 100),
      neutral: Math.round((stats.neutral / total) * 100),
    });
  }

  return trends;
}
