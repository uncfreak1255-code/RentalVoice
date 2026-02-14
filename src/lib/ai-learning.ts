// AI Learning Service
// Analyzes host messages to learn style patterns and improve AI mimicry

import type { Message, LearningEntry, HostStyleProfile, Conversation, QuickReplyTemplate } from './store';
import type { HostawayMessage, HostawayConversation } from './hostaway';

// Anonymized pattern structure for privacy-compliant storage
export interface AnonymizedPattern {
  id: string;
  category: 'greeting' | 'signoff' | 'phrase' | 'response_style';
  pattern: string;
  frequency: number;
  contexts: string[]; // e.g., ['check_in', 'issue_response']
  lastSeen: Date;
}

// Template analysis result
export interface TemplateAnalysisResult {
  tone: 'formal' | 'casual' | 'friendly' | 'professional';
  length: 'short' | 'medium' | 'long';
  hasGreeting: boolean;
  hasSignoff: boolean;
  hasEmojis: boolean;
  hasVariables: boolean;
  detectedIntents: string[];
  suggestedKeywords: string[];
}

// Template match result for AI generation
export interface TemplateMatchResult {
  template: QuickReplyTemplate;
  matchScore: number; // 0-100
  matchedKeywords: string[];
  isPropertyMatch: boolean;
}

// Historical analysis result
export interface HistoricalAnalysisResult {
  totalConversationsAnalyzed: number;
  totalMessagesAnalyzed: number;
  hostMessagesAnalyzed: number;
  dateRange: { earliest: Date | null; latest: Date | null };
  patterns: AnonymizedPattern[];
  styleProfile: Partial<HostStyleProfile>;
  responsePatterns: {
    guestIntent: string;
    commonResponses: string[];
    avgResponseLength: number;
  }[];
}

// Common greeting patterns to detect
const GREETING_PATTERNS = [
  /^(hi|hello|hey|good morning|good afternoon|good evening|greetings)/i,
  /^(dear|welcome|thank you for)/i,
];

// Common sign-off patterns to detect
const SIGNOFF_PATTERNS = [
  /(best|regards|cheers|thanks|thank you|sincerely|warmly|take care)[\s,!.]*$/i,
  /(let me know|reach out|happy to help|don't hesitate).*$/i,
];

// Emoji detection
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;

/**
 * Analyze a single host message to extract style patterns
 */
export function analyzeMessage(content: string): {
  greeting: string | null;
  signoff: string | null;
  hasEmojis: boolean;
  emojiCount: number;
  wordCount: number;
  formalityScore: number;
  warmthScore: number;
  phrases: string[];
} {
  const words = content.split(/\s+/).filter(Boolean);
  const sentences = content.split(/[.!?]+/).filter(Boolean);

  // Detect greeting
  let greeting: string | null = null;
  for (const pattern of GREETING_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      greeting = match[0];
      break;
    }
  }

  // Detect sign-off
  let signoff: string | null = null;
  for (const pattern of SIGNOFF_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      signoff = match[0];
      break;
    }
  }

  // Count emojis
  const emojiMatches = content.match(EMOJI_REGEX) || [];
  const hasEmojis = emojiMatches.length > 0;
  const emojiCount = emojiMatches.length;

  // Calculate formality score (0-100)
  let formalityScore = 50;

  // Formal indicators
  if (/\b(dear|sincerely|regards|pleased|appreciate)\b/i.test(content)) formalityScore += 15;
  if (/\b(would|could|shall|may I)\b/i.test(content)) formalityScore += 10;
  if (/\b(apologize|apologies)\b/i.test(content)) formalityScore += 5;

  // Informal indicators
  if (/\b(hey|hi|yeah|yep|nope|gonna|wanna|gotta)\b/i.test(content)) formalityScore -= 15;
  if (hasEmojis) formalityScore -= 10;
  if (/!{2,}/.test(content)) formalityScore -= 5;
  if (/\b(awesome|cool|great|super)\b/i.test(content)) formalityScore -= 5;

  formalityScore = Math.max(0, Math.min(100, formalityScore));

  // Calculate warmth score (0-100)
  let warmthScore = 50;

  // Warm indicators
  if (/\b(thank|thanks|appreciate|grateful)\b/i.test(content)) warmthScore += 10;
  if (/\b(happy|glad|pleased|delighted|excited)\b/i.test(content)) warmthScore += 10;
  if (/\b(enjoy|wonderful|fantastic|amazing)\b/i.test(content)) warmthScore += 10;
  if (hasEmojis) warmthScore += 5;
  if (/!/.test(content)) warmthScore += 5;

  // Cold indicators
  if (/\b(unfortunately|regret|sorry|apologize)\b/i.test(content)) warmthScore -= 5;
  if (/\b(policy|rules|regulations|required)\b/i.test(content)) warmthScore -= 10;

  warmthScore = Math.max(0, Math.min(100, warmthScore));

  // Extract notable phrases (2-4 word combinations)
  const phrases: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    const twoWord = `${words[i]} ${words[i + 1]}`.toLowerCase();
    const threeWord = words[i + 2] ? `${twoWord} ${words[i + 2]}`.toLowerCase() : null;

    // Look for common hospitality phrases
    if (/let me know|happy to|feel free|don't hesitate|reach out|no problem|of course/i.test(twoWord)) {
      phrases.push(twoWord);
    }
    if (threeWord && /looking forward to|thank you for|please let me|hope you have/i.test(threeWord)) {
      phrases.push(threeWord);
    }
  }

  return {
    greeting,
    signoff,
    hasEmojis,
    emojiCount,
    wordCount: words.length,
    formalityScore,
    warmthScore,
    phrases: [...new Set(phrases)], // Remove duplicates
  };
}

