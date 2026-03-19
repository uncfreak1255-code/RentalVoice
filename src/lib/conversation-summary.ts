// Conversation Summarization Service
// Auto-generates concise summaries for conversation threads
// Updates live as conversations progress

import type { Conversation, Message } from './store';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Server proxy config
const AI_PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL || '';
const AI_PROXY_TOKEN = process.env.EXPO_PUBLIC_AI_PROXY_TOKEN || '';
const useServerProxy = Boolean(AI_PROXY_URL && AI_PROXY_TOKEN);

// Minimum messages before generating a summary
export const MIN_MESSAGES_FOR_SUMMARY = 5;

// Summary types
export interface ConversationSummary {
  id: string;
  conversationId: string;
  summary: string;
  keyPoints: string[];
  currentStatus: 'inquiry' | 'negotiating' | 'resolved' | 'pending_action' | 'follow_up';
  lastMessageId: string;
  messageCount: number;
  generatedAt: Date;
  // Tracking
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  hasOpenIssue: boolean;
  nextAction?: string;
}

// Event tracking for summary generation
export interface ConversationEvent {
  type: 'question' | 'answer' | 'offer' | 'acceptance' | 'rejection' | 'issue' | 'resolution' | 'follow_up';
  description: string;
  timestamp: Date;
  sender: 'guest' | 'host';
}

/**
 * Check if a conversation needs a summary
 */
export function needsSummary(conversation: Conversation, existingSummary?: ConversationSummary): boolean {
  const messageCount = conversation.messages.filter(m => m.sender !== 'ai_draft').length;

  // Need at least MIN_MESSAGES_FOR_SUMMARY messages
  if (messageCount < MIN_MESSAGES_FOR_SUMMARY) {
    return false;
  }

  // No existing summary
  if (!existingSummary) {
    return true;
  }

  // Check if new messages since last summary
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  if (lastMessage && lastMessage.id !== existingSummary.lastMessageId) {
    // Update if 2+ new messages since last summary
    const newMessageCount = messageCount - existingSummary.messageCount;
    return newMessageCount >= 2;
  }

  return false;
}

/**
 * Extract key events from conversation messages
 */
export function extractConversationEvents(messages: Message[]): ConversationEvent[] {
  const events: ConversationEvent[] = [];
  const realMessages = messages.filter(m => m.sender !== 'ai_draft');

  for (const message of realMessages) {
    const content = message.content.toLowerCase();
    const timestamp = message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp);

    // Question detection
    if (message.sender === 'guest' && (content.includes('?') || /\b(can|could|how|what|where|when|is there|do you)\b/.test(content))) {
      events.push({
        type: 'question',
        description: extractQuestionTopic(message.content),
        timestamp,
        sender: 'guest',
      });
    }

    // Offer detection (host offering something)
    if (message.sender === 'host' && /\b(offer|can offer|available for|would be|\$\d+|for a fee)\b/i.test(content)) {
      events.push({
        type: 'offer',
        description: extractOfferDescription(message.content),
        timestamp,
        sender: 'host',
      });
    }

    // Acceptance detection
    if (/\b(yes|perfect|great|sounds good|that works|agreed|accept|book it|let'?s do|i'?ll take)\b/i.test(content)) {
      events.push({
        type: 'acceptance',
        description: 'Accepted',
        timestamp,
        sender: message.sender as 'guest' | 'host',
      });
    }

    // Rejection detection
    if (/\b(no thanks|can'?t|won'?t|too expensive|not interested|decline|pass)\b/i.test(content)) {
      events.push({
        type: 'rejection',
        description: 'Declined',
        timestamp,
        sender: message.sender as 'guest' | 'host',
      });
    }

    // Issue detection
    if (/\b(problem|issue|broken|not working|dirty|complaint|help|emergency|urgent)\b/i.test(content)) {
      events.push({
        type: 'issue',
        description: extractIssueDescription(message.content),
        timestamp,
        sender: message.sender as 'guest' | 'host',
      });
    }

    // Resolution detection
    if (message.sender === 'host' && /\b(fixed|resolved|sorted|taken care|handled|sent|here'?s the|code is)\b/i.test(content)) {
      events.push({
        type: 'resolution',
        description: extractResolutionDescription(message.content),
        timestamp,
        sender: 'host',
      });
    }

    // Follow-up detection
    if (/\b(let me know|follow up|check back|get back to you|will update)\b/i.test(content)) {
      events.push({
        type: 'follow_up',
        description: 'Follow-up pending',
        timestamp,
        sender: message.sender as 'guest' | 'host',
      });
    }
  }

  return events;
}

/**
 * Extract question topic from message
 */
