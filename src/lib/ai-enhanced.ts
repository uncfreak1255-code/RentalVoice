// Enhanced AI Service with Advanced Features
// Sentiment Analysis, Multi-Topic Handling, Confidence Scoring, Action Detection
// Historical Response Matching for accurate host-style replies

import type { Conversation, Message, PropertyKnowledge, HostStyleProfile } from './store';
import { useAppStore } from './store';
import { generateStyleInstructions } from './ai-learning';
import { generateVoiceDNAPromptSnippet, getDeltaPromptAdjustments } from './ai-intelligence';
import { aiTrainingService } from './ai-training-service';
import { getPromptAdjustments, getRejectionAdjustments } from './edit-diff-analysis';
import { computeCalibrationSummary, type CalibrationSummary } from './ai-intelligence';
import { detectGuestType, getGuestTypePromptAdjustments, type GuestProfile } from './guest-type-detection';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildAdvancedAIPrompt,
  incrementalTrainer,
  fewShotIndexer,
  conversationFlowLearner,
  guestMemoryManager,
  negativeExampleManager,
} from './advanced-training';
import { getAIKey, getProviderOrder, isProviderEnabled, getSelectedModel, getGoogleAuthMethod, AI_MODELS } from './ai-keys';
import { canGenerateDraft, recordDraftGeneration } from './ai-usage-limiter';

// ── CALIBRATION FEEDBACK LOOP ──
// Caches the calibration summary for 60 seconds to avoid recomputing on every draft.
// This is the self-correcting loop: past outcomes adjust future confidence predictions.
let _cachedCalibration: { summary: CalibrationSummary; intentMap: Map<string, number>; timestamp: number } | null = null;
const CALIBRATION_CACHE_TTL = 60_000; // 60 seconds

function getCalibrationAdjustment(primaryIntent?: string): {
  globalAdj: number;
  intentAdj: number;
  warnings: string[];
} {
  const now = Date.now();

  // Rebuild cache if stale or missing
  if (!_cachedCalibration || now - _cachedCalibration.timestamp > CALIBRATION_CACHE_TTL) {
    const entries = useAppStore.getState().calibrationEntries;
    if (entries.length < 5) {
      // Not enough data yet for meaningful calibration
      return { globalAdj: 0, intentAdj: 0, warnings: [] };
    }

    // Use only recent entries (last 200) — recency matters more than volume
    const recentEntries = entries.slice(-200);
    const summary = computeCalibrationSummary(recentEntries);

    // Build a fast lookup map: intent → penalty
    const intentMap = new Map<string, number>();
    for (const pi of summary.problemIntents) {
      if (pi.issue === 'overconfident') {
        // Overconfident on this intent → penalize by 5-15 based on frequency
        intentMap.set(pi.intent, -Math.min(15, pi.count * 2));
      } else {
        // Underconfident → slight boost (up to +10)
        intentMap.set(pi.intent, Math.min(10, pi.count));
      }
    }

    _cachedCalibration = { summary, intentMap, timestamp: now };
    console.log(`[Calibration] Recomputed: score=${summary.calibrationScore}, adj=${summary.confidenceAdjustment}, problems=${summary.problemIntents.length}`);
  }

  const { summary, intentMap } = _cachedCalibration;
  const warnings: string[] = [];

  // Global adjustment (applies to all drafts)
  const globalAdj = summary.confidenceAdjustment; // -20 to +20

  // Per-intent adjustment (if we know the primary intent)
  let intentAdj = 0;
  if (primaryIntent && intentMap.has(primaryIntent)) {
    intentAdj = intentMap.get(primaryIntent)!;
    const dir = intentAdj < 0 ? 'overconfident' : 'underconfident';
    warnings.push(`Calibration: historically ${dir} on ${primaryIntent.replace(/_/g, ' ')} topics (${intentAdj > 0 ? '+' : ''}${intentAdj})`);
  }

  if (summary.calibrationScore < 50 && summary.totalEntries > 10) {
    warnings.push(`Overall calibration: ${summary.calibrationScore}% — system is still learning your preferences`);
  }

  return { globalAdj, intentAdj, warnings };
}

// API Configuration
const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const CLAUDE_MODEL = 'claude-3-5-haiku-20241022';
const GEMINI_MODEL = 'gemini-2.0-flash';

// Sentiment Analysis Types
export interface SentimentAnalysis {
  primary: 'positive' | 'neutral' | 'negative' | 'urgent';
  intensity: number; // 0-100
  emotions: ('frustrated' | 'excited' | 'confused' | 'grateful' | 'anxious' | 'angry' | 'happy')[];
  requiresEscalation: boolean;
  escalationReason?: string;
}

// Multi-Topic Detection
export interface DetectedTopic {
  topic: string;
  intent: string;
  priority: number;
  hasAnswer: boolean;
  suggestedResponse?: string;
}

// Confidence Scoring
export interface ConfidenceScore {
  overall: number; // 0-100
  factors: {
    sentimentMatch: number;
    knowledgeAvailable: number;
    topicCoverage: number;
    styleMatch: number;
    safetyCheck: number;
  };
  warnings: string[];
  blockedForAutoSend: boolean;
  blockReason?: string;
}

// Action Items
export interface ActionItem {
  id: string;
  type: 'maintenance' | 'followup' | 'escalation' | 'refund' | 'upsell' | 'emergency';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: Date;
  assignee?: string;
  conversationId: string;
  guestName: string;
  propertyId: string;
  createdAt: Date;
}

// Knowledge Conflict
export interface KnowledgeConflict {
  field: string;
  issue: string;
  severity: 'low' | 'medium' | 'high';
  suggestedFix?: string;
}

// Enhanced AI Response
export interface EnhancedAIResponse {
  content: string;
  sentiment: SentimentAnalysis;
  topics: DetectedTopic[];
  confidence: ConfidenceScore;
  actionItems: ActionItem[];
  knowledgeConflicts: KnowledgeConflict[];
  detectedLanguage: string;
  translatedContent?: string;
  regenerationOptions: RegenerationOption[];
  // Historical matching info
  historicalMatches?: HistoricalMatchInfo;
  // Cultural tone adaptation info
  culturalToneApplied?: string;
  culturalAdaptations?: string[];
  // Context awareness - skipped topics info
  skippedTopics?: SkippedTopicInfo[];
  contextAnalysis?: ConversationContextAnalysis;
  // Intra-thread learning info
  intraThreadLearning?: IntraThreadLearning;
  // Guest profile detection
  guestProfile?: GuestProfile;
}

// Skipped topic information for "How I Arrived at This"
export interface SkippedTopicInfo {
  topic: string;
  reason: string;
  answeredInMessageIndex: number; // Which host message answered this
  exchangesAgo: number; // How many exchanges ago (1-3 typically)
}

// Full conversation context analysis
export interface ConversationContextAnalysis {
  totalExchanges: number;
  recentHostTopics: string[]; // Topics addressed in last 1-3 host messages
  primaryFocusMessage: string; // The guest message being responded to
  threadDirection: 'new_topic' | 'followup' | 'clarification' | 'resolution';
}

// Intra-thread learning: Style anchor from recent host responses in this thread
export interface ThreadStyleAnchor {
  hasAnchor: boolean;
  // Style metrics extracted from most recent host message(s) in thread
  warmthLevel: 'warm' | 'neutral' | 'professional'; // Detected warmth
  brevityLevel: 'brief' | 'moderate' | 'detailed'; // Response length tendency
  usesEmojis: boolean;
  usesExclamations: boolean;
  greetingStyle?: string; // e.g., "Hi Sarah!" or "Hello,"
  signoffStyle?: string; // e.g., "Best," or "Thanks!"
  // Most recent host response as the primary style reference
  mostRecentHostResponse?: string;
  responseWordCount: number;
  // Topics successfully resolved (guest confirmed/thanked)
  resolvedTopics: string[];
  // Phrases to potentially echo back
  keyPhrases: string[];
}

// Intra-thread continuity: Tracks what guest is referencing from prior exchange
export interface ThreadContinuityInfo {
  guestReferencesHostReply: boolean; // Guest mentions something from your last reply
  referencedContent?: string; // What they referenced (e.g., "the trash instructions")
  sentimentTowardPriorReply: 'positive' | 'neutral' | 'negative' | 'unknown';
  // Suggested acknowledgment phrase
  suggestedAcknowledgment?: string;
}

// Combined intra-thread learning info
export interface IntraThreadLearning {
  styleAnchor: ThreadStyleAnchor;
  continuity: ThreadContinuityInfo;
  // Confidence adjustments based on thread alignment
  confidenceModifier: number; // +/- percentage to add to base confidence
  confidenceReason?: string;
}

// Historical match information
export interface HistoricalMatchInfo {
  foundMatches: boolean;
  matchCount: number;
  topMatchScore: number;
  usedHistoricalBasis: boolean;
  matchedPatterns: {
    intent: string;
    score: number;
    responsePreview: string;  // Truncated for UI display (100 chars)
    fullResponse: string;     // Full response for AI prompt (up to 800 chars)
  }[];
}

// Regeneration Options
export interface RegenerationOption {
  id: string;
  label: string;
  description: string;
  modifier: 'empathy' | 'shorter' | 'longer' | 'formal' | 'casual' | 'detailed';
}

