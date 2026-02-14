// Edit Diff Analysis Service
// Learns from user edits to AI drafts to improve future responses

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'edit_diff_patterns';
const MAX_PATTERNS = 500; // Keep last 500 edit patterns

// Types of edits the user might make
export type EditType =
  | 'shortened' // Made response shorter
  | 'lengthened' // Made response longer
  | 'more_formal' // Added formality
  | 'more_casual' // Made more casual/friendly
  | 'added_emoji' // Added emojis
  | 'removed_emoji' // Removed emojis
  | 'added_greeting' // Added or changed greeting
  | 'changed_greeting' // Modified greeting style
  | 'added_signoff' // Added or changed sign-off
  | 'changed_signoff' // Modified sign-off style
  | 'added_info' // Added new information
  | 'removed_info' // Removed information
  | 'corrected_facts' // Fixed incorrect information
  | 'softened_tone' // Made tone gentler
  | 'more_direct' // Made more direct/assertive
  | 'added_empathy' // Added empathetic language
  | 'personalized' // Added personal touches
  | 'depersonalized' // Removed personal elements
  | 'restructured'; // Changed structure/order

export interface EditPattern {
  id: string;
  timestamp: number;
  propertyId?: string;
  guestIntent?: string; // What the guest was asking about

  // The actual edit
  originalDraft: string;
  editedMessage: string;

  // Detected changes
  editTypes: EditType[];

  // Metrics
  lengthChange: number; // Percentage change in length
  wordCountChange: number;

  // Extracted patterns
  addedPhrases: string[];
  removedPhrases: string[];
  greetingBefore?: string;
  greetingAfter?: string;
  signoffBefore?: string;
  signoffAfter?: string;

  // Sentiment shift
  toneShift?: 'warmer' | 'cooler' | 'neutral';
}

export interface EditLearningStats {
  totalEdits: number;
  editsByType: Record<EditType, number>;
  averageLengthChange: number;
  preferredGreetings: string[];
  preferredSignoffs: string[];
  commonAddedPhrases: string[];
  commonRemovedPhrases: string[];
  tonePreference: 'warmer' | 'cooler' | 'balanced';
  lengthPreference: 'shorter' | 'longer' | 'same';
}

// Common greetings to detect
const GREETINGS = [
  'hi', 'hey', 'hello', 'good morning', 'good afternoon', 'good evening',
  'hi there', 'hey there', 'hello there', 'greetings', 'dear'
];

// Common sign-offs to detect
const SIGNOFFS = [
  'thanks', 'thank you', 'cheers', 'best', 'regards', 'sincerely',
  'take care', 'have a great', 'enjoy', 'let me know', 'feel free',
  'happy to help', 'looking forward'
];

// Empathy phrases
const EMPATHY_PHRASES = [
  'understand', 'sorry', 'apologize', 'appreciate', 'i know', 'must be',
  'frustrating', 'inconvenient', 'completely', 'absolutely', 'of course'
];

// Formal markers
const FORMAL_MARKERS = [
  'please', 'kindly', 'would you', 'could you', 'we appreciate',
  'thank you for', 'regarding', 'concerning', 'furthermore'
];

// Casual markers
const CASUAL_MARKERS = [
  '!', 'awesome', 'great', 'cool', 'no worries', 'sure thing',
  'gotcha', 'yep', 'nope', 'btw', 'fyi'
];

/**
 * Analyze the differences between an AI draft and the user's edited version
 */
