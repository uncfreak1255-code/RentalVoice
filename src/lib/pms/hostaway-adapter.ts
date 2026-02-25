/**
 * Hostaway PMS Adapter
 * 
 * Wraps the existing hostaway.ts functions into the universal PMSProvider interface.
 * No logic changes — just mapping existing functions to the unified API.
 */

import type { Property, Message, Conversation } from '../store';
import type { PMSProvider, PMSConnectionStatus, PMSListingDetail, PMSReservation, PMSProviderInfo } from './pms-provider';
import { PMS_PROVIDERS } from './pms-provider';
import {
  initializeConnection,
  restoreConnection as hostawayRestore,
  disconnectHostaway,
  validateCredentials as hostawayValidate,
  fetchListings,
  fetchListingDetail as hostawayFetchDetail,
  fetchAllConversations,
  fetchMessages as hostawayFetchMessages,
  sendMessage as hostawaySendMessage,
  fetchReservation as hostawayFetchReservation,
  extractGuestName,
} from '../hostaway';
import type { HostawayConversation } from '../hostaway';
import { convertListingToProperty, convertHostawayMessage, getChannelPlatform } from '../hostaway-utils';

// Store credentials in the adapter so they persist across calls
let storedAccountId: string | null = null;
let storedApiKey: string | null = null;

/** Convert a Hostaway conversation to an app Conversation */
function convertConversation(conv: HostawayConversation, properties: Property[]): Conversation {
  const guestName = extractGuestName(conv);
  const platform = getChannelPlatform(conv.channelName, conv.channelId, conv.source);
  const property = properties.find(p => p.id === String(conv.listingMapId));
  
  const lastMsg = conv.lastMessage;
  const lastMessage: Message | undefined = lastMsg ? {
    id: `last-${conv.id}`,
    conversationId: String(conv.id),
    content: typeof lastMsg === 'string' ? lastMsg : '',
    sender: 'guest' as const,
    timestamp: new Date(conv.lastMessageSentAt || Date.now()),
    isRead: true,
  } : undefined;

  return {
    id: String(conv.id),
    guest: {
      id: String(conv.guest?.id || conv.id),
      name: guestName,
      email: conv.guestEmail,
      phone: conv.guestPhone,
      avatar: conv.guestPicture,
    },
    property: property || {
      id: String(conv.listingMapId),
      name: 'Unknown Property',
      address: '',
    },
    messages: [],
    lastMessage,
    unreadCount: conv.isRead ? 0 : 1,
    hasAiDraft: false,
    status: 'active',
    checkInDate: conv.arrivalDate ? new Date(conv.arrivalDate) : undefined,
    checkOutDate: conv.departureDate ? new Date(conv.departureDate) : undefined,
    platform,
  };
}

export class HostawayAdapter implements PMSProvider {
  get info(): PMSProviderInfo {
    return PMS_PROVIDERS.find(p => p.id === 'hostaway')!;
  }

  async connect(credentials: Record<string, string>): Promise<boolean> {
    const { accountId, apiKey } = credentials;
    if (!accountId || !apiKey) return false;

    const success = await initializeConnection(accountId, apiKey);
    if (success) {
      storedAccountId = accountId;
      storedApiKey = apiKey;
    }
    return success;
  }

  async disconnect(): Promise<void> {
    await disconnectHostaway();
    storedAccountId = null;
    storedApiKey = null;
  }

  async restoreConnection(): Promise<PMSConnectionStatus> {
    const result = await hostawayRestore();
    if (result.connected && result.accountId && result.apiKey) {
      storedAccountId = result.accountId;
      storedApiKey = result.apiKey;
    }
    return {
      connected: result.connected,
      providerId: 'hostaway',
      accountId: storedAccountId || undefined,
      needsReauth: result.needsReauth,
    };
  }

  async validateCredentials(credentials: Record<string, string>): Promise<boolean> {
    return hostawayValidate(credentials.accountId, credentials.apiKey);
  }

  async fetchProperties(): Promise<Property[]> {
    if (!storedAccountId || !storedApiKey) return [];
    const listings = await fetchListings(storedAccountId, storedApiKey);
    return listings.map(convertListingToProperty);
  }

  async fetchPropertyDetail(propertyId: string): Promise<PMSListingDetail | null> {
    if (!storedAccountId || !storedApiKey) return null;
    const detail = await hostawayFetchDetail(storedAccountId, storedApiKey, parseInt(propertyId));
    if (!detail) return null;

    return {
      id: String(detail.id),
      name: detail.name,
      address: [detail.address, detail.city, detail.state].filter(Boolean).join(', '),
      description: detail.description,
      thumbnailUrl: detail.thumbnailUrl || detail.picture,
      bedrooms: detail.numberOfBedrooms ?? detail.bedrooms,
      bathrooms: detail.numberOfBathrooms ?? detail.bathrooms,
      maxGuests: detail.personCapacity ?? detail.maxNumberOfGuests,
      checkInTime: detail.checkInTimeStart ? String(detail.checkInTimeStart) : undefined,
      checkOutTime: detail.checkOutTime ? String(detail.checkOutTime) : undefined,
      wifiName: detail.wifiName,
      wifiPassword: detail.wifiPassword,
      houseRules: detail.houseRules,
      amenities: [],
      raw: detail as unknown as Record<string, unknown>,
    };
  }

  async fetchConversations(
    onProgress?: (fetched: number, total: number | null) => void
  ): Promise<Conversation[]> {
    if (!storedAccountId || !storedApiKey) return [];

    // Fetch properties first so we can match them
    const properties = await this.fetchProperties();

    const rawConversations = await fetchAllConversations(
      storedAccountId,
      storedApiKey,
      onProgress
    );

    return rawConversations.map(conv => convertConversation(conv, properties));
  }

  async fetchMessages(conversationId: string): Promise<Message[]> {
    if (!storedAccountId || !storedApiKey) return [];
    const messages = await hostawayFetchMessages(
      storedAccountId,
      storedApiKey,
      parseInt(conversationId)
    );
    return messages.map(msg => convertHostawayMessage(msg, conversationId));
  }

  async sendMessage(conversationId: string, content: string): Promise<void> {
    if (!storedAccountId || !storedApiKey) throw new Error('Not connected');
    await hostawaySendMessage(
      storedAccountId,
      storedApiKey,
      parseInt(conversationId),
      content
    );
  }

  async fetchReservation(reservationId: string): Promise<PMSReservation | null> {
    if (!storedAccountId || !storedApiKey) return null;
    const res = await hostawayFetchReservation(
      storedAccountId,
      storedApiKey,
      parseInt(reservationId)
    );
    if (!res) return null;

    return {
      id: String(res.id),
      propertyId: String(res.listingMapId),
      guestName: res.guestName || [res.guestFirstName, res.guestLastName].filter(Boolean).join(' ') || 'Guest',
      guestEmail: res.guestEmail,
      guestPhone: res.guestPhone,
      checkIn: res.arrivalDate ? new Date(res.arrivalDate) : new Date(),
      checkOut: res.departureDate ? new Date(res.departureDate) : new Date(),
      adults: res.adults,
      children: res.children,
      totalPrice: res.totalPrice,
      currency: res.currency,
      channel: res.channelName,
      status: res.status,
    };
  }
}

/** Create a new Hostaway adapter instance */
export function createHostawayAdapter(): PMSProvider {
  return new HostawayAdapter();
}