// Analyze sentiment with detailed emotion detection
export function analyzeSentimentAdvanced(content: string): SentimentAnalysis {
  const lowerContent = content.toLowerCase();
  const emotions: SentimentAnalysis['emotions'] = [];
  let intensity = 50;

  // Urgency detection — STRICT: require actual emergency/urgency context
  // Words like "now", "help", "not working" cause massive false positives
  // in casual messages ("for now we are not...", "this will help", etc.)
  const urgentPatterns = [
    /\b(emergency|urgent|immediately|asap|locked out|fire|flood|police|ambulance|hospital)\b/i,
    /\b(can'?t|cannot) (get in|access|open|enter)\b/i,
    /\b(dangerous|unsafe|gas leak|smoke|carbon monoxide)\b/i,
    /\bhelp\b.*\b(right away|right now|immediately|asap|please)\b/i,
    /\b(right now|right away)\b/i,
  ];

  // False-positive filter: benign phrases that contain urgent-looking words
  const benignPhrases = [
    /\bfor now\b/i,
    /\bknow\b/i,
    /\blet you know\b/i,
    /\bnot expecting\b/i,
    /\bif that changes\b/i,
    /\bas soon as\b/i,
    /\bhelp (with|you|us|me)\b/i,
    /\b(will|would|can|could) help\b/i,
  ];

  const isUrgent = urgentPatterns.some(p => p.test(content));
  const isBenign = benignPhrases.some(p => p.test(content));

  // Only classify as urgent if we match urgent patterns AND the message
  // doesn't look like a calm/informational message
  if (isUrgent && !isBenign) {
    return {
      primary: 'urgent',
      intensity: 95,
      emotions: ['anxious'],
      requiresEscalation: true,
      escalationReason: 'Urgent issue detected - may require immediate attention',
    };
  }

  // Frustration detection
  const frustratedPatterns = [
    /\b(frustrated|annoyed|disappointed|upset|unhappy|unacceptable|ridiculous|terrible|awful|worst)\b/i,
    /\b(still waiting|no response|ignored|again|multiple times|how many times)\b/i,
    /(!{2,}|\?{2,})/,
    /\bWHY\b/,
  ];
  if (frustratedPatterns.some(p => p.test(content))) {
    emotions.push('frustrated');
    intensity = Math.max(intensity, 70);
  }

  // Anger detection
  const angryPatterns = [
    /\b(angry|furious|outraged|livid|disgusted|hate|horrible)\b/i,
    /\b(refund|compensation|legal|lawyer|sue|complaint|manager)\b/i,
  ];
  if (angryPatterns.some(p => p.test(content))) {
    emotions.push('angry');
    intensity = Math.max(intensity, 85);
  }

  // Excitement detection
  const excitedPatterns = [
    /\b(excited|can'?t wait|amazing|wonderful|fantastic|perfect|love it|so happy)\b/i,
    /!{1,}$/,
    /(😍|🎉|❤️|🙏|😊|🥰)/,
  ];
  if (excitedPatterns.some(p => p.test(content))) {
    emotions.push('excited');
    intensity = Math.max(intensity, 75);
  }

  // Gratitude detection
  const gratefulPatterns = [
    /\b(thank|thanks|appreciate|grateful|kind|helpful|great job|well done)\b/i,
  ];
  if (gratefulPatterns.some(p => p.test(content))) {
    emotions.push('grateful');
  }

  // Confusion detection
  const confusedPatterns = [
    /\b(confused|don'?t understand|unclear|how do i|where is|what is|can you explain)\b/i,
    /\?{2,}/,
  ];
  if (confusedPatterns.some(p => p.test(content))) {
    emotions.push('confused');
  }

  // Anxiety detection
  const anxiousPatterns = [
    /\b(worried|concerned|nervous|anxious|stress|hope|hopefully|please)\b/i,
  ];
  if (anxiousPatterns.some(p => p.test(content))) {
    emotions.push('anxious');
  }

  // Happy detection
  const happyPatterns = [
    /\b(happy|great|lovely|nice|enjoy|enjoyed|wonderful|beautiful|perfect)\b/i,
    /(😊|😃|😄|🙂|☺️)/,
  ];
  if (happyPatterns.some(p => p.test(content))) {
    emotions.push('happy');
  }

  // Determine primary sentiment
  let primary: SentimentAnalysis['primary'] = 'neutral';
  if (emotions.includes('angry') || emotions.includes('frustrated')) {
    primary = 'negative';
    intensity = Math.max(intensity, 70);
  } else if (emotions.includes('excited') || emotions.includes('happy') || emotions.includes('grateful')) {
    primary = 'positive';
  }

  // Escalation logic
  const requiresEscalation =
    primary === 'negative' && intensity >= 75 ||
    emotions.includes('angry') ||
    (emotions.includes('frustrated') && lowerContent.includes('refund'));

  return {
    primary,
    intensity,
    emotions: emotions.length > 0 ? emotions : ['happy'],
    requiresEscalation,
    escalationReason: requiresEscalation ? 'Guest appears upset - may need human attention' : undefined,
  };
}

// Detect multiple topics in a message
export function detectTopics(content: string, knowledge?: PropertyKnowledge): DetectedTopic[] {
  const topics: DetectedTopic[] = [];
  // Topic patterns use case-insensitive regex, no need for lowercase variable
  // Define topic patterns with their intents
  const topicPatterns: { pattern: RegExp; topic: string; intent: string; priority: number }[] = [
    // WiFi
    { pattern: /\b(wifi|wi-fi|internet|password|network|connect)\b/i, topic: 'WiFi', intent: 'wifi_inquiry', priority: 2 },
    // Check-in
    { pattern: /\b(check-?in|arrive|arrival|get in|access|key|code|lock|door)\b/i, topic: 'Check-in', intent: 'checkin_inquiry', priority: 1 },
    // Check-out
    { pattern: /\b(check-?out|leave|leaving|departure|depart)\b/i, topic: 'Check-out', intent: 'checkout_inquiry', priority: 1 },
    // Early check-in
    { pattern: /\b(early|earlier)\b.*\b(check|arrive|in)\b/i, topic: 'Early Check-in', intent: 'early_checkin_request', priority: 2 },
    // Late check-out
    { pattern: /\b(late|later)\b.*\b(check|out|leave|stay)\b/i, topic: 'Late Check-out', intent: 'late_checkout_request', priority: 2 },
    // Parking
    { pattern: /\b(park|parking|car|garage|driveway)\b/i, topic: 'Parking', intent: 'parking_inquiry', priority: 3 },
    // Amenities
    { pattern: /\b(pool|gym|fitness|hot tub|jacuzzi|sauna|amenities)\b/i, topic: 'Amenities', intent: 'amenity_inquiry', priority: 3 },
    // Cleaning/Housekeeping
    { pattern: /\b(clean|cleaning|towel|sheet|trash|garbage|dirty|housekeeping)\b/i, topic: 'Housekeeping', intent: 'housekeeping_inquiry', priority: 2 },
    // Local recommendations
    { pattern: /\b(restaurant|food|eat|coffee|grocery|store|shop|recommend|recommendation|nearby|around|area)\b/i, topic: 'Local Tips', intent: 'local_recommendation', priority: 4 },
    // Maintenance issues
    { pattern: /\b(broken|not working|fix|repair|leak|issue|problem|damage)\b/i, topic: 'Maintenance', intent: 'maintenance_issue', priority: 1 },
    // Temperature/HVAC
    { pattern: /\b(heat|heating|ac|air condition|thermostat|cold|hot|temperature)\b/i, topic: 'Temperature', intent: 'hvac_inquiry', priority: 2 },
    // Appliances
    { pattern: /\b(tv|television|stove|oven|microwave|dishwasher|washer|dryer|appliance)\b/i, topic: 'Appliances', intent: 'appliance_inquiry', priority: 3 },
    // Noise
    { pattern: /\b(noise|loud|quiet|neighbor|party|music)\b/i, topic: 'Noise', intent: 'noise_complaint', priority: 2 },
    // Pets
    { pattern: /\b(pet|dog|cat|animal)\b/i, topic: 'Pets', intent: 'pet_inquiry', priority: 3 },
    // Extra guests
    { pattern: /\b(extra guest|more people|additional person|friend|visitor)\b/i, topic: 'Extra Guests', intent: 'guest_inquiry', priority: 2 },
    // Extension
    { pattern: /\b(extend|extension|stay longer|more nights|additional night)\b/i, topic: 'Stay Extension', intent: 'extension_request', priority: 2 },
    // Refund
    { pattern: /\b(refund|money back|reimburse|compensation|discount)\b/i, topic: 'Refund', intent: 'refund_request', priority: 1 },
  ];

  for (const { pattern, topic, intent, priority } of topicPatterns) {
    if (pattern.test(content)) {
      const hasAnswer = checkKnowledgeAvailable(intent, knowledge);
      topics.push({
        topic,
        intent,
        priority,
        hasAnswer,
      });
    }
  }

  // Sort by priority (lower = more important)
  topics.sort((a, b) => a.priority - b.priority);

  // If no specific topics found, mark as general inquiry
  if (topics.length === 0) {
    topics.push({
      topic: 'General',
      intent: 'general_inquiry',
      priority: 5,
      hasAnswer: false,
    });
  }

  return topics;
}

// Check if knowledge is available for a topic
function checkKnowledgeAvailable(intent: string, knowledge?: PropertyKnowledge): boolean {
  if (!knowledge) return false;

  const knowledgeMap: Record<string, keyof PropertyKnowledge> = {
    'wifi_inquiry': 'wifiPassword',
    'checkin_inquiry': 'checkInInstructions',
    'checkout_inquiry': 'checkOutInstructions',
    'parking_inquiry': 'parkingInfo',
    'appliance_inquiry': 'applianceGuide',
    'local_recommendation': 'localRecommendations',
  };

  const field = knowledgeMap[intent];
  return field ? !!knowledge[field] : false;
}

/**
 * Build a DIRECT ANSWER block for the AI prompt based on detected topics.
 * When the guest asks about a specific topic AND we have the exact answer
 * in the knowledge base, inject it as a high-priority instruction so the AI
 * uses our exact data rather than generating a generic response.
 */
function getDirectAnswerBlock(topics: DetectedTopic[], knowledge?: PropertyKnowledge): string {
  if (!knowledge || topics.length === 0) return '';

  const answers: string[] = [];

  for (const topic of topics) {
    if (!topic.hasAnswer) continue;

    switch (topic.intent) {
      case 'wifi_inquiry':
        if (knowledge.wifiName && knowledge.wifiPassword) {
          answers.push(`WiFi — Network: "${knowledge.wifiName}", Password: "${knowledge.wifiPassword}"`);
        }
        break;
      case 'checkin_inquiry':
        if (knowledge.checkInInstructions) {
          answers.push(`Check-in Instructions — ${knowledge.checkInInstructions}`);
        }
        if (knowledge.checkInTime) {
          answers.push(`Check-in Time — ${knowledge.checkInTime}`);
        }
        break;
      case 'early_checkin_request':
        if (knowledge.earlyCheckInAvailable && knowledge.earlyCheckInFee) {
          answers.push(`Early Check-in — Available for $${knowledge.earlyCheckInFee}`);
        }
        if (knowledge.checkInTime) {
          answers.push(`Standard Check-in Time — ${knowledge.checkInTime}`);
        }
        answers.push(`EARLY CHECK-IN RESPONSE TEMPLATE — Use this EXACT style (swap [GUEST NAME] for the guest's first name):
"Hi [GUEST NAME], Thanks so much for reaching out as we are so excited to have you and your Family!! So with early check-ins, the earliest our management company is allowed to offer for this owners home is 3pm! But you are more than welcome to head on over anytime after 3pm to get settled in as our cleaning crew is usually always done before then! We are looking forward to accommodating to you and your family, and are always here if you need anything at all!! 😊"
Adapt naturally but keep this warm, exclamation-heavy, family-friendly tone.`);
        break;
      case 'checkout_inquiry':
        if (knowledge.checkOutInstructions) {
          answers.push(`Check-out Instructions — ${knowledge.checkOutInstructions}`);
        }
        if (knowledge.checkOutTime) {
          answers.push(`Check-out Time — ${knowledge.checkOutTime}`);
        }
        break;
      case 'late_checkout_request':
        if (knowledge.lateCheckOutAvailable && knowledge.lateCheckOutFee) {
          answers.push(`Late Check-out — Available for $${knowledge.lateCheckOutFee}`);
        } else if (knowledge.checkOutTime) {
          answers.push(`Standard Check-out Time — ${knowledge.checkOutTime}`);
        }
        break;
      case 'parking_inquiry':
        if (knowledge.parkingInfo) {
          answers.push(`Parking — ${knowledge.parkingInfo}`);
        }
        break;
      case 'appliance_inquiry':
        if (knowledge.applianceGuide) {
          answers.push(`Appliances — ${knowledge.applianceGuide}`);
        }
        break;
      case 'local_recommendation':
        if (knowledge.localRecommendations) {
          answers.push(`Local Tips — ${knowledge.localRecommendations}`);
        }
        break;
      case 'housekeeping_inquiry':
        if (knowledge.houseRules) {
          answers.push(`House Rules — ${knowledge.houseRules}`);
        }
        break;
    }
  }

  if (answers.length === 0) return '';

  console.log(`[SmartKnowledge] Injecting ${answers.length} direct answer(s) for topics: ${topics.filter(t => t.hasAnswer).map(t => t.topic).join(', ')}`);

  return `\n⚠️ DIRECT ANSWER — USE THIS EXACT INFORMATION IN YOUR RESPONSE:
The guest is asking about a topic where you have SPECIFIC knowledge. Use the exact details below in your response. Do NOT paraphrase, generalize, or make up different information. Weave these facts naturally into your reply.
${answers.map(a => `• ${a}`).join('\n')}\n`;
}

// Calculate comprehensive confidence score
export function calculateConfidence(
  sentiment: SentimentAnalysis,
  topics: DetectedTopic[],
  knowledge?: PropertyKnowledge,
  styleProfile?: HostStyleProfile
): ConfidenceScore {
  const warnings: string[] = [];
  let blockedForAutoSend = false;
  let blockReason: string | undefined;

  // Factor: Sentiment Match (how well we can handle this emotion)
  let sentimentMatch = 85;
  if (sentiment.primary === 'urgent') {
    sentimentMatch = 50;
    warnings.push('Urgent message - requires human review');
    blockedForAutoSend = true;
    blockReason = 'Urgent messages require human approval';
  } else if (sentiment.primary === 'negative' && sentiment.intensity >= 70) {
    sentimentMatch = 60;
    warnings.push('Guest appears upset - consider adding empathy');
  } else if (sentiment.emotions.includes('angry')) {
    sentimentMatch = 55;
    blockedForAutoSend = true;
    blockReason = 'Angry guest - needs careful human response';
  }

  // Factor: Knowledge Available
  const topicsWithAnswers = topics.filter(t => t.hasAnswer).length;
  const knowledgeAvailable = topics.length > 0
    ? Math.round((topicsWithAnswers / topics.length) * 100)
    : 70;

  if (knowledgeAvailable < 50) {
    warnings.push('Limited knowledge available for these topics');
  }

  // Factor: Topic Coverage
  let topicCoverage = 75;
  if (topics.length > 3) {
    topicCoverage = 60;
    warnings.push('Complex message with multiple topics');
  }

  // Check for sensitive topics
  const sensitiveIntents = ['refund_request', 'noise_complaint', 'maintenance_issue'];
  const hasSensitiveTopic = topics.some(t => sensitiveIntents.includes(t.intent));
  if (hasSensitiveTopic) {
    topicCoverage -= 15;
    warnings.push('Contains sensitive topic - review before sending');
    blockedForAutoSend = true;
    blockReason = blockReason || 'Sensitive topic requires human review';
  }

  // Factor: Style Match — measures training data availability (NOT output quality)
  // Post-generation validation adds/subtracts based on actual output match
  let styleMatch = 40; // Low base without any profile
  if (styleProfile && styleProfile.samplesAnalyzed > 20) {
    styleMatch = 75; // Good training data, but output quality checked post-generation
  } else if (styleProfile && styleProfile.samplesAnalyzed > 10) {
    styleMatch = 65;
  } else if (styleProfile && styleProfile.samplesAnalyzed > 5) {
    styleMatch = 55;
  } else if (styleProfile && styleProfile.samplesAnalyzed > 0) {
    styleMatch = 45;
  }

  // Factor: Safety Check (hallucination prevention)
  let safetyCheck = 80;
  const moneyMentioned = /\$|refund|payment|charge|fee|price|cost/i.test(topics.map(t => t.topic).join(' '));
  if (moneyMentioned && !knowledge) {
    safetyCheck = 60;
    warnings.push('Money/pricing mentioned without knowledge base');
    blockedForAutoSend = true;
    blockReason = blockReason || 'Financial topics need verification';
  }

  // Calculate overall
  const overall = Math.round(
    (sentimentMatch * 0.25) +
    (knowledgeAvailable * 0.25) +
    (topicCoverage * 0.2) +
    (styleMatch * 0.15) +
    (safetyCheck * 0.15)
  );

  return {
    overall,
    factors: {
      sentimentMatch,
      knowledgeAvailable,
      topicCoverage,
      styleMatch,
      safetyCheck,
    },
    warnings,
    blockedForAutoSend,
    blockReason,
  };
}

// Detect action items from message
export function detectActionItems(
  content: string,
  sentiment: SentimentAnalysis,
  topics: DetectedTopic[],
  conversationId: string,
  guestName: string,
  propertyId: string
): ActionItem[] {
  const items: ActionItem[] = [];
  // content accessed directly via regex patterns below

  // Maintenance issues
  if (topics.some(t => t.intent === 'maintenance_issue')) {
    const maintenanceKeywords = content.match(/\b(ac|air condition|heat|water|leak|broken|not working|damage|light|bulb|toilet|shower|fridge|refrigerator|tv|wifi|door|window|lock)\b/gi);
    items.push({
      id: `action-${Date.now()}-maintenance`,
      type: 'maintenance',
      description: `Maintenance issue reported: ${maintenanceKeywords?.join(', ') || 'General issue'}`,
      priority: sentiment.primary === 'urgent' ? 'urgent' : 'high',
      conversationId,
      guestName,
      propertyId,
      createdAt: new Date(),
    });
  }

  // Follow-up needed for negative sentiment
  if (sentiment.primary === 'negative' && sentiment.intensity >= 60) {
    items.push({
      id: `action-${Date.now()}-followup`,
      type: 'followup',
      description: `Guest appears unhappy - follow up within 24 hours`,
      priority: sentiment.intensity >= 80 ? 'high' : 'medium',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      conversationId,
      guestName,
      propertyId,
      createdAt: new Date(),
    });
  }

  // Escalation for urgent/angry
  if (sentiment.requiresEscalation) {
    items.push({
      id: `action-${Date.now()}-escalation`,
      type: 'escalation',
      description: sentiment.escalationReason || 'Requires immediate attention',
      priority: 'urgent',
      conversationId,
      guestName,
      propertyId,
      createdAt: new Date(),
    });
  }

  // Refund request
  if (topics.some(t => t.intent === 'refund_request')) {
    items.push({
      id: `action-${Date.now()}-refund`,
      type: 'refund',
      description: 'Guest requested refund or compensation',
      priority: 'high',
      conversationId,
      guestName,
      propertyId,
      createdAt: new Date(),
    });
  }

  // Emergency
  if (sentiment.primary === 'urgent' && /\b(fire|flood|gas|police|ambulance|medical|emergency)\b/i.test(content)) {
    items.push({
      id: `action-${Date.now()}-emergency`,
      type: 'emergency',
      description: 'EMERGENCY: Immediate action required',
      priority: 'urgent',
      conversationId,
      guestName,
      propertyId,
      createdAt: new Date(),
    });
  }

  // Upsell opportunities
  if (topics.some(t => ['early_checkin_request', 'late_checkout_request', 'extension_request'].includes(t.intent))) {
    items.push({
      id: `action-${Date.now()}-upsell`,
      type: 'upsell',
      description: `Potential upsell: ${topics.find(t => t.intent.includes('request'))?.topic}`,
      priority: 'low',
      conversationId,
      guestName,
      propertyId,
      createdAt: new Date(),
    });
  }

  return items;
}

// Check for knowledge base conflicts
export function detectKnowledgeConflicts(knowledge: PropertyKnowledge): KnowledgeConflict[] {
  const conflicts: KnowledgeConflict[] = [];
  // Date comparisons handled inline below

  // Check for obviously outdated info
  if (knowledge.wifiPassword && knowledge.wifiPassword.includes('2023')) {
    conflicts.push({
      field: 'wifiPassword',
      issue: 'WiFi password may contain outdated year reference',
      severity: 'medium',
      suggestedFix: 'Update WiFi password if it references an old date',
    });
  }

  // Check for incomplete info
  if (knowledge.wifiName && !knowledge.wifiPassword) {
    conflicts.push({
      field: 'wifiPassword',
      issue: 'WiFi name set but password is missing',
      severity: 'high',
      suggestedFix: 'Add WiFi password to property knowledge',
    });
  }

  if (knowledge.checkInTime && !knowledge.checkInInstructions) {
    conflicts.push({
      field: 'checkInInstructions',
      issue: 'Check-in time set but instructions are missing',
      severity: 'medium',
      suggestedFix: 'Add detailed check-in instructions',
    });
  }

  // Check for potential inconsistencies in text
  if (knowledge.checkInInstructions && knowledge.checkInTime) {
    const mentionedTime = knowledge.checkInInstructions.match(/\b(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)?\b/);
    if (mentionedTime && !knowledge.checkInInstructions.includes(knowledge.checkInTime)) {
      conflicts.push({
        field: 'checkInInstructions',
        issue: 'Check-in instructions may mention different time than set check-in time',
        severity: 'low',
        suggestedFix: 'Verify check-in time is consistent across all fields',
      });
    }
  }
  return conflicts;
}

// Get regeneration options based on context
export function getRegenerationOptions(sentiment: SentimentAnalysis): RegenerationOption[] {
  const options: RegenerationOption[] = [
    {
      id: 'empathy',
      label: 'More Empathy',
      description: 'Add understanding and care',
      modifier: 'empathy',
    },
    {
      id: 'shorter',
      label: 'Shorter',
      description: 'Make it more concise',
      modifier: 'shorter',
    },
    {
      id: 'longer',
      label: 'More Details',
      description: 'Add more information',
      modifier: 'longer',
    },
    {
      id: 'formal',
      label: 'More Formal',
      description: 'Professional tone',
      modifier: 'formal',
    },
    {
      id: 'casual',
      label: 'More Casual',
      description: 'Friendly and relaxed',
      modifier: 'casual',
    },
  ];

  // Prioritize empathy for negative sentiment
  if (sentiment.primary === 'negative' || sentiment.emotions.includes('frustrated')) {
    const empathyOption = options.find(o => o.id === 'empathy');
    if (empathyOption) {
      options.splice(options.indexOf(empathyOption), 1);
      options.unshift(empathyOption);
    }
  }

  return options;
}

// Analyze full conversation context for repetition detection and context awareness
export function analyzeConversationContext(
  conversation: Conversation,
  currentGuestMessage: Message,
  propertyKnowledge?: PropertyKnowledge
): {
  contextAnalysis: ConversationContextAnalysis;
  skippedTopics: SkippedTopicInfo[];
  filteredTopics: DetectedTopic[];
} {
  const messages = conversation.messages.filter(m => m.sender !== 'ai_draft');

  // Find recent host messages (last 1-3 exchanges)
  const recentHostMessages: { message: Message; index: number; exchangesAgo: number }[] = [];
  let exchangeCount = 0;

  // Walk backwards through messages to find recent host responses
  for (let i = messages.length - 1; i >= 0 && exchangeCount < 3; i--) {
    const msg = messages[i];
    if (msg.sender === 'host') {
      exchangeCount++;
      recentHostMessages.push({
        message: msg,
        index: i,
        exchangesAgo: exchangeCount,
      });
    }
  }

  // Detect topics in recent host messages
  const recentHostTopics: string[] = [];
  const topicsAddressedByHost: Map<string, { messageIndex: number; exchangesAgo: number }> = new Map();

  for (const { message, index, exchangesAgo } of recentHostMessages) {
    const hostTopics = detectTopicsInText(message.content);
    for (const topic of hostTopics) {
      recentHostTopics.push(topic);
      if (!topicsAddressedByHost.has(topic)) {
        topicsAddressedByHost.set(topic, { messageIndex: index, exchangesAgo });
      }
    }
  }

  // Detect topics in current guest message
  const currentGuestTopics = detectTopics(currentGuestMessage.content, propertyKnowledge);

  // Identify skipped topics (already addressed in recent host messages)
  const skippedTopics: SkippedTopicInfo[] = [];
  const filteredTopics: DetectedTopic[] = [];

  for (const topic of currentGuestTopics) {
    const topicLower = topic.topic.toLowerCase();
    // intent used directly below

    // Check if this topic was recently addressed
    let wasAddressed = false;
    let addressedInfo: { messageIndex: number; exchangesAgo: number } | undefined;

    for (const [addressedTopic, info] of topicsAddressedByHost.entries()) {
      const addressedLower = addressedTopic.toLowerCase();

      // Check for topic match (exact or semantic)
      if (
        addressedLower === topicLower ||
        addressedLower.includes(topicLower) ||
        topicLower.includes(addressedLower) ||
        isSemanticMatch(topicLower, addressedLower)
      ) {
        wasAddressed = true;
        addressedInfo = info;
        break;
      }
    }

    // Only skip if guest is NOT explicitly referencing the topic again
    const guestExplicitlyAsksAgain = checkIfGuestReferencesAgain(
      currentGuestMessage.content,
      topic.topic
    );

    if (wasAddressed && !guestExplicitlyAsksAgain && addressedInfo) {
      skippedTopics.push({
        topic: topic.topic,
        reason: `Already answered in your previous reply (${addressedInfo.exchangesAgo} exchange${addressedInfo.exchangesAgo > 1 ? 's' : ''} ago)`,
        answeredInMessageIndex: addressedInfo.messageIndex,
        exchangesAgo: addressedInfo.exchangesAgo,
      });
    } else {
      filteredTopics.push(topic);
    }
  }

  // Determine thread direction
  const threadDirection = determineThreadDirection(
    currentGuestMessage.content,
    recentHostMessages.map(h => h.message.content),
    skippedTopics.length > 0
  );

  // Calculate total exchanges
  const totalExchanges = Math.ceil(messages.length / 2);

  const contextAnalysis: ConversationContextAnalysis = {
    totalExchanges,
    recentHostTopics: [...new Set(recentHostTopics)], // Unique topics
    primaryFocusMessage: currentGuestMessage.content,
    threadDirection,
  };

  console.log('[AI Enhanced] Context Analysis:', {
    totalExchanges,
    recentHostTopics: contextAnalysis.recentHostTopics,
    skippedTopicsCount: skippedTopics.length,
    filteredTopicsCount: filteredTopics.length,
    threadDirection,
  });

  return { contextAnalysis, skippedTopics, filteredTopics };
}

// Detect topics mentioned in text (simpler version for host messages)
function detectTopicsInText(content: string): string[] {
  const topics: string[] = [];
  // content tested via regex directly below

  const topicKeywords: { keywords: RegExp; topic: string }[] = [
    { keywords: /\b(wifi|wi-fi|internet|password|network)\b/i, topic: 'WiFi' },
    { keywords: /\b(check-?in|arrive|arrival|entry|access|door|key|code|lock)\b/i, topic: 'Check-in' },
    { keywords: /\b(check-?out|leave|leaving|departure)\b/i, topic: 'Check-out' },
    { keywords: /\b(parking|car|garage|driveway)\b/i, topic: 'Parking' },
    { keywords: /\b(trash|garbage|recycling|bins)\b/i, topic: 'Trash' },
    { keywords: /\b(towel|sheet|linen|bedding)\b/i, topic: 'Housekeeping' },
    { keywords: /\b(pool|hot tub|jacuzzi|gym|fitness)\b/i, topic: 'Amenities' },
    { keywords: /\b(restaurant|food|eat|coffee|grocery|store)\b/i, topic: 'Local Tips' },
    { keywords: /\b(broken|not working|fix|repair|maintenance|issue)\b/i, topic: 'Maintenance' },
    { keywords: /\b(heat|ac|air condition|thermostat|temperature)\b/i, topic: 'Temperature' },
    { keywords: /\b(tv|television|remote|streaming|netflix)\b/i, topic: 'TV/Entertainment' },
    { keywords: /\b(noise|loud|quiet|neighbor)\b/i, topic: 'Noise' },
    { keywords: /\b(pet|dog|cat|animal)\b/i, topic: 'Pets' },
    { keywords: /\b(refund|money|compensation|charge|fee)\b/i, topic: 'Refund' },
    { keywords: /\b(early|earlier)\s+(check|arrive)/i, topic: 'Early Check-in' },
    { keywords: /\b(late|later)\s+(check|out|stay)/i, topic: 'Late Check-out' },
  ];

  for (const { keywords, topic } of topicKeywords) {
    if (keywords.test(content)) {
      topics.push(topic);
    }
  }

  return topics;
}

// Check for semantic topic matches
function isSemanticMatch(topic1: string, topic2: string): boolean {
  const semanticGroups: string[][] = [
    ['wifi', 'internet', 'network', 'password', 'connection'],
    ['check-in', 'checkin', 'arrival', 'access', 'entry', 'door', 'key', 'code', 'lock'],
    ['check-out', 'checkout', 'departure', 'leaving'],
    ['parking', 'car', 'garage', 'driveway'],
    ['trash', 'garbage', 'bins', 'recycling', 'waste'],
    ['housekeeping', 'cleaning', 'towels', 'sheets', 'linens'],
    ['temperature', 'heat', 'ac', 'hvac', 'thermostat', 'cold', 'hot'],
    ['maintenance', 'broken', 'repair', 'fix', 'not working'],
  ];

  for (const group of semanticGroups) {
    const topic1InGroup = group.some(word => topic1.includes(word));
    const topic2InGroup = group.some(word => topic2.includes(word));
    if (topic1InGroup && topic2InGroup) {
      return true;
    }
  }

  return false;
}

// Check if guest explicitly references a topic again (asking follow-up or clarification)
function checkIfGuestReferencesAgain(guestMessage: string, topic: string): boolean {
  const lowerMessage = guestMessage.toLowerCase();
  const lowerTopic = topic.toLowerCase();

  // Patterns that indicate guest is explicitly asking about the topic again
  const followUpPatterns = [
    `still.*${lowerTopic}`,
    `again.*${lowerTopic}`,
    `${lowerTopic}.*again`,
    `${lowerTopic}.*still`,
    `more.*about.*${lowerTopic}`,
    `${lowerTopic}.*not working`,
    `${lowerTopic}.*didn't work`,
    `${lowerTopic}.*doesn't work`,
    `clarif.*${lowerTopic}`,
    `${lowerTopic}.*clarif`,
    `sorry.*${lowerTopic}`,
    `${lowerTopic}.*sorry`,
    `confused.*${lowerTopic}`,
    `${lowerTopic}.*confused`,
  ];

  for (const pattern of followUpPatterns) {
    if (new RegExp(pattern, 'i').test(lowerMessage)) {
      return true;
    }
  }

  return false;
}

// Determine the direction of the conversation thread
function determineThreadDirection(
  currentGuestMessage: string,
  recentHostMessages: string[],
  hasSkippedTopics: boolean
): ConversationContextAnalysis['threadDirection'] {
  // currentGuestMessage tested via regex directly below

  // Check for follow-up indicators
  const followUpPatterns = [
    /\b(follow|following)\s+up\b/i,
    /\b(as\s+)?mentioned\b/i,
    /\b(you\s+)?said\b/i,
    /\b(about\s+)?that\b/i,
    /\b(regarding|re:)\b/i,
  ];

  const isFollowUp = followUpPatterns.some(p => p.test(currentGuestMessage));

  // Check for clarification requests
  const clarificationPatterns = [
    /\b(don't|do not)\s+understand\b/i,
    /\b(confused|unclear|what\s+do\s+you\s+mean)\b/i,
    /\b(can\s+you\s+)?(explain|clarify)\b/i,
    /\?{2,}/,
  ];

  const isClarification = clarificationPatterns.some(p => p.test(currentGuestMessage));

  // Check for resolution/thanks
  const resolutionPatterns = [
    /\b(thank|thanks|perfect|great|got\s+it|understood|makes\s+sense)\b/i,
    /\b(that\s+)?work(s|ed)?\b/i,
    /\b(all\s+)?set\b/i,
  ];

  const isResolution = resolutionPatterns.some(p => p.test(currentGuestMessage));

  if (isResolution && !isClarification) {
    return 'resolution';
  }
  if (isClarification) {
    return 'clarification';
  }
  if (isFollowUp || hasSkippedTopics) {
    return 'followup';
  }

  return 'new_topic';
}

// =============================================================================
// INTRA-THREAD LEARNING: Real-time learning from your responses within a thread
// =============================================================================

// Extract style anchor from most recent host responses in this conversation
export function extractThreadStyleAnchor(
  conversation: Conversation,
  guestName: string
): ThreadStyleAnchor {
  const messages = conversation.messages.filter(m => m.sender !== 'ai_draft');

  // Find host messages (most recent first)
  const hostMessages = messages
    .filter(m => m.sender === 'host')
    .slice(-3) // Last 3 host messages
    .reverse(); // Most recent first

  if (hostMessages.length === 0) {
    return {
      hasAnchor: false,
      warmthLevel: 'neutral',
      brevityLevel: 'moderate',
      usesEmojis: false,
      usesExclamations: false,
      responseWordCount: 0,
      resolvedTopics: [],
      keyPhrases: [],
    };
  }

  const mostRecent = hostMessages[0];
  const content = mostRecent.content;
  const wordCount = content.split(/\s+/).length;

  // Detect warmth level
  const warmPatterns = [
    /\b(happy to|glad to|my pleasure|of course|absolutely|wonderful|great|love)\b/i,
    /(!)/,
    /(😊|🙂|❤️|😍|👍|🎉)/,
    new RegExp(`\\b(hi|hey|hello)\\s+${guestName}`, 'i'),
  ];
  const professionalPatterns = [
    /\b(please note|kindly|regarding|as per|accordingly)\b/i,
    /^(dear|hello,)/i,
  ];

  const warmCount = warmPatterns.filter(p => p.test(content)).length;
  const professionalCount = professionalPatterns.filter(p => p.test(content)).length;

  let warmthLevel: ThreadStyleAnchor['warmthLevel'] = 'neutral';
  if (warmCount >= 2) {
    warmthLevel = 'warm';
  } else if (professionalCount >= 1 && warmCount === 0) {
    warmthLevel = 'professional';
  }

  // Detect brevity level
  let brevityLevel: ThreadStyleAnchor['brevityLevel'] = 'moderate';
  if (wordCount < 30) {
    brevityLevel = 'brief';
  } else if (wordCount > 80) {
    brevityLevel = 'detailed';
  }

  // Detect emoji and exclamation usage
  const usesEmojis = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(content);
  const usesExclamations = /!/.test(content);

  // Extract greeting style
  const greetingMatch = content.match(/^(hi\s+\w+[!,]?|hey\s+\w+[!,]?|hello[!,]?|dear\s+\w+[,]?|good\s+(morning|afternoon|evening)[!,]?)/i);
  const greetingStyle = greetingMatch ? greetingMatch[0] : undefined;

  // Extract signoff style
  const signoffMatch = content.match(/(best[,]?|thanks[!,]?|thank you[!,]?|cheers[!,]?|regards[,]?|sincerely[,]?|warm regards[,]?|take care[!,]?)[\s]*$/i);
  const signoffStyle = signoffMatch ? signoffMatch[0].trim() : undefined;

  // Extract key phrases (unique to this host's style in this thread)
  const keyPhrases = extractKeyPhrases(hostMessages.map(m => m.content));

  // Find resolved topics (guest thanked/confirmed after host provided info)
  const resolvedTopics = findResolvedTopics(messages);

  console.log('[Intra-Thread] Style anchor extracted:', {
    warmthLevel,
    brevityLevel,
    wordCount,
    usesEmojis,
    usesExclamations,
    greetingStyle,
    signoffStyle,
    keyPhrasesCount: keyPhrases.length,
    resolvedTopicsCount: resolvedTopics.length,
  });

  return {
    hasAnchor: true,
    warmthLevel,
    brevityLevel,
    usesEmojis,
    usesExclamations,
    greetingStyle,
    signoffStyle,
    mostRecentHostResponse: content,
    responseWordCount: wordCount,
    resolvedTopics,
    keyPhrases,
  };
}

// Extract memorable/distinctive phrases from host messages
function extractKeyPhrases(hostMessages: string[]): string[] {
  const phrases: string[] = [];

  for (const content of hostMessages) {
    // Look for helpful phrases that could be reused
    const helpfulPatterns = [
      /let me know if.+/i,
      /feel free to.+/i,
      /don't hesitate to.+/i,
      /happy to help.*/i,
      /glad (that|to).+/i,
      /hope (that|this|you).+/i,
    ];

    for (const pattern of helpfulPatterns) {
      const match = content.match(pattern);
      if (match && match[0].length < 60) {
        phrases.push(match[0]);
      }
    }
  }

  return [...new Set(phrases)].slice(0, 5); // Unique, max 5
}

// Find topics that were resolved (guest thanked/confirmed after host explanation)
function findResolvedTopics(messages: Message[]): string[] {
  const resolved: string[] = [];

  // Look for host message followed by positive guest response
  for (let i = 0; i < messages.length - 1; i++) {
    const current = messages[i];
    const next = messages[i + 1];

    if (current.sender === 'host' && next.sender === 'guest') {
      const positiveResponse = /\b(thank|thanks|perfect|great|got it|understood|works|awesome|appreciate)\b/i.test(next.content);

      if (positiveResponse) {
        // Extract what topic was resolved
        const hostTopics = detectTopicsInText(current.content);
        resolved.push(...hostTopics);
      }
    }
  }

  return [...new Set(resolved)];
}

// Detect if guest is referencing content from your previous reply
export function detectThreadContinuity(
  currentGuestMessage: Message,
  previousHostMessage: Message | undefined,
  previousGuestMessage: Message | undefined
): ThreadContinuityInfo {
  if (!previousHostMessage) {
    return {
      guestReferencesHostReply: false,
      sentimentTowardPriorReply: 'unknown',
    };
  }

  const guestContent = currentGuestMessage.content.toLowerCase();
  // host content compared via regex patterns below

  // Check if guest references something from host reply
  const referencePatterns = [
    /\b(you (said|mentioned|told me)|as you (said|mentioned)|about (that|the|what you)|regarding)\b/i,
    /\b(the (info|information|instructions|code|password|address) you (gave|sent|provided))\b/i,
    /\b(that (worked|helped|fixed|solved)|it (worked|helped))\b/i,
    /\b(i tried (that|what you|the)|i did (that|what you))\b/i,
  ];

  const guestReferencesHostReply = referencePatterns.some(p => p.test(currentGuestMessage.content));

  // Try to identify what they're referencing
  let referencedContent: string | undefined;
  if (guestReferencesHostReply) {
    // Look for topic keywords in guest message that were in host message
    const hostTopics = detectTopicsInText(previousHostMessage.content);
    const guestTopics = detectTopicsInText(currentGuestMessage.content);
    const overlappingTopics = hostTopics.filter(t =>
      guestTopics.includes(t) || guestContent.includes(t.toLowerCase())
    );

    if (overlappingTopics.length > 0) {
      referencedContent = `the ${overlappingTopics[0].toLowerCase()} info`;
    }
  }

  // Detect sentiment toward prior reply
  let sentimentTowardPriorReply: ThreadContinuityInfo['sentimentTowardPriorReply'] = 'unknown';

  const positivePatterns = [
    /\b(thank|thanks|perfect|great|awesome|helpful|worked|appreciate|got it)\b/i,
    /(👍|😊|🙏|❤️)/,
  ];
  const negativePatterns = [
    /\b(didn't work|doesn't work|still (not|can't|doesn't)|wrong|incorrect|that's not)\b/i,
    /\b(confused|don't understand|unclear)\b/i,
  ];

  if (positivePatterns.some(p => p.test(currentGuestMessage.content))) {
    sentimentTowardPriorReply = 'positive';
  } else if (negativePatterns.some(p => p.test(currentGuestMessage.content))) {
    sentimentTowardPriorReply = 'negative';
  } else if (guestReferencesHostReply) {
    sentimentTowardPriorReply = 'neutral';
  }

  // Generate suggested acknowledgment
  let suggestedAcknowledgment: string | undefined;
  if (sentimentTowardPriorReply === 'positive' && referencedContent) {
    suggestedAcknowledgment = `Glad ${referencedContent} worked for you!`;
  } else if (sentimentTowardPriorReply === 'positive') {
    suggestedAcknowledgment = `Happy to help!`;
  } else if (sentimentTowardPriorReply === 'negative' && referencedContent) {
    suggestedAcknowledgment = `Sorry ${referencedContent} didn't work - let me help further.`;
  }

  console.log('[Intra-Thread] Continuity detection:', {
    guestReferencesHostReply,
    referencedContent,
    sentimentTowardPriorReply,
    suggestedAcknowledgment,
  });

  return {
    guestReferencesHostReply,
    referencedContent,
    sentimentTowardPriorReply,
    suggestedAcknowledgment,
  };
}

// Calculate confidence modifier based on thread alignment (True Confidence: Only Penalties)
function calculateThreadConfidenceModifier(
  styleAnchor: ThreadStyleAnchor,
  continuity: ThreadContinuityInfo
): { modifier: number; reason?: string } {
  let modifier = 0;
  let reasons: string[] = [];

  // Lower confidence if guest had issues with prior reply
  if (continuity.sentimentTowardPriorReply === 'negative') {
    modifier -= 15;
    reasons.push('Guest had issues with prior reply - being careful');
  }

  return {
    modifier,
    reason: reasons.length > 0 ? reasons.join('; ') : undefined,
  };
}

// Main function to analyze intra-thread learning for a conversation
export function analyzeIntraThreadLearning(
  conversation: Conversation,
  currentGuestMessage: Message
): IntraThreadLearning {
  const messages = conversation.messages.filter(m => m.sender !== 'ai_draft');

  // Find previous messages
  const currentIndex = messages.findIndex(m => m.id === currentGuestMessage.id);
  const previousHostMessage = messages
    .slice(0, currentIndex >= 0 ? currentIndex : messages.length)
    .reverse()
    .find(m => m.sender === 'host');

  const previousGuestMessage = messages
    .slice(0, currentIndex >= 0 ? currentIndex : messages.length)
    .reverse()
    .find(m => m.sender === 'guest' && m.id !== currentGuestMessage.id);

  // Extract style anchor
  const styleAnchor = extractThreadStyleAnchor(conversation, conversation.guest.name);

  // Detect continuity
  const continuity = detectThreadContinuity(
    currentGuestMessage,
    previousHostMessage,
    previousGuestMessage
  );

  // Calculate confidence modifier
  const { modifier, reason } = calculateThreadConfidenceModifier(styleAnchor, continuity);

  return {
    styleAnchor,
    continuity,
    confidenceModifier: modifier,
    confidenceReason: reason,
  };
}

// Build enhanced system prompt with tone adaptation
export function buildEnhancedSystemPrompt(
  propertyName: string,
  propertyAddress: string,
  sentiment: SentimentAnalysis,
  topics: DetectedTopic[],
  knowledge?: PropertyKnowledge,
  hostName?: string,
  hostStyleProfile?: HostStyleProfile,
  regenerationModifier?: RegenerationOption['modifier']
): string {
  let toneGuidance = '';

  // Adapt tone based on sentiment
  if (sentiment.primary === 'urgent') {
    toneGuidance = `The guest has an urgent issue. Be responsive and solution-focused. Show you take their concern seriously and will act on it. Do NOT use generic reassurance phrases — read what they actually said and respond to that specific situation.`;
  } else if (sentiment.primary === 'negative') {
    if (sentiment.emotions.includes('frustrated')) {
      toneGuidance = `The guest is frustrated. Acknowledge their frustration first ("I completely understand your frustration"), apologize if appropriate, then focus on solutions. Don't be defensive.`;
    } else if (sentiment.emotions.includes('angry')) {
      toneGuidance = `The guest is upset. Lead with empathy ("I'm so sorry you're experiencing this"), take responsibility where appropriate, and offer concrete solutions or compensation options.`;
    } else {
      toneGuidance = `The guest has concerns. Address each concern thoughtfully, be apologetic if there was a shortcoming, and provide helpful solutions.`;
    }
  } else if (sentiment.primary === 'positive') {
    if (sentiment.emotions.includes('excited')) {
      toneGuidance = `The guest is excited! Match their energy with enthusiasm. Use warm, welcoming language and express that you're excited to host them.`;
    } else {
      toneGuidance = `The guest has a positive tone. Be warm and friendly, express appreciation for their kind words if any, and maintain the positive atmosphere.`;
    }
  } else {
    toneGuidance = `The guest has a straightforward tone. Read what they ACTUALLY said and respond to THAT — do not generate a generic placeholder. Be warm, friendly, professional, and address the specific content of their message. If they're confirming details, acknowledge the details. If they're asking a question, answer it directly.`;
  }

  // Apply regeneration modifier
  if (regenerationModifier) {
    switch (regenerationModifier) {
      case 'empathy':
        toneGuidance += `\n\nIMPORTANT: Add extra empathy and understanding. Start by acknowledging their feelings before addressing the practical matter.`;
        break;
      case 'shorter':
        toneGuidance += `\n\nIMPORTANT: Keep the response brief and to the point. Maximum 2-3 sentences. No unnecessary pleasantries.`;
        break;
      case 'longer':
        toneGuidance += `\n\nIMPORTANT: Provide a detailed response with additional helpful information. Anticipate follow-up questions.`;
        break;
      case 'formal':
        toneGuidance += `\n\nIMPORTANT: Use a more formal, professional tone. Avoid casual phrases. Be polite and businesslike.`;
        break;
      case 'casual':
        toneGuidance += `\n\nIMPORTANT: Use a casual, friendly tone like texting a friend. Keep it warm and relaxed.`;
        break;
    }
  }

  // Build identity based on whether we have a learned style profile
  const hasLearnedStyle = hostStyleProfile && hostStyleProfile.samplesAnalyzed > 5;
  // Use Voice DNA (richer ~200-word portrait) when enough data, fall back to basic instructions
  const styleInstructions = hasLearnedStyle && hostStyleProfile!.samplesAnalyzed > 20
    ? generateVoiceDNAPromptSnippet(hostStyleProfile!)
    : hasLearnedStyle
      ? generateStyleInstructions(hostStyleProfile!)
      : '';

  let prompt: string;
  
  if (hasLearnedStyle) {
    // STRONG IDENTITY: AI acts AS the host, style is the core identity
    prompt = `You are ${hostName || 'the host'}, responding to a guest at your vacation rental property. You are NOT an AI assistant — you are writing as yourself, the property host. Your responses must sound exactly like YOUR previous messages. If someone read this response alongside your real messages, they should not be able to tell which is which.

PROPERTY: ${propertyName}
ADDRESS: ${propertyAddress}

YOUR VOICE DNA (learned from ${hostStyleProfile!.samplesAnalyzed} of your real messages — this is WHO YOU ARE):
${styleInstructions}

These style rules are MANDATORY. They define your voice. Do NOT deviate from them.

TONE GUIDANCE FOR THIS MESSAGE:
${toneGuidance}

DETECTED TOPICS IN GUEST MESSAGE:
${topics.map(t => `- ${t.topic} (${t.hasAnswer ? 'knowledge available' : 'no specific knowledge'})`).join('\n')}

REVIEW/FEEDBACK RESPONSE RULES:
- When responding to guest reviews or positive feedback, be warm and grateful
- Do NOT create bullet-point lists of property improvements or to-do items
- NEVER say "I will look into adding..." or promise specific property changes
- Simply thank them by first name, acknowledge their feedback generally, and warmly invite them back
- Match this style EXACTLY: "Hi [guest first name], thank you so much for the feedback as that truly helps us improve the home! We're always striving to improve our home for our guests! We are so glad we had the opportunity to have you and your wonderful family, and would love to have you back anytime! We wish you safe travels, and thank you again for everything!"
- Keep it warm, genuine, and personal — never corporate or list-like

MULTI-TOPIC HANDLING:
If the guest asked multiple questions, address EACH one clearly. Use paragraph breaks or numbered points for clarity. Don't skip any topic.

GUIDELINES:
- Write as yourself (${hostName || 'the host'}), not as an AI
- Answer questions directly and proactively offer relevant information
- If you don't have specific information, be honest but offer to help find it
- Never make up information about the property that isn't provided
- Keep responses concise but complete
- CRITICAL LANGUAGE RULE: YOU MUST RESPOND EXCLUSIVELY IN ENGLISH. Do NOT write in Italian, Spanish, or any other language, even if the guest wrote in that language or if historical examples are in that language. Hostaway handles translation automatically. English only.
- For urgent issues, express immediate concern and offer solutions

SAFETY RULES (NEVER VIOLATE — these protect your business):
- NEVER promise refunds, discounts, compensation, or any financial action. If a guest asks for money back, say: "I need to look into this and I'll get back to you shortly with a resolution."
- NEVER fabricate property details. If you don't have specific information about an amenity, rule, or feature, say: "Let me confirm that and get back to you" instead of guessing.
- NEVER share other guests' personal information, check-in codes, or booking details.
- NEVER handle legal threats, medical emergencies, or safety hazards. For emergencies, respond: "If this is an emergency, please call 911 immediately. I'm on it right now."
- NEVER guarantee specific check-in/check-out times unless explicitly stated in the property knowledge. For early check-in or late checkout requests, respond helpfully: "Let me check availability for that and I'll let you know!"
- NEVER offer free nights, upgrades, early check-in, or late check-out as confirmed — always say you'll check.
- NEVER make promises about future bookings, availability, or pricing.
- When uncertain about ANY fact, clearly state uncertainty rather than guessing. "I'll check on that" is better than a wrong answer that damages trust.
- NEVER refer to yourself in the third person or say "the host" — YOU ARE the host.

BANNED PHRASES (these are AI artifacts — no real person writes like this, remove if you catch yourself using them):
- "I understand this is stressful" / "I understand your frustration" / "I completely understand"
- "I'd be happy to help" / "Happy to assist" / "Please don't hesitate to reach out"
- "Rest assured" / "I want to assure you" / "Let me assure you" / "I appreciate your patience"
- "It's important to note" / "It's worth noting" / "I need to look into this and I'll get back to you shortly with a resolution"
- "Delve" / "Leverage" / "Utilize" / "Harness" / "Robust" / "Landscape" / "Realm"
- "Furthermore" / "Additionally" / "Moreover" / "Moving forward" / "Straightforward"
- "Absolutely" as a sentence starter / "reach out at anytime"
- Do NOT sign off with your name on every message. Sign-offs like "– ${hostName}" are ONLY for initial welcome messages, NOT for follow-up replies in an ongoing conversation.
${hostStyleProfile!.avoidedWords && hostStyleProfile!.avoidedWords.length > 0 ? `- YOUR PERSONAL BANNED LIST (you've edited these out of AI drafts before): ${hostStyleProfile!.avoidedWords.slice(0, 10).join(', ')}` : ''}
`;
  } else {
    // FALLBACK: First-person host voice when no style profile exists yet
    prompt = `You are ${hostName || 'the property host'}, responding directly to a guest at your vacation rental property. You are NOT an AI assistant or middleman — you ARE the host. Write in first person as yourself. Never say "the host" or "I'll bring this to the host's attention" — YOU are the host.

PROPERTY: ${propertyName}
ADDRESS: ${propertyAddress}

TONE GUIDANCE:
${toneGuidance}

DETECTED TOPICS IN GUEST MESSAGE:
${topics.map(t => `- ${t.topic} (${t.hasAnswer ? 'knowledge available' : 'no specific knowledge'})`).join('\n')}

REVIEW/FEEDBACK RESPONSE RULES:
- When responding to guest reviews or positive feedback, be warm and grateful
- Do NOT create bullet-point lists of property improvements or to-do items
- NEVER say "I will look into adding..." or promise specific property changes
- Simply thank them by first name, acknowledge their feedback generally, and warmly invite them back
- Match this style EXACTLY: "Hi [guest first name], thank you so much for the feedback as that truly helps us improve the home! We're always striving to improve our home for our guests! We are so glad we had the opportunity to have you and your wonderful family, and would love to have you back anytime! We wish you safe travels, and thank you again for everything!"
- Keep it warm, genuine, and personal — never corporate or list-like

MULTI-TOPIC HANDLING:
If the guest asked multiple questions, address EACH one clearly. Use paragraph breaks or numbered points for clarity. Don't skip any topic.

GUIDELINES:
- Write as yourself (${hostName || 'the host'}), in first person
- Answer questions directly and proactively offer relevant information
- If you don't have specific information, say "Let me check on that and get back to you"
- Never make up information about the property that isn't provided
- Keep responses concise but complete (2-4 sentences)
- ALWAYS respond in English — Hostaway handles translation to the guest's language automatically
- For urgent issues, express immediate concern and offer solutions

SAFETY RULES (NEVER VIOLATE — these protect your business):
- NEVER promise refunds, discounts, compensation, or any financial action. Say: "I need to look into this and I'll get back to you shortly."
- NEVER fabricate property details. Say: "Let me confirm that and get back to you" instead of guessing.
- NEVER share other guests' personal information, check-in codes, or booking details.
- NEVER handle legal threats, medical emergencies, or safety hazards. For emergencies: "If this is an emergency, please call 911 immediately. I'm on it."
- NEVER guarantee specific check-in/check-out times unless explicitly stated in the property knowledge. For late checkout or early check-in requests, say: "Let me check availability for that and I'll let you know!"
- NEVER offer free nights, upgrades, or confirmed schedule changes — always say you'll check.
- NEVER make promises about future bookings, availability, or pricing.
- When uncertain, say "I'll check on that" rather than guessing.
- NEVER refer to yourself in the third person or say "the host" — YOU ARE the host.

BANNED PHRASES (these are AI artifacts — no real person writes like this):
- "I understand this is stressful" / "I understand your frustration" / "I completely understand"
- "I'd be happy to help" / "Happy to assist" / "Please don't hesitate to reach out"
- "Rest assured" / "I want to assure you" / "Let me assure you" / "I appreciate your patience"
- "It's important to note" / "It's worth noting"
- "Delve" / "Leverage" / "Utilize" / "Harness" / "Robust" / "Straightforward"
- "Furthermore" / "Additionally" / "Moreover" / "Moving forward"
- "Absolutely" as a sentence starter / "reach out at anytime"
- Do NOT sign off with your name on every message — only on initial welcome messages.
`;
  }

  // Add property knowledge
  if (knowledge) {
    prompt += '\nPROPERTY INFORMATION:\n';

    if (knowledge.wifiName && knowledge.wifiPassword) {
      prompt += `- WiFi: Network "${knowledge.wifiName}", Password "${knowledge.wifiPassword}"\n`;
    }
    if (knowledge.checkInInstructions) {
      prompt += `- Check-in: ${knowledge.checkInInstructions}\n`;
    }
    if (knowledge.checkInTime) {
      prompt += `- Check-in Time: ${knowledge.checkInTime}\n`;
    }
    if (knowledge.checkOutInstructions) {
      prompt += `- Check-out: ${knowledge.checkOutInstructions}\n`;
    }
    if (knowledge.checkOutTime) {
      prompt += `- Check-out Time: ${knowledge.checkOutTime}\n`;
    }
    if (knowledge.parkingInfo) {
      prompt += `- Parking: ${knowledge.parkingInfo}\n`;
    }
    if (knowledge.houseRules) {
      prompt += `- House Rules: ${knowledge.houseRules}\n`;
    }
    if (knowledge.applianceGuide) {
      prompt += `- Appliances: ${knowledge.applianceGuide}\n`;
    }
    if (knowledge.localRecommendations) {
      prompt += `- Local Tips: ${knowledge.localRecommendations}\n`;
    }
    if (knowledge.emergencyContacts) {
      prompt += `- Emergency Contacts: ${knowledge.emergencyContacts}\n`;
    }
    if (knowledge.customNotes) {
      prompt += `- Additional Notes: ${knowledge.customNotes}\n`;
    }
    if (knowledge.earlyCheckInAvailable && knowledge.earlyCheckInFee) {
      prompt += `- Early Check-in: Available for $${knowledge.earlyCheckInFee}\n`;
    }
    if (knowledge.lateCheckOutAvailable && knowledge.lateCheckOutFee) {
      prompt += `- Late Check-out: Available for $${knowledge.lateCheckOutFee}\n`;
    }
  }

  // Add DIRECT ANSWER block for detected topics that have knowledge
  const directAnswerBlock = getDirectAnswerBlock(topics, knowledge);
  if (directAnswerBlock) {
    prompt += directAnswerBlock;
  }

  return prompt;
}

// Call Google Gemini API
async function callGeminiAPI(
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  apiKey: string,
  authMethod: 'key' | 'bearer' = 'key',
  modelId: string = GEMINI_MODEL
): Promise<string | null> {
  try {
    const url = `${GOOGLE_API_BASE}/${modelId}:generateContent`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    let fetchUrl = url;
    if (authMethod === 'bearer') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      fetchUrl = `${url}?key=${apiKey}`;
    }

    const response = await fetch(fetchUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${systemPrompt}\n\n${userPrompt}`
          }]
        }],
        generationConfig: {
          temperature,
          maxOutputTokens: 600,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[AI Enhanced] Gemini API error:', error);
      return null;
    }

    const data = await response.json();
    const generatedContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!generatedContent) {
      console.error('[AI Enhanced] Empty response from Gemini');
      return null;
    }

    return generatedContent.trim();
  } catch (error) {
    console.error('[AI Enhanced] Gemini error:', error);
    return null;
  }
}

// Call Claude API
async function callClaudeAPI(
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  apiKey: string,
  modelId: string = CLAUDE_MODEL
): Promise<string | null> {
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 600,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
        ],
        temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[AI Enhanced] Claude API error:', error);
      return null;
    }

    const data = await response.json();
    const generatedContent = data.content?.[0]?.text || '';

    if (!generatedContent) {
      console.error('[AI Enhanced] Empty response from Claude');
      return null;
    }

    return generatedContent.trim();
  } catch (error) {
    console.error('[AI Enhanced] Claude error:', error);
    return null;
  }
}

