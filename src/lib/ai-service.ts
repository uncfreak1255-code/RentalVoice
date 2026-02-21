// AI Service for generating guest responses
// Uses Google Gemini 2.5 Flash for best cost/performance on guest messages

import type { Conversation, Message, Property, HostStyleProfile, QuickReplyTemplate, LearnedLanguageStyle, PropertyKnowledge } from './store';
import { generateStyleInstructions, findMatchingTemplates, generateTemplateBasedPrompt, type TemplateMatchResult } from './ai-learning';
import { generateCulturalToneInstructions, getCulturalAdaptationSummary } from './cultural-tone';
import { detectLanguage as detectLanguageEnhanced } from './language-detect';

const GEMINI_MODEL = 'gemini-2.5-flash-preview-05-20';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// PropertyKnowledge is imported from store.ts

export interface AIResponse {
  content: string;
  confidence: number;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'urgent';
  suggestedActions?: string[];
  detectedIntent?: string;
  detectedLanguage?: string;
  translatedContent?: string;
  // Cultural tone adaptation info
  culturalToneApplied?: string;
  culturalAdaptations?: string[];
}

export interface AIGenerationOptions {
  conversation: Conversation;
  propertyKnowledge?: PropertyKnowledge;
  hostName?: string;
  language?: string;
  autoTranslate?: boolean;
  hostStyleProfile?: HostStyleProfile;
  quickReplyTemplates?: QuickReplyTemplate[];
  // Cultural tone adaptation
  culturalToneEnabled?: boolean;
  learnedLanguageStyles?: Record<string, LearnedLanguageStyle>;
  // Response language control
  responseLanguageMode?: 'match_guest' | 'host_language';
  hostDefaultLanguage?: string;
}

/**
 * Detect the language of a text message
 */
