/**
 * AI Intelligence Engine — Tier 3: Competitive Moat
 * 
 * 3A. Conversation Flow Templates — detect common multi-turn patterns
 * 3B. Confidence Calibration — track overconfident/underconfident predictions
 * 3C. Voice DNA Export — portable style prompt for any AI
 * 3D. Reply Delta Deep Learning — content/priority/specificity analysis
 */


import type { HostStyleProfile, DraftOutcome } from './store';

// ============================================
// 3A. CONVERSATION FLOW TEMPLATES
// ============================================


const MAX_FLOWS = 100;

/**
 * A detected multi-turn conversation flow pattern.
 * E.g., booking inquiry → check-in details → WiFi request
 */
export interface ConversationFlow {
  id: string;
  /** Ordered sequence of intents in this flow */
  intentSequence: string[];
  /** How many times this exact flow was observed */
  frequency: number;
  /** Average time between turns (minutes) */
  avgTurnGapMinutes: number;
  /** The most likely NEXT intent after this flow */
  predictedNextIntent: string;
  /** Pre-drafted response for the predicted next question */
  predictedNextDraft?: string;
  /** Confidence in this flow prediction (0-100) */
  predictionConfidence: number;
  /** Property-specific or global */
  propertyId?: string;
  lastSeen: number;
}


/**
 * Detect conversation flow patterns from a sequence of intents.
 * Looks for 2-4 intent sequences that repeat across conversations.
 */
