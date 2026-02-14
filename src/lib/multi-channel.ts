// Multi-Channel Messaging Service
// Supports WhatsApp, SMS, Email, and OTA platforms (Airbnb, Vrbo, Booking.com)

export type ChannelType = 'hostaway' | 'whatsapp' | 'sms' | 'email' | 'airbnb' | 'vrbo' | 'booking';

export interface ChannelConfig {
  id: string;
  type: ChannelType;
  name: string;
  icon: string;
  color: string;
  isConnected: boolean;
  supportsRichText: boolean;
  supportsMedia: boolean;
  maxMessageLength?: number;
  credentials?: Record<string, string>;
}

export interface ChannelMessage {
  id: string;
  channelType: ChannelType;
  channelId: string;
  conversationId: string;
  content: string;
  richContent?: {
    html?: string;
    markdown?: string;
  };
  attachments?: Attachment[];
  sender: 'guest' | 'host';
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  metadata?: Record<string, unknown>;
}

export interface Attachment {
  id: string;
  type: 'image' | 'pdf' | 'document' | 'video' | 'audio';
  name: string;
  url: string;
  mimeType: string;
  size: number;
  thumbnailUrl?: string;
}

// Channel configurations
export const channelConfigs: Record<ChannelType, Omit<ChannelConfig, 'id' | 'isConnected' | 'credentials'>> = {
  hostaway: {
    type: 'hostaway',
    name: 'Hostaway',
    icon: 'home',
    color: '#14B8A6',
    supportsRichText: false,
    supportsMedia: true,
    maxMessageLength: 5000,
  },
  whatsapp: {
    type: 'whatsapp',
    name: 'WhatsApp',
    icon: 'message-circle',
    color: '#25D366',
    supportsRichText: true,
    supportsMedia: true,
    maxMessageLength: 4096,
  },
  sms: {
    type: 'sms',
    name: 'SMS',
    icon: 'smartphone',
    color: '#3B82F6',
    supportsRichText: false,
    supportsMedia: false,
    maxMessageLength: 160,
  },
  email: {
    type: 'email',
    name: 'Email',
    icon: 'mail',
    color: '#6366F1',
    supportsRichText: true,
    supportsMedia: true,
  },
  airbnb: {
    type: 'airbnb',
    name: 'Airbnb',
    icon: 'home',
    color: '#FF5A5F',
    supportsRichText: false,
    supportsMedia: true,
    maxMessageLength: 5000,
  },
  vrbo: {
    type: 'vrbo',
    name: 'Vrbo',
    icon: 'home',
    color: '#0A3761',
    supportsRichText: false,
    supportsMedia: true,
    maxMessageLength: 5000,
  },
  booking: {
    type: 'booking',
    name: 'Booking.com',
    icon: 'globe',
    color: '#003580',
    supportsRichText: false,
    supportsMedia: true,
    maxMessageLength: 5000,
  },
};

// Format message for specific channel
export function formatMessageForChannel(
  content: string,
  channelType: ChannelType,
  richContent?: { html?: string; markdown?: string }
): string {
  const config = channelConfigs[channelType];

  // Handle rich text for supported channels
  if (config.supportsRichText && richContent) {
    if (channelType === 'whatsapp' && richContent.markdown) {
      return formatWhatsAppMessage(content, richContent.markdown);
    }
    if (channelType === 'email' && richContent.html) {
      return richContent.html;
    }
  }

  // Truncate for SMS
  if (channelType === 'sms' && content.length > 160) {
    return content.substring(0, 157) + '...';
  }

  // Enforce max length
  if (config.maxMessageLength && content.length > config.maxMessageLength) {
    return content.substring(0, config.maxMessageLength - 3) + '...';
  }

  return content;
}