/**
 * Analyze all host messages from conversations to build a style profile
 */
export function analyzeConversationsForStyle(
  conversations: Conversation[],
  propertyId?: string
): Partial<HostStyleProfile> {
  const hostMessages: Message[] = [];

  // Collect all host messages
  for (const conv of conversations) {
    if (propertyId && conv.property.id !== propertyId) continue;

    for (const msg of conv.messages) {
      if (msg.sender === 'host') {
        hostMessages.push(msg);
      }
    }
  }

  if (hostMessages.length === 0) {
    return { samplesAnalyzed: 0 };
  }

  // Analyze all messages
  const analyses = hostMessages.map((msg) => analyzeMessage(msg.content));

  // Aggregate results
  const allGreetings = analyses.map((a) => a.greeting).filter(Boolean) as string[];
  const allSignoffs = analyses.map((a) => a.signoff).filter(Boolean) as string[];
  const allPhrases = analyses.flatMap((a) => a.phrases);

  const emojiMessages = analyses.filter((a) => a.hasEmojis).length;
  const totalEmojis = analyses.reduce((sum, a) => sum + a.emojiCount, 0);
  const avgLength = analyses.reduce((sum, a) => sum + a.wordCount, 0) / analyses.length;
  const avgFormality = analyses.reduce((sum, a) => sum + a.formalityScore, 0) / analyses.length;
  const avgWarmth = analyses.reduce((sum, a) => sum + a.warmthScore, 0) / analyses.length;

  // Count phrase frequencies
  const phraseCounts = new Map<string, number>();
  for (const phrase of allPhrases) {
    phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
  }

  // Get top phrases (appearing more than once)
  const commonPhrases = [...phraseCounts.entries()]
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase]) => phrase);

  // Get unique greetings and signoffs
  const greetingCounts = new Map<string, number>();
  for (const g of allGreetings) {
    const lower = g.toLowerCase();
    greetingCounts.set(lower, (greetingCounts.get(lower) || 0) + 1);
  }
  const commonGreetings = [...greetingCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([greeting]) => greeting);

  const signoffCounts = new Map<string, number>();
  for (const s of allSignoffs) {
    const lower = s.toLowerCase();
    signoffCounts.set(lower, (signoffCounts.get(lower) || 0) + 1);
  }
  const commonSignoffs = [...signoffCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([signoff]) => signoff);

  return {
    propertyId: propertyId || 'global',
    formalityLevel: Math.round(avgFormality),
    warmthLevel: Math.round(avgWarmth),
    commonGreetings,
    commonSignoffs,
    usesEmojis: emojiMessages / hostMessages.length > 0.2, // Uses emojis if >20% of messages have them
    emojiFrequency: Math.round((totalEmojis / hostMessages.length) * 100),
    averageResponseLength: Math.round(avgLength),
    commonPhrases,
    samplesAnalyzed: hostMessages.length,
    lastUpdated: new Date(),
  };
}

