export type IssueTriageCategory =
  | 'maintenance'
  | 'cleanliness'
  | 'amenity'
  | 'complaint'
  | 'refund_risk'
  | 'policy_billing'
  | 'access'
  | 'utility'
  | 'other';

export type IssueTriagePriority = 'low' | 'medium' | 'high' | 'urgent';

export interface IssueTriageResult {
  isIssue: boolean;
  category: IssueTriageCategory;
  priority: IssueTriagePriority;
  summary: string;
  guestImpact: string;
  suggestedAction: string;
}

const RULES: {
  category: IssueTriageCategory;
  priority: IssueTriagePriority;
  patterns: RegExp[];
  summary: string;
  guestImpact: string;
  suggestedAction: string;
}[] = [
  {
    category: 'refund_risk',
    priority: 'high',
    patterns: [/\b(refund|compensation|financial consideration|partial refund|money back|credit back|discount off|fee waived)\b/i],
    summary: 'Guest may be asking for compensation or a refund-related resolution.',
    guestImpact: 'Trust and satisfaction are at risk and may escalate if the response is vague.',
    suggestedAction: 'Acknowledge the inconvenience clearly and align on the resolution path before replying.',
  },
  {
    category: 'policy_billing',
    priority: 'medium',
    patterns: [/\b(charged|billing|daily fee|pool heat|pool heating|extra charge|charge on the bill|consideration)\b/i],
    summary: 'Guest is raising a billing or policy-related concern.',
    guestImpact: 'The guest may challenge charges or ask for clarification before resolving the thread.',
    suggestedAction: 'Clarify the applicable charge or policy and confirm the next step before replying.',
  },
  {
    category: 'access',
    priority: 'urgent',
    patterns: [/\b(lock(?:ed)? out|can.?t get in|cannot get in|door code|entry code|key.?box|access code|won.?t unlock)\b/i],
    summary: 'Guest may be unable to access the property.',
    guestImpact: 'Arrival and entry are blocked.',
    suggestedAction: 'Confirm access instructions and prepare an immediate handoff if entry is still blocked.',
  },
  {
    category: 'utility',
    priority: 'high',
    patterns: [/\b(no power|power.?out|electricity|water.?off|water being shut off|water shut off|no water|internet down|wifi down|wi-?fi not working)\b/i],
    summary: 'Guest is reporting a utility issue affecting the stay.',
    guestImpact: 'Core stay services may be unavailable.',
    suggestedAction: 'Acknowledge the disruption and prepare a handoff to maintenance or property support.',
  },
  {
    category: 'cleanliness',
    priority: 'high',
    patterns: [/\b(dirty|filthy|unclean|hair everywhere|not cleaned|stains|smells bad|smells like)\b/i],
    summary: 'Guest is reporting a cleanliness issue.',
    guestImpact: 'The stay experience is negatively affected.',
    suggestedAction: 'Acknowledge the issue and prepare a cleaner handoff with the impacted area.',
  },
  {
    category: 'maintenance',
    priority: 'high',
    patterns: [/\b(broken|not working|doesn.?t work|won.?t work|leak|leaking|clogged|flood|heater|air conditioner|ac|toilet)\b/i],
    summary: 'Guest is reporting a maintenance problem.',
    guestImpact: 'Property functionality may be reduced.',
    suggestedAction: 'Collect the exact affected item and prepare a maintenance handoff.',
  },
  {
    category: 'amenity',
    priority: 'medium',
    patterns: [/\b(hot tub|pool|spa|grill|tv|remote|washer|dryer|coffee maker)\b/i],
    summary: 'Guest is asking about or reporting an amenity issue.',
    guestImpact: 'A stay feature may be unavailable or unclear.',
    suggestedAction: 'Clarify the amenity instructions or prepare a handoff if the amenity is broken.',
  },
  {
    category: 'complaint',
    priority: 'high',
    patterns: [/\b(frustrated|disappointed|upset|unacceptable|we were hoping|appreciate your consideration|dishwasher|a lot of dishes)\b/i],
    summary: 'Guest is unhappy and may need a direct acknowledgement with a clear next step.',
    guestImpact: 'Satisfaction is dropping and the conversation may escalate if not handled carefully.',
    suggestedAction: 'Lead with acknowledgement, address the concern directly, and offer a concrete next step.',
  },
];

export function triageIssueFromMessage(message: string): IssueTriageResult {
  const normalized = message.trim();
  if (!normalized) {
    return {
      isIssue: false,
      category: 'other',
      priority: 'low',
      summary: '',
      guestImpact: '',
      suggestedAction: '',
    };
  }

  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      return {
        isIssue: true,
        category: rule.category,
        priority: rule.priority,
        summary: rule.summary,
        guestImpact: rule.guestImpact,
        suggestedAction: rule.suggestedAction,
      };
    }
  }

  return {
    isIssue: false,
    category: 'other',
    priority: 'low',
    summary: '',
    guestImpact: '',
    suggestedAction: '',
  };
}

export function buildIssueHandoffDraft(input: {
  propertyName: string;
  issue: IssueTriageResult;
  guestName: string;
  guestMessage: string;
  stayWindow?: string | null;
}): string {
  const stayLine = input.stayWindow ? `Stay window: ${input.stayWindow}` : 'Stay window: current reservation';

  return [
    `Handoff: ${input.issue.category.replace(/_/g, ' ')} issue at ${input.propertyName}`,
    `Guest: ${input.guestName}`,
    stayLine,
    `Priority: ${input.issue.priority.toUpperCase()}`,
    `Summary: ${input.issue.summary}`,
    `Guest impact: ${input.issue.guestImpact}`,
    `Guest message: "${input.guestMessage}"`,
    `Suggested next step: ${input.issue.suggestedAction}`,
  ].join('\n');
}