function extractQuestionTopic(content: string): string {
  const topicPatterns: { pattern: RegExp; topic: string }[] = [
    { pattern: /\b(wifi|internet|password)\b/i, topic: 'WiFi' },
    { pattern: /\b(check-?in|arrive|arrival|access|key|code)\b/i, topic: 'check-in' },
    { pattern: /\b(check-?out|leave|departure)\b/i, topic: 'check-out' },
    { pattern: /\b(early|earlier).*\b(check|arrive)\b/i, topic: 'early check-in' },
    { pattern: /\b(late|later).*\b(check|stay|out)\b/i, topic: 'late check-out' },
    { pattern: /\b(park|parking|car|garage)\b/i, topic: 'parking' },
    { pattern: /\b(pool|gym|amenities|hot tub)\b/i, topic: 'amenities' },
    { pattern: /\b(restaurant|food|eat|recommend)\b/i, topic: 'local recommendations' },
    { pattern: /\b(extend|extension|stay longer)\b/i, topic: 'stay extension' },
    { pattern: /\b(refund|money|price|cost)\b/i, topic: 'refund/pricing' },
  ];

  for (const { pattern, topic } of topicPatterns) {
    if (pattern.test(content)) {
      return `Asked about ${topic}`;
    }
  }

  return 'Asked a question';
}

/**
 * Extract offer description from message
 */
function extractOfferDescription(content: string): string {
  // Try to extract price
  const priceMatch = content.match(/\$(\d+)/);
  const price = priceMatch ? `$${priceMatch[1]}` : '';

  if (/early.*check/i.test(content)) {
    return `Offered early check-in ${price}`.trim();
  }
  if (/late.*check/i.test(content)) {
    return `Offered late check-out ${price}`.trim();
  }
  if (/extend/i.test(content)) {
    return `Offered extension ${price}`.trim();
  }

  return `Made an offer ${price}`.trim();
}

/**
 * Extract issue description from message
 */
function extractIssueDescription(content: string): string {
  const issuePatterns: { pattern: RegExp; issue: string }[] = [
    { pattern: /\b(wifi|internet).*\b(not|isn'?t|won'?t|broken)\b/i, issue: 'WiFi issue' },
    { pattern: /\b(ac|air condition|heat|cold|hot)\b/i, issue: 'HVAC issue' },
    { pattern: /\b(water|leak|flood|plumb)\b/i, issue: 'plumbing issue' },
    { pattern: /\b(lock|key|door|access)\b.*\b(not|can'?t|won'?t)\b/i, issue: 'access issue' },
    { pattern: /\b(dirty|clean|mess)\b/i, issue: 'cleanliness issue' },
    { pattern: /\b(noise|loud|neighbor)\b/i, issue: 'noise complaint' },
    { pattern: /\b(broken|not working)\b/i, issue: 'something broken' },
  ];

  for (const { pattern, issue } of issuePatterns) {
    if (pattern.test(content)) {
      return `Reported ${issue}`;
    }
  }

  return 'Reported an issue';
}

/**
 * Extract resolution description from message
 */