/**
 * Learn from a specific edit - when host edits AI response
 */
export function learnFromEdit(
  originalResponse: string,
  editedResponse: string,
  guestIntent: string
): {
  addedPhrases: string[];
  removedPhrases: string[];
  toneShift: 'more_formal' | 'more_casual' | 'more_warm' | 'more_distant' | 'neutral';
} {
  const originalAnalysis = analyzeMessage(originalResponse);
  const editedAnalysis = analyzeMessage(editedResponse);

  // Find phrases added
  const addedPhrases = editedAnalysis.phrases.filter(
    (p) => !originalAnalysis.phrases.includes(p)
  );

  // Find phrases removed
  const removedPhrases = originalAnalysis.phrases.filter(
    (p) => !editedAnalysis.phrases.includes(p)
  );

  // Determine tone shift
  let toneShift: 'more_formal' | 'more_casual' | 'more_warm' | 'more_distant' | 'neutral' = 'neutral';

  const formalityDiff = editedAnalysis.formalityScore - originalAnalysis.formalityScore;
  const warmthDiff = editedAnalysis.warmthScore - originalAnalysis.warmthScore;

  if (Math.abs(formalityDiff) > Math.abs(warmthDiff)) {
    if (formalityDiff > 10) toneShift = 'more_formal';
    else if (formalityDiff < -10) toneShift = 'more_casual';
  } else {
    if (warmthDiff > 10) toneShift = 'more_warm';
    else if (warmthDiff < -10) toneShift = 'more_distant';
  }

  return {
    addedPhrases,
    removedPhrases,
    toneShift,
  };
}

/**
 * Calculate learning progress and accuracy
 */
export function calculateLearningProgress(
  learningEntries: LearningEntry[]
): {
  accuracyScore: number;
  totalAnalyzed: number;
  approvalRate: number;
  editRate: number;
} {
  if (learningEntries.length === 0) {
    return {
      accuracyScore: 0,
      totalAnalyzed: 0,
      approvalRate: 0,
      editRate: 0,
    };
  }

  const approved = learningEntries.filter((e) => e.wasApproved && !e.wasEdited).length;
  const edited = learningEntries.filter((e) => e.wasEdited).length;
  const total = learningEntries.length;

  const approvalRate = (approved / total) * 100;
  const editRate = (edited / total) * 100;

  // Accuracy score: approved without edits get full points, edited get partial
  const accuracyScore = ((approved + edited * 0.7) / total) * 100;

  return {
    accuracyScore: Math.round(accuracyScore),
    totalAnalyzed: total,
    approvalRate: Math.round(approvalRate),
    editRate: Math.round(editRate),
  };
}

/**
 * Generate style instructions for the AI based on learned profile
 */
export function generateStyleInstructions(profile: HostStyleProfile): string {
  const instructions: string[] = [];

  // Formality
  if (profile.formalityLevel > 70) {
    instructions.push('Use formal, professional language. Avoid slang and casual expressions.');
  } else if (profile.formalityLevel < 40) {
    instructions.push('Use casual, friendly language. Be conversational and relaxed.');
  } else {
    instructions.push('Use a balanced, semi-formal tone.');
  }

  // Warmth
  if (profile.warmthLevel > 70) {
    instructions.push('Be very warm and enthusiastic. Express genuine care and excitement.');
  } else if (profile.warmthLevel < 40) {
    instructions.push('Keep responses professional and to-the-point.');
  }

  // Emojis
  if (profile.usesEmojis) {
    instructions.push(`Include occasional emojis (about ${Math.round(profile.emojiFrequency / 10)} per message on average).`);
  } else {
    instructions.push('Do not use emojis.');
  }

  // Length
  if (profile.averageResponseLength > 100) {
    instructions.push('Provide detailed, thorough responses.');
  } else if (profile.averageResponseLength < 50) {
    instructions.push('Keep responses brief and concise.');
  }

  // Greetings
  if (profile.commonGreetings.length > 0) {
    instructions.push(`Preferred greetings: ${profile.commonGreetings.slice(0, 3).join(', ')}`);
  }

  // Sign-offs
  if (profile.commonSignoffs.length > 0) {
    instructions.push(`Preferred sign-offs: ${profile.commonSignoffs.slice(0, 3).join(', ')}`);
  }

  // Common phrases
  if (profile.commonPhrases.length > 0) {
    instructions.push(`Incorporate these phrases when appropriate: ${profile.commonPhrases.slice(0, 5).join(', ')}`);
  }

  return instructions.join('\n');
}