export function analyzeEdit(
  originalDraft: string,
  editedMessage: string,
  propertyId?: string,
  guestIntent?: string
): EditPattern {
  const editTypes: EditType[] = [];

  // Length analysis
  const originalLength = originalDraft.length;
  const editedLength = editedMessage.length;
  const lengthChange = ((editedLength - originalLength) / originalLength) * 100;

  const originalWords = originalDraft.split(/\s+/).length;
  const editedWords = editedMessage.split(/\s+/).length;
  const wordCountChange = editedWords - originalWords;

  if (lengthChange < -20) {
    editTypes.push('shortened');
  } else if (lengthChange > 20) {
    editTypes.push('lengthened');
  }

  // Emoji analysis
  const originalEmojis = (originalDraft.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  const editedEmojis = (editedMessage.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;

  if (editedEmojis > originalEmojis) {
    editTypes.push('added_emoji');
  } else if (editedEmojis < originalEmojis) {
    editTypes.push('removed_emoji');
  }

  // Greeting analysis
  const greetingBefore = extractGreeting(originalDraft);
  const greetingAfter = extractGreeting(editedMessage);

  if (!greetingBefore && greetingAfter) {
    editTypes.push('added_greeting');
  } else if (greetingBefore && greetingAfter && greetingBefore !== greetingAfter) {
    editTypes.push('changed_greeting');
  }

  // Sign-off analysis
  const signoffBefore = extractSignoff(originalDraft);
  const signoffAfter = extractSignoff(editedMessage);

  if (!signoffBefore && signoffAfter) {
    editTypes.push('added_signoff');
  } else if (signoffBefore && signoffAfter && signoffBefore !== signoffAfter) {
    editTypes.push('changed_signoff');
  }

  // Tone analysis
  const originalFormal = countMatches(originalDraft.toLowerCase(), FORMAL_MARKERS);
  const editedFormal = countMatches(editedMessage.toLowerCase(), FORMAL_MARKERS);
  const originalCasual = countMatches(originalDraft.toLowerCase(), CASUAL_MARKERS);
  const editedCasual = countMatches(editedMessage.toLowerCase(), CASUAL_MARKERS);

  if (editedFormal > originalFormal && editedCasual <= originalCasual) {
    editTypes.push('more_formal');
  } else if (editedCasual > originalCasual && editedFormal <= originalFormal) {
    editTypes.push('more_casual');
  }

  // Empathy analysis
  const originalEmpathy = countMatches(originalDraft.toLowerCase(), EMPATHY_PHRASES);
  const editedEmpathy = countMatches(editedMessage.toLowerCase(), EMPATHY_PHRASES);

  if (editedEmpathy > originalEmpathy) {
    editTypes.push('added_empathy');
  }

  // Extract added/removed phrases
  const { addedPhrases, removedPhrases } = extractPhraseChanges(originalDraft, editedMessage);

  if (addedPhrases.length > 0) {
    editTypes.push('added_info');
  }
  if (removedPhrases.length > 0) {
    editTypes.push('removed_info');
  }

  // Determine tone shift
  let toneShift: 'warmer' | 'cooler' | 'neutral' = 'neutral';
  const warmthIndicators = editedEmpathy - originalEmpathy + editedCasual - originalCasual + (editedEmojis - originalEmojis);
  if (warmthIndicators > 1) {
    toneShift = 'warmer';
  } else if (warmthIndicators < -1) {
    toneShift = 'cooler';
  }

  return {
    id: `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    propertyId,
    guestIntent,
    originalDraft,
    editedMessage,
    editTypes,
    lengthChange,
    wordCountChange,
    addedPhrases,
    removedPhrases,
    greetingBefore,
    greetingAfter,
    signoffBefore,
    signoffAfter,
    toneShift,
  };
}

/**
 * Extract greeting from message
 */
function extractGreeting(text: string): string | undefined {
  const firstLine = text.split(/[.!?\n]/)[0]?.toLowerCase().trim() || '';

  for (const greeting of GREETINGS) {
    if (firstLine.startsWith(greeting)) {
      // Extract the full greeting including name if present
      const match = firstLine.match(new RegExp(`^${greeting}[,!]?\\s*\\w*`, 'i'));
      return match ? match[0].trim() : greeting;
    }
  }

  return undefined;
}

/**
 * Extract sign-off from message
 */
function extractSignoff(text: string): string | undefined {
  const lines = text.split(/[.!?\n]/).filter(l => l.trim());
  const lastLines = lines.slice(-2).join(' ').toLowerCase();

  for (const signoff of SIGNOFFS) {
    if (lastLines.includes(signoff)) {
      return signoff;
    }
  }

  return undefined;
}

/**
 * Count matches of patterns in text
 */
function countMatches(text: string, patterns: string[]): number {
  return patterns.reduce((count, pattern) => {
    return count + (text.includes(pattern) ? 1 : 0);
  }, 0);
}

/**
 * Extract significant phrases that were added or removed
 */
function extractPhraseChanges(original: string, edited: string): {
  addedPhrases: string[];
  removedPhrases: string[];
} {
  // Split into sentences
  const originalSentences = original.split(/[.!?]+/).map(s => s.trim().toLowerCase()).filter(s => s.length > 10);
  const editedSentences = edited.split(/[.!?]+/).map(s => s.trim().toLowerCase()).filter(s => s.length > 10);

  const addedPhrases: string[] = [];
  const removedPhrases: string[] = [];

  // Find sentences in edited that don't exist in original
  for (const sentence of editedSentences) {
    const found = originalSentences.some(orig =>
      orig.includes(sentence) || sentence.includes(orig) ||
      calculateSimilarity(orig, sentence) > 0.8
    );
    if (!found && sentence.length > 15) {
      addedPhrases.push(sentence);
    }
  }

  // Find sentences in original that don't exist in edited
  for (const sentence of originalSentences) {
    const found = editedSentences.some(edit =>
      edit.includes(sentence) || sentence.includes(edit) ||
      calculateSimilarity(edit, sentence) > 0.8
    );
    if (!found && sentence.length > 15) {
      removedPhrases.push(sentence);
    }
  }

  return { addedPhrases, removedPhrases };
}

/**
 * Calculate similarity between two strings (Jaccard similarity on words)
 */
function calculateSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));

  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}

/**
 * Store an edit pattern for learning
 */
export async function storeEditPattern(pattern: EditPattern): Promise<void> {
  try {
    const existing = await getStoredPatterns();

    // Add new pattern at the beginning
    existing.unshift(pattern);

    // Keep only the most recent patterns
    const trimmed = existing.slice(0, MAX_PATTERNS);

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    console.log('[EditDiff] Stored edit pattern:', pattern.editTypes);
  } catch (error) {
    console.error('[EditDiff] Failed to store pattern:', error);
  }
}

/**
 * Get all stored edit patterns
 */
export async function getStoredPatterns(): Promise<EditPattern[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[EditDiff] Failed to get patterns:', error);
    return [];
  }
}

/**
 * Calculate learning statistics from edit patterns
 */
export async function getEditLearningStats(): Promise<EditLearningStats> {
  const patterns = await getStoredPatterns();

  const editsByType: Record<EditType, number> = {
    shortened: 0,
    lengthened: 0,
    more_formal: 0,
    more_casual: 0,
    added_emoji: 0,
    removed_emoji: 0,
    added_greeting: 0,
    changed_greeting: 0,
    added_signoff: 0,
    changed_signoff: 0,
    added_info: 0,
    removed_info: 0,
    corrected_facts: 0,
    softened_tone: 0,
    more_direct: 0,
    added_empathy: 0,
    personalized: 0,
    depersonalized: 0,
    restructured: 0,
  };

  let totalLengthChange = 0;
  const greetings: Record<string, number> = {};
  const signoffs: Record<string, number> = {};
  const addedPhrases: Record<string, number> = {};
  const removedPhrases: Record<string, number> = {};
  let warmerCount = 0;
  let coolerCount = 0;

  for (const pattern of patterns) {
    // Count edit types
    for (const editType of pattern.editTypes) {
      editsByType[editType]++;
    }

    // Track length changes
    totalLengthChange += pattern.lengthChange;

    // Track preferred greetings
    if (pattern.greetingAfter) {
      greetings[pattern.greetingAfter] = (greetings[pattern.greetingAfter] || 0) + 1;
    }

    // Track preferred sign-offs
    if (pattern.signoffAfter) {
      signoffs[pattern.signoffAfter] = (signoffs[pattern.signoffAfter] || 0) + 1;
    }

    // Track common phrases
    for (const phrase of pattern.addedPhrases) {
      addedPhrases[phrase] = (addedPhrases[phrase] || 0) + 1;
    }
    for (const phrase of pattern.removedPhrases) {
      removedPhrases[phrase] = (removedPhrases[phrase] || 0) + 1;
    }

    // Track tone shifts
    if (pattern.toneShift === 'warmer') warmerCount++;
    if (pattern.toneShift === 'cooler') coolerCount++;
  }

  // Calculate preferences
  const averageLengthChange = patterns.length > 0 ? totalLengthChange / patterns.length : 0;

  const preferredGreetings = Object.entries(greetings)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([g]) => g);

  const preferredSignoffs = Object.entries(signoffs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([s]) => s);

  const commonAddedPhrases = Object.entries(addedPhrases)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([p]) => p);

  const commonRemovedPhrases = Object.entries(removedPhrases)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([p]) => p);

  // Determine preferences
  let tonePreference: 'warmer' | 'cooler' | 'balanced' = 'balanced';
  if (warmerCount > coolerCount * 1.5) tonePreference = 'warmer';
  else if (coolerCount > warmerCount * 1.5) tonePreference = 'cooler';

  let lengthPreference: 'shorter' | 'longer' | 'same' = 'same';
  if (averageLengthChange < -15) lengthPreference = 'shorter';
  else if (averageLengthChange > 15) lengthPreference = 'longer';

  return {
    totalEdits: patterns.length,
    editsByType,
    averageLengthChange,
    preferredGreetings,
    preferredSignoffs,
    commonAddedPhrases,
    commonRemovedPhrases,
    tonePreference,
    lengthPreference,
  };
}

/**
 * Generate AI prompt adjustments based on learned patterns
 */
export async function getPromptAdjustments(propertyId?: string): Promise<string> {
  const stats = await getEditLearningStats();

  if (stats.totalEdits < 3) {
    return ''; // Not enough data yet
  }

  const adjustments: string[] = [];

  // Length preference
  if (stats.lengthPreference === 'shorter') {
    adjustments.push('Keep responses concise and brief. The user prefers shorter messages.');
  } else if (stats.lengthPreference === 'longer') {
    adjustments.push('Provide detailed, thorough responses. The user prefers comprehensive messages.');
  }

  // Tone preference
  if (stats.tonePreference === 'warmer') {
    adjustments.push('Use a warm, friendly tone with personal touches. Add empathy where appropriate.');
  } else if (stats.tonePreference === 'cooler') {
    adjustments.push('Maintain a professional, businesslike tone. Keep it formal and direct.');
  }

  // Emoji preference
  if (stats.editsByType.added_emoji > stats.editsByType.removed_emoji * 2) {
    adjustments.push('Include appropriate emojis to add warmth.');
  } else if (stats.editsByType.removed_emoji > stats.editsByType.added_emoji * 2) {
    adjustments.push('Avoid using emojis in responses.');
  }

  // Greeting preference
  if (stats.preferredGreetings.length > 0) {
    adjustments.push(`Use greetings like: "${stats.preferredGreetings[0]}"`);
  }

  // Sign-off preference
  if (stats.preferredSignoffs.length > 0) {
    adjustments.push(`End messages with phrases like: "${stats.preferredSignoffs[0]}"`);
  }

  // Empathy preference
  if (stats.editsByType.added_empathy > stats.totalEdits * 0.2) {
    adjustments.push('Show empathy and understanding in responses.');
  }

  // Common phrases to include
  if (stats.commonAddedPhrases.length > 0) {
    adjustments.push(`The user often adds phrases like: "${stats.commonAddedPhrases[0]}"`);
  }

  // Things to avoid
  if (stats.commonRemovedPhrases.length > 0) {
    adjustments.push(`Avoid phrases like: "${stats.commonRemovedPhrases[0]}"`);
  }

  if (adjustments.length === 0) {
    return '';
  }

  return `\n\n### User Style Preferences (learned from their edits):\n${adjustments.map(a => `- ${a}`).join('\n')}`;
}

/**
 * Get a human-readable summary of what was learned from an edit
 */
export function getEditSummary(pattern: EditPattern): string {
  const insights: string[] = [];

  for (const editType of pattern.editTypes) {
    switch (editType) {
      case 'shortened':
        insights.push('Made the response shorter');
        break;
      case 'lengthened':
        insights.push('Added more detail');
        break;
      case 'more_formal':
        insights.push('Made tone more formal');
        break;
      case 'more_casual':
        insights.push('Made tone more casual');
        break;
      case 'added_emoji':
        insights.push('Added emojis');
        break;
      case 'removed_emoji':
        insights.push('Removed emojis');
        break;
      case 'added_greeting':
        insights.push(`Added greeting: "${pattern.greetingAfter}"`);
        break;
      case 'changed_greeting':
        insights.push(`Changed greeting to: "${pattern.greetingAfter}"`);
        break;
      case 'added_signoff':
        insights.push(`Added sign-off: "${pattern.signoffAfter}"`);
        break;
      case 'changed_signoff':
        insights.push(`Changed sign-off to: "${pattern.signoffAfter}"`);
        break;
      case 'added_info':
        insights.push('Added new information');
        break;
      case 'removed_info':
        insights.push('Removed some content');
        break;
      case 'added_empathy':
        insights.push('Added empathetic language');
        break;
    }
  }

  if (pattern.toneShift === 'warmer') {
    insights.push('Overall warmer tone');
  } else if (pattern.toneShift === 'cooler') {
    insights.push('Overall cooler tone');
  }

  return insights.length > 0 ? insights.join(' • ') : 'Minor adjustments';
}

/**
 * Clear all stored patterns
 */
export async function clearEditPatterns(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  await AsyncStorage.removeItem(REJECTION_STORAGE_KEY);
  console.log('[EditDiff] Cleared all edit patterns');
}

// ============================================
// REJECTION LEARNING
// ============================================

const REJECTION_STORAGE_KEY = 'rejection_patterns';
const MAX_REJECTIONS = 200;

export interface RejectionPattern {
  id: string;
  timestamp: number;
  propertyId?: string;
  guestIntent?: string;
  rejectedContent: string;
  guestMessage: string; // What the guest asked

  // Analysis of why it might have been rejected
  detectedIssues: RejectionIssue[];

  // Context
  sentiment?: string;
  confidence?: number;
}

export type RejectionIssue =
  | 'too_long'
  | 'too_short'
  | 'too_formal'
  | 'too_casual'
  | 'wrong_tone'
  | 'missing_info'
  | 'incorrect_info'
  | 'generic_response'
  | 'not_personalized'
  | 'inappropriate_emoji'
  | 'bad_timing'
  | 'unknown';

/**
 * Analyze why a draft might have been rejected
 */
export function analyzeRejection(
  rejectedDraft: string,
  guestMessage: string,
  propertyId?: string,
  guestIntent?: string,
  sentiment?: string,
  confidence?: number
): RejectionPattern {
  const detectedIssues: RejectionIssue[] = [];

  // Length analysis
  const wordCount = rejectedDraft.split(/\s+/).length;
  if (wordCount > 100) {
    detectedIssues.push('too_long');
  } else if (wordCount < 10) {
    detectedIssues.push('too_short');
  }

  // Generic response detection
  const genericPhrases = [
    'let me know if you have any questions',
    'please don\'t hesitate',
    'we\'re here to help',
    'thank you for reaching out',
    'happy to assist',
  ];
  const lowerDraft = rejectedDraft.toLowerCase();
  const genericCount = genericPhrases.filter(p => lowerDraft.includes(p)).length;
  if (genericCount >= 2) {
    detectedIssues.push('generic_response');
  }

  // Check if guest name is missing when it should be included
  const guestNameMentioned = /\b(hi|hey|hello|dear)\s+\w+/i.test(rejectedDraft);
  if (!guestNameMentioned && wordCount > 20) {
    detectedIssues.push('not_personalized');
  }

  // Emoji mismatch (emojis in formal context)
  const hasEmojis = /[\u{1F300}-\u{1F9FF}]/gu.test(rejectedDraft);
  const formalContext = /complaint|issue|problem|refund|damage|broken/i.test(guestMessage);
  if (hasEmojis && formalContext) {
    detectedIssues.push('inappropriate_emoji');
  }

  // Missing info detection (guest asked specific question, response doesn't address it)
  const guestAskedWifi = /wifi|password|internet/i.test(guestMessage);
  const responseHasWifi = /wifi|password|network/i.test(rejectedDraft);
  if (guestAskedWifi && !responseHasWifi) {
    detectedIssues.push('missing_info');
  }

  const guestAskedCheckIn = /check.?in|arrival|key|code|lock/i.test(guestMessage);
  const responseHasCheckIn = /check.?in|arrive|key|code|door/i.test(rejectedDraft);
  if (guestAskedCheckIn && !responseHasCheckIn) {
    detectedIssues.push('missing_info');
  }

  // If no specific issues detected, mark as unknown
  if (detectedIssues.length === 0) {
    detectedIssues.push('unknown');
  }

  return {
    id: `rejection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    propertyId,
    guestIntent,
    rejectedContent: rejectedDraft,
    guestMessage,
    detectedIssues,
    sentiment,
    confidence,
  };
}

/**
 * Store a rejection pattern for learning
 */
export async function storeRejectionPattern(pattern: RejectionPattern): Promise<void> {
  try {
    const existing = await getStoredRejections();
    existing.unshift(pattern);
    const trimmed = existing.slice(0, MAX_REJECTIONS);
    await AsyncStorage.setItem(REJECTION_STORAGE_KEY, JSON.stringify(trimmed));
    console.log('[EditDiff] Stored rejection pattern:', pattern.detectedIssues);
  } catch (error) {
    console.error('[EditDiff] Failed to store rejection:', error);
  }
}

/**
 * Get all stored rejection patterns
 */
export async function getStoredRejections(): Promise<RejectionPattern[]> {
  try {
    const data = await AsyncStorage.getItem(REJECTION_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[EditDiff] Failed to get rejections:', error);
    return [];
  }
}

/**
 * Get rejection-based prompt adjustments
 */
export async function getRejectionAdjustments(): Promise<string> {
  const rejections = await getStoredRejections();

  if (rejections.length < 2) {
    return ''; // Not enough data
  }

  // Count issues
  const issueCounts: Record<RejectionIssue, number> = {
    too_long: 0,
    too_short: 0,
    too_formal: 0,
    too_casual: 0,
    wrong_tone: 0,
    missing_info: 0,
    incorrect_info: 0,
    generic_response: 0,
    not_personalized: 0,
    inappropriate_emoji: 0,
    bad_timing: 0,
    unknown: 0,
  };

  for (const rejection of rejections) {
    for (const issue of rejection.detectedIssues) {
      issueCounts[issue]++;
    }
  }

  const warnings: string[] = [];
  const total = rejections.length;

  // Generate warnings for common issues
  if (issueCounts.too_long > total * 0.3) {
    warnings.push('Your drafts are often too long. Keep responses concise.');
  }
  if (issueCounts.generic_response > total * 0.3) {
    warnings.push('Avoid generic phrases. Be specific and personal.');
  }
  if (issueCounts.not_personalized > total * 0.3) {
    warnings.push('Include the guest\'s name and personal details when appropriate.');
  }
  if (issueCounts.missing_info > total * 0.2) {
    warnings.push('Make sure to directly address all questions the guest asked.');
  }
  if (issueCounts.inappropriate_emoji > total * 0.2) {
    warnings.push('Be careful with emojis in serious/complaint situations.');
  }

  if (warnings.length === 0) {
    return '';
  }

  return `\n\n### Learned from Rejected Drafts (things to avoid):\n${warnings.map(w => `- ${w}`).join('\n')}`;
}

/**
 * Get summary of what was learned from a rejection
 */
export function getRejectionSummary(pattern: RejectionPattern): string {
  const insights: string[] = [];

  for (const issue of pattern.detectedIssues) {
    switch (issue) {
      case 'too_long':
        insights.push('Response was too long');
        break;
      case 'too_short':
        insights.push('Response was too short');
        break;
      case 'generic_response':
        insights.push('Response was too generic');
        break;
      case 'not_personalized':
        insights.push('Missing personalization');
        break;
      case 'missing_info':
        insights.push('Didn\'t address the question');
        break;
      case 'inappropriate_emoji':
        insights.push('Emojis weren\'t appropriate');
        break;
      case 'unknown':
        insights.push('Style didn\'t match preference');
        break;
    }
  }

  return insights.length > 0 ? insights.join(' • ') : 'Noted for learning';
}

// ============================================
// INDEPENDENT REPLY LEARNING
// ============================================

const INDEPENDENT_REPLY_STORAGE_KEY = 'independent_reply_patterns';
const MAX_INDEPENDENT_PATTERNS = 300;

export interface IndependentReplyPattern {
  id: string;
  timestamp: number;
  propertyId?: string;
  guestIntent?: string;
  guestMessage: string;

  // The AI's suggestion that was ignored
  aiDraft: string;

  // The host's actual reply
  hostReply: string;

  // Detected differences (what the host preferred over AI)
  stylePreferences: StylePreference[];

  // Metrics
  aiDraftLength: number;
  hostReplyLength: number;
  lengthDifference: number; // percentage

  // Detected patterns
  hostGreeting?: string;
  hostSignoff?: string;
  aiGreeting?: string;
  aiSignoff?: string;

  // Tone comparison
  hostTone: 'formal' | 'casual' | 'neutral';
  aiTone: 'formal' | 'casual' | 'neutral';
}

export type StylePreference =
  | 'prefers_shorter'
  | 'prefers_longer'
  | 'prefers_casual'
  | 'prefers_formal'
  | 'prefers_emojis'
  | 'avoids_emojis'
  | 'different_greeting'
  | 'different_signoff'
  | 'more_direct'
  | 'more_personal'
  | 'completely_different'; // Host wrote something unrelated

/**
 * Analyze when host sends their own reply instead of using AI draft
 * This provides valuable learning signals about what the AI got wrong
 */
export function analyzeIndependentReply(
  aiDraft: string,
  hostReply: string,
  guestMessage: string,
  propertyId?: string,
  guestIntent?: string
): IndependentReplyPattern {
  const stylePreferences: StylePreference[] = [];

  // Length comparison
  const aiLength = aiDraft.length;
  const hostLength = hostReply.length;
  const lengthDiff = ((hostLength - aiLength) / aiLength) * 100;

  if (lengthDiff < -30) {
    stylePreferences.push('prefers_shorter');
  } else if (lengthDiff > 30) {
    stylePreferences.push('prefers_longer');
  }

  // Tone detection
  const aiTone = detectTone(aiDraft);
  const hostTone = detectTone(hostReply);

  if (aiTone === 'formal' && hostTone === 'casual') {
    stylePreferences.push('prefers_casual');
  } else if (aiTone === 'casual' && hostTone === 'formal') {
    stylePreferences.push('prefers_formal');
  }

  // Emoji comparison
  const aiEmojis = (aiDraft.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  const hostEmojis = (hostReply.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;

  if (hostEmojis > aiEmojis && aiEmojis === 0) {
    stylePreferences.push('prefers_emojis');
  } else if (aiEmojis > hostEmojis && hostEmojis === 0) {
    stylePreferences.push('avoids_emojis');
  }

  // Greeting/signoff comparison
  const aiGreeting = extractGreeting(aiDraft);
  const hostGreeting = extractGreeting(hostReply);
  const aiSignoff = extractSignoff(aiDraft);
  const hostSignoff = extractSignoff(hostReply);

  if (aiGreeting !== hostGreeting && hostGreeting) {
    stylePreferences.push('different_greeting');
  }
  if (aiSignoff !== hostSignoff && hostSignoff) {
    stylePreferences.push('different_signoff');
  }

  // Check if content is completely different (low similarity)
  const similarity = calculateSimilarity(aiDraft, hostReply);
  if (similarity < 0.2) {
    stylePreferences.push('completely_different');
  }

  // Check for more direct style (fewer filler words)
  const aiFillerCount = countFillerWords(aiDraft);
  const hostFillerCount = countFillerWords(hostReply);
  if (hostFillerCount < aiFillerCount * 0.5) {
    stylePreferences.push('more_direct');
  }

  // Check for personal touches
  const hostHasName = /\b(hi|hey|hello)\s+\w+/i.test(hostReply);
  const aiHasName = /\b(hi|hey|hello)\s+\w+/i.test(aiDraft);
  if (hostHasName && !aiHasName) {
    stylePreferences.push('more_personal');
  }

  return {
    id: `independent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    propertyId,
    guestIntent,
    guestMessage,
    aiDraft,
    hostReply,
    stylePreferences,
    aiDraftLength: aiLength,
    hostReplyLength: hostLength,
    lengthDifference: lengthDiff,
    hostGreeting,
    hostSignoff,
    aiGreeting,
    aiSignoff,
    hostTone,
    aiTone,
  };
}

/**
 * Detect overall tone of a message
 */
function detectTone(text: string): 'formal' | 'casual' | 'neutral' {
  const lower = text.toLowerCase();
  const formalScore = countMatches(lower, FORMAL_MARKERS);
  const casualScore = countMatches(lower, CASUAL_MARKERS);
  const hasEmojis = /[\u{1F300}-\u{1F9FF}]/gu.test(text);

  let casualScoreAdj = casualScore;
  if (hasEmojis) casualScoreAdj += 2;

  if (formalScore > casualScoreAdj + 1) return 'formal';
  if (casualScoreAdj > formalScore + 1) return 'casual';
  return 'neutral';
}

/**
 * Count filler words that make text less direct
 */
function countFillerWords(text: string): number {
  const fillers = [
    'just', 'actually', 'basically', 'really', 'please note',
    'i wanted to', 'i would like to', 'feel free to', 'don\'t hesitate',
    'as mentioned', 'as discussed', 'going forward'
  ];
  return countMatches(text.toLowerCase(), fillers);
}

/**
 * Store an independent reply pattern for learning
 */
export async function storeIndependentReplyPattern(
  pattern: IndependentReplyPattern
): Promise<void> {
  try {
    const existing = await getStoredIndependentPatterns();
    existing.unshift(pattern);
    const trimmed = existing.slice(0, MAX_INDEPENDENT_PATTERNS);
    await AsyncStorage.setItem(INDEPENDENT_REPLY_STORAGE_KEY, JSON.stringify(trimmed));
    console.log('[EditDiff] Stored independent reply pattern:', pattern.stylePreferences);
  } catch (error) {
    console.error('[EditDiff] Failed to store independent pattern:', error);
  }
}

/**
 * Get all stored independent reply patterns
 */
export async function getStoredIndependentPatterns(): Promise<IndependentReplyPattern[]> {
  try {
    const data = await AsyncStorage.getItem(INDEPENDENT_REPLY_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[EditDiff] Failed to get independent patterns:', error);
    return [];
  }
}

/**
 * Get prompt adjustments based on independent reply patterns
 */
export async function getIndependentReplyAdjustments(): Promise<string> {
  const patterns = await getStoredIndependentPatterns();

  if (patterns.length < 3) {
    return ''; // Not enough data
  }

  const prefCounts: Record<StylePreference, number> = {
    prefers_shorter: 0,
    prefers_longer: 0,
    prefers_casual: 0,
    prefers_formal: 0,
    prefers_emojis: 0,
    avoids_emojis: 0,
    different_greeting: 0,
    different_signoff: 0,
    more_direct: 0,
    more_personal: 0,
    completely_different: 0,
  };

  for (const pattern of patterns) {
    for (const pref of pattern.stylePreferences) {
      prefCounts[pref]++;
    }
  }

  const total = patterns.length;
  const adjustments: string[] = [];

  if (prefCounts.prefers_shorter > total * 0.4) {
    adjustments.push('Host consistently writes shorter than AI suggests. Be more concise.');
  }
  if (prefCounts.prefers_casual > total * 0.4) {
    adjustments.push('Host prefers casual tone over AI\'s formal suggestions.');
  }
  if (prefCounts.prefers_formal > total * 0.4) {
    adjustments.push('Host prefers formal tone over AI\'s casual suggestions.');
  }
  if (prefCounts.more_direct > total * 0.3) {
    adjustments.push('Host is more direct. Avoid filler phrases and get to the point.');
  }
  if (prefCounts.avoids_emojis > total * 0.3) {
    adjustments.push('Host removes emojis. Avoid using emojis in drafts.');
  }
  if (prefCounts.prefers_emojis > total * 0.3) {
    adjustments.push('Host adds emojis. Include appropriate emojis.');
  }

  if (adjustments.length === 0) {
    return '';
  }

  return `\n\n### Learned from Host's Own Replies:\n${adjustments.map(a => `- ${a}`).join('\n')}`;
}

/**
 * Get summary of what was learned from an independent reply
 */
export function getIndependentReplySummary(pattern: IndependentReplyPattern): string {
  const insights: string[] = [];

  for (const pref of pattern.stylePreferences) {
    switch (pref) {
      case 'prefers_shorter':
        insights.push('Prefers shorter messages');
        break;
      case 'prefers_longer':
        insights.push('Prefers more detail');
        break;
      case 'prefers_casual':
        insights.push('Prefers casual tone');
        break;
      case 'prefers_formal':
        insights.push('Prefers formal tone');
        break;
      case 'prefers_emojis':
        insights.push('Likes using emojis');
        break;
      case 'avoids_emojis':
        insights.push('Avoids emojis');
        break;
      case 'different_greeting':
        insights.push(`Uses greeting: "${pattern.hostGreeting}"`);
        break;
      case 'different_signoff':
        insights.push(`Uses sign-off: "${pattern.hostSignoff}"`);
        break;
      case 'more_direct':
        insights.push('More direct style');
        break;
      case 'more_personal':
        insights.push('More personal touches');
        break;
      case 'completely_different':
        insights.push('Took a different approach');
        break;
    }
  }

  return insights.length > 0 ? insights.join(' • ') : 'Noted host style';
}
