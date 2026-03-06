/**
 * Hostaway PMS Adapter
 *
 * Implements PMSAdapter interface for Hostaway API.
 */

import type {
  UnifiedProperty,
  UnifiedConversation,
  UnifiedGuest,
  UnifiedMessage,
} from '../lib/types.js';
import type { PMSAdapter, PMSCredentials } from './pms-adapter.js';
import { registerAdapter } from './pms-adapter.js';

const HOSTAWAY_API_BASE = 'https://api.hostaway.com/v1';

async function getToken(accountId: string, apiKey: string): Promise<string> {
  const tokenResponse = await fetch(`${HOSTAWAY_API_BASE}/accessTokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: accountId,
      client_secret: apiKey,
      scope: 'general',
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Hostaway token request failed: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json() as { access_token?: string };
  if (!tokenData.access_token) {
    throw new Error('Hostaway token response missing access_token');
  }

  return tokenData.access_token;
}

function requireApiKey(credentials: PMSCredentials): string {
  if (!credentials.apiKey) {
    throw new Error('No Hostaway API key in credentials');
  }
  return credentials.apiKey;
}

function normalizePlatform(
  channelName?: string,
  source?: string,
  channelId?: number
): 'airbnb' | 'booking' | 'vrbo' | 'direct' | 'unknown' {
  const name = (channelName || '').toLowerCase();
  const src = (source || '').toLowerCase();

  if (channelId === 2000 || name.includes('airbnb') || src.includes('airbnb')) return 'airbnb';
  if (channelId === 2002 || name.includes('booking') || src.includes('booking')) return 'booking';
  if (channelId === 2016 || name.includes('vrbo') || name.includes('homeaway') || src.includes('vrbo') || src.includes('homeaway')) return 'vrbo';
  return 'direct';
}

function mapConversation(conv: {
  id: number;
  listingMapId?: number;
  listingName?: string;
  guestName?: string;
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string;
  guestPhone?: string;
  channelName?: string;
  channelId?: number;
  source?: string;
  arrivalDate?: string;
  departureDate?: string;
  isArchived?: boolean;
}): UnifiedConversation {
  const guestName = conv.guestName || `${conv.guestFirstName || ''} ${conv.guestLastName || ''}`.trim() || 'Guest';
  const propertyId = String(conv.listingMapId || 'unknown');

  const property: UnifiedProperty = {
    id: propertyId,
    externalId: propertyId,
    pmsProvider: 'hostaway',
    name: conv.listingName || 'Unknown Property',
    address: null,
    imageUrl: null,
    bedroomCount: 0,
    bathroomCount: 0,
    maxGuests: 0,
  };

  const guest: UnifiedGuest = {
    id: String(conv.id),
    externalId: String(conv.id),
    name: guestName,
    email: conv.guestEmail || null,
    phone: conv.guestPhone || null,
    language: null,
  };

  return {
    id: String(conv.id),
    externalId: String(conv.id),
    pmsProvider: 'hostaway',
    property,
    guest,
    messages: [],
    status: conv.isArchived ? 'archived' : 'active',
    checkInDate: conv.arrivalDate ? new Date(conv.arrivalDate) : null,
    checkOutDate: conv.departureDate ? new Date(conv.departureDate) : null,
    platform: normalizePlatform(conv.channelName, conv.source, conv.channelId),
  };
}

const hostawayAdapter: PMSAdapter = {
  provider: 'hostaway',

  async testConnection(credentials: PMSCredentials): Promise<boolean> {
    try {
      const apiKey = requireApiKey(credentials);
      await getToken(credentials.accountId, apiKey);
      return true;
    } catch {
      return false;
    }
  },

  async getProperties(credentials: PMSCredentials): Promise<UnifiedProperty[]> {
    const apiKey = requireApiKey(credentials);
    const token = await getToken(credentials.accountId, apiKey);

    const response = await fetch(`${HOSTAWAY_API_BASE}/listings?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Hostaway listings error: ${response.status}`);

    const data = await response.json() as {
      result?: {
        id: number;
        name?: string;
        address?: string;
        city?: string;
        state?: string;
        thumbnailUrl?: string | null;
        bedrooms?: number;
        bathrooms?: number;
        personCapacity?: number;
      }[];
    };

    return (data.result || []).map((l) => ({
      id: String(l.id),
      externalId: String(l.id),
      pmsProvider: 'hostaway' as const,
      name: l.name || 'Untitled',
      address: [l.address, l.city, l.state].filter(Boolean).join(', ') || null,
      imageUrl: l.thumbnailUrl || null,
      bedroomCount: l.bedrooms || 0,
      bathroomCount: l.bathrooms || 0,
      maxGuests: l.personCapacity || 0,
    }));
  },

  async getConversations(
    credentials: PMSCredentials,
    options?: { since?: Date; propertyId?: string; limit?: number }
  ): Promise<UnifiedConversation[]> {
    const apiKey = requireApiKey(credentials);
    const token = await getToken(credentials.accountId, apiKey);
    const limit = options?.limit || 50;

    const response = await fetch(
      `${HOSTAWAY_API_BASE}/conversations?limit=${limit}&includeResources=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) throw new Error(`Hostaway conversations error: ${response.status}`);

    const data = await response.json() as {
      result?: {
        id: number;
        listingMapId?: number;
        listingName?: string;
        guestName?: string;
        guestFirstName?: string;
        guestLastName?: string;
        guestEmail?: string;
        guestPhone?: string;
        channelName?: string;
        channelId?: number;
        source?: string;
        arrivalDate?: string;
        departureDate?: string;
        isArchived?: boolean;
      }[];
    };

    return (data.result || []).map(mapConversation);
  },

  async getConversation(
    credentials: PMSCredentials,
    conversationId: string
  ): Promise<UnifiedConversation | null> {
    const conversations = await this.getConversations(credentials, { limit: 100 });
    return conversations.find((c) => c.id === conversationId) || null;
  },

  async sendMessage(
    credentials: PMSCredentials,
    conversationId: string,
    content: string
  ): Promise<UnifiedMessage> {
    const apiKey = requireApiKey(credentials);
    const token = await getToken(credentials.accountId, apiKey);

    const response = await fetch(
      `${HOSTAWAY_API_BASE}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: content }),
      }
    );

    if (!response.ok) throw new Error(`Hostaway send failed: ${response.status}`);

    const data = await response.json() as {
      result?: {
        id?: number;
        body?: string;
        insertedOn?: string;
        sentOn?: string;
      };
    };

    const sent = data.result || {};
    const sentAt = sent.sentOn || sent.insertedOn;

    return {
      id: String(sent.id || `hostaway-${Date.now()}`),
      externalId: String(sent.id || `hostaway-${Date.now()}`),
      conversationId,
      sender: 'host',
      content: sent.body || content,
      sentAt: sentAt ? new Date(sentAt) : new Date(),
      isRead: true,
    };
  },
};

registerAdapter(hostawayAdapter);

export { hostawayAdapter };
