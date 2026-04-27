// Smart Templates Service with AI Personalization
// Combines reusable templates with AI-powered customization

import type { Conversation, PropertyKnowledge, HostStyleProfile } from './store';
import { generateStyleInstructions } from './ai-learning';
import { API_BASE_URL } from './config';
import { getAuthHeaders } from './api-client';

// Template Categories
export type TemplateCategory =
  | 'check_in'
  | 'check_out'
  | 'welcome'
  | 'review_request'
  | 'issue_response'
  | 'upsell'
  | 'custom';

// Template Trigger Types
export type TemplateTrigger =
  | 'manual'
  | 'before_checkin'
  | 'after_checkin'
  | 'before_checkout'
  | 'after_checkout'
  | 'on_message'
  | 'scheduled';

// Smart Template Definition
export interface SmartTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  trigger: TemplateTrigger;
  triggerCondition?: string; // e.g., "guest asks about parking"
  triggerHours?: number; // Hours before/after event
  baseContent: string;
  variables: TemplateVariable[];
  aiPersonalization: boolean;
  personalizationInstructions?: string;
  isActive: boolean;
  usageCount: number;
  lastUsed?: Date;
  createdAt: Date;
  propertyId?: string; // Optional - applies to specific property or all
}

// Template Variable
export interface TemplateVariable {
  key: string;
  label: string;
  defaultValue?: string;
  source: 'guest' | 'property' | 'booking' | 'custom';
  required: boolean;
}

// Personalized Template Result
export interface PersonalizedTemplate {
  originalTemplate: SmartTemplate;
  personalizedContent: string;
  variablesUsed: Record<string, string>;
  aiAdjustments: string[];
  confidence: number;
}

// Default template variables
export const defaultVariables: TemplateVariable[] = [
  { key: 'guest_name', label: 'Guest Name', source: 'guest', required: true },
  { key: 'property_name', label: 'Property Name', source: 'property', required: true },
  { key: 'property_address', label: 'Property Address', source: 'property', required: false },
  { key: 'checkin_date', label: 'Check-in Date', source: 'booking', required: false },
  { key: 'checkout_date', label: 'Check-out Date', source: 'booking', required: false },
  { key: 'checkin_time', label: 'Check-in Time', source: 'property', required: false },
  { key: 'checkout_time', label: 'Check-out Time', source: 'property', required: false },
  { key: 'wifi_name', label: 'WiFi Network', source: 'property', required: false },
  { key: 'wifi_password', label: 'WiFi Password', source: 'property', required: false },
  { key: 'parking_info', label: 'Parking Info', source: 'property', required: false },
  { key: 'host_name', label: 'Host Name', source: 'property', required: false },
  { key: 'checkout_instructions', label: 'Check-out Instructions', source: 'property', required: false },
];