export function detectLanguage(text: string): string {
  // Common language patterns
  const patterns: { lang: string; regex: RegExp }[] = [
    { lang: 'es', regex: /\b(hola|gracias|buenos|días|noches|por favor|cómo|está|qué|para)\b/i },
    { lang: 'fr', regex: /\b(bonjour|merci|s'il vous plaît|comment|êtes|avez|pour|avec|nous)\b/i },
    { lang: 'de', regex: /\b(guten|danke|bitte|wie|sind|haben|für|mit|wir|können)\b/i },
    { lang: 'it', regex: /\b(buongiorno|grazie|prego|come|siete|avete|per|con|noi)\b/i },
    { lang: 'pt', regex: /\b(olá|obrigado|por favor|como|está|vocês|para|com|nós)\b/i },
    { lang: 'zh', regex: /[\u4e00-\u9fff]/ },
    { lang: 'ja', regex: /[\u3040-\u309f\u30a0-\u30ff]/ },
    { lang: 'ko', regex: /[\uac00-\ud7af]/ },
    { lang: 'ar', regex: /[\u0600-\u06ff]/ },
    { lang: 'ru', regex: /[\u0400-\u04ff]/ },
  ];

  for (const { lang, regex } of patterns) {
    if (regex.test(text)) {
      return lang;
    }
  }

  return 'en'; // Default to English
}

/**
 * Get language name from code
 */
export function getLanguageName(code: string): string {
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
  };
  return languages[code] || 'English';
}

/**
 * Build the system prompt for the AI based on property knowledge and preferences
 */
function buildSystemPrompt(
  property: Property,
  knowledge?: PropertyKnowledge,
  hostName?: string,
  hostStyleProfile?: HostStyleProfile,
  culturalToneData?: {
    enabled: boolean;
    languageCode: string;
    learnedStyle?: LearnedLanguageStyle;
  }
): string {
  const tone = knowledge?.tonePreference || 'friendly';
  const propertyType = knowledge?.propertyType || 'vacation_rental';
  const toneGuidelines = {
    friendly: 'Be warm, personable, and use a conversational tone. Show genuine care.',
    professional: 'Be polite, efficient, and maintain a business-appropriate tone. Be helpful but concise.',
    casual: 'Be relaxed and informal. Use a friendly, approachable style like texting a friend.',
  };

  // Adapt intro and role based on property type
  const roleIntro = propertyType === 'long_term'
    ? `You are an AI assistant helping manage tenant communications for a long-term rental property.`
    : propertyType === 'hybrid'
    ? `You are an AI assistant helping manage communications for a rental property that serves both short-term guests and long-term tenants. Adapt your tone based on the conversation context.`
    : `You are an AI assistant helping manage guest communications for a vacation rental property.`;

  let prompt = `${roleIntro}

PROPERTY: ${property.name}
ADDRESS: ${property.address}
${hostName ? `HOST NAME: ${hostName}` : ''}
PROPERTY TYPE: ${propertyType === 'long_term' ? 'Long-Term Rental' : propertyType === 'hybrid' ? 'Hybrid (STR + LTR)' : 'Vacation Rental'}

BASE COMMUNICATION STYLE: ${toneGuidelines[tone]}

GUIDELINES:
- Be helpful, empathetic, and solution-focused
- Answer questions directly and proactively offer relevant information
- If you don't have specific information, be honest but offer to help find it
- Never make up information about the property that isn't provided
- Keep responses concise but complete (2-4 sentences typically)
- For urgent issues (lockouts, safety, emergencies), express immediate concern and offer solutions
`;

  // LTR-specific guidelines
  if (propertyType === 'long_term' || propertyType === 'hybrid') {
    prompt += `
LANDLORD-TENANT GUIDELINES:
- Maintain a professional landlord-tenant relationship tone
- For rent inquiries, reference specific amounts, due dates, and payment methods
- For maintenance requests, acknowledge urgency and provide correct contacts
- For lease questions, reference terms but advise consulting the actual lease document
- For complaints (noise, pests), document and escalate appropriately
- Never discuss other tenants' personal information
`;
  }

  // Add cultural tone instructions if enabled
  if (culturalToneData?.enabled && culturalToneData.languageCode) {
    const culturalInstructions = generateCulturalToneInstructions(
      culturalToneData.languageCode,
      culturalToneData.learnedStyle
    );
    prompt += culturalInstructions;
  } else {
    prompt += '\n- Match the guest\'s language if they write in a non-English language';
  }

  // Add learned host style if available
  if (hostStyleProfile && hostStyleProfile.samplesAnalyzed > 5) {
    const styleInstructions = generateStyleInstructions(hostStyleProfile);
    prompt += `\nHOST'S PERSONAL STYLE (learned from their messages):
${styleInstructions}
`;
  }

  if (knowledge) {
    // Shared property info
    prompt += '\nPROPERTY INFORMATION:\n';
    if (knowledge.wifiName && knowledge.wifiPassword) {
      prompt += `- WiFi: Network "${knowledge.wifiName}", Password "${knowledge.wifiPassword}"\n`;
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
    if (knowledge.emergencyContacts) {
      prompt += `- Emergency Contacts: ${knowledge.emergencyContacts}\n`;
    }
    if (knowledge.customNotes) {
      prompt += `- Additional Notes: ${knowledge.customNotes}\n`;
    }

    // STR-specific info
    if (propertyType === 'vacation_rental' || propertyType === 'hybrid') {
      if (knowledge.checkInInstructions) {
        prompt += `- Check-in Instructions: ${knowledge.checkInInstructions}\n`;
      }
      if (knowledge.checkOutInstructions) {
        prompt += `- Check-out Instructions: ${knowledge.checkOutInstructions}\n`;
      }
      if (knowledge.localRecommendations) {
        prompt += `- Local Tips: ${knowledge.localRecommendations}\n`;
      }
    }

    // LTR-specific info
    if (propertyType === 'long_term' || propertyType === 'hybrid') {
      prompt += '\nLEASE & RENT DETAILS:\n';
      if (knowledge.monthlyRent) {
        prompt += `- Monthly Rent: $${knowledge.monthlyRent}\n`;
      }
      if (knowledge.rentDueDay) {
        prompt += `- Rent Due: ${knowledge.rentDueDay}${getOrdinal(knowledge.rentDueDay)} of each month\n`;
      }
      if (knowledge.lateFeeAmount && knowledge.lateFeeGracePeriod) {
        prompt += `- Late Fee: $${knowledge.lateFeeAmount} after ${knowledge.lateFeeGracePeriod}-day grace period\n`;
      }
      if (knowledge.paymentMethods) {
        prompt += `- Payment Methods: ${knowledge.paymentMethods}\n`;
      }
      if (knowledge.tenantPortalUrl) {
        prompt += `- Tenant Portal: ${knowledge.tenantPortalUrl}\n`;
      }
      if (knowledge.leaseStartDate && knowledge.leaseEndDate) {
        prompt += `- Lease Period: ${knowledge.leaseStartDate} to ${knowledge.leaseEndDate}\n`;
      }

      prompt += '\nBUILDING POLICIES:\n';
      if (knowledge.quietHoursPolicy) {
        prompt += `- Quiet Hours: ${knowledge.quietHoursPolicy}\n`;
      }
      if (knowledge.petPolicy) {
        prompt += `- Pet Policy: ${knowledge.petPolicy}\n`;
      }
      if (knowledge.guestPolicy) {
        prompt += `- Guest Policy: ${knowledge.guestPolicy}\n`;
      }
      if (knowledge.smokingPolicy) {
        prompt += `- Smoking Policy: ${knowledge.smokingPolicy}\n`;
      }
      if (knowledge.trashPolicy) {
        prompt += `- Trash & Recycling: ${knowledge.trashPolicy}\n`;
      }
      if (knowledge.utilityResponsibility) {
        prompt += `- Utilities: ${knowledge.utilityResponsibility}\n`;
      }

      prompt += '\nMAINTENANCE:\n';
      if (knowledge.maintenanceContactName) {
        prompt += `- Contact: ${knowledge.maintenanceContactName}`;
        if (knowledge.maintenanceContactPhone) prompt += ` (${knowledge.maintenanceContactPhone})`;
        prompt += '\n';
      }
      if (knowledge.maintenanceEmergencyPhone) {
        prompt += `- Emergency Line: ${knowledge.maintenanceEmergencyPhone}\n`;
      }
      if (knowledge.maintenanceHours) {
        prompt += `- Hours: ${knowledge.maintenanceHours}\n`;
      }
    }
  }

  return prompt;
}

/** Helper for ordinal suffixes (1st, 2nd, 3rd, etc.) */
function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Build conversation history for context
 */
function buildConversationContext(messages: Message[]): string {
  const recentMessages = messages.slice(-10); // Last 10 messages for context

  return recentMessages
    .filter((m) => m.sender !== 'ai_draft')
    .map((m) => {
      const role = m.sender === 'guest' ? 'Guest' : 'Host';
      return `${role}: ${m.content}`;
    })
    .join('\n');
}

/**
 * Analyze message sentiment and urgency
 */
function analyzeMessage(content: string): { sentiment: 'positive' | 'neutral' | 'negative' | 'urgent'; confidence: number } {
  const lowerContent = content.toLowerCase();

  // Urgent keywords
  const urgentKeywords = ['emergency', 'urgent', 'help', 'locked out', 'broken', 'flood', 'fire', 'safety', 'immediately', 'asap', 'police', 'ambulance'];
  const isUrgent = urgentKeywords.some((kw) => lowerContent.includes(kw));
  if (isUrgent) {
    return { sentiment: 'urgent', confidence: 95 };
  }

  // Negative keywords
  const negativeKeywords = ['problem', 'issue', 'complaint', 'disappointed', 'dirty', 'broken', 'not working', 'unhappy', 'refund', 'terrible', 'awful'];
  const isNegative = negativeKeywords.some((kw) => lowerContent.includes(kw));
  if (isNegative) {
    return { sentiment: 'negative', confidence: 85 };
  }

  // Positive keywords
  const positiveKeywords = ['thank', 'great', 'amazing', 'wonderful', 'love', 'perfect', 'beautiful', 'excellent', 'happy', 'appreciate'];
  const isPositive = positiveKeywords.some((kw) => lowerContent.includes(kw));
  if (isPositive) {
    return { sentiment: 'positive', confidence: 90 };
  }

  return { sentiment: 'neutral', confidence: 85 };
}

/**
 * Detect common intents — supports both STR (guest) and LTR (tenant) messages
 */
function detectIntent(content: string): string {
  const lowerContent = content.toLowerCase();

  // ── LTR Intents ──
  if (lowerContent.includes('rent') || lowerContent.includes('payment') || lowerContent.includes('due') || lowerContent.includes('late fee') || lowerContent.includes('pay')) {
    return 'rent_inquiry';
  }
  if (lowerContent.includes('lease') || lowerContent.includes('contract') || lowerContent.includes('renew') || lowerContent.includes('renewal') || lowerContent.includes('term')) {
    return 'lease_inquiry';
  }
  if (lowerContent.includes('noise') || lowerContent.includes('loud') || lowerContent.includes('party') || lowerContent.includes('neighbor') || lowerContent.includes('quiet hours')) {
    return 'noise_complaint';
  }
  if (lowerContent.includes('move in') || lowerContent.includes('move out') || lowerContent.includes('key return') || lowerContent.includes('walkthrough') || lowerContent.includes('moving')) {
    return 'move_in_out';
  }
  if (lowerContent.includes('bug') || lowerContent.includes('pest') || lowerContent.includes('roach') || lowerContent.includes('mouse') || lowerContent.includes('ant') || lowerContent.includes('exterminator')) {
    return 'pest_issue';
  }
  if (lowerContent.includes('utility') || lowerContent.includes('electric') || lowerContent.includes('water bill') || lowerContent.includes('gas bill') || lowerContent.includes('included')) {
    return 'utility_inquiry';
  }

  // ── Shared Intents ──
  if (lowerContent.includes('park') || lowerContent.includes('car') || lowerContent.includes('garage') || lowerContent.includes('towed') || lowerContent.includes('visitor parking')) {
    return 'parking_inquiry';
  }
  if (lowerContent.includes('broken') || lowerContent.includes('not working') || lowerContent.includes('fix') || lowerContent.includes('repair') || lowerContent.includes('leak') || lowerContent.includes('plumbing') || lowerContent.includes('hvac')) {
    return 'maintenance_issue';
  }
  if (lowerContent.includes('key') || lowerContent.includes('lock') || lowerContent.includes('door') || lowerContent.includes('access')) {
    return 'access_inquiry';
  }

  // ── STR-specific Intents ──
  if (lowerContent.includes('wifi') || lowerContent.includes('internet') || lowerContent.includes('password')) {
    return 'wifi_inquiry';
  }
  if (lowerContent.includes('check-in') || lowerContent.includes('checkin') || lowerContent.includes('arrive') || lowerContent.includes('arrival')) {
    return 'checkin_inquiry';
  }
  if (lowerContent.includes('check-out') || lowerContent.includes('checkout') || lowerContent.includes('leave') || lowerContent.includes('departure')) {
    return 'checkout_inquiry';
  }
  if (lowerContent.includes('early') && (lowerContent.includes('check') || lowerContent.includes('arrive'))) {
    return 'early_checkin_request';
  }
  if (lowerContent.includes('late') && (lowerContent.includes('check') || lowerContent.includes('stay'))) {
    return 'late_checkout_request';
  }
  if (lowerContent.includes('clean') || lowerContent.includes('towel') || lowerContent.includes('sheet') || lowerContent.includes('trash')) {
    return 'housekeeping_inquiry';
  }
  if (lowerContent.includes('restaurant') || lowerContent.includes('food') || lowerContent.includes('eat') || lowerContent.includes('recommend')) {
    return 'local_recommendation';
  }

  return 'general_inquiry';
}

/**
 * Generate an AI response for a guest message
 */
export async function generateAIResponse(options: AIGenerationOptions): Promise<AIResponse> {
  const {
    conversation,
    propertyKnowledge,
    hostName,
    language,
    hostStyleProfile,
    quickReplyTemplates,
    culturalToneEnabled = true,
    learnedLanguageStyles = {},
    responseLanguageMode = 'match_guest',
    hostDefaultLanguage = 'en',
  } = options;
  const apiKey = process.env.EXPO_PUBLIC_VIBECODE_GOOGLE_API_KEY;

  if (!apiKey) {
    console.error('[AI Service] No Gemini API key found');
    throw new Error('Gemini API key not configured. Please add it in Settings → API.');
  }

  const lastGuestMessage = [...conversation.messages]
    .reverse()
    .find((m) => m.sender === 'guest');

  if (!lastGuestMessage) {
    throw new Error('No guest message to respond to');
  }

  // Analyze the message
  const { sentiment, confidence: sentimentConfidence } = analyzeMessage(lastGuestMessage.content);
  const detectedIntent = detectIntent(lastGuestMessage.content);

  // Detect guest language — use enhanced detector, fallback chain
  const guestLanguage = language ||
    conversation.guest.preferredLanguage ||
    conversation.guest.detectedLanguage ||
    detectLanguageEnhanced(lastGuestMessage.content);

  // Determine response language based on mode
  const detectedLanguage = responseLanguageMode === 'host_language'
    ? hostDefaultLanguage
    : guestLanguage;

  // Get learned style for this language if available
  const learnedStyle = learnedLanguageStyles[detectedLanguage];

  // Get cultural adaptation summary for response metadata
  const culturalSummary = culturalToneEnabled
    ? getCulturalAdaptationSummary(detectedLanguage)
    : null;

  console.log('[AI Service] Detected language:', detectedLanguage, 'Cultural tone enabled:', culturalToneEnabled);
  if (culturalSummary) {
    console.log('[AI Service] Cultural adaptations:', culturalSummary.adaptations);
  }

  // Find matching templates for this message
  let templateMatch: TemplateMatchResult | null = null;
  let templatePromptAddition = '';

  if (quickReplyTemplates && quickReplyTemplates.length > 0) {
    const matches = findMatchingTemplates(
      lastGuestMessage.content,
      quickReplyTemplates,
      conversation.property.id,
      1 // Get top match only
    );

    if (matches.length > 0 && matches[0].matchScore >= 20) {
      templateMatch = matches[0];
      templatePromptAddition = generateTemplateBasedPrompt(templateMatch, lastGuestMessage.content);
      console.log('[AI Service] Found matching template:', templateMatch.template.name, 'score:', templateMatch.matchScore);
    }
  }

  // Build prompts - now includes cultural tone data
  const systemPrompt = buildSystemPrompt(
    conversation.property,
    propertyKnowledge,
    hostName,
    hostStyleProfile,
    {
      enabled: culturalToneEnabled,
      languageCode: detectedLanguage,
      learnedStyle,
    }
  );
  const conversationContext = buildConversationContext(conversation.messages);

  // Get language name for the prompt
  const languageName = getLanguageName(detectedLanguage);

  let userPrompt = `Based on the conversation below, generate a helpful response to the guest's latest message.

CONVERSATION HISTORY:
${conversationContext}

The guest's sentiment appears to be: ${sentiment}
Detected intent: ${detectedIntent}
Guest language: ${languageName} (${detectedLanguage})
${culturalToneEnabled ? `\nIMPORTANT: Apply the cultural tone guidelines for ${languageName} provided in the system instructions. Ensure the response feels natural and culturally appropriate for a ${languageName}-speaking guest.` : ''}
`;

  // Add template guidance if we have a match
  if (templatePromptAddition) {
    userPrompt += `\n${templatePromptAddition}\n`;
  } else {
    userPrompt += `
Generate a response that:
1. Directly addresses their question or concern
2. Is empathetic and helpful
3. Provides specific information when available
4. Offers proactive help when appropriate
${culturalToneEnabled ? `5. Uses culturally appropriate tone, greetings, and expressions for ${languageName}` : ''}
`;
  }

  userPrompt += `\nRespond with ONLY the message content in ${languageName}, no additional formatting or explanation.`;

  console.log('[AI Service] Generating response for intent:', detectedIntent);

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[AI Service] Gemini API error:', error);
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const data = await response.json();
    const generatedContent =
      data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!generatedContent) {
      throw new Error('Empty response from Gemini');
    }

    // Calculate confidence based on various factors
    let confidence = sentimentConfidence;

    // Boost confidence if we used a matching template
    if (templateMatch && templateMatch.matchScore >= 40) {
      confidence = Math.min(98, confidence + 10);
      console.log('[AI Service] Boosted confidence due to template match');
    }

    // Boost confidence if we have learned style for this language
    if (learnedStyle && learnedStyle.samplesAnalyzed >= 3) {
      confidence = Math.min(98, confidence + 5);
      console.log('[AI Service] Boosted confidence due to learned language style');
    }

    // Reduce confidence for complex situations
    if (sentiment === 'urgent') confidence = Math.min(confidence, 75); // Urgent needs human review
    if (sentiment === 'negative') confidence = Math.min(confidence, 80);
    if (detectedIntent === 'maintenance_issue') confidence = Math.min(confidence, 78);

    // Boost confidence for straightforward queries with knowledge
    if (propertyKnowledge) {
      if (detectedIntent === 'wifi_inquiry' && propertyKnowledge.wifiPassword) confidence = Math.min(95, confidence + 5);
      if (detectedIntent === 'checkin_inquiry' && propertyKnowledge.checkInInstructions) confidence = Math.min(95, confidence + 5);
      if (detectedIntent === 'parking_inquiry' && propertyKnowledge.parkingInfo) confidence = Math.min(95, confidence + 5);
    }

    console.log('[AI Service] Response generated with confidence:', confidence);

    return {
      content: generatedContent.trim(),
      confidence,
      sentiment,
      detectedIntent,
      detectedLanguage,
      suggestedActions: getSuggestedActions(detectedIntent, sentiment),
      culturalToneApplied: culturalToneEnabled ? detectedLanguage : undefined,
      culturalAdaptations: culturalSummary?.adaptations,
    };
  } catch (error) {
    console.error('[AI Service] Error:', error);
    throw error;
  }
}