// Intent detection patterns for response categorization
const INTENT_PATTERNS: Record<string, RegExp[]> = {
  check_in: [/check.?in/i, /arrival/i, /key|access|door|lock/i, /when.*arrive/i],
  check_out: [/check.?out/i, /departure/i, /leaving/i, /late.*check.*out/i],
  wifi: [/wi.?fi/i, /internet|password|network/i],
  issue: [/broken|not working|problem|issue|fix/i, /doesn't work|dirty|noise/i],
  amenity: [/pool|gym|parking|tv|kitchen|bathroom/i],
  booking: [/book|reservation|extend|cancel/i, /dates|availability/i],
  thanks: [/thank|appreciate|great stay|wonderful/i],
  question: [/where|how|what|when|can I|is there/i],
};

/**
 * Detect guest intent from message content
 */
function detectIntent(content: string): string {
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        return intent;
      }
    }
  }
  return 'general';
}

/**
 * Anonymize message content by removing personal identifiable information
 * Keeps only patterns, not actual guest/host names or contact info
 */
function anonymizeContent(content: string): string {
  // Remove email addresses
  let anonymized = content.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');
  // Remove phone numbers
  anonymized = anonymized.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE]');
  // Remove specific addresses
  anonymized = anonymized.replace(/\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|court|ct|blvd|boulevard)\b/gi, '[ADDRESS]');
  // Remove URLs
  anonymized = anonymized.replace(/https?:\/\/[^\s]+/g, '[URL]');
  // Remove specific names (capitalized words at message start after greetings)
  anonymized = anonymized.replace(/^(hi|hello|hey|dear)\s+[A-Z][a-z]+/i, '$1 [NAME]');

  return anonymized;
}

/**
 * Analyze Hostaway historical messages to extract patterns
 * This processes raw API data for AI training
 */
