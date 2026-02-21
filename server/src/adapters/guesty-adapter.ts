/**
 * Guesty PMS Adapter
 * 
 * 📁 server/src/adapters/guesty-adapter.ts
 * Purpose: Implements PMSAdapter interface for Guesty Open API v1
 * Depends on: adapters/pms-adapter.ts, lib/types.ts
 * Used by: Route handlers, autopilot auto-send
 */

import type {
  UnifiedProperty,
  UnifiedConversation,
  UnifiedMessage,
  UnifiedGuest,
} from '../lib/types.js';
import type { PMSAdapter, PMSCredentials } from './pms-adapter.js';
import { registerAdapter } from './pms-adapter.js';

const GUESTY_API_BASE = 'https://open-api.guesty.com/v1';

async function guestyFetch(
  path: string,
  token: string,
  method: string = 'GET',
  body?: unknown
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  if (body) headers['Content-Type'] = 'application/json';

  return fetch(`${GUESTY_API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const guestyAdapter: PMSAdapter = {
  provider: 'guesty',

  async testConnection(credentials: PMSCredentials): Promise<boolean> {
    try {
      const token = credentials.apiKey || credentials.oauthToken;
      if (!token) return false;

      const res = await guestyFetch('/listings?limit=1', token);
      return res.ok;
    } catch {
      return false;
    }
  },

  async getProperties(credentials: PMSCredentials): Promise<UnifiedProperty[]> {
    const token = credentials.apiKey || credentials.oauthToken;
    if (!token) throw new Error('No Guesty API token');

    const res = await guestyFetch('/listings?limit=100', token);
    if (!res.ok) throw new Error(`Guesty API error: ${res.status}`);

    const data = await res.json() as {
      results: {
        _id: string;
        title: string;
        nickname?: string;
        address?: { full?: string };
        picture?: { thumbnail?: string };
        bedrooms?: number;
        bathrooms?: number;
        accommodates?: number;
      }[];
    };

    return (data.results || []).map((listing) => ({
      id: listing._id,
      externalId: listing._id,
      pmsProvider: 'guesty' as const,
      name: listing.title || listing.nickname || 'Untitled',
      address: listing.address?.full || null,
      imageUrl: listing.picture?.thumbnail || null,
      bedroomCount: listing.bedrooms || 0,
      bathroomCount: listing.bathrooms || 0,
      maxGuests: listing.accommodates || 0,
    }));
  },

  async getConversations(
    credentials: PMSCredentials,
    options?: { since?: Date; propertyId?: string; limit?: number }
  ): Promise<UnifiedConversation[]> {
    const token = credentials.apiKey || credentials.oauthToken;
    if (!token) throw new Error('No Guesty API token');

    const limit = options?.limit || 50;
    const url = `/inbox/conversations?limit=${limit}&sort=-lastMessage.sentAt`;

    const res = await guestyFetch(url, token);
    if (!res.ok) throw new Error(`Guesty API error: ${res.status}`);

    const data = await res.json() as {
      results: {
        _id: string;
        guest?: { _id?: string; fullName?: string; email?: string; phone?: string };
        listing?: {
          _id?: string;
          title?: string;
          address?: { full?: string };
          picture?: { thumbnail?: string };
          bedrooms?: number;
          bathrooms?: number;
          accommodates?: number;
        };
        lastMessage?: { body?: string; sentAt?: string };
        messages?: {
          _id: string;
          body: string;
          sentAt?: string;
          source?: string;
        }[];
        reservation?: {
          checkIn?: string;
          checkOut?: string;
          source?: string;
        };
      }[];
    };

    return (data.results || []).map((conv) => {
      const property: UnifiedProperty = {
        id: conv.listing?._id || 'unknown',
        externalId: conv.listing?._id || 'unknown',
        pmsProvider: 'guesty',
        name: conv.listing?.title || 'Unknown Property',
        address: conv.listing?.address?.full || null,
        imageUrl: conv.listing?.picture?.thumbnail || null,
        bedroomCount: conv.listing?.bedrooms || 0,
        bathroomCount: conv.listing?.bathrooms || 0,
        maxGuests: conv.listing?.accommodates || 0,
      };

      const guest: UnifiedGuest = {
        id: conv.guest?._id || 'unknown',
        externalId: conv.guest?._id || 'unknown',
        name: conv.guest?.fullName || 'Guest',
        email: conv.guest?.email || null,
        phone: conv.guest?.phone || null,
        language: null,
      };

      const messages: UnifiedMessage[] = (conv.messages || []).map((m) => ({
        id: m._id,
        externalId: m._id,
        conversationId: conv._id,
        sender: (m.source === 'host' ? 'host' : 'guest') as 'host' | 'guest',
        content: m.body,
        sentAt: m.sentAt ? new Date(m.sentAt) : new Date(),
        isRead: true,
      }));

      const platformMap: Record<string, 'airbnb' | 'booking' | 'vrbo' | 'direct' | 'unknown'> = {
        airbnb: 'airbnb',
        bookingCom: 'booking',
        vrbo: 'vrbo',
        direct: 'direct',
      };

      return {
        id: conv._id,
        externalId: conv._id,
        pmsProvider: 'guesty' as const,
        property,
        guest,
        messages,
        status: 'active' as const,
        checkInDate: conv.reservation?.checkIn ? new Date(conv.reservation.checkIn) : null,
        checkOutDate: conv.reservation?.checkOut ? new Date(conv.reservation.checkOut) : null,
        platform: platformMap[conv.reservation?.source || ''] || 'unknown' as const,
      };
    });
  },

  async getConversation(
    credentials: PMSCredentials,
    conversationId: string
  ): Promise<UnifiedConversation | null> {
    const token = credentials.apiKey || credentials.oauthToken;
    if (!token) throw new Error('No Guesty API token');

    const res = await guestyFetch(`/inbox/conversations/${conversationId}`, token);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Guesty API error: ${res.status}`);
    }

    const conv = await res.json() as {
      _id: string;
      guest?: { _id?: string; fullName?: string; email?: string; phone?: string };
      listing?: {
        _id?: string;
        title?: string;
        address?: { full?: string };
        picture?: { thumbnail?: string };
        bedrooms?: number;
        bathrooms?: number;
        accommodates?: number;
      };
      lastMessage?: { body?: string; sentAt?: string };
      messages?: {
        _id: string;
        body: string;
        sentAt?: string;
        source?: string;
      }[];
      reservation?: {
        checkIn?: string;
        checkOut?: string;
        source?: string;
      };
    };

    const property: UnifiedProperty = {
      id: conv.listing?._id || 'unknown',
      externalId: conv.listing?._id || 'unknown',
      pmsProvider: 'guesty',
      name: conv.listing?.title || 'Unknown Property',
      address: conv.listing?.address?.full || null,
      imageUrl: conv.listing?.picture?.thumbnail || null,
      bedroomCount: conv.listing?.bedrooms || 0,
      bathroomCount: conv.listing?.bathrooms || 0,
      maxGuests: conv.listing?.accommodates || 0,
    };

    const guest: UnifiedGuest = {
      id: conv.guest?._id || 'unknown',
      externalId: conv.guest?._id || 'unknown',
      name: conv.guest?.fullName || 'Guest',
      email: conv.guest?.email || null,
      phone: conv.guest?.phone || null,
      language: null,
    };

    const messages: UnifiedMessage[] = (conv.messages || []).map((m) => ({
      id: m._id,
      externalId: m._id,
      conversationId: conv._id,
      sender: (m.source === 'host' ? 'host' : 'guest') as 'host' | 'guest',
      content: m.body,
      sentAt: m.sentAt ? new Date(m.sentAt) : new Date(),
      isRead: true,
    }));

    const platformMap: Record<string, 'airbnb' | 'booking' | 'vrbo' | 'direct' | 'unknown'> = {
      airbnb: 'airbnb',
      bookingCom: 'booking',
      vrbo: 'vrbo',
      direct: 'direct',
    };

    return {
      id: conv._id,
      externalId: conv._id,
      pmsProvider: 'guesty',
      property,
      guest,
      messages,
      status: 'active' as const,
      checkInDate: conv.reservation?.checkIn ? new Date(conv.reservation.checkIn) : null,
      checkOutDate: conv.reservation?.checkOut ? new Date(conv.reservation.checkOut) : null,
      platform: platformMap[conv.reservation?.source || ''] || 'unknown' as const,
    };
  },

  async sendMessage(
    credentials: PMSCredentials,
    conversationId: string,
    content: string
  ): Promise<UnifiedMessage> {
    const token = credentials.apiKey || credentials.oauthToken;
    if (!token) throw new Error('No Guesty API token');

    const res = await guestyFetch(
      `/inbox/conversations/${conversationId}/messages`,
      token,
      'POST',
      { body: content }
    );

    if (!res.ok) throw new Error(`Guesty send failed: ${res.status}`);

    const msg = await res.json() as { _id?: string; body?: string; sentAt?: string };

    return {
      id: msg._id || `guesty-${Date.now()}`,
      externalId: msg._id || `guesty-${Date.now()}`,
      conversationId,
      sender: 'host',
      content: msg.body || content,
      sentAt: msg.sentAt ? new Date(msg.sentAt) : new Date(),
      isRead: true,
    };
  },
};

// Self-register
registerAdapter(guestyAdapter);

export { guestyAdapter };