// Format for WhatsApp (supports bold, italic, strikethrough, monospace)
function formatWhatsAppMessage(content: string, markdown: string): string {
  // Convert markdown to WhatsApp format
  let formatted = markdown;

  // Bold: **text** or __text__ -> *text*
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '*$1*');
  formatted = formatted.replace(/__(.*?)__/g, '*$1*');

  // Italic: *text* or _text_ (single) -> _text_
  // Be careful not to conflict with bold
  formatted = formatted.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '_$1_');

  // Strikethrough: ~~text~~ -> ~text~
  formatted = formatted.replace(/~~(.*?)~~/g, '~$1~');

  // Code: `text` -> ```text```
  formatted = formatted.replace(/`([^`]+)`/g, '```$1```');

  return formatted;
}

// Get channel icon component name
export function getChannelIcon(channelType: ChannelType): string {
  return channelConfigs[channelType]?.icon || 'message-circle';
}

// Get channel color
export function getChannelColor(channelType: ChannelType): string {
  return channelConfigs[channelType]?.color || '#64748B';
}

// Check if channel supports feature
export function channelSupportsMedia(channelType: ChannelType): boolean {
  return channelConfigs[channelType]?.supportsMedia || false;
}

export function channelSupportsRichText(channelType: ChannelType): boolean {
  return channelConfigs[channelType]?.supportsRichText || false;
}

// Validate attachment for channel
export function validateAttachment(attachment: Attachment, channelType: ChannelType): { valid: boolean; error?: string } {
  const config = channelConfigs[channelType];

  if (!config.supportsMedia) {
    return { valid: false, error: `${config.name} does not support attachments` };
  }

  // Size limits (in bytes)
  const sizeLimits: Record<ChannelType, number> = {
    hostaway: 10 * 1024 * 1024, // 10MB
    whatsapp: 16 * 1024 * 1024, // 16MB
    sms: 0, // No media
    email: 25 * 1024 * 1024, // 25MB
    airbnb: 10 * 1024 * 1024,
    vrbo: 10 * 1024 * 1024,
    booking: 10 * 1024 * 1024,
  };

  if (attachment.size > sizeLimits[channelType]) {
    const maxMB = sizeLimits[channelType] / (1024 * 1024);
    return { valid: false, error: `File too large. Max size for ${config.name} is ${maxMB}MB` };
  }

  // Type restrictions for WhatsApp
  if (channelType === 'whatsapp') {
    const allowedTypes = ['image', 'pdf', 'document', 'video', 'audio'];
    if (!allowedTypes.includes(attachment.type)) {
      return { valid: false, error: 'Unsupported file type for WhatsApp' };
    }
  }

  return { valid: true };
}

// Unified inbox message type
export interface UnifiedInboxMessage {
  id: string;
  conversationId: string;
  guestName: string;
  guestAvatar?: string;
  propertyName: string;
  propertyId: string;
  channel: ChannelType;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  status: 'active' | 'archived' | 'urgent';
  sentiment?: 'positive' | 'neutral' | 'negative' | 'urgent';
  hasAiDraft: boolean;
  checkInDate?: Date;
  checkOutDate?: Date;
}

// Convert platform-specific message to unified format
export function normalizeChannelMessage(
  rawMessage: Record<string, unknown>,
  channelType: ChannelType
): Partial<ChannelMessage> {
  switch (channelType) {
    case 'airbnb':
      return {
        content: rawMessage.message as string || '',
        sender: rawMessage.sender_type === 'host' ? 'host' : 'guest',
        timestamp: new Date(rawMessage.created_at as string),
      };
    case 'vrbo':
      return {
        content: rawMessage.body as string || '',
        sender: rawMessage.from_host ? 'host' : 'guest',
        timestamp: new Date(rawMessage.sent_at as string),
      };
    case 'booking':
      return {
        content: rawMessage.text as string || '',
        sender: rawMessage.sender === 'property' ? 'host' : 'guest',
        timestamp: new Date(rawMessage.created as string),
      };
    case 'whatsapp':
      return {
        content: rawMessage.body as string || '',
        sender: rawMessage.from_me ? 'host' : 'guest',
        timestamp: new Date((rawMessage.timestamp as number) * 1000),
      };
    default:
      return {
        content: rawMessage.content as string || rawMessage.message as string || '',
        sender: rawMessage.sender as 'guest' | 'host' || 'guest',
        timestamp: new Date(rawMessage.timestamp as string || rawMessage.created_at as string),
      };
  }
}
