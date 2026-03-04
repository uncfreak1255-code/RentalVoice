/**
 * Intent Detection — Classifies guest messages into intent types
 * Used for inbox priority sorting, intent badges, smart reply generation,
 * and AutoPilot safety decisions.
 *
 * Lightweight: no AI call needed — uses keyword matching + patterns.
 */

export type GuestIntent =
  | 'question'
  | 'complaint'
  | 'booking_inquiry'
  | 'check_in'
  | 'check_out'
  | 'thanks'
  | 'emergency'
  | 'general';

export interface IntentResult {
  intent: GuestIntent;
  confidence: number;       // 0-100
  needsReply: boolean;       // Should host respond?
  autoSendSafe: boolean;     // Safe for AutoPilot to handle?
  safetyFlags: SafetyFlag[]; // Anything that blocks AutoPilot
  label: string;             // Human-readable badge text
  color: string;             // Badge color
  priority: number;          // 1 = highest priority in inbox
  secondaryIntents: { intent: GuestIntent; confidence: number }[]; // Additional detected intents
}

export interface SafetyFlag {
  type: 'financial' | 'legal' | 'emergency' | 'unknown_fact' | 'complaint' | 'personal_info';
  reason: string;
  blocksAutoPilot: boolean;
}

// ─── Pattern Definitions ──────────────────────────────────────────────

const PATTERNS: Record<GuestIntent, RegExp[]> = {
  emergency: [
    /\b(fire|flood|gas leak|carbon monoxide|break.?in|intruder|911|ambulance|police|hospital|emergency)\b/i,
    /\b(someone.?broke in|i.?m hurt|there.?s a fire|water everywhere|smell.?gas)\b/i,
  ],
  complaint: [
    /\b(broken|dirty|disgusting|disappointed|unacceptable|terrible|horrible|worst|awful|filthy)\b/i,
    /\b(not working|doesn.?t work|won.?t work|still broken|never fixed|refund|compensation)\b/i,
    /\b(cockroach|bug|mice|mold|stain|smell|noise|loud|uncomfortable)\b/i,
    /\b(false advertising|misleading|not as described|nothing like|photos don.?t match)\b/i,
  ],
  check_in: [
    /\b(check.?in|checking in|arrive|arriving|arrival|get there|lockbox|lock.?box|key.?box|door code|access code|entry code)\b/i,
    /\b(what time can|when can i|how do i get in|where.?s the key|find the house|directions to)\b/i,
    /\b(early check.?in|late arrival|getting there|on our way|en route|landing at|flight lands)\b/i,
  ],
  check_out: [
    /\b(check.?out|checking out|departure|leaving|leave by|check out time)\b/i,
    /\b(late check.?out|extend|stay longer|extra night|leave the key|where.?do i.?leave)\b/i,
  ],
  booking_inquiry: [
    /\b(available|availability|price|pricing|rate|cost|book|booking|reserve|reservation)\b/i,
    /\b(how much|pet.?friendly|pet fee|discount|special offer|minimum stay|maximum guest)\b/i,
    /\b(cancel|cancellation policy|modify.?booking|change dates)\b/i,
  ],
  question: [
    /\?/,
    /\b(where|how|what|when|which|who|can i|is there|do you|does the|are there)\b/i,
    /\b(wifi|wi-fi|password|parking|pool|hot tub|towel|linen|trash|garbage|recycling|laundry)\b/i,
    /\b(thermostat|ac|air conditioning|heater|heat|tv|remote|netflix|roku)\b/i,
    /\b(grill|bbq|beach|restaurant|grocery|store|near|nearby)\b/i,
  ],
  thanks: [
    /\b(thank|thanks|thx|appreciate|perfect|awesome|great|wonderful|amazing|excellent)\b/i,
    /\b(had a great|loved the|beautiful place|enjoyed|will be back|recommend|five star|5 star)\b/i,
    /\b(no question|just wanted to say|everything.?s great|all good|all set)\b/i,
  ],
  general: [], // fallback
};

// ─── Safety Pattern Definitions ───────────────────────────────────────

const SAFETY_PATTERNS: { type: SafetyFlag['type']; patterns: RegExp[]; reason: string }[] = [
  {
    type: 'financial',
    patterns: [
      /\b(refund|money back|compensation|reimburse|discount|price match|overcharg)\b/i,
      /\b(credit card|charge|billing|invoice|receipt|payment issue)\b/i,
    ],
    reason: 'Guest is discussing financial matters — requires host decision',
  },
  {
    type: 'legal',
    patterns: [
      /\b(lawyer|attorney|sue|legal|lawsuit|liability|negligence|regulation|health department)\b/i,
      /\b(report you|file a complaint|better business bureau|bbb|consumer protection)\b/i,
    ],
    reason: 'Guest is making legal references — requires host attention',
  },
  {
    type: 'emergency',
    patterns: [
      /\b(fire|flood|gas leak|carbon monoxide|break.?in|intruder|911|ambulance|police|hospital|emergency)\b/i,
      /\b(injured|hurt|bleeding|unconscious|can.?t breathe|allergic reaction)\b/i,
    ],
    reason: 'Potential emergency — never auto-reply, host must handle directly',
  },
  {
    type: 'personal_info',
    patterns: [
      /\b(social security|ssn|passport|driver.?s license|bank account|routing number)\b/i,
      /\b(date of birth|home address|phone number|credit card number)\b/i,
    ],
    reason: 'Guest sharing or requesting sensitive personal information',
  },
  {
    type: 'complaint',
    patterns: [
      /\b(refund|compensation|unacceptable|terrible|disgusting|worst|lawsuit|report)\b/i,
    ],
    reason: 'Complaint requires empathetic, personalized response from host',
  },
];