export function analyzeHostawayHistory(
  conversations: HostawayConversation[],
  messagesByConversation: Record<number, HostawayMessage[]>,
  dateRangeStart?: Date,
  dateRangeEnd?: Date
): HistoricalAnalysisResult {
  const allHostMessages: { content: string; date: Date; conversationId: number; prevGuestMessage?: string }[] = [];
  let earliestDate: Date | null = null;
  let latestDate: Date | null = null;
  let totalMessages = 0;

  // Collect all host messages with context
  for (const conv of conversations) {
    const messages = messagesByConversation[conv.id] || [];

    // Sort messages by date
    const sortedMessages = [...messages].sort(
      (a, b) => new Date(a.insertedOn).getTime() - new Date(b.insertedOn).getTime()
    );

    for (let i = 0; i < sortedMessages.length; i++) {
      const msg = sortedMessages[i];
      const msgDate = new Date(msg.insertedOn);

      // Apply date range filter
      if (dateRangeStart && msgDate < dateRangeStart) continue;
      if (dateRangeEnd && msgDate > dateRangeEnd) continue;

      totalMessages++;

      // Track date range
      if (!earliestDate || msgDate < earliestDate) earliestDate = msgDate;
      if (!latestDate || msgDate > latestDate) latestDate = msgDate;

      // Only analyze outgoing (host) messages
      if (!msg.isIncoming && msg.body) {
        // Find previous guest message for context
        let prevGuestMessage: string | undefined;
        for (let j = i - 1; j >= 0; j--) {
          if (sortedMessages[j].isIncoming && sortedMessages[j].body) {
            prevGuestMessage = sortedMessages[j].body;
            break;
          }
        }

        allHostMessages.push({
          content: msg.body,
          date: msgDate,
          conversationId: conv.id,
          prevGuestMessage,
        });
      }
    }
  }

  // Analyze all host messages
  const analyses = allHostMessages.map((msg) => ({
    ...analyzeMessage(msg.content),
    intent: msg.prevGuestMessage ? detectIntent(msg.prevGuestMessage) : 'general',
    anonymizedContent: anonymizeContent(msg.content),
  }));

  // Build patterns map
  const patternMap = new Map<string, AnonymizedPattern>();
  let patternId = 0;

  // Collect greetings
  for (const analysis of analyses) {
    if (analysis.greeting) {
      const key = `greeting:${analysis.greeting.toLowerCase()}`;
      const existing = patternMap.get(key);
      if (existing) {
        existing.frequency++;
      } else {
        patternMap.set(key, {
          id: `pat_${++patternId}`,
          category: 'greeting',
          pattern: analysis.greeting.toLowerCase(),
          frequency: 1,
          contexts: [],
          lastSeen: new Date(),
        });
      }
    }
    if (analysis.signoff) {
      const key = `signoff:${analysis.signoff.toLowerCase()}`;
      const existing = patternMap.get(key);
      if (existing) {
        existing.frequency++;
      } else {
        patternMap.set(key, {
          id: `pat_${++patternId}`,
          category: 'signoff',
          pattern: analysis.signoff.toLowerCase(),
          frequency: 1,
          contexts: [],
          lastSeen: new Date(),
        });
      }
    }
    for (const phrase of analysis.phrases) {
      const key = `phrase:${phrase}`;
      const existing = patternMap.get(key);
      if (existing) {
        existing.frequency++;
        if (!existing.contexts.includes(analysis.intent)) {
          existing.contexts.push(analysis.intent);
        }
      } else {
        patternMap.set(key, {
          id: `pat_${++patternId}`,
          category: 'phrase',
          pattern: phrase,
          frequency: 1,
          contexts: [analysis.intent],
          lastSeen: new Date(),
        });
      }
    }
  }

  // Build response patterns by intent
  const intentGroups = new Map<string, { contents: string[]; lengths: number[] }>();
  for (const analysis of analyses) {
    const group = intentGroups.get(analysis.intent) || { contents: [], lengths: [] };
    group.contents.push(analysis.anonymizedContent);
    group.lengths.push(analysis.wordCount);
    intentGroups.set(analysis.intent, group);
  }

  const responsePatterns = [...intentGroups.entries()]
    .filter(([_, group]) => group.contents.length >= 3) // Only include intents with enough samples
    .map(([intent, group]) => ({
      guestIntent: intent,
      commonResponses: group.contents.slice(0, 5), // Keep only 5 examples
      avgResponseLength: Math.round(group.lengths.reduce((a, b) => a + b, 0) / group.lengths.length),
    }));

  // Calculate aggregate style metrics
  const avgFormality = analyses.length > 0
    ? analyses.reduce((sum, a) => sum + a.formalityScore, 0) / analyses.length
    : 50;
  const avgWarmth = analyses.length > 0
    ? analyses.reduce((sum, a) => sum + a.warmthScore, 0) / analyses.length
    : 50;
  const avgLength = analyses.length > 0
    ? analyses.reduce((sum, a) => sum + a.wordCount, 0) / analyses.length
    : 50;
  const emojiMessages = analyses.filter((a) => a.hasEmojis).length;
  const totalEmojis = analyses.reduce((sum, a) => sum + a.emojiCount, 0);

  // Get top patterns
  const sortedPatterns = [...patternMap.values()]
    .filter((p) => p.frequency >= 2) // Only include patterns that appear at least twice
    .sort((a, b) => b.frequency - a.frequency);

  // Build style profile
  const commonGreetings = sortedPatterns
    .filter((p) => p.category === 'greeting')
    .slice(0, 5)
    .map((p) => p.pattern);
  const commonSignoffs = sortedPatterns
    .filter((p) => p.category === 'signoff')
    .slice(0, 5)
    .map((p) => p.pattern);
  const commonPhrases = sortedPatterns
    .filter((p) => p.category === 'phrase')
    .slice(0, 10)
    .map((p) => p.pattern);

  return {
    totalConversationsAnalyzed: conversations.length,
    totalMessagesAnalyzed: totalMessages,
    hostMessagesAnalyzed: allHostMessages.length,
    dateRange: { earliest: earliestDate, latest: latestDate },
    patterns: sortedPatterns.slice(0, 50), // Limit stored patterns
    styleProfile: {
      formalityLevel: Math.round(avgFormality),
      warmthLevel: Math.round(avgWarmth),
      averageResponseLength: Math.round(avgLength),
      usesEmojis: analyses.length > 0 ? emojiMessages / analyses.length > 0.2 : false,
      emojiFrequency: analyses.length > 0 ? Math.round((totalEmojis / analyses.length) * 100) : 0,
      commonGreetings,
      commonSignoffs,
      commonPhrases,
      samplesAnalyzed: allHostMessages.length,
      lastUpdated: new Date(),
    },
    responsePatterns,
  };
}