// Call OpenAI API
async function callOpenAIAPI(
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  apiKey: string,
  modelId: string = 'gpt-4o-mini'
): Promise<string | null> {
  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 600,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[AI Enhanced] OpenAI API error:', error);
      return null;
    }

    const data = await response.json();
    const generatedContent = data.choices?.[0]?.message?.content || '';

    if (!generatedContent) {
      console.error('[AI Enhanced] Empty response from OpenAI');
      return null;
    }

    return generatedContent.trim();
  } catch (error) {
    console.error('[AI Enhanced] OpenAI error:', error);
    return null;
  }
}

// Generate a local fallback response when AI API is unavailable
function generateLocalFallbackResponse(
  guestMessage: string,
  sentiment: SentimentAnalysis,
  topics: DetectedTopic[],
  detectedLanguage: string,
  propertyKnowledge?: PropertyKnowledge,
  hostName?: string
): string {
  const greeting = hostName ? `Hi! This is ${hostName}.` : 'Hi there!';

  // Check for common intents and generate appropriate responses
  const lowerMessage = guestMessage.toLowerCase();

  // WiFi inquiry
  if (lowerMessage.includes('wifi') || lowerMessage.includes('wi-fi') || lowerMessage.includes('internet') || lowerMessage.includes('password')) {
    if (propertyKnowledge?.wifiName && propertyKnowledge?.wifiPassword) {
      return `${greeting} The WiFi network is "${propertyKnowledge.wifiName}" and the password is "${propertyKnowledge.wifiPassword}". Let me know if you have any trouble connecting!`;
    }
    return `${greeting} You can find the WiFi details in the welcome book on the kitchen counter. Let me know if you need any help!`;
  }

  // Check-in inquiry
  if (lowerMessage.includes('check-in') || lowerMessage.includes('check in') || lowerMessage.includes('arrive') || lowerMessage.includes('arrival')) {
    const checkInTime = propertyKnowledge?.checkInTime || '3:00 PM';
    return `${greeting} Check-in is at ${checkInTime}. I'll send you the entry code on the morning of your arrival. Let me know if you have any questions!`;
  }

  // Check-out inquiry
  if (lowerMessage.includes('check-out') || lowerMessage.includes('check out') || lowerMessage.includes('leaving') || lowerMessage.includes('departure')) {
    const checkOutTime = propertyKnowledge?.checkOutTime || '11:00 AM';
    return `${greeting} Check-out is at ${checkOutTime}. Please start the dishwasher and leave the keys on the counter. Safe travels!`;
  }

  // Parking inquiry
  if (lowerMessage.includes('parking') || lowerMessage.includes('car') || lowerMessage.includes('driveway')) {
    if (propertyKnowledge?.parkingInfo) {
      return `${greeting} ${propertyKnowledge.parkingInfo}`;
    }
    return `${greeting} Parking is available at the property. You can park in the driveway or check the welcome book for additional parking information.`;
  }

  // Issue/problem handling
  if (sentiment.primary === 'negative' || sentiment.requiresEscalation ||
      lowerMessage.includes('broken') || lowerMessage.includes('not working') ||
      lowerMessage.includes('problem') || lowerMessage.includes('issue')) {
    return `${greeting} I'm so sorry to hear you're experiencing an issue! I want to get this resolved for you right away. Can you tell me more about what's happening? I'll look into this immediately.`;
  }

  // Thank you / positive
  if (sentiment.primary === 'positive' || lowerMessage.includes('thank') || lowerMessage.includes('great') || lowerMessage.includes('wonderful')) {
    return `${greeting} Thank you so much for the kind words! I'm so glad you're enjoying your stay. Please don't hesitate to reach out if there's anything else I can help with!`;
  }

  // Default response
  return `${greeting} Thanks for reaching out! I'm happy to help with anything you need during your stay. What can I assist you with?`;
}