export function detectConversationFlows(
  conversations: { intents: string[]; propertyId?: string; timestamps?: number[] }[]
): ConversationFlow[] {
  // Count n-gram sequences (2-gram and 3-gram)
  const sequenceCounts = new Map<string, {
    count: number;
    totalGapMs: number;
    nextIntents: Map<string, number>;
    propertyId?: string;
    lastSeen: number;
  }>();

  for (const conv of conversations) {
    const { intents, propertyId, timestamps } = conv;

    // Extract 2-grams and 3-grams
    for (let windowSize = 2; windowSize <= Math.min(3, intents.length); windowSize++) {
      for (let i = 0; i <= intents.length - windowSize; i++) {
        const sequence = intents.slice(i, i + windowSize);
        const key = sequence.join(' → ');
        const nextIntent = intents[i + windowSize];

        const existing = sequenceCounts.get(key) || {
          count: 0,
          totalGapMs: 0,
          nextIntents: new Map(),
          propertyId,
          lastSeen: 0,
        };

        existing.count++;
        existing.lastSeen = Math.max(existing.lastSeen, Date.now());

        // Track time gaps if timestamps available
        if (timestamps && timestamps[i + 1]) {
          existing.totalGapMs += (timestamps[i + 1] - timestamps[i]);
        }

        // Track what comes NEXT after this sequence
        if (nextIntent) {
          existing.nextIntents.set(
            nextIntent,
            (existing.nextIntents.get(nextIntent) || 0) + 1
          );
        }

        sequenceCounts.set(key, existing);
      }
    }
  }

  // Convert to ConversationFlow objects (only sequences seen 2+ times)
  const flows: ConversationFlow[] = [];

  for (const [key, data] of sequenceCounts) {
    if (data.count < 2) continue;

    const intentSequence = key.split(' → ');

    // Find most likely next intent
    let bestNextIntent = '';
    let bestNextCount = 0;
    for (const [intent, count] of data.nextIntents) {
      if (count > bestNextCount) {
        bestNextIntent = intent;
        bestNextCount = count;
      }
    }

    const totalNextCount = Array.from(data.nextIntents.values()).reduce((a, b) => a + b, 0);
    const predictionConfidence = totalNextCount > 0
      ? Math.round((bestNextCount / totalNextCount) * 100)
      : 0;

    flows.push({
      id: `flow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      intentSequence,
      frequency: data.count,
      avgTurnGapMinutes: data.count > 0
        ? Math.round(data.totalGapMs / data.count / 60000)
        : 0,
      predictedNextIntent: bestNextIntent,
      predictionConfidence,
      propertyId: data.propertyId,
      lastSeen: data.lastSeen,
    });
  }

  // Sort by frequency and return top flows
  return flows
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, MAX_FLOWS);
}

/**
 * Get the predicted next question based on recent conversation history.
 */
export function predictNextQuestion(
  recentIntents: string[],
  flows: ConversationFlow[]
): { intent: string; confidence: number; label: string } | null {
  if (recentIntents.length === 0 || flows.length === 0) return null;

  // Try matching longest sequence first (3-gram), then 2-gram
  for (let windowSize = Math.min(3, recentIntents.length); windowSize >= 2; windowSize--) {
    const recentSequence = recentIntents.slice(-windowSize).join(' → ');

    const matchingFlow = flows.find(
      (f) => f.intentSequence.join(' → ') === recentSequence && f.predictedNextIntent
    );

    if (matchingFlow && matchingFlow.predictionConfidence >= 40) {
      return {
        intent: matchingFlow.predictedNextIntent,
        confidence: matchingFlow.predictionConfidence,
        label: formatIntentLabel(matchingFlow.predictedNextIntent),
      };
    }
  }

  return null;
}

function formatIntentLabel(intent: string): string {
  const labels: Record<string, string> = {
    check_in: 'Check-in details',
    check_out: 'Check-out info',
    wifi: 'WiFi password',
    parking: 'Parking instructions',
    amenity: 'Amenity question',
    maintenance: 'Maintenance issue',
    local_tips: 'Local recommendations',
    noise: 'Noise concern',
    booking: 'Booking question',
    thanks: 'Thank you',
    question: 'General question',
    early_checkin: 'Early check-in',
    late_checkout: 'Late checkout',
    refund: 'Refund request',
  };
  return labels[intent] || intent.replace(/_/g, ' ');
}




// ============================================
// 3B. CONFIDENCE CALIBRATION
// ============================================



export interface CalibrationEntry {
  id: string;
  timestamp: number;
  /** AI's predicted confidence (0-100) */
  predictedConfidence: number;
  /** What actually happened */
  outcomeType: 'approved' | 'edited' | 'rejected' | 'independent';
  /** Was the AI's confidence justified? */
  calibrationResult: 'calibrated' | 'overconfident' | 'underconfident';
  guestIntent?: string;
  propertyId?: string;
}

export interface CalibrationSummary {
  totalEntries: number;
  calibratedCount: number;
  overconfidentCount: number;
  underconfidentCount: number;
  calibrationScore: number; // 0-100 (higher = better calibrated)
  avgConfidenceWhenApproved: number;
  avgConfidenceWhenRejected: number;
  /** Recommended confidence adjustment (-20 to +20) */
  confidenceAdjustment: number;
  /** Intent-specific calibration issues */
  problemIntents: { intent: string; issue: 'overconfident' | 'underconfident'; count: number }[];
}

/**
 * Record a calibration event from a draft outcome.
 * Compares the AI's predicted confidence to what actually happened.
 */
export function createCalibrationEntry(outcome: DraftOutcome): CalibrationEntry {
  const confidence = outcome.confidence ?? 50;
  const wasAccepted = outcome.outcomeType === 'approved';
  const wasEdited = outcome.outcomeType === 'edited';

  let calibrationResult: CalibrationEntry['calibrationResult'];

  if (confidence >= 70) {
    // High confidence
    calibrationResult = (wasAccepted || wasEdited)
      ? 'calibrated'      // High confidence + accepted/edited = correct
      : 'overconfident';   // High confidence + rejected = overconfident ⚠️
  } else if (confidence <= 40) {
    // Low confidence
    calibrationResult = wasAccepted
      ? 'underconfident'   // Low confidence + approved = underconfident
      : 'calibrated';      // Low confidence + rejected = correct
  } else {
    // Medium confidence — calibrated if edited, mild issue otherwise
    calibrationResult = (wasAccepted || wasEdited) ? 'calibrated' : 'overconfident';
  }

  return {
    id: `cal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    predictedConfidence: confidence,
    outcomeType: outcome.outcomeType,
    calibrationResult,
    guestIntent: outcome.guestIntent,
    propertyId: outcome.propertyId,
  };
}

/**
 * Compute a calibration summary from all entries.
 */
export function computeCalibrationSummary(entries: CalibrationEntry[]): CalibrationSummary {
  if (entries.length === 0) {
    return {
      totalEntries: 0,
      calibratedCount: 0,
      overconfidentCount: 0,
      underconfidentCount: 0,
      calibrationScore: 0,
      avgConfidenceWhenApproved: 0,
      avgConfidenceWhenRejected: 0,
      confidenceAdjustment: 0,
      problemIntents: [],
    };
  }

  let calibrated = 0, overconfident = 0, underconfident = 0;
  let confSumApproved = 0, confCountApproved = 0;
  let confSumRejected = 0, confCountRejected = 0;

  const intentIssues = new Map<string, { over: number; under: number }>();

  for (const entry of entries) {
    if (entry.calibrationResult === 'calibrated') calibrated++;
    else if (entry.calibrationResult === 'overconfident') overconfident++;
    else underconfident++;

    if (entry.outcomeType === 'approved') {
      confSumApproved += entry.predictedConfidence;
      confCountApproved++;
    } else if (entry.outcomeType === 'rejected') {
      confSumRejected += entry.predictedConfidence;
      confCountRejected++;
    }

    // Track per-intent issues
    if (entry.guestIntent && entry.calibrationResult !== 'calibrated') {
      const existing = intentIssues.get(entry.guestIntent) || { over: 0, under: 0 };
      if (entry.calibrationResult === 'overconfident') existing.over++;
      else existing.under++;
      intentIssues.set(entry.guestIntent, existing);
    }
  }

  const calibrationScore = Math.round((calibrated / entries.length) * 100);

  // Calculate confidence adjustment: negative = AI is overconfident, positive = underconfident
  let adjustment = 0;
  if (overconfident > underconfident) {
    adjustment = -Math.min(20, Math.round((overconfident / entries.length) * 30));
  } else if (underconfident > overconfident) {
    adjustment = Math.min(20, Math.round((underconfident / entries.length) * 30));
  }

  // Find problematic intents
  const problemIntents: CalibrationSummary['problemIntents'] = [];
  for (const [intent, counts] of intentIssues) {
    if (counts.over >= 3) {
      problemIntents.push({ intent, issue: 'overconfident', count: counts.over });
    }
    if (counts.under >= 3) {
      problemIntents.push({ intent, issue: 'underconfident', count: counts.under });
    }
  }
  problemIntents.sort((a, b) => b.count - a.count);

  return {
    totalEntries: entries.length,
    calibratedCount: calibrated,
    overconfidentCount: overconfident,
    underconfidentCount: underconfident,
    calibrationScore,
    avgConfidenceWhenApproved: confCountApproved > 0 ? Math.round(confSumApproved / confCountApproved) : 0,
    avgConfidenceWhenRejected: confCountRejected > 0 ? Math.round(confSumRejected / confCountRejected) : 0,
    confidenceAdjustment: adjustment,
    problemIntents,
  };
}




// ============================================
// 3C. VOICE DNA EXPORT
// ============================================

/**
 * Generate a portable "Voice DNA" prompt from the host's style profile.
 * This is a ~200-word prompt that any AI model can use to mimic the host's style.
 */
export function generateVoiceDNA(profile: HostStyleProfile): string {
  const lines: string[] = [];

  lines.push('## Communication Style Profile');
  lines.push('');

  // Tone
  const formality = profile.formalityLevel < 30 ? 'casual and relaxed'
    : profile.formalityLevel < 60 ? 'balanced between casual and professional'
    : 'professional and formal';

  const warmth = profile.warmthLevel < 30 ? 'direct and efficient'
    : profile.warmthLevel < 60 ? 'friendly and approachable'
    : 'very warm and personal';

  lines.push(`**Tone:** ${formality}, ${warmth}.`);

  // Greetings
  if (profile.commonGreetings.length > 0) {
    lines.push(`**Greetings:** Start messages with "${profile.commonGreetings[0]}"${profile.commonGreetings.length > 1 ? ` or "${profile.commonGreetings[1]}"` : ''}.`);
  }

  // Sign-offs
  if (profile.commonSignoffs.length > 0) {
    lines.push(`**Sign-offs:** End messages with "${profile.commonSignoffs[0]}"${profile.commonSignoffs.length > 1 ? ` or "${profile.commonSignoffs[1]}"` : ''}.`);
  }

  // Emoji usage
  if (profile.usesEmojis) {
    lines.push(`**Emojis:** Uses emojis in ~${profile.emojiFrequency}% of messages to add warmth.`);
  } else {
    lines.push('**Emojis:** Rarely uses emojis. Keep responses text-only.');
  }

  // Response length
  const lengthDesc = profile.averageResponseLength < 30 ? 'brief (1-2 sentences)'
    : profile.averageResponseLength < 80 ? 'medium (2-4 sentences)'
    : 'detailed (4+ sentences)';
  lines.push(`**Response length:** ${lengthDesc}, averaging ~${Math.round(profile.averageResponseLength)} words.`);

  // Common phrases
  if (profile.commonPhrases.length > 0) {
    lines.push(`**Signature phrases:** "${profile.commonPhrases.slice(0, 3).join('", "')}".`);
  }

  // Avoided words
  if (profile.avoidedWords.length > 0) {
    lines.push(`**Avoid:** "${profile.avoidedWords.slice(0, 3).join('", "')}".`);
  }

  // Training stats
  lines.push('');
  lines.push(`_Based on ${profile.samplesAnalyzed} analyzed messages, last updated ${new Date(profile.lastUpdated).toLocaleDateString()}._`);

  return lines.join('\n');
}

/**
 * Generate a rich Voice DNA prompt snippet (~150 words) from the host's style profile.
 * Every line is derived from the host's actual messages — no generic rules imposed.
 * Designed to be injected into any AI model's system prompt.
 */
export function generateVoiceDNAPromptSnippet(profile: HostStyleProfile): string {
  const lines: string[] = [];

  // Identity
  const formality = profile.formalityLevel < 30 ? 'casual and relaxed'
    : profile.formalityLevel < 60 ? 'balanced — friendly but professional'
    : 'professional and polished';
  const warmth = profile.warmthLevel < 30 ? 'direct and efficient'
    : profile.warmthLevel < 60 ? 'friendly and approachable'
    : 'very warm and personal — you genuinely care about each guest';
  lines.push(`TONE: ${formality}. ${warmth}.`);

  // Greeting pattern
  if (profile.commonGreetings.length > 0) {
    const greetings = profile.commonGreetings.slice(0, 3).map(g => `"${g}"`).join(' or ');
    lines.push(`GREETING: Always start with ${greetings} — use the guest's first name. This is non-negotiable.`);
  }

  // Sign-off pattern — context-aware (NOT on every message)
  if (profile.commonSignoffs.length > 0) {
    const signoffs = profile.commonSignoffs.slice(0, 2).map(s => `"${s}"`).join(' or ');
    lines.push(`SIGN-OFF: ${signoffs} — but ONLY on initial welcome messages. For follow-up replies in an ongoing conversation, end naturally without a formal sign-off.`);
  }

  // Emoji usage
  if (profile.usesEmojis) {
    lines.push(`EMOJIS: You use emojis naturally (~${Math.round(profile.emojiFrequency / 10)} per message). They feel warm, not forced.`);
  } else {
    lines.push('EMOJIS: You NEVER use emojis. Any emoji in the response is WRONG.');
  }

  // Length and structure
  const lengthDesc = profile.averageResponseLength < 40 ? 'short and punchy (1-2 sentences)'
    : profile.averageResponseLength < 100 ? 'moderate length (2-4 sentences)'
    : 'detailed when needed (4+ sentences, but never padded)';
  lines.push(`LENGTH: Your messages are ${lengthDesc}, averaging ~${Math.round(profile.averageResponseLength)} words. Don't pad to seem thorough — match THIS length.`);

  // Signature phrases
  if (profile.commonPhrases.length > 0) {
    const phrases = profile.commonPhrases.slice(0, 5).map(p => `"${p}"`).join(', ');
    lines.push(`YOUR PHRASES (use these naturally): ${phrases}`);
  }

  // Intent-specific examples (the 85% consistency the user mentioned)
  if (profile.intentPatterns && Object.keys(profile.intentPatterns).length > 0) {
    const topIntents = Object.entries(profile.intentPatterns)
      .filter(([, examples]) => examples.length > 0)
      .slice(0, 3);
    if (topIntents.length > 0) {
      lines.push('HOW YOU TYPICALLY RESPOND:');
      for (const [intent, examples] of topIntents) {
        if (examples[0]) {
          const short = examples[0].length > 120 ? examples[0].substring(0, 120) + '...' : examples[0];
          lines.push(`  ${intent}: "${short}"`);
        }
      }
    }
  }

  // Avoided words from edit diffs
  if (profile.avoidedWords && profile.avoidedWords.length > 0) {
    const avoided = profile.avoidedWords.slice(0, 8).map(w => `"${w}"`).join(', ');
    lines.push(`NEVER SAY (you've edited these out before): ${avoided}`);
  }

  return lines.join('\n');
}


// ============================================
// 3D. REPLY DELTA DEEP LEARNING
// ============================================



export interface ReplyDelta {
  id: string;
  timestamp: number;
  propertyId?: string;
  guestIntent?: string;

  // Content delta
  contentAdded: string[];    // Info the host added that AI missed
  contentRemoved: string[];  // Info the host removed that AI included
  
  // Priority delta
  hostPrioritized: string;   // What the host put first
  aiPrioritized: string;     // What the AI put first

  // Specificity delta
  specificityDelta: 'host_more_specific' | 'ai_more_specific' | 'equal';
  specificExamples: string[]; // e.g., "Host added exact door code instead of generic instructions"

  // Overall learning signal
  learningSummary: string;   // Human-readable takeaway
}

/**
 * Perform deep delta analysis between AI draft and host's actual reply.
 * Goes beyond surface-level diffs to understand WHY the host changed things.
 */
export function analyzeReplyDelta(
  aiDraft: string,
  hostReply: string,
  guestMessage: string,
  propertyId?: string,
  guestIntent?: string
): ReplyDelta {
  const contentAdded: string[] = [];
  const contentRemoved: string[] = [];
  const specificExamples: string[] = [];

  // Extract sentences from both
  const aiSentences = extractSentences(aiDraft);
  const hostSentences = extractSentences(hostReply);

  // Find added content (in host but not in AI)
  for (const sentence of hostSentences) {
    const hasSimilar = aiSentences.some(
      (s) => sentenceSimilarity(s, sentence) > 0.4
    );
    if (!hasSimilar && sentence.length > 20) {
      contentAdded.push(sentence.trim());
    }
  }

  // Find removed content (in AI but not in host)
  for (const sentence of aiSentences) {
    const hasSimilar = hostSentences.some(
      (s) => sentenceSimilarity(s, sentence) > 0.4
    );
    if (!hasSimilar && sentence.length > 20) {
      contentRemoved.push(sentence.trim());
    }
  }

  // Priority delta: what does each put first?
  const hostPrioritized = hostSentences[0]?.trim() || '';
  const aiPrioritized = aiSentences[0]?.trim() || '';

  // Specificity delta: check for specific details vs generic phrases
  const hostSpecifics = countSpecificDetails(hostReply);
  const aiSpecifics = countSpecificDetails(aiDraft);

  let specificityDelta: ReplyDelta['specificityDelta'] = 'equal';
  if (hostSpecifics > aiSpecifics + 1) {
    specificityDelta = 'host_more_specific';
    specificExamples.push('Host included more specific details (times, codes, names)');
  } else if (aiSpecifics > hostSpecifics + 1) {
    specificityDelta = 'ai_more_specific';
  }

  // Check for specific patterns
  if (/\d{1,2}:\d{2}/.test(hostReply) && !/\d{1,2}:\d{2}/.test(aiDraft)) {
    specificExamples.push('Host added specific times');
  }
  if (/\d{4,}/.test(hostReply) && !/\d{4,}/.test(aiDraft)) {
    specificExamples.push('Host added access codes/numbers');
  }
  if (/[A-Z][a-z]+\s+[A-Z][a-z]+/.test(hostReply) && !/[A-Z][a-z]+\s+[A-Z][a-z]+/.test(aiDraft)) {
    specificExamples.push('Host added proper names or places');
  }

  // Generate human-readable summary
  const insights: string[] = [];
  if (contentAdded.length > 0) insights.push(`Added ${contentAdded.length} pieces of info AI missed`);
  if (contentRemoved.length > 0) insights.push(`Removed ${contentRemoved.length} unnecessary parts`);
  if (specificityDelta === 'host_more_specific') insights.push('Host was more specific than AI');
  if (hostPrioritized !== aiPrioritized && hostPrioritized.length > 0) {
    insights.push('Different message priority order');
  }

  const learningSummary = insights.length > 0
    ? insights.join('. ') + '.'
    : 'Minor stylistic differences.';

  return {
    id: `delta_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    propertyId,
    guestIntent,
    contentAdded: contentAdded.slice(0, 5),
    contentRemoved: contentRemoved.slice(0, 5),
    hostPrioritized,
    aiPrioritized,
    specificityDelta,
    specificExamples: specificExamples.slice(0, 3),
    learningSummary,
  };
}

// Helper: extract sentences from text
function extractSentences(text: string): string[] {
  return text
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
}

// Helper: rough sentence similarity (word overlap ratio)
function sentenceSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...wordsA].filter((w) => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size > 0 ? intersection.length / union.size : 0;
}

// Helper: count specific details in text (times, numbers, proper nouns, codes)
function countSpecificDetails(text: string): number {
  let count = 0;
  // Times (3:00 PM, 10am)
  count += (text.match(/\d{1,2}:\d{2}\s*(am|pm)?/gi) || []).length;
  // Access codes / long numbers
  count += (text.match(/\b\d{4,}\b/g) || []).length;
  // Proper nouns (capitalized words not at sentence start)
  count += (text.match(/(?<=[a-z]\s)[A-Z][a-z]{2,}/g) || []).length;
  // Specific addresses or directions
  count += (text.match(/\b(left|right|floor|unit|apt|suite|building)\b/gi) || []).length;
  return count;
}



/**
 * Aggregate delta signals into prompt adjustments.
 */
export function getDeltaPromptAdjustments(deltas: ReplyDelta[]): string {
  if (deltas.length < 3) return '';

  const adjustments: string[] = [];

  // Count specificity issues
  const hostMoreSpecific = deltas.filter((d) => d.specificityDelta === 'host_more_specific').length;
  if (hostMoreSpecific / deltas.length > 0.4) {
    adjustments.push('Include specific details (exact times, codes, names) instead of generic instructions.');
  }

  // Count common added content themes
  const allAdded = deltas.flatMap((d) => d.contentAdded);
  if (allAdded.length > deltas.length * 0.5) {
    adjustments.push('Your drafts often miss information the host adds. Be more comprehensive.');
  }

  // Count common removed content themes
  const allRemoved = deltas.flatMap((d) => d.contentRemoved);
  if (allRemoved.length > deltas.length * 0.5) {
    adjustments.push('Your drafts often include unnecessary filler. Be more concise.');
  }

  if (adjustments.length === 0) return '';

  return `\n\n### Deep Learning from Host Corrections:\n${adjustments.map((a) => `- ${a}`).join('\n')}`;
}