/**
 * Merge new historical analysis with existing profile
 * Combines patterns and updates averages incrementally
 */
export function mergeAnalysisWithProfile(
  existingProfile: HostStyleProfile | undefined,
  newAnalysis: HistoricalAnalysisResult
): Partial<HostStyleProfile> {
  if (!existingProfile || existingProfile.samplesAnalyzed === 0) {
    return newAnalysis.styleProfile;
  }

  const totalSamples = existingProfile.samplesAnalyzed + (newAnalysis.styleProfile.samplesAnalyzed || 0);
  const existingWeight = existingProfile.samplesAnalyzed / totalSamples;
  const newWeight = (newAnalysis.styleProfile.samplesAnalyzed || 0) / totalSamples;

  // Weighted average for numeric values
  const formalityLevel = Math.round(
    existingProfile.formalityLevel * existingWeight +
    (newAnalysis.styleProfile.formalityLevel || 50) * newWeight
  );
  const warmthLevel = Math.round(
    existingProfile.warmthLevel * existingWeight +
    (newAnalysis.styleProfile.warmthLevel || 50) * newWeight
  );
  const averageResponseLength = Math.round(
    existingProfile.averageResponseLength * existingWeight +
    (newAnalysis.styleProfile.averageResponseLength || 50) * newWeight
  );
  const emojiFrequency = Math.round(
    existingProfile.emojiFrequency * existingWeight +
    (newAnalysis.styleProfile.emojiFrequency || 0) * newWeight
  );

  // Merge arrays, keeping most frequent
  const mergeArrays = (existing: string[], newArr: string[] | undefined, limit: number): string[] => {
    const combined = [...existing, ...(newArr || [])];
    const counts = new Map<string, number>();
    for (const item of combined) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([item]) => item);
  };

  return {
    formalityLevel,
    warmthLevel,
    averageResponseLength,
    usesEmojis: newAnalysis.styleProfile.usesEmojis ?? existingProfile.usesEmojis,
    emojiFrequency,
    commonGreetings: mergeArrays(existingProfile.commonGreetings, newAnalysis.styleProfile.commonGreetings, 5),
    commonSignoffs: mergeArrays(existingProfile.commonSignoffs, newAnalysis.styleProfile.commonSignoffs, 5),
    commonPhrases: mergeArrays(existingProfile.commonPhrases, newAnalysis.styleProfile.commonPhrases, 10),
    samplesAnalyzed: totalSamples,
    lastUpdated: new Date(),
  };
}

// ============================================
// QUICK REPLY TEMPLATE ANALYSIS & MATCHING
// ============================================

// Variable patterns in templates (e.g., {guest_name}, {{property}}, [WiFi])
const VARIABLE_PATTERNS = [
  /\{[^}]+\}/g,           // {variable}
  /\{\{[^}]+\}\}/g,       // {{variable}}
  /\[[A-Z][^\]]+\]/g,     // [Variable]
  /<[^>]+>/g,             // <variable>
];

// Keywords by category for auto-detection
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  wifi: ['wifi', 'wi-fi', 'internet', 'password', 'network', 'connection', 'router'],
  check_in: ['check-in', 'checkin', 'arrival', 'arrive', 'key', 'keypad', 'lockbox', 'door', 'code', 'access', 'entry'],
  check_out: ['check-out', 'checkout', 'departure', 'leave', 'leaving', 'late checkout'],
  parking: ['parking', 'park', 'car', 'vehicle', 'garage', 'driveway', 'spot'],
  amenities: ['pool', 'gym', 'tv', 'kitchen', 'washer', 'dryer', 'ac', 'air conditioning', 'heating', 'thermostat', 'hot tub', 'grill', 'bbq'],
  issue: ['sorry', 'apologize', 'problem', 'issue', 'fix', 'maintenance', 'broken', 'not working', 'repair'],
  thanks: ['thank', 'appreciate', 'grateful', 'enjoyed', 'pleasure', 'wonderful stay', 'great guest'],
  booking: ['reservation', 'booking', 'extend', 'dates', 'availability', 'price', 'rate', 'cancel'],
};

/**
 * Analyze a quick reply template to extract metadata
 */