// Default smart templates
export const defaultTemplates: Omit<SmartTemplate, 'id' | 'createdAt' | 'usageCount'>[] = [
  {
    name: 'Pre-Arrival Welcome',
    category: 'check_in',
    trigger: 'before_checkin',
    triggerHours: 24,
    baseContent: `Hi {{guest_name}}!

We're excited to welcome you to {{property_name}} tomorrow!

Here's what you need to know:
• Check-in time: {{checkin_time}}
• Address: {{property_address}}
• WiFi: {{wifi_name}} / {{wifi_password}}
• Parking: {{parking_info}}

Please let me know if you have any questions before your arrival. Safe travels!

{{host_name}}`,
    variables: defaultVariables,
    aiPersonalization: true,
    personalizationInstructions: 'Adjust warmth based on if this is a returning guest. Add any relevant local tips if arriving late.',
    isActive: true,
  },
  {
    name: 'Day-Of Check-in',
    category: 'check_in',
    trigger: 'before_checkin',
    triggerHours: 4,
    baseContent: `Hi {{guest_name}}! Your home for the next few days is ready and waiting for you!

Quick reminder - check-in is at {{checkin_time}}. Can't wait to host you!`,
    variables: defaultVariables,
    aiPersonalization: true,
    personalizationInstructions: 'Keep it brief and excited. Match the guest\'s previous communication style if known.',
    isActive: true,
  },
  {
    name: 'Post Check-in Follow-up',
    category: 'welcome',
    trigger: 'after_checkin',
    triggerHours: 2,
    baseContent: `Hi {{guest_name}}! I hope you've settled in nicely at {{property_name}}.

Just checking in to make sure everything is to your liking. The WiFi is "{{wifi_name}}" with password "{{wifi_password}}" in case you need it.

Please don't hesitate to reach out if you need anything at all!`,
    variables: defaultVariables,
    aiPersonalization: true,
    personalizationInstructions: 'Be warm and available. If there were any issues during check-in, acknowledge and offer help.',
    isActive: true,
  },
  {
    name: 'Check-out Reminder',
    category: 'check_out',
    trigger: 'before_checkout',
    triggerHours: 14,
    baseContent: `Hi {{guest_name}}! Just a friendly reminder that check-out is tomorrow at {{checkout_time}}.

Before you leave:
{{checkout_instructions}}

We hope you've had a wonderful stay! Safe travels on your journey home.`,
    variables: defaultVariables,
    aiPersonalization: true,
    personalizationInstructions: 'Thank them for their stay. If they mentioned enjoying something specific during their stay, reference it.',
    isActive: true,
  },
  {
    name: 'Review Request',
    category: 'review_request',
    trigger: 'after_checkout',
    triggerHours: 24,
    baseContent: `Hi {{guest_name}}!

Thank you so much for staying at {{property_name}}! We truly hope you had a wonderful experience.

If you have a moment, we'd be incredibly grateful for a review. Your feedback helps future guests and means the world to us!

We hope to host you again soon!

{{host_name}}`,
    variables: defaultVariables,
    aiPersonalization: true,
    personalizationInstructions: 'Reference any positive interactions during the stay. Keep it genuine, not pushy.',
    isActive: true,
  },
  {
    name: 'Issue Acknowledgment',
    category: 'issue_response',
    trigger: 'manual',
    baseContent: `Hi {{guest_name}},

I'm so sorry to hear about this issue. Your comfort is my top priority, and I want to make this right.

I'm looking into this immediately and will get back to you with a solution as soon as possible.

Thank you for letting me know!`,
    variables: defaultVariables,
    aiPersonalization: true,
    personalizationInstructions: 'Match empathy level to the severity of the issue. For urgent issues, convey immediate action.',
    isActive: true,
  },
  {
    name: 'Early Check-in Offer',
    category: 'upsell',
    trigger: 'on_message',
    triggerCondition: 'guest asks about early check-in',
    baseContent: 'Great news, {{guest_name}}! I\'d be happy to try to accommodate an early check-in for you.\n\nSubject to availability, I can offer early check-in at 1 PM for a small fee of ${{early_checkin_fee}}. Would you like me to check if it\'s available for your dates?',
    variables: defaultVariables.concat([{ key: 'early_checkin_fee', label: 'Early Check-in Fee', source: 'property', required: true }]),
    aiPersonalization: true,
    personalizationInstructions: 'Be accommodating and make it sound like a helpful option, not a sales pitch.',
    isActive: true,
  },
];

// Replace template variables with actual values
export function replaceVariables(
  template: string,
  values: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(values)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || '');
  }

  // Remove any unreplaced variables
  result = result.replace(/\{\{[^}]+\}\}/g, '');

  // Clean up extra whitespace
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

