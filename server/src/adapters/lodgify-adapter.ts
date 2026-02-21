/**
 * Lodgify PMS Adapter
 * 
 * 📁 server/src/adapters/lodgify-adapter.ts
 * Purpose: Implements PMSAdapter interface for Lodgify REST API v2
 * Depends on: adapters/pms-adapter.ts, lib/types.ts
 * Used by: Route handlers, autopilot auto-send
 * 
 * API docs: https://docs.lodgify.com/reference
 * Auth: API key via X-ApiKey header
 */

import type {
  UnifiedProperty,
  UnifiedConversation,
  UnifiedMessage,
  UnifiedGuest,
} from '../lib/types.js';
import type { PMSAdapter, PMSCredentials } from './pms-adapter.js';
import { registerAdapter } from './pms-adapter.js';

const LODGIFY_API_BASE = 'https://api.lodgify.com/v2';

async function lodgifyFetch(
  path: string,
  apiKey: string,
  method: string = 'GET',
  body?: unknown
): Promise<Response> {
  const headers: Record<string, string> = {
    'X-ApiKey': apiKey,
    Accept: 'application/json',
  };
  if (body) headers['Content-Type'] = 'application/json';

  return fetch(`${LODGIFY_API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const lodgifyAdapter: PMSAdapter = {
  provider: 'lodgify',

  async testConnection(credentials: PMSCredentials): Promise<boolean> {
    try {
      const apiKey = credentials.apiKey;
      if (!apiKey) return false;

      const res = await lodgifyFetch('/properties?size=1', apiKey);
      return res.ok;
    } catch {
      return false;
    }
  },

  async getProperties(credentials: PMSCredentials): Promise<UnifiedProperty[]> {
    const apiKey = credentials.apiKey;
    if (!apiKey) throw new Error('No Lodgify API key');

    const res = await lodgifyFetch('/properties?size=100', apiKey);
    if (!res.ok) throw new Error(`Lodgify API error: ${res.status}`);

    const data = await res.json() as {
      items?: {
        id: number;
        name: string;
        address?: string;
        image_url?: string;
        bedrooms?: number;
        bathrooms?: number;
        max_guests?: number;
      }[];
    };

    return (data.items || []).map((prop) => ({
      id: String(prop.id),
      externalId: String(prop.id),
      pmsProvider: 'lodgify' as const,
      name: prop.name || 'Untitled',
      address: prop.address || null,
      imageUrl: prop.image_url || null,
      bedroomCount: prop.bedrooms || 0,
      bathroomCount: prop.bathrooms || 0,
      maxGuests: prop.max_guests || 0,
    }));
  },

  async getConversations(
    credentials: PMSCredentials,
    options?: { since?: Date; propertyId?: string; limit?: number }
  ): Promise<UnifiedConversation[]> {
    const apiKey = credentials.apiKey;
    if (!apiKey) throw new Error('No Lodgify API key');

    const limit = options?.limit || 50;
    let url = `/reservation/bookings?size=${limit}&sort=-arrival`;
    if (options?.propertyId) {
      url += `&property_id=${options.propertyId}`;
    }

    const res = await lodgifyFetch(url, apiKey);
    if (!res.ok) throw new Error(`Lodgify API error: ${res.status}`);

    const data = await res.json() as {
      items?: {
        id: number;
        guest?: {
          id?: number;
          name?: string;
          email?: string;
          phone?: string;
        };
        property_id?: number;
        property_name?: string;
        property_image?: string;
        rooms?: { bedrooms?: number; bathrooms?: number }[];
        arrival?: string;
        departure?: string;
        source?: string;
        messages?: {
          id: number;
          body: string;
          created_at?: string;
          type?: string; // 'host' | 'guest'
        }[];
      }[];
    };

    return (data.items || []).map((booking) => {
      const property: UnifiedProperty = {
        id: String(booking.property_id || 'unknown'),
        externalId: String(booking.property_id || 'unknown'),
        pmsProvider: 'lodgify',
        name: booking.property_name || 'Unknown Property',
        address: null,
        imageUrl: booking.property_image || null,
        bedroomCount: booking.rooms?.[0]?.bedrooms || 0,
        bathroomCount: booking.rooms?.[0]?.bathrooms || 0,
        maxGuests: 0,
      };

      const guest: UnifiedGuest = {
        id: String(booking.guest?.id || 'unknown'),
        externalId: String(booking.guest?.id || 'unknown'),
        name: booking.guest?.name || 'Guest',
        email: booking.guest?.email || null,
        phone: booking.guest?.phone || null,
        language: null,
      };

      const messages: UnifiedMessage[] = (booking.messages || []).map((m) => ({
        id: String(m.id),
        externalId: String(m.id),
        conversationId: String(booking.id),
        sender: (m.type === 'host' ? 'host' : 'guest') as 'host' | 'guest',
        content: m.body,
        sentAt: m.created_at ? new Date(m.created_at) : new Date(),
        isRead: true,
      }));

      const platformMap: Record<string, 'airbnb' | 'booking' | 'vrbo' | 'direct' | 'unknown'> = {
        Airbnb: 'airbnb',
        'Booking.com': 'booking',
        Vrbo: 'vrbo',
        Manual: 'direct',
        Direct: 'direct',
      };

      return {
        id: String(booking.id),
        externalId: String(booking.id),
        pmsProvider: 'lodgify' as const,
        property,
        guest,
        messages,
        status: 'active' as const,
        checkInDate: booking.arrival ? new Date(booking.arrival) : null,
        checkOutDate: booking.departure ? new Date(booking.departure) : null,
        platform: platformMap[booking.source || ''] || ('unknown' as const),
      };
    });
  },

  async getConversation(
    credentials: PMSCredentials,
    conversationId: string
  ): Promise<UnifiedConversation | null> {
    const apiKey = credentials.apiKey;
    if (!apiKey) throw new Error('No Lodgify API key');

    const res = await lodgifyFetch(`/reservation/bookings/${conversationId}`, apiKey);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Lodgify API error: ${res.status}`);
    }

    const booking = await res.json() as {
      id: number;
      guest?: { id?: number; name?: string; email?: string; phone?: string };
      property_id?: number;
      property_name?: string;
      property_image?: string;
      rooms?: { bedrooms?: number; bathrooms?: number }[];
      arrival?: string;
      departure?: string;
      source?: string;
      messages?: {
        id: number;
        body: string;
        created_at?: string;
        type?: string;
      }[];
    };

    const property: UnifiedProperty = {
      id: String(booking.property_id || 'unknown'),
      externalId: String(booking.property_id || 'unknown'),
      pmsProvider: 'lodgify',
      name: booking.property_name || 'Unknown Property',
      address: null,
      imageUrl: booking.property_image || null,
      bedroomCount: booking.rooms?.[0]?.bedrooms || 0,
      bathroomCount: booking.rooms?.[0]?.bathrooms || 0,
      maxGuests: 0,
    };

    const guest: UnifiedGuest = {
      id: String(booking.guest?.id || 'unknown'),
      externalId: String(booking.guest?.id || 'unknown'),
      name: booking.guest?.name || 'Guest',
      email: booking.guest?.email || null,
      phone: booking.guest?.phone || null,
      language: null,
    };

    const messages: UnifiedMessage[] = (booking.messages || []).map((m) => ({
      id: String(m.id),
      externalId: String(m.id),
      conversationId: String(booking.id),
      sender: (m.type === 'host' ? 'host' : 'guest') as 'host' | 'guest',
      content: m.body,
      sentAt: m.created_at ? new Date(m.created_at) : new Date(),
      isRead: true,
    }));

    const platformMap: Record<string, 'airbnb' | 'booking' | 'vrbo' | 'direct' | 'unknown'> = {
      Airbnb: 'airbnb',
      'Booking.com': 'booking',
      Vrbo: 'vrbo',
      Manual: 'direct',
      Direct: 'direct',
    };

    return {
      id: String(booking.id),
      externalId: String(booking.id),
      pmsProvider: 'lodgify',
      property,
      guest,
      messages,
      status: 'active' as const,
      checkInDate: booking.arrival ? new Date(booking.arrival) : null,
      checkOutDate: booking.departure ? new Date(booking.departure) : null,
      platform: platformMap[booking.source || ''] || ('unknown' as const),
    };
  },

  async sendMessage(
    credentials: PMSCredentials,
    conversationId: string,
    content: string
  ): Promise<UnifiedMessage> {
    const apiKey = credentials.apiKey;
    if (!apiKey) throw new Error('No Lodgify API key');

    const res = await lodgifyFetch(
      `/reservation/bookings/${conversationId}/messages`,
      apiKey,
      'POST',
      { body: content }
    );

    if (!res.ok) throw new Error(`Lodgify send failed: ${res.status}`);

    const msg = await res.json() as { id?: number; body?: string; created_at?: string };

    return {
      id: String(msg.id || `lodgify-${Date.now()}`),
      externalId: String(msg.id || `lodgify-${Date.now()}`),
      conversationId,
      sender: 'host',
      content: msg.body || content,
      sentAt: msg.created_at ? new Date(msg.created_at) : new Date(),
      isRead: true,
    };
  },
};

// Self-register
registerAdapter(lodgifyAdapter);

export { lodgifyAdapter };