function extractResolutionDescription(content: string): string {
  if (/\b(code|password)\b/i.test(content)) {
    return 'Sent access code';
  }
  if (/\bfixed\b/i.test(content)) {
    return 'Issue fixed';
  }
  if (/\b(sent|here'?s)\b/i.test(content)) {
    return 'Provided information';
  }

  return 'Resolved';
}

/**
 * Generate a concise summary from events
 */
export function generateLocalSummary(events: ConversationEvent[]): string {
  if (events.length === 0) {
    return 'Conversation in progress';
  }

  // Group events into a narrative
  const narrative: string[] = [];
  let lastType: string | null = null;

  for (const event of events) {
    // Avoid redundant entries
    if (event.type === lastType && narrative.length > 0) {
      continue;
    }

    let part = '';
    switch (event.type) {
      case 'question':
        part = event.description;
        break;
      case 'answer':
        part = event.description;
        break;
      case 'offer':
        part = event.description;
        break;
      case 'acceptance':
        part = 'accepted';
        break;
      case 'rejection':
        part = 'declined';
        break;
      case 'issue':
        part = event.description;
        break;
      case 'resolution':
        part = event.description;
        break;
      case 'follow_up':
        part = 'follow-up pending';
        break;
    }

    if (part) {
      narrative.push(part);
    }
    lastType = event.type;
  }

  // Join with arrows for flow
  if (narrative.length === 0) {
    return 'Conversation in progress';
  }

  // Capitalize first letter
  const summary = narrative.join(' → ');
  return summary.charAt(0).toUpperCase() + summary.slice(1);
}

/**
 * Determine conversation status from events
 */
export function determineConversationStatus(
  events: ConversationEvent[],
  messages: Message[]
): ConversationSummary['currentStatus'] {
  const lastEvent = events[events.length - 1];
  const lastMessage = messages.filter(m => m.sender !== 'ai_draft').pop();

  // Check for open issues
  const hasIssue = events.some(e => e.type === 'issue');
  const hasResolution = events.some(e => e.type === 'resolution');
  if (hasIssue && !hasResolution) {
    return 'pending_action';
  }

  // Check for follow-up needed
  if (lastEvent?.type === 'follow_up') {
    return 'follow_up';
  }

  // Check for resolution
  if (lastEvent?.type === 'resolution' || lastEvent?.type === 'acceptance') {
    return 'resolved';
  }

  // Check if negotiating
  if (events.some(e => e.type === 'offer') && !events.some(e => e.type === 'acceptance' || e.type === 'rejection')) {
    return 'negotiating';
  }

  // Default to inquiry if guest asked last
  if (lastMessage?.sender === 'guest') {
    return 'inquiry';
  }

  return 'resolved';
}

/**
 * Generate summary using AI for complex conversations
 */
export async function generateAISummary(conversation: Conversation): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_VIBECODE_GOOGLE_API_KEY;

  if (!apiKey || apiKey.includes('n0tr3al')) {
    // Fall back to local summary
    const events = extractConversationEvents(conversation.messages);
    return generateLocalSummary(events);
  }

  const messages = conversation.messages
    .filter(m => m.sender !== 'ai_draft')
    .map(m => `${m.sender === 'guest' ? 'Guest' : 'Host'}: ${m.content}`)
    .join('\n');

  const prompt = `Summarize this vacation rental guest conversation in ONE concise line (max 80 chars).
Use arrow notation to show the flow: "topic → action → result"

Examples:
- "Asked about early check-in → offered for $30 → accepted → sent access code"
- "WiFi not working → troubleshooting → issue resolved"
- "Check-in questions → provided instructions → guest thanked"
- "Noise complaint → apologized → monitoring situation"

Conversation:
${messages}

Summary (one line, use → arrows):`;

  try {
    const geminiPayload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 100,
      },
    };

    let response: Response;
    if (useServerProxy) {
      response = await fetch(`${AI_PROXY_URL}/api/ai-proxy/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AI_PROXY_TOKEN}`,
        },
        body: JSON.stringify({
          provider: 'google',
          model: 'gemini-2.0-flash',
          payload: geminiPayload,
        }),
      });
    } else {
      response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload),
      });
    }

    if (!response.ok) {
      throw new Error('AI summary generation failed');
    }

    const data = await response.json();
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return summary.trim().replace(/^["']|["']$/g, ''); // Remove quotes if present
  } catch (error) {
    console.error('[Summary] AI generation failed, using local summary:', error);
    const events = extractConversationEvents(conversation.messages);
    return generateLocalSummary(events);
  }
}

/**
 * Generate full conversation summary object
 */
export async function generateConversationSummary(
  conversation: Conversation,
  useAI = true
): Promise<ConversationSummary> {
  const realMessages = conversation.messages.filter(m => m.sender !== 'ai_draft');
  const events = extractConversationEvents(conversation.messages);

  // Generate summary text
  let summaryText: string;
  if (useAI && realMessages.length >= 8) {
    // Use AI for longer conversations
    summaryText = await generateAISummary(conversation);
  } else {
    // Use local generation for shorter ones
    summaryText = generateLocalSummary(events);
  }

  // Extract topics
  const topics = extractTopicsFromMessages(realMessages);

  // Determine overall sentiment
  const sentiment = determineOverallSentiment(realMessages);

  // Check for open issues
  const hasOpenIssue = events.some(e => e.type === 'issue') &&
    !events.some(e => e.type === 'resolution');

  // Determine next action
  const nextAction = determineNextAction(events, realMessages);

  // Determine status
  const status = determineConversationStatus(events, realMessages);

  // Generate key points
  const keyPoints = generateKeyPoints(events);

  const lastMessage = realMessages[realMessages.length - 1];

  return {
    id: `summary_${conversation.id}_${Date.now()}`,
    conversationId: conversation.id,
    summary: summaryText,
    keyPoints,
    currentStatus: status,
    lastMessageId: lastMessage?.id || '',
    messageCount: realMessages.length,
    generatedAt: new Date(),
    topics,
    sentiment,
    hasOpenIssue,
    nextAction,
  };
}

/**
 * Extract topics from messages
 */