// Generate enhanced AI response
export async function generateEnhancedAIResponse(options: {
  conversation: Conversation;
  propertyKnowledge?: PropertyKnowledge;
  hostName?: string;
  hostStyleProfile?: HostStyleProfile;
  regenerationModifier?: RegenerationOption['modifier'];
  responseLanguageMode?: 'match_guest' | 'host_language';
  hostDefaultLanguage?: string;
}): Promise<EnhancedAIResponse> {
  const { conversation, propertyKnowledge, hostName, hostStyleProfile, regenerationModifier } = options;

  // ── RATE LIMIT CHECK ──
  const rateLimitResult = await canGenerateDraft();
  if (!rateLimitResult.allowed) {
    throw new Error(`RATE_LIMIT: ${rateLimitResult.reason}`);
  }

  // Keys are now fetched dynamically via getAIKey() in the provider fallback chain

  // Get last guest message
  const lastGuestMessage = [...conversation.messages]
    .reverse()
    .find((m) => m.sender === 'guest');

  if (!lastGuestMessage) {
    throw new Error('No guest message to respond to');
  }

  // GUEST TYPE DETECTION: Detect guest type for tone adaptation
  const guestProfile = detectGuestType(conversation);
  console.log('[AI Enhanced] Guest profile detected:', guestProfile.type, 'confidence:', guestProfile.confidence);

  // CONTEXT AWARENESS: Analyze full conversation to detect repetition
  const { contextAnalysis, skippedTopics, filteredTopics } = analyzeConversationContext(
    conversation,
    lastGuestMessage,
    propertyKnowledge
  );

  // INTRA-THREAD LEARNING: Analyze recent host responses for style anchoring
  const intraThreadLearning = analyzeIntraThreadLearning(conversation, lastGuestMessage);

  // Analyze message sentiment
  const sentiment = analyzeSentimentAdvanced(lastGuestMessage.content);

  // Use filtered topics (excluding already-addressed topics) instead of raw topics
  const topics = filteredTopics.length > 0 ? filteredTopics : detectTopics(lastGuestMessage.content, propertyKnowledge);

  const actionItems = detectActionItems(
    lastGuestMessage.content,
    sentiment,
    topics,
    conversation.id,
    conversation.guest.name,
    conversation.property.id
  );
  const knowledgeConflicts = propertyKnowledge
    ? detectKnowledgeConflicts(propertyKnowledge)
    : [];
  const regenerationOptions = getRegenerationOptions(sentiment);

  // Language: always English — Hostaway translates on the channel side
  const detectedLanguage = 'en';

  // Search historical responses for similar guest questions
  const historicalMatches = searchAndPrepareHistoricalContext(
    lastGuestMessage.content,
    conversation.property.id
  );

  // Calculate confidence (with historical match boost and skipped topics adjustment)
  let confidence = calculateConfidenceWithHistory(
    sentiment,
    topics,
    propertyKnowledge,
    hostStyleProfile,
    historicalMatches
  );

  // Adjust confidence based on context analysis
  if (skippedTopics.length > 0) {
    // Reduce confidence slightly if we're skipping topics - human should verify
    confidence = {
      ...confidence,
      overall: Math.max(50, confidence.overall - (skippedTopics.length * 5)),
      warnings: [
        ...confidence.warnings,
        `Skipped ${skippedTopics.length} topic(s) already addressed in previous replies`,
      ],
    };
  }

  // Apply intra-thread learning confidence modifier
  if (intraThreadLearning.confidenceModifier !== 0) {
    confidence = {
      ...confidence,
      overall: Math.max(30, Math.min(92, confidence.overall + intraThreadLearning.confidenceModifier)),
      warnings: intraThreadLearning.confidenceReason
        ? [...confidence.warnings, intraThreadLearning.confidenceReason]
        : confidence.warnings,
    };
  }

  // ── CALIBRATION FEEDBACK LOOP ──
  // Apply self-correcting adjustment based on past draft outcomes.
  // If the AI has been consistently overconfident, lower confidence.
  // If consistently underconfident on certain intents, slightly boost.
  const primaryIntent = topics[0]?.intent;
  const calibration = getCalibrationAdjustment(primaryIntent);
  if (calibration.globalAdj !== 0 || calibration.intentAdj !== 0) {
    const totalCalAdj = calibration.globalAdj + calibration.intentAdj;
    confidence = {
      ...confidence,
      overall: Math.max(20, Math.min(90, confidence.overall + totalCalAdj)),
      warnings: [...confidence.warnings, ...calibration.warnings],
    };
    console.log(`[Calibration] Applied adjustment: global=${calibration.globalAdj}, intent=${calibration.intentAdj}, newConfidence=${confidence.overall}`);
  }

  // HARD SAFETY CAP: Never allow auto-sendable confidence above 85%
  // Confidence measures "readiness to send" — only post-generation validation can push above 80%
  if (confidence.overall > 85) {
    confidence.overall = 85;
    confidence.warnings.push('Confidence capped at 85% pre-generation safety limit');
  }

  // Build prompts with historical context, context awareness, AND intra-thread learning
  const systemPrompt = buildEnhancedSystemPromptWithHistory(
    conversation.property.name,
    conversation.property.address,
    sentiment,
    topics,
    propertyKnowledge,
    hostName,
    hostStyleProfile,
    regenerationModifier,
    historicalMatches,
    skippedTopics,
    contextAnalysis,
    intraThreadLearning
  );

  // Build conversation context with chronological ordering
  const recentMessages = conversation.messages.slice(-10);
  const conversationContext = recentMessages
    .filter((m) => m.sender !== 'ai_draft')
    .map((m, idx) => {
      const role = m.sender === 'guest' ? 'Guest' : 'Host';
      return `[${idx + 1}] ${role}: ${m.content}`;
    })
    .join('\n');

  const topicsText = topics.map(t => t.topic).join(', ');

  // Build user prompt with historical guidance and context awareness
  const userPrompt = buildUserPromptWithHistory(
    conversationContext,
    sentiment,
    topicsText,
    detectedLanguage,
    historicalMatches,
    skippedTopics,
    contextAnalysis
  );

  // Add edit diff learned preferences and guest profile to the system prompt
  // Also add advanced training: property lexicon, few-shot examples, negative examples, guest memory
  const systemPromptWithEdits = await buildSystemPromptWithEditLearning(
    systemPrompt,
    conversation.property.id,
    guestProfile,
    lastGuestMessage.content,
    conversation.guest.email,
    conversation.guest.phone
  );

  // ── SUPERMEMORY SEMANTIC ENRICHMENT ──
  // Retrieve semantic memories from Supermemory (kicked off by searchHistoricalResponses above)
  // and host memory profile to enrich the AI prompt with cloud-persisted context
  let finalSystemPrompt = systemPromptWithEdits;
  try {
    const [semanticMemories, hostMemoryProfile] = await Promise.all([
      aiTrainingService.getSemanticContext(),
      aiTrainingService.getHostMemoryProfile(conversation.property.id),
    ]);

    if (semanticMemories.length > 0) {
      // Reframe memories as HOST voice samples with explicit guest/host separation
      finalSystemPrompt += `\n\nYOUR PREVIOUS REPLIES (these are YOUR real messages — match this voice exactly):
${semanticMemories.slice(0, 3).map((m, i) => {
  // The memory format is "Guest asked: X\nHost replied: Y\nIntent: Z"
  // Parse to explicitly show the guest/host separation
  const memory = m.memory || '';
  return `[Example ${i + 1}]${m.score ? ` (${Math.round(m.score * 100)}% match)` : ''}\n${memory}`;
}).join('\n\n')}

^^^ Write your new response the way YOU wrote these. Same greeting style, same energy, same length. These are YOUR real words — the AI's job is to sound indistinguishable from these examples.
`;
      console.log(`[AI Enhanced] ✅ Injected ${semanticMemories.length} Supermemory semantic memories`);
    }

    if (hostMemoryProfile) {
      const profileParts: string[] = [];
      if (hostMemoryProfile.staticFacts.length > 0) {
        profileParts.push(`Permanent host traits: ${hostMemoryProfile.staticFacts.slice(0, 5).join('; ')}`);
      }
      if (hostMemoryProfile.dynamicContext.length > 0) {
        profileParts.push(`Recent behavior patterns: ${hostMemoryProfile.dynamicContext.slice(0, 3).join('; ')}`);
      }
      if (profileParts.length > 0) {
        finalSystemPrompt += `\n\nHOST MEMORY PROFILE (learned from all past interactions):\n${profileParts.join('\n')}
`;
        console.log('[AI Enhanced] ✅ Injected Supermemory host profile');
      }
    }
  } catch (err) {
    // Supermemory enrichment is non-critical — local context is sufficient
    console.warn('[AI Enhanced] Supermemory enrichment failed (non-critical):', err);
  }

  console.log('[AI Enhanced] Generating AI response, sentiment:', sentiment.primary,
    'topics:', topicsText,
    'guestType:', guestProfile.type,
    'historicalMatches:', historicalMatches.matchCount);

  const temperature = historicalMatches.usedHistoricalBasis ? 0.5 : 0.7;
  let generatedContent: string | null = null;
  let usedProvider = 'local';

  // Use dynamic provider order from BYOK settings
  const providerOrder = await getProviderOrder();

  // Check if user has selected a specific model
  const selectedModelId = await getSelectedModel();
  const selectedModel = selectedModelId
    ? AI_MODELS.find(m => m.id === selectedModelId)
    : null;

  // If user selected a specific model, try that provider first
  const effectiveOrder = selectedModel
    ? [selectedModel.provider, ...providerOrder.filter(p => p !== selectedModel.provider)]
    : providerOrder;

  for (const provider of effectiveOrder) {
    if (generatedContent) break;

    const enabled = await isProviderEnabled(provider);
    if (!enabled) continue;

    const key = await getAIKey(provider);
    if (!key) continue;

    switch (provider) {
      case 'google': {
        const googleAuthMethod = await getGoogleAuthMethod();
        const authMode = (googleAuthMethod === 'oauth') ? 'bearer' as const : 'key' as const;
        const modelId = (selectedModel?.provider === 'google' ? selectedModel.id : undefined) || GEMINI_MODEL;
        console.log(`[AI Enhanced] Trying Google Gemini API (${authMode}, model: ${modelId})...`);
        generatedContent = await callGeminiAPI(
          finalSystemPrompt,
          userPrompt,
          temperature,
          key,
          authMode,
          modelId
        );
        if (generatedContent) {
          usedProvider = `gemini (${modelId})`;
          console.log('[AI Enhanced] ✓ Google Gemini succeeded');
        }
        break;
      }
      case 'anthropic': {
        const modelId = (selectedModel?.provider === 'anthropic' ? selectedModel.id : undefined) || CLAUDE_MODEL;
        console.log(`[AI Enhanced] Trying Claude API (model: ${modelId})...`);
        generatedContent = await callClaudeAPI(
          finalSystemPrompt,
          userPrompt,
          temperature,
          key,
          modelId
        );
        if (generatedContent) {
          usedProvider = `claude (${modelId})`;
          console.log('[AI Enhanced] ✓ Claude succeeded');
        }
        break;
      }
      case 'openai': {
        const modelId = (selectedModel?.provider === 'openai' ? selectedModel.id : undefined) || 'gpt-4o-mini';
        console.log(`[AI Enhanced] Trying OpenAI API (model: ${modelId})...`);
        generatedContent = await callOpenAIAPI(
          finalSystemPrompt,
          userPrompt,
          temperature,
          key,
          modelId
        );
        if (generatedContent) {
          usedProvider = `openai (${modelId})`;
          console.log('[AI Enhanced] ✓ OpenAI succeeded');
        }
        break;
      }
    }
  }

  // If all providers failed, use local fallback
  if (!generatedContent) {
    console.log('[AI Enhanced] All providers failed, using local fallback');
    generatedContent = generateLocalFallbackResponse(
      lastGuestMessage.content,
      sentiment,
      topics,
      detectedLanguage,
      propertyKnowledge,
      hostName
    );
    usedProvider = 'local';
  }

  console.log('[AI Enhanced] Response generated using:', usedProvider,
    'confidence:', confidence.overall,
    'historicalBasis:', historicalMatches.usedHistoricalBasis,
    'skippedTopics:', skippedTopics.length,
    'threadDirection:', contextAnalysis.threadDirection,
    'hasStyleAnchor:', intraThreadLearning.styleAnchor.hasAnchor,
    'guestType:', guestProfile.type);

  // Adjust confidence if using local fallback
  const finalConfidence = usedProvider === 'local' ? {
    ...confidence,
    overall: Math.min(confidence.overall, 60),
    warnings: [
      ...confidence.warnings,
      'AI service temporarily unavailable - using smart local response',
    ],
  } : confidence;

  // ── POST-GENERATION STYLE VALIDATION ──
  // Check if the generated response matches the host's style profile.
  // This catches cases where confidence was high (based on input recognition)
  // but the AI's actual OUTPUT is wrong (e.g. emojis when host never uses them).
  if (generatedContent && hostStyleProfile && hostStyleProfile.samplesAnalyzed >= 5) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu;
    const responseHasEmojis = emojiRegex.test(generatedContent);
    const hostUsesEmojis = hostStyleProfile.usesEmojis && hostStyleProfile.emojiFrequency > 0;

    if (responseHasEmojis && !hostUsesEmojis) {
      // AI used emojis but host NEVER uses them — major style mismatch
      console.log('[AI Enhanced] ⚠️ STYLE MISMATCH: Response contains emojis but host does not use them');
      finalConfidence.overall = Math.min(finalConfidence.overall, 60);
      finalConfidence.blockedForAutoSend = true;
      finalConfidence.blockReason = 'Response contains emojis but your style profile shows you don\'t use them';
      finalConfidence.warnings.push('Style mismatch: emojis detected in response but host doesn\'t use emojis');
    }

    // Check for factual accuracy / hallucinations (e.g. placeholders)
    if (generatedContent) {
      const placeholderRegex = /\[(.*?)\]|\((insert.*?)\)/i;
      if (placeholderRegex.test(generatedContent)) {
        console.log('[AI Enhanced] ⚠️ FACTUAL MISMATCH: Response contains placeholders');
        finalConfidence.overall = Math.min(finalConfidence.overall, 20); // Crush confidence
        finalConfidence.blockedForAutoSend = true;
        finalConfidence.blockReason = 'Response contains placeholders that require manual input';
        finalConfidence.warnings.push('Factual mismatch: AI generated placeholders instead of concrete facts');
      }
    }

    // Check if response is significantly longer/shorter than host's typical style
    const responseLength = generatedContent.trim().length;
    const avgLength = hostStyleProfile.averageResponseLength || 150;
    if (responseLength > avgLength * 2.5) {
      console.log('[AI Enhanced] ⚠️ Response much longer than host\'s typical style');
      finalConfidence.overall = Math.min(finalConfidence.overall, 75);
      finalConfidence.warnings.push('Response significantly longer than your typical messages');
    }

    // Check excessive exclamation marks (more than host uses)
    const exclamationCount = (generatedContent.match(/!/g) || []).length;
    if (exclamationCount > 4) {
      console.log('[AI Enhanced] ⚠️ Excessive exclamation marks:', exclamationCount);
      finalConfidence.overall = Math.min(finalConfidence.overall, 70);
      finalConfidence.warnings.push('Response uses excessive exclamation marks');
    }

    // Check formality mismatch
    const hostFormality = hostStyleProfile.formalityLevel || 50;
    const casualMarkers = (generatedContent.match(/\b(hey|lol|yeah|gonna|wanna|gotta|awesome|cool|sweet|dude|bro)\b/gi) || []).length;
    const formalMarkers = (generatedContent.match(/\b(dear|sincerely|regards|esteemed|pursuant|hereby|kindly note)\b/gi) || []).length;
    if (hostFormality > 70 && casualMarkers > 2) {
      console.log('[AI Enhanced] ⚠️ STYLE MISMATCH: Response too casual for host\'s formal style');
      finalConfidence.overall = Math.min(finalConfidence.overall, 65);
      finalConfidence.warnings.push('Style mismatch: response is too casual for your typical communication style');
    } else if (hostFormality < 30 && formalMarkers > 1) {
      console.log('[AI Enhanced] ⚠️ STYLE MISMATCH: Response too formal for host\'s casual style');
      finalConfidence.overall = Math.min(finalConfidence.overall, 65);
      finalConfidence.warnings.push('Style mismatch: response is too formal for your typical communication style');
    }

    // Check greeting style mismatch
    const hostGreeting = hostStyleProfile.commonGreetings?.[0]?.toLowerCase() || '';
    const responseStart = generatedContent.trim().substring(0, 50).toLowerCase();
    if (hostGreeting && !responseStart.includes(hostGreeting.split(' ')[0])) {
      // Host typically says "Hi" but AI said "Hello" or "Hey" — mild penalty
      finalConfidence.overall = Math.max(finalConfidence.overall - 3, 30);
      finalConfidence.warnings.push(`Greeting doesn't match your typical style ("${hostStyleProfile.commonGreetings?.[0]}")`);
    }

    // Check warmth mismatch using warmthLevel
    const hostWarmth = hostStyleProfile.warmthLevel || 50;
    const highWarmthMarkers = (generatedContent.match(/(!{2,}|❤|💕|🥰|so excited|can't wait|thrilled|absolutely love)/gi) || []).length;
    if (hostWarmth < 30 && highWarmthMarkers > 1) {
      console.log('[AI Enhanced] ⚠️ Response too warm/enthusiastic for host\'s direct style');
      finalConfidence.overall = Math.min(finalConfidence.overall, 65);
      finalConfidence.warnings.push('Style mismatch: response is more enthusiastic than your typical tone');
    }
  }

  const response: EnhancedAIResponse = {
    content: generatedContent,
    sentiment,
    topics,
    confidence: finalConfidence,
    actionItems,
    knowledgeConflicts,
    detectedLanguage,
    regenerationOptions,
    historicalMatches,
    skippedTopics,
    contextAnalysis,
    intraThreadLearning,
    guestProfile,
  };

  // ── RECORD USAGE ──
  await recordDraftGeneration((generatedContent?.length ?? 400) * 2).catch(console.error);

  return response;
}
// Search historical responses and prepare context for AI
function searchAndPrepareHistoricalContext(
  guestMessage: string,
  propertyId: string
): HistoricalMatchInfo {
  const matches = aiTrainingService.searchHistoricalResponses(guestMessage, propertyId, 5);

  if (matches.length === 0) {
    return {
      foundMatches: false,
      matchCount: 0,
      topMatchScore: 0,
      usedHistoricalBasis: false,
      matchedPatterns: [],
    };
  }

  const topScore = matches[0].matchScore || 0;
  // Use historical basis if we have high-confidence matches (score >= 50)
  const useHistoricalBasis = topScore >= 50;

  return {
    foundMatches: true,
    matchCount: matches.length,
    topMatchScore: topScore,
    usedHistoricalBasis: useHistoricalBasis,
    matchedPatterns: matches.map((m, i) => ({
      intent: m.guestIntent,
      score: m.matchScore || 0,
      responsePreview: m.hostResponse.substring(0, 100) + (m.hostResponse.length > 100 ? '...' : ''),
      // Top 2 matches get full response (up to 800 chars), rest get 200 chars
      fullResponse: i < 2
        ? m.hostResponse.substring(0, 800) + (m.hostResponse.length > 800 ? '...' : '')
        : m.hostResponse.substring(0, 200) + (m.hostResponse.length > 200 ? '...' : ''),
    })),
  };
}

// Calculate confidence without artificial history boost (True Confidence)
function calculateConfidenceWithHistory(
  sentiment: SentimentAnalysis,
  topics: DetectedTopic[],
  knowledge?: PropertyKnowledge,
  styleProfile?: HostStyleProfile,
  historicalMatches?: HistoricalMatchInfo
): ConfidenceScore {
  // Get true base confidence from semantic understanding
  const baseConfidence = calculateConfidence(sentiment, topics, knowledge, styleProfile);

  // We no longer add artificial boosts for historical matches.
  // The LLM will use the historical matches to generate a better response,
  // but confidence reflects factual readiness and style match, not just "I've seen this before".

  return baseConfidence;
}

// Build system prompt with historical response examples
function buildEnhancedSystemPromptWithHistory(
  propertyName: string,
  propertyAddress: string,
  sentiment: SentimentAnalysis,
  topics: DetectedTopic[],
  knowledge?: PropertyKnowledge,
  hostName?: string,
  hostStyleProfile?: HostStyleProfile,
  regenerationModifier?: RegenerationOption['modifier'],
  historicalMatches?: HistoricalMatchInfo,
  skippedTopics?: SkippedTopicInfo[],
  contextAnalysis?: ConversationContextAnalysis,
  intraThreadLearning?: IntraThreadLearning
): string {
  // Get base prompt
  let prompt = buildEnhancedSystemPrompt(
    propertyName,
    propertyAddress,
    sentiment,
    topics,
    knowledge,
    hostName,
    hostStyleProfile,
    regenerationModifier
  );

  // INTRA-THREAD LEARNING: Add style anchoring instructions
  if (intraThreadLearning?.styleAnchor.hasAnchor) {
    const anchor = intraThreadLearning.styleAnchor;
    const continuity = intraThreadLearning.continuity;

    prompt += `\n\nINTRA-THREAD STYLE ANCHORING (Match your recent replies in this thread):
Your most recent response in this thread sets the style anchor. MATCH IT CLOSELY:
- Warmth Level: ${anchor.warmthLevel} ${anchor.warmthLevel === 'warm' ? '(be friendly, use exclamations)' : anchor.warmthLevel === 'professional' ? '(be formal, business-like)' : '(balanced tone)'}
- Brevity: ${anchor.brevityLevel} ${anchor.brevityLevel === 'brief' ? '(keep under 30 words)' : anchor.brevityLevel === 'detailed' ? '(provide thorough explanation)' : '(moderate length ~40-60 words)'}
${anchor.usesEmojis ? '- Use emojis similar to your recent messages' : '- NO emojis (you didn\'t use them in this thread)'}
${anchor.usesExclamations ? '- Use exclamation marks as you did before' : '- Keep tone calm (no exclamations)'}
${anchor.greetingStyle ? `- Greeting style: "${anchor.greetingStyle}"` : ''}
${anchor.signoffStyle ? `- Sign-off style: "${anchor.signoffStyle}"` : ''}
${anchor.keyPhrases.length > 0 ? `- Key phrases you used: "${anchor.keyPhrases.slice(0, 2).join('", "')}"` : ''}
`;

    // Add continuity acknowledgment guidance
    if (continuity.guestReferencesHostReply) {
      prompt += `\nGUEST CONTINUITY: The guest is referencing your previous reply${continuity.referencedContent ? ` (${continuity.referencedContent})` : ''}.
`;
      if (continuity.sentimentTowardPriorReply === 'positive') {
        prompt += `They responded POSITIVELY. ${continuity.suggestedAcknowledgment ? `Consider starting with: "${continuity.suggestedAcknowledgment}"` : 'Acknowledge their satisfaction briefly before moving on.'}
`;
      } else if (continuity.sentimentTowardPriorReply === 'negative') {
        prompt += `They had ISSUES with your previous info. ${continuity.suggestedAcknowledgment ? `Consider: "${continuity.suggestedAcknowledgment}"` : 'Apologize and provide alternative help.'}
`;
      }
    }

    // Note resolved topics
    if (anchor.resolvedTopics.length > 0) {
      prompt += `\nPREVIOUSLY RESOLVED in this thread: ${anchor.resolvedTopics.join(', ')} (guest confirmed these were helpful - don't re-explain unless asked)
`;
    }
  }

  // CONTEXT AWARENESS: Add skipped topics and conversation flow guidance
  if (skippedTopics && skippedTopics.length > 0) {
    prompt += `\n\nCONTEXT AWARENESS - AVOIDING REPETITION:
The following topics were ALREADY addressed in your recent replies. DO NOT repeat this information unless the guest explicitly asks again:
${skippedTopics.map(s => `- ${s.topic}: ${s.reason}`).join('\n')}

IMPORTANT: Focus ONLY on NEW topics or follow-up clarifications the guest is asking about.
`;
  }

  // Add conversation flow context
  if (contextAnalysis) {
    let flowGuidance = '';
    switch (contextAnalysis.threadDirection) {
      case 'followup':
        flowGuidance = 'This appears to be a follow-up message. Build on the previous conversation rather than starting fresh.';
        break;
      case 'clarification':
        flowGuidance = 'The guest seems confused or needs clarification. Explain more clearly and offer additional help.';
        break;
      case 'resolution':
        flowGuidance = 'The guest seems satisfied or is wrapping up. Keep response brief and friendly.';
        break;
      case 'new_topic':
        flowGuidance = 'This is a new topic. Provide a complete, helpful response.';
        break;
    }

    prompt += `\nCONVERSATION FLOW: ${flowGuidance}
Total exchanges in this thread: ${contextAnalysis.totalExchanges}
${contextAnalysis.recentHostTopics.length > 0 ? `Topics you recently covered: ${contextAnalysis.recentHostTopics.join(', ')}` : ''}
`;

    // CRITICAL: Extract the host's most recent reply to enforce consistency
    if (contextAnalysis.totalExchanges > 0) {
      prompt += `\nCONSISTENCY RULE (NEVER VIOLATE):
You ARE the host. If you already provided an answer earlier in this conversation, your new response MUST be consistent with it.
- NEVER contradict something you already told the guest.
- If you already said "yes" to something, do NOT now say "I'm not sure" or "let me check."
- If you already gave specific details (times, codes, instructions), repeat the SAME details — do NOT invent different ones.
- Build on your previous answers, don't restart from scratch.
This rule overrides all other instructions. Contradicting yourself destroys guest trust.
`;
    }
  }

  // Add historical context if available
  if (historicalMatches?.usedHistoricalBasis && historicalMatches.matchedPatterns.length > 0) {
    prompt += `\n\nHISTORICAL RESPONSE GUIDANCE:
The host has previously responded to similar guest questions. Use these as the PRIMARY basis for your response content and style:

`;

    const topMatches = historicalMatches.matchedPatterns.slice(0, 3);
    topMatches.forEach((match, i) => {
      prompt += `Example ${i + 1} (${match.intent}, similarity: ${match.score}%):
"${match.fullResponse}"

`;
    });

    prompt += `IMPORTANT INSTRUCTIONS FOR HISTORICAL MATCHING:
1. Base your response PRIMARILY on how the host actually replied in these examples
2. Use similar phrasing, solutions, and level of detail as shown above
3. Adapt the content for the specific current question while maintaining the host's voice
4. If the examples provide specific information (WiFi passwords, check-in times, etc.), use that exact information
5. Match the tone, warmth, and formality shown in the examples
6. If examples include emojis, use similar emoji style
7. If no strong match exists for part of the question, generate safely but flag lower confidence
`;
  } else if (historicalMatches?.matchCount === 0) {
    prompt += `\n\nNOTE: No similar historical responses found. Generate a response based on property knowledge and learned style profile. Use a slightly more conservative/safe approach since we don't have direct examples from this host for this type of question.`;
  }

  return prompt;
}

// Build system prompt with edit diff learning (async wrapper)
async function buildSystemPromptWithEditLearning(
  basePrompt: string,
  propertyId?: string,
  guestProfile?: GuestProfile,
  guestMessage?: string,
  guestEmail?: string,
  guestPhone?: string
): Promise<string> {
  let prompt = basePrompt;

  try {
    // Add guest profile adjustments
    if (guestProfile) {
      const guestAdjustments = getGuestTypePromptAdjustments(guestProfile);
      if (guestAdjustments) {
        prompt += guestAdjustments;
      }
    }

    // Add learnings from edits
    const editAdjustments = await getPromptAdjustments(propertyId);
    if (editAdjustments) {
      prompt += editAdjustments;
    }

    // Add deep learning from reply deltas (what the host consistently changes)
    try {
      const deltaKey = 'reply_deltas';
      const deltaData = await AsyncStorage.getItem(deltaKey);
      if (deltaData) {
        const deltas = JSON.parse(deltaData);
        const deltaAdjustments = getDeltaPromptAdjustments(deltas);
        if (deltaAdjustments) {
          prompt += deltaAdjustments;
        }
      }
    } catch (e) {
      // Delta learning is optional — don't block generation
      console.warn('[AI Enhanced] Delta learning failed:', e);
    }

    // Add learnings from rejections
    const rejectionAdjustments = await getRejectionAdjustments();
    if (rejectionAdjustments) {
      prompt += rejectionAdjustments;
    }

    // ADVANCED TRAINING: Add property lexicon, few-shot examples, negative examples, guest memory
    if (guestMessage) {
      const advancedPrompt = buildAdvancedAIPrompt(
        guestMessage,
        propertyId,
        guestEmail,
        guestPhone
      );
      if (advancedPrompt) {
        prompt += advancedPrompt;
      }
    }
  } catch (error) {
    console.error('[AI Enhanced] Error getting learning adjustments:', error);
  }

  return prompt;
}

// Build user prompt with historical guidance and context awareness
function buildUserPromptWithHistory(
  conversationContext: string,
  sentiment: SentimentAnalysis,
  topicsText: string,
  detectedLanguage: string,
  historicalMatches?: HistoricalMatchInfo,
  skippedTopics?: SkippedTopicInfo[],
  contextAnalysis?: ConversationContextAnalysis
): string {
  let prompt = `Based on the conversation below, generate a helpful response to the guest's MOST RECENT message.

CONVERSATION HISTORY (in chronological order - most recent at bottom):
${conversationContext}

PRIMARY FOCUS: The LAST guest message is what you're responding to. Earlier messages are context only.
The guest's sentiment is: ${sentiment.primary} (${sentiment.emotions.join(', ')})
Topics to address: ${topicsText || 'General inquiry'}


`;

  // Add context awareness instructions
  if (skippedTopics && skippedTopics.length > 0) {
    prompt += `IMPORTANT - AVOID REPETITION:
These topics were already answered in recent replies - DO NOT address them again:
${skippedTopics.map(s => `- ${s.topic} (${s.reason})`).join('\n')}

Focus your response ONLY on new questions or explicit follow-ups.

`;
  }

  if (historicalMatches?.usedHistoricalBasis) {
    prompt += `CRITICAL: Historical matches found with ${historicalMatches.topMatchScore}% similarity.
Your response should:
1. Follow the EXACT phrasing and style from the historical examples provided
2. Use the same level of detail and helpfulness shown in those examples
3. Sound like it was written by the SAME person who wrote those examples
4. Only deviate from the examples if the specific question requires different information

`;
  }

  prompt += `Generate a response that:
1. Addresses ONLY the new topics/questions from the most recent guest message
2. Does NOT repeat information you already provided in earlier messages
3. NEVER contradicts anything you (the host) already said in this conversation — if you already answered, stay consistent
4. Matches the appropriate tone for their emotional state
5. Provides specific, accurate information from property knowledge when available
6. ${historicalMatches?.usedHistoricalBasis ? 'Primarily follows the style and content of historical examples' : 'Offers proactive help when appropriate'}

CRITICAL: Review the conversation history above. If the host (you) already responded to this topic, your new message MUST align with that response. Do NOT give a different or contradictory answer.

Respond with ONLY the message content in ENGLISH. No additional formatting or explanation.
CRITICAL: Your response MUST be in English regardless of the guest's language. Hostaway handles translation.`;

  return prompt;
}

// Enhanced language detection — requires multiple keyword matches for Latin-script
// languages to avoid false positives from words shared with English (e.g. "per", "con")
function _detectLanguageEnhanced(text: string): string {
  const lower = text.toLowerCase();

  // Character-set based detection (single match is conclusive)
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja';
  if (/[\uac00-\ud7af]/.test(text)) return 'ko';
  if (/[\u0600-\u06ff]/.test(text)) return 'ar';
  if (/[\u0400-\u04ff]/.test(text)) return 'ru';

  // Latin-script languages: require ≥2 distinct keyword matches to avoid
  // false positives from words that also exist in English (e.g. "per", "con", "come")
  const keywordSets: { lang: string; keywords: string[] }[] = [
    { lang: 'es', keywords: ['hola', 'gracias', 'buenos', 'días', 'noches', 'por favor', 'cómo', 'está', 'qué', 'tengo', 'puede', 'necesito', 'habitación', 'reserva'] },
    { lang: 'fr', keywords: ['bonjour', 'merci', 'comment', 'êtes', 'avez', 'nous', 'je suis', 'réservation', 's\'il vous plaît', 'chambre', 'séjour'] },
    { lang: 'de', keywords: ['guten', 'danke', 'bitte', 'sind', 'haben', 'für', 'können', 'ich bin', 'zimmer', 'buchung', 'ankunft'] },
    { lang: 'it', keywords: ['buongiorno', 'grazie', 'prego', 'siete', 'avete', 'possiamo', 'prenotazione', 'arrivo', 'soggiorno', 'buonasera', 'salve'] },
    { lang: 'pt', keywords: ['olá', 'obrigado', 'obrigada', 'está', 'vocês', 'estou', 'reserva', 'chegada', 'hospedagem', 'quarto'] },
    { lang: 'nl', keywords: ['hallo', 'dank', 'alstublieft', 'bent', 'heeft', 'wij', 'kamer', 'boeking', 'verblijf'] },
  ];

  for (const { lang, keywords } of keywordSets) {
    let matches = 0;
    for (const kw of keywords) {
      // Use word boundary check for multi-word phrases and single words
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lower)) {
        matches++;
        if (matches >= 2) return lang;
      }
    }
  }

  return 'en';
}