/**
 * Get suggested follow-up actions based on intent and sentiment
 */
function getSuggestedActions(intent: string, sentiment: string): string[] {
  const actions: string[] = [];

  if (sentiment === 'urgent') {
    actions.push('Flag for immediate review');
    actions.push('Consider calling guest');
  }

  if (sentiment === 'negative') {
    actions.push('Follow up within 24 hours');
    actions.push('Consider offering compensation');
  }

  // STR actions
  if (intent === 'maintenance_issue') {
    actions.push('Create maintenance ticket');
    actions.push('Contact property manager');
  }
  if (intent === 'early_checkin_request' || intent === 'late_checkout_request') {
    actions.push('Check availability');
    actions.push('Consider upsell opportunity');
  }

  // LTR actions
  if (intent === 'rent_inquiry') {
    actions.push('Verify payment status');
    actions.push('Send payment portal link');
  }
  if (intent === 'lease_inquiry') {
    actions.push('Review lease terms');
    actions.push('Schedule renewal discussion');
  }
  if (intent === 'noise_complaint') {
    actions.push('Document complaint');
    actions.push('Send quiet hours reminder to building');
  }
  if (intent === 'pest_issue') {
    actions.push('Schedule exterminator');
    actions.push('Create urgent maintenance ticket');
  }
  if (intent === 'move_in_out') {
    actions.push('Schedule walkthrough');
    actions.push('Prepare move-in/out checklist');
  }

  return actions;
}