function extractTopicsFromMessages(messages: Message[]): string[] {
  const topics = new Set<string>();
  const allContent = messages.map(m => m.content).join(' ').toLowerCase();

  const topicPatterns: { pattern: RegExp; topic: string }[] = [
    { pattern: /\b(wifi|internet|password)\b/i, topic: 'WiFi' },
    { pattern: /\b(check-?in|arrival|access|key)\b/i, topic: 'Check-in' },
    { pattern: /\b(check-?out|departure|leave)\b/i, topic: 'Check-out' },
    { pattern: /\b(early.*check|earlier)\b/i, topic: 'Early Check-in' },
    { pattern: /\b(late.*check|later.*out)\b/i, topic: 'Late Check-out' },
    { pattern: /\b(park|parking|car)\b/i, topic: 'Parking' },
    { pattern: /\b(pool|gym|amenities)\b/i, topic: 'Amenities' },
    { pattern: /\b(broken|not working|issue|problem)\b/i, topic: 'Maintenance' },
    { pattern: /\b(clean|dirty|housekeeping)\b/i, topic: 'Cleanliness' },
    { pattern: /\b(noise|loud|quiet)\b/i, topic: 'Noise' },
    { pattern: /\b(refund|money|charge)\b/i, topic: 'Billing' },
    { pattern: /\b(extend|extension|longer)\b/i, topic: 'Extension' },
    { pattern: /\b(restaurant|food|recommend)\b/i, topic: 'Recommendations' },
  ];

  for (const { pattern, topic } of topicPatterns) {
    if (pattern.test(allContent)) {
      topics.add(topic);
    }
  }

  return Array.from(topics);
}

/**
 * Determine overall sentiment of conversation
 */
function determineOverallSentiment(messages: Message[]): ConversationSummary['sentiment'] {
  let positive = 0;
  let negative = 0;

  const positivePatterns = /\b(thank|great|amazing|perfect|wonderful|love|appreciate|happy|excellent)\b/i;
  const negativePatterns = /\b(problem|issue|upset|disappointed|frustrated|angry|terrible|awful|complaint)\b/i;

  for (const message of messages) {
    if (positivePatterns.test(message.content)) positive++;
    if (negativePatterns.test(message.content)) negative++;
  }

  if (positive > 0 && negative > 0) return 'mixed';
  if (negative > positive) return 'negative';
  if (positive > 0) return 'positive';
  return 'neutral';
}

/**
 * Determine next recommended action
 */
function determineNextAction(events: ConversationEvent[], messages: Message[]): string | undefined {
  const lastMessage = messages[messages.length - 1];
  const hasOpenIssue = events.some(e => e.type === 'issue') && !events.some(e => e.type === 'resolution');

  if (hasOpenIssue) {
    return 'Resolve reported issue';
  }

  if (lastMessage?.sender === 'guest') {
    // Guest asked last - host should respond
    const hasQuestion = lastMessage.content.includes('?');
    if (hasQuestion) {
      return 'Answer guest question';
    }
    return 'Respond to guest';
  }

  // Check for pending offers
  const hasOffer = events.some(e => e.type === 'offer');
  const hasResponse = events.some(e => e.type === 'acceptance' || e.type === 'rejection');
  if (hasOffer && !hasResponse) {
    return 'Awaiting guest response to offer';
  }

  return undefined;
}

/**
 * Generate key points from events
 */
function generateKeyPoints(events: ConversationEvent[]): string[] {
  const points: string[] = [];

  // Group by type and get most important
  const questions = events.filter(e => e.type === 'question');
  const issues = events.filter(e => e.type === 'issue');
  const offers = events.filter(e => e.type === 'offer');
  const resolutions = events.filter(e => e.type === 'resolution');

  if (questions.length > 0) {
    points.push(`${questions.length} question(s) asked`);
  }
  if (issues.length > 0) {
    points.push(`${issues.length} issue(s) reported`);
  }
  if (offers.length > 0) {
    points.push(`${offers.length} offer(s) made`);
  }
  if (resolutions.length > 0) {
    points.push(`${resolutions.length} resolution(s)`);
  }

  return points.slice(0, 4); // Max 4 key points
}

/**
 * Get short summary for inbox preview (max 50 chars)
 */
export function getInboxPreviewSummary(summary: ConversationSummary): string {
  const text = summary.summary;
  if (text.length <= 50) return text;

  // Try to cut at a natural break point
  const cutoff = text.lastIndexOf(' → ', 47);
  if (cutoff > 20) {
    return text.substring(0, cutoff) + '...';
  }

  return text.substring(0, 47) + '...';
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: ConversationSummary['currentStatus']): string {
  switch (status) {
    case 'inquiry':
      return '#3B82F6'; // blue
    case 'negotiating':
      return '#F59E0B'; // amber
    case 'resolved':
      return '#10B981'; // green
    case 'pending_action':
      return '#EF4444'; // red
    case 'follow_up':
      return '#8B5CF6'; // purple
    default:
      return '#64748B'; // gray
  }
}

/**
 * Get status label for UI
 */
export function getStatusLabel(status: ConversationSummary['currentStatus']): string {
  switch (status) {
    case 'inquiry':
      return 'Inquiry';
    case 'negotiating':
      return 'Negotiating';
    case 'resolved':
      return 'Resolved';
    case 'pending_action':
      return 'Action Needed';
    case 'follow_up':
      return 'Follow-up';
    default:
      return 'Unknown';
  }
}