// Get language name
function _getLanguageNameEnhanced(code: string): string {
  const languages: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    ar: 'Arabic',
    ru: 'Russian',
    nl: 'Dutch',
  };
  return languages[code] || 'English';
}

// ============================================================================
// LEARNING HOOKS - Called when messages are sent/approved/rejected
// ============================================================================

/**
 * Learn from a sent message - add to incremental training queue
 */
export async function learnFromSentMessage(
  hostResponse: string,
  guestMessage: string,
  propertyId?: string,
  wasEdited: boolean = false,
  wasApproved: boolean = true
): Promise<void> {
  try {
    // Queue for incremental training (auto-trains every 10 messages)
    await incrementalTrainer.queueMessage({
      id: `msg_${Date.now()}`,
      content: hostResponse,
      guestMessage,
      propertyId,
      timestamp: Date.now(),
      wasEdited,
      wasApproved,
    });

    // Add to few-shot index
    await fewShotIndexer.addExample(guestMessage, hostResponse, propertyId);

    console.log('[Learning] Message queued for incremental training, edited:', wasEdited);
  } catch (error) {
    console.error('[Learning] Failed to learn from sent message:', error);
  }
}

/**
 * Learn from a rejected/dismissed AI draft
 */
export async function learnFromRejectedDraft(
  rejectedDraft: string,
  guestMessage: string,
  rejectionReason: 'too_long' | 'too_short' | 'wrong_tone' | 'missing_info' | 'generic' | 'inappropriate',
  guestIntent: string,
  guestSentiment: string,
  betterResponse?: string
): Promise<void> {
  try {
    await negativeExampleManager.addExample(
      rejectedDraft,
      rejectionReason,
      {
        guestMessage,
        guestIntent,
        guestSentiment,
      },
      betterResponse
    );

    console.log('[Learning] Negative example recorded:', rejectionReason);
  } catch (error) {
    console.error('[Learning] Failed to record negative example:', error);
  }
}

/**
 * Learn conversation flows when a conversation ends
 */
export async function learnFromConversation(conversation: Conversation): Promise<void> {
  try {
    // Learn conversation flow patterns
    await conversationFlowLearner.learnFromConversation(conversation);

    // Record guest memory for returning guest detection
    await guestMemoryManager.recordConversation(
      conversation.guest.email,
      conversation.guest.phone,
      conversation
    );

    console.log('[Learning] Conversation flow and guest memory recorded');
  } catch (error) {
    console.error('[Learning] Failed to learn from conversation:', error);
  }
}

/**
 * Get conversation flow prediction
 */
export function predictConversationFollowup(conversation: Conversation): {
  likelyTopics: string[];
  confidence: number;
} | null {
  return conversationFlowLearner.predictFollowup(conversation);
}

/**
 * Check if guest is returning
 */
export function isReturningGuest(email?: string, phone?: string): boolean {
  const memory = guestMemoryManager.getGuestMemory(email, phone);
  return memory?.preferences.isReturning || false;
}