// Extract variable values from conversation context
export function extractVariableValues(
  conversation: Conversation,
  propertyKnowledge?: PropertyKnowledge,
  hostName?: string
): Record<string, string> {
  const values: Record<string, string> = {};

  // Guest info
  values['guest_name'] = conversation.guest.name;
  values['guest_email'] = conversation.guest.email || '';

  // Property info
  values['property_name'] = conversation.property.name;
  values['property_address'] = conversation.property.address;

  // Booking info
  if (conversation.checkInDate) {
    values['checkin_date'] = new Date(conversation.checkInDate).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }
  if (conversation.checkOutDate) {
    values['checkout_date'] = new Date(conversation.checkOutDate).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  // Property knowledge
  if (propertyKnowledge) {
    values['checkin_time'] = propertyKnowledge.checkInTime || '3:00 PM';
    values['checkout_time'] = propertyKnowledge.checkOutTime || '11:00 AM';
    values['wifi_name'] = propertyKnowledge.wifiName || '';
    values['wifi_password'] = propertyKnowledge.wifiPassword || '';
    values['parking_info'] = propertyKnowledge.parkingInfo || '';
    values['checkout_instructions'] = propertyKnowledge.checkOutInstructions || '';
    values['early_checkin_fee'] = propertyKnowledge.earlyCheckInFee?.toString() || '25';
    values['late_checkout_fee'] = propertyKnowledge.lateCheckOutFee?.toString() || '30';
  }

  // Host info
  values['host_name'] = hostName || 'Your Host';

  return values;
}

// Apply AI personalization to a template
export async function personalizeTemplate(
  template: SmartTemplate,
  conversation: Conversation,
  propertyKnowledge?: PropertyKnowledge,
  hostName?: string,
  hostStyleProfile?: HostStyleProfile
): Promise<PersonalizedTemplate> {
  // Get variable values
  const variableValues = extractVariableValues(conversation, propertyKnowledge, hostName);

  // Replace variables in base content
  const populatedContent = replaceVariables(template.baseContent, variableValues);

  // If no AI personalization, return as-is
  if (!template.aiPersonalization) {
    return {
      originalTemplate: template,
      personalizedContent: populatedContent,
      variablesUsed: variableValues,
      aiAdjustments: [],
      confidence: 95,
    };
  }

  // Apply AI personalization via server proxy

  try {
    // Build context from conversation
    const recentMessages = conversation.messages.slice(-5);
    const conversationContext = recentMessages
      .map((m) => `${m.sender === 'guest' ? 'Guest' : 'Host'}: ${m.content}`)
      .join('\n');

    // Build personalization prompt
    let systemPrompt = `You are helping personalize a message template for a vacation rental host.

Your task is to take the provided template and adjust the wording to:
1. Match the conversation flow and context
2. Sound natural and not templated
3. Add personal touches based on conversation history
4. Maintain the core information but adjust tone and phrasing

${template.personalizationInstructions || ''}`;

    if (hostStyleProfile && hostStyleProfile.samplesAnalyzed > 5) {
      systemPrompt += `\n\nHOST'S COMMUNICATION STYLE:
${generateStyleInstructions(hostStyleProfile)}`;
    }

    const userPrompt = `Template to personalize:
---
${populatedContent}
---

Recent conversation:
${conversationContext || 'No previous messages'}

Guest: ${conversation.guest.name}
${conversation.guest.previousStays ? `Returning guest (${conversation.guest.previousStays} previous stays)` : 'First-time guest'}

Personalize this template to sound natural and appropriate for this specific guest and conversation.
Return ONLY the personalized message, no explanation.`;

    const anthropicPayload = {
      model: 'claude-sonnet-4-6',
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 500,
      temperature: 0.7,
    };

    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/ai-proxy/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        payload: anthropicPayload,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const personalizedContent = data.content?.[0]?.text || populatedContent;

    return {
      originalTemplate: template,
      personalizedContent: personalizedContent.trim(),
      variablesUsed: variableValues,
      aiAdjustments: ['Personalized based on conversation context', 'Adjusted for host style'],
      confidence: 92,
    };
  } catch (error) {
    console.error('[SmartTemplates] Personalization error:', error);
    return {
      originalTemplate: template,
      personalizedContent: populatedContent,
      variablesUsed: variableValues,
      aiAdjustments: ['AI personalization failed - using base template'],
      confidence: 80,
    };
  }
}

// Find applicable templates based on trigger condition
export function findMatchingTemplates(
  templates: SmartTemplate[],
  trigger: TemplateTrigger,
  messageContent?: string,
  propertyId?: string
): SmartTemplate[] {
  return templates.filter((template) => {
    // Check if active
    if (!template.isActive) return false;

    // Check trigger type
    if (template.trigger !== trigger) return false;

    // Check property match (null = all properties)
    if (template.propertyId && template.propertyId !== propertyId) return false;

    // For on_message triggers, check condition
    if (trigger === 'on_message' && template.triggerCondition && messageContent) {
      const condition = template.triggerCondition.toLowerCase();
      const message = messageContent.toLowerCase();

      // Simple keyword matching
      if (condition.includes('early check-in') && !message.match(/early|earlier|before.*check/i)) {
        return false;
      }
      if (condition.includes('late check-out') && !message.match(/late|later|extend|stay longer/i)) {
        return false;
      }
      if (condition.includes('parking') && !message.includes('park')) {
        return false;
      }
    }

    return true;
  });
}

// Generate post-stay thank you with AI
export async function generatePostStayThankYou(
  conversation: Conversation,
  propertyKnowledge?: PropertyKnowledge,
  hostName?: string,
  hostStyleProfile?: HostStyleProfile
): Promise<string> {
  try {
    // Gather stay details from conversation
    const positiveTopics: string[] = [];
    const issues: string[] = [];

    conversation.messages.forEach((msg) => {
      if (msg.sender === 'guest') {
        const content = msg.content.toLowerCase();
        if (content.match(/love|amazing|great|wonderful|beautiful|perfect|clean|comfortable/)) {
          positiveTopics.push(msg.content);
        }
        if (content.match(/problem|issue|broken|dirty|complaint/)) {
          issues.push(msg.content);
        }
      }
    });

    let systemPrompt = `You are helping write a personalized thank-you message for a guest who just checked out of a vacation rental.

Create a warm, genuine thank-you note that:
1. Thanks them for staying
2. References specific positive moments from their stay (if any mentioned)
3. Acknowledges if there were any issues and how they were handled
4. Encourages them to return
5. Gently requests a review

Keep it concise (3-4 sentences) and genuine.`;

    if (hostStyleProfile && hostStyleProfile.samplesAnalyzed > 5) {
      systemPrompt += `\n\nHOST'S STYLE:
${generateStyleInstructions(hostStyleProfile)}`;
    }

    const userPrompt = `Guest: ${conversation.guest.name}
Property: ${conversation.property.name}
Stay dates: ${conversation.checkInDate ? new Date(conversation.checkInDate).toLocaleDateString() : 'N/A'} - ${conversation.checkOutDate ? new Date(conversation.checkOutDate).toLocaleDateString() : 'N/A'}

${positiveTopics.length > 0 ? `Positive moments mentioned: ${positiveTopics.slice(0, 2).join('; ')}` : 'No specific positives mentioned'}
${issues.length > 0 ? `Issues during stay: ${issues.slice(0, 2).join('; ')}` : 'No issues reported'}
${conversation.guest.previousStays ? `Returning guest (${conversation.guest.previousStays} stays)` : 'First-time guest'}

Host name: ${hostName || 'The Host'}

Write a personalized thank-you message. Return ONLY the message.`;

    const anthropicPayload = {
      model: 'claude-sonnet-4-6',
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 300,
      temperature: 0.8,
    };

    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/ai-proxy/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        payload: anthropicPayload,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  } catch (error) {
    console.error('[SmartTemplates] Post-stay generation error:', error);
    return `Thank you so much for staying at ${conversation.property.name}, ${conversation.guest.name}! We hope you had a wonderful experience and would love to host you again. Safe travels!`;
  }
}