export function analyzeTemplate(content: string): TemplateAnalysisResult {
  const analysis = analyzeMessage(content);

  // Detect variables
  let hasVariables = false;
  for (const pattern of VARIABLE_PATTERNS) {
    if (pattern.test(content)) {
      hasVariables = true;
      break;
    }
  }

  // Detect intents based on content
  const detectedIntents: string[] = [];
  const lowerContent = content.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword)) {
        if (!detectedIntents.includes(category)) {
          detectedIntents.push(category);
        }
        break;
      }
    }
  }

  // Suggest keywords from content
  const suggestedKeywords: string[] = [];
  const words = lowerContent.split(/\s+/);

  for (const word of words) {
    const cleanWord = word.replace(/[^a-z]/g, '');
    if (cleanWord.length >= 4) {
      for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(k => k.includes(cleanWord) || cleanWord.includes(k))) {
          if (!suggestedKeywords.includes(cleanWord)) {
            suggestedKeywords.push(cleanWord);
          }
        }
      }
    }
  }

  // Determine length category
  const wordCount = content.split(/\s+/).length;
  let length: 'short' | 'medium' | 'long' = 'medium';
  if (wordCount < 30) length = 'short';
  else if (wordCount > 100) length = 'long';

  // Determine tone
  let tone: 'formal' | 'casual' | 'friendly' | 'professional' = 'friendly';
  if (analysis.formalityScore > 70) {
    tone = analysis.warmthScore > 60 ? 'professional' : 'formal';
  } else if (analysis.formalityScore < 40) {
    tone = 'casual';
  } else {
    tone = analysis.warmthScore > 60 ? 'friendly' : 'professional';
  }

  return {
    tone,
    length,
    hasGreeting: !!analysis.greeting,
    hasSignoff: !!analysis.signoff,
    hasEmojis: analysis.hasEmojis,
    hasVariables,
    detectedIntents,
    suggestedKeywords: suggestedKeywords.slice(0, 10),
  };
}

/**
 * Parse CSV content to extract templates
 * Supports formats: "name,content" or "name,category,content"
 */
export function parseTemplatesFromCSV(csvContent: string): {
  name: string;
  content: string;
  category: QuickReplyTemplate['category'];
  keywords: string[];
}[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  const templates: {
    name: string;
    content: string;
    category: QuickReplyTemplate['category'];
    keywords: string[];
  }[] = [];

  for (const line of lines) {
    // Skip header row
    if (line.toLowerCase().includes('name') && line.toLowerCase().includes('content')) {
      continue;
    }

    // Parse CSV - handle quoted strings
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current.trim());

    if (parts.length >= 2) {
      const name = parts[0].replace(/^"|"$/g, '');
      let content: string;
      let category: QuickReplyTemplate['category'] = 'general';

      if (parts.length >= 3) {
        // Format: name, category, content
        const maybeCategory = parts[1].toLowerCase().replace(/^"|"$/g, '');
        if (Object.keys(CATEGORY_KEYWORDS).includes(maybeCategory) || maybeCategory === 'general') {
          category = maybeCategory as QuickReplyTemplate['category'];
          content = parts[2].replace(/^"|"$/g, '');
        } else {
          // Format: name, content (second field is content, not category)
          content = parts[1].replace(/^"|"$/g, '');
        }
      } else {
        content = parts[1].replace(/^"|"$/g, '');
      }

      if (name && content) {
        // Auto-detect category if not provided
        const analysis = analyzeTemplate(content);
        if (category === 'general' && analysis.detectedIntents.length > 0) {
          category = analysis.detectedIntents[0] as QuickReplyTemplate['category'];
        }

        templates.push({
          name,
          content,
          category,
          keywords: analysis.suggestedKeywords,
        });
      }
    }
  }

  return templates;
}

/**
 * Parse plain text templates (one per line or separated by blank lines)
 */
export function parseTemplatesFromText(textContent: string): {
  name: string;
  content: string;
  category: QuickReplyTemplate['category'];
  keywords: string[];
}[] {
  // Split by double newlines (paragraph breaks)
  const blocks = textContent.split(/\n\n+/).filter(b => b.trim());
  const templates: {
    name: string;
    content: string;
    category: QuickReplyTemplate['category'];
    keywords: string[];
  }[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const content = blocks[i].trim();
    if (content.length < 10) continue; // Skip too short

    const analysis = analyzeTemplate(content);
    const category = analysis.detectedIntents[0] as QuickReplyTemplate['category'] || 'general';

    // Generate name from first few words
    const firstWords = content.split(/\s+/).slice(0, 5).join(' ');
    const name = firstWords.length > 30 ? firstWords.slice(0, 30) + '...' : firstWords;

    templates.push({
      name: `Template ${i + 1}: ${name}`,
      content,
      category,
      keywords: analysis.suggestedKeywords,
    });
  }

  return templates;
}