/**
 * Generate a demo response without calling the API (for demo mode)
 */
export function generateDemoResponse(conversation: Conversation, culturalToneEnabled = true): AIResponse {
  const lastGuestMessage = [...conversation.messages]
    .reverse()
    .find((m) => m.sender === 'guest');

  if (!lastGuestMessage) {
    return {
      content: "Thank you for reaching out! How can I help you with your stay?",
      confidence: 85,
      sentiment: 'neutral',
      detectedIntent: 'general_inquiry',
      detectedLanguage: 'en',
    };
  }

  const { sentiment } = analyzeMessage(lastGuestMessage.content);
  const intent = detectIntent(lastGuestMessage.content);
  const detectedLanguage = conversation.guest.preferredLanguage ||
    conversation.guest.detectedLanguage ||
    detectLanguage(lastGuestMessage.content);

  // Get cultural adaptation summary
  const culturalSummary = culturalToneEnabled
    ? getCulturalAdaptationSummary(detectedLanguage)
    : null;

  // Demo responses based on intent - with cultural variations
  const demoResponses: Record<string, Record<string, string>> = {
    wifi_inquiry: {
      en: `Great question! The WiFi network is "PropertyGuest" and the password is "welcome2024". You should find the strongest signal in the living room. Let me know if you have any trouble connecting!`,
      es: `¡Excelente pregunta! La red WiFi es "PropertyGuest" y la contraseña es "welcome2024". Encontrarás la mejor señal en la sala de estar. ¡No dudes en escribirme si tienes problemas para conectarte!`,
      fr: `Très bonne question ! Le réseau WiFi est "PropertyGuest" et le mot de passe est "welcome2024". Vous trouverez le meilleur signal dans le salon. N'hésitez pas à me contacter si vous avez des difficultés à vous connecter.`,
      de: `Gute Frage! Das WLAN-Netzwerk heißt "PropertyGuest" und das Passwort lautet "welcome2024". Das beste Signal finden Sie im Wohnzimmer. Bei Fragen stehe ich Ihnen gerne zur Verfügung.`,
      it: `Ottima domanda! La rete WiFi è "PropertyGuest" e la password è "welcome2024". Troverai il segnale migliore in soggiorno. Non esitare a contattarmi se hai problemi a connetterti!`,
      ja: `ご質問ありがとうございます。WiFiネットワーク名は「PropertyGuest」、パスワードは「welcome2024」でございます。リビングルームで最も電波が良くなっております。接続に問題がございましたら、お気軽にお申し付けください。`,
    },
    checkin_inquiry: {
      en: `Check-in is at 3:00 PM. You'll find a lockbox on the front door - the code will be sent to you the morning of your arrival. There's also a detailed check-in guide in the welcome book on the kitchen counter!`,
      es: `¡El check-in es a las 3:00 PM! Encontrarás una caja de seguridad en la puerta principal - te enviaré el código la mañana de tu llegada. También hay una guía detallada en el libro de bienvenida en la cocina. ¡Que tengas un buen viaje!`,
      fr: `L'enregistrement se fait à 15h00. Vous trouverez un boîtier à code sur la porte d'entrée - le code vous sera envoyé le matin de votre arrivée. Un guide détaillé vous attend également dans le livret d'accueil sur le comptoir de la cuisine.`,
      de: `Der Check-in ist um 15:00 Uhr. Sie finden einen Schlüsseltresor an der Eingangstür - den Code erhalten Sie am Morgen Ihrer Ankunft. Eine ausführliche Check-in-Anleitung finden Sie im Willkommensbuch auf der Küchentheke.`,
      it: `Il check-in è alle 15:00. Troverai una cassetta di sicurezza sulla porta d'ingresso - ti invierò il codice la mattina del tuo arrivo. C'è anche una guida dettagliata nel libro di benvenuto sul bancone della cucina!`,
      ja: `チェックインは午後3時でございます。玄関ドアにキーボックスがございます。暗証番号はご到着日の朝にお送りいたします。また、キッチンカウンターにあるウェルカムブックに詳しいチェックインガイドがございます。`,
    },
    general_inquiry: {
      en: `Thanks for reaching out! I'm happy to help with anything you need during your stay. What can I assist you with?`,
      es: `¡Gracias por escribir! Estoy encantado de ayudarte con lo que necesites durante tu estancia. ¿En qué puedo asistirte?`,
      fr: `Merci de nous contacter ! Je suis ravi de pouvoir vous aider pendant votre séjour. Comment puis-je vous être utile ?`,
      de: `Vielen Dank für Ihre Nachricht! Ich helfe Ihnen gerne bei allem, was Sie während Ihres Aufenthalts benötigen. Wie kann ich Ihnen behilflich sein?`,
      it: `Grazie per averci contattato! Sono felice di aiutarti con qualsiasi cosa durante il tuo soggiorno. Come posso assisterti?`,
      ja: `お問い合わせいただきありがとうございます。ご滞在中、何かございましたらお気軽にお申し付けください。どのようなご用件でしょうか？`,
    },
  };

  // Fallback responses for intents not in the cultural map
  const fallbackResponses: Record<string, string> = {
    checkout_inquiry: `Check-out is at 11:00 AM. Please start the dishwasher, take out any trash, and leave the keys on the kitchen counter. No need to strip the beds - we've got that covered!`,
    early_checkin_request: `I'd love to accommodate an early check-in for you! Let me check with our cleaning team. Typically, we can offer early check-in at 1 PM for a small fee of $25, subject to availability. Would that work for you?`,
    late_checkout_request: `Thanks for asking about late checkout! I can often accommodate this. Our standard late checkout is until 1 PM for $30. Let me confirm availability for your dates and get back to you shortly.`,
    parking_inquiry: `Parking is available right in the driveway - you can fit up to 2 cars. There's also free street parking if you have additional vehicles. The garage is for storage only, so please use the driveway.`,
    access_inquiry: `Access to the property is via a keypad lock on the front door. Your unique entry code will be sent to you on the morning of check-in. If you ever get locked out, just give me a call and I can provide a backup code!`,
    maintenance_issue: `I'm so sorry to hear you're experiencing an issue! I want to get this resolved for you right away. Can you tell me a bit more about what's happening? I'll contact our maintenance team immediately.`,
    local_recommendation: `Great question! Some local favorites include The Harbor Grill for seafood, Sunrise Cafe for breakfast, and Bella Italia for dinner. For activities, the beach is just 5 minutes away and there's great hiking at Pine Ridge Trail!`,
    housekeeping_inquiry: `I'd be happy to help with housekeeping needs! Fresh towels and linens can be found in the hallway closet. If you need anything else, just let me know!`,
  };

  // Get the response - prefer culturally adapted, fallback to English or generic
  const intentResponses = demoResponses[intent];
  let content: string;

  if (intentResponses && intentResponses[detectedLanguage]) {
    content = intentResponses[detectedLanguage];
  } else if (intentResponses && intentResponses['en']) {
    content = intentResponses['en'];
  } else {
    content = fallbackResponses[intent] || fallbackResponses['general_inquiry'] || demoResponses.general_inquiry.en;
  }

  return {
    content,
    confidence: Math.floor(Math.random() * 10) + 85,
    sentiment,
    detectedIntent: intent,
    detectedLanguage,
    suggestedActions: getSuggestedActions(intent, sentiment),
    culturalToneApplied: culturalToneEnabled ? detectedLanguage : undefined,
    culturalAdaptations: culturalSummary?.adaptations,
  };
}