// ─── Intent Config ────────────────────────────────────────────────────

const INTENT_CONFIG: Record<GuestIntent, { label: string; color: string; priority: number; needsReply: boolean; autoSendSafe: boolean }> = {
  emergency:      { label: '🚨 Emergency',      color: '#EF4444', priority: 1, needsReply: true,  autoSendSafe: false },
  complaint:      { label: 'Complaint',          color: '#F59E0B', priority: 2, needsReply: true,  autoSendSafe: false },
  check_in:       { label: 'Check-in',           color: '#3B82F6', priority: 3, needsReply: true,  autoSendSafe: true  },
  question:       { label: 'Question',           color: '#14B8A6', priority: 4, needsReply: true,  autoSendSafe: true  },
  booking_inquiry:{ label: 'Booking',            color: '#8B5CF6', priority: 5, needsReply: true,  autoSendSafe: false },
  check_out:      { label: 'Check-out',          color: '#6366F1', priority: 6, needsReply: true,  autoSendSafe: true  },
  general:        { label: 'Message',            color: '#64748B', priority: 7, needsReply: true,  autoSendSafe: true  },
  thanks:         { label: 'Thanks',             color: '#22C55E', priority: 8, needsReply: false, autoSendSafe: true  },
};

// ─── Main Detection Function ──────────────────────────────────────────

export function detectIntent(message: string): IntentResult {
  if (!message || message.trim().length === 0) {
    return { ...INTENT_CONFIG.general, intent: 'general', confidence: 0, safetyFlags: [], secondaryIntents: [] };
  }

  const text = message.toLowerCase().trim();
  let bestIntent: GuestIntent = 'general';
  let bestScore = 0;

  // Score each intent by number of matching patterns
  const allScores: { intent: GuestIntent; score: number }[] = [];
  for (const [intent, patterns] of Object.entries(PATTERNS) as [GuestIntent, RegExp[]][]) {
    if (patterns.length === 0) continue;

    let matches = 0;
    for (const pattern of patterns) {
      if (pattern.test(text)) matches++;
    }

    const score = matches / patterns.length;
    if (score > 0) {
      allScores.push({ intent, score });
    }
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  // Build secondary intents (above 30% confidence, excluding primary)
  const secondaryIntents = allScores
    .filter(s => s.intent !== bestIntent && Math.round(s.score * 100) >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(s => ({ intent: s.intent, confidence: Math.round(s.score * 100) }));

  // Check safety flags
  const safetyFlags: SafetyFlag[] = [];
  for (const safety of SAFETY_PATTERNS) {
    for (const pattern of safety.patterns) {
      if (pattern.test(text)) {
        safetyFlags.push({
          type: safety.type,
          reason: safety.reason,
          blocksAutoPilot: true,
        });
        break; // one match per category is enough
      }
    }
  }

  const config = INTENT_CONFIG[bestIntent];
  const hasBlockingFlags = safetyFlags.some(f => f.blocksAutoPilot);

  return {
    intent: bestIntent,
    confidence: Math.round(Math.max(bestScore * 100, bestIntent === 'general' ? 30 : 50)),
    needsReply: config.needsReply,
    autoSendSafe: hasBlockingFlags ? false : config.autoSendSafe,
    safetyFlags,
    label: config.label,
    color: config.color,
    priority: config.priority,
    secondaryIntents,
  };
}

/**
 * Get the priority sort value for inbox ordering.
 * Lower = higher priority (shown first).
 */
export function getIntentPriority(lastGuestMessage?: string): number {
  if (!lastGuestMessage) return 99;
  return detectIntent(lastGuestMessage).priority;
}

/**
 * Check if a draft is safe for AutoPilot to send automatically.
 * This checks BOTH the guest message intent AND the draft content.
 */
export function isDraftSafeForAutoPilot(
  guestMessage: string,
  draftContent: string
): { safe: boolean; flags: SafetyFlag[] } {
  const guestFlags = detectIntent(guestMessage).safetyFlags;
  const draftFlags: SafetyFlag[] = [];

  // Check if draft contains dangerous content
  const draftSafetyPatterns: { type: SafetyFlag['type']; pattern: RegExp; reason: string }[] = [
    { type: 'financial', pattern: /\b(i.?ll refund|we.?ll refund|here.?s a discount|(\$\d+) off|credit|compensation of)\b/i, reason: 'Draft promises financial action' },
    { type: 'financial', pattern: /\b(free night|no charge|waive the fee|complimentary)\b/i, reason: 'Draft offers free services' },
    { type: 'unknown_fact', pattern: /\b(i believe|i think|if i.?m not mistaken|i.?m not sure but|probably|might be)\b/i, reason: 'Draft contains uncertain information' },
  ];

  for (const { type, pattern, reason } of draftSafetyPatterns) {
    if (pattern.test(draftContent)) {
      draftFlags.push({ type, reason, blocksAutoPilot: true });
    }
  }

  const allFlags = [...guestFlags, ...draftFlags];
  return {
    safe: allFlags.length === 0,
    flags: allFlags,
  };
}