/**
 * Find matching templates for a guest message
 * Returns templates sorted by match score (highest first)
 */
export function findMatchingTemplates(
  guestMessage: string,
  templates: QuickReplyTemplate[],
  propertyId?: string | null,
  limit: number = 5
): TemplateMatchResult[] {
  const lowerMessage = guestMessage.toLowerCase();
  const messageWords = new Set(lowerMessage.split(/\s+/).filter(w => w.length >= 3));

  const results: TemplateMatchResult[] = [];

  for (const template of templates) {
    let matchScore = 0;
    const matchedKeywords: string[] = [];
    const isPropertyMatch = template.propertyId === null || template.propertyId === propertyId;

    // Check keyword matches
    for (const keyword of template.keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        matchScore += 15;
        matchedKeywords.push(keyword);
      }
    }

    // Check category-based keywords
    const categoryKeywords = CATEGORY_KEYWORDS[template.category] || [];
    for (const keyword of categoryKeywords) {
      if (lowerMessage.includes(keyword)) {
        matchScore += 10;
        if (!matchedKeywords.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
      }
    }

    // Check word overlap with template content
    const templateWords = new Set(template.content.toLowerCase().split(/\s+/).filter(w => w.length >= 4));
    let wordOverlap = 0;
    for (const word of messageWords) {
      if (templateWords.has(word)) {
        wordOverlap++;
      }
    }
    matchScore += Math.min(wordOverlap * 3, 15);

    // Property match bonus
    if (isPropertyMatch && template.propertyId !== null) {
      matchScore += 10;
    }

    // Priority bonus
    matchScore += template.priority;

    // Usage frequency bonus (frequently used templates are likely more relevant)
    matchScore += Math.min(template.usageCount, 10);

    // Only include if there's some match
    if (matchScore > 0 || matchedKeywords.length > 0) {
      results.push({
        template,
        matchScore: Math.min(matchScore, 100),
        matchedKeywords,
        isPropertyMatch,
      });
    }
  }

  // Sort by score descending, then by property match
  return results
    .sort((a, b) => {
      if (b.isPropertyMatch !== a.isPropertyMatch) {
        return b.isPropertyMatch ? 1 : -1;
      }
      return b.matchScore - a.matchScore;
    })
    .slice(0, limit);
}

/**
 * Personalize a template with reservation details
 */
export function personalizeTemplate(
  templateContent: string,
  variables: Record<string, string>
): string {
  let personalized = templateContent;

  // Replace various variable formats
  for (const [key, value] of Object.entries(variables)) {
    const patterns = [
      new RegExp(`\\{${key}\\}`, 'gi'),
      new RegExp(`\\{\\{${key}\\}\\}`, 'gi'),
      new RegExp(`\\[${key}\\]`, 'gi'),
      new RegExp(`<${key}>`, 'gi'),
    ];

    for (const pattern of patterns) {
      personalized = personalized.replace(pattern, value);
    }
  }

  return personalized;
}

/**
 * Generate AI prompt enhancement based on matching template
 */
export function generateTemplateBasedPrompt(
  matchResult: TemplateMatchResult,
  guestMessage: string
): string {
  const { template } = matchResult;

  return `
IMPORTANT: The host has a preferred quick reply template for this type of question.
Use this template as the foundation for your response, adapting and personalizing it for the specific guest inquiry.

TEMPLATE TO USE:
"""
${template.content}
"""

Template details:
- Category: ${template.category}
- Tone: ${template.analyzedTone || 'friendly'}
- This template has been used ${template.usageCount} times

Instructions:
1. Base your response on the template structure and phrasing
2. Personalize with any specific details from the guest's message
3. Maintain the same tone and style as the template
4. Fill in any variable placeholders with appropriate information
5. If the guest asks something not covered by the template, add that information naturally

Guest's message: "${guestMessage}"
`.trim();
}
