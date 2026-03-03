// Hostaway API Service
// Documentation: https://api.hostaway.com/documentation

import {
  storeCredentials,
  getCredentials,
  storeAccessToken,
  getAccessToken as getStoredAccessToken,
  clearAccessToken,
  clearAllCredentials,
  hasStoredCredentials,
  tokenNeedsRefresh,
} from './secure-storage';
import { parseHostawayTimestamp } from './hostaway-utils';

const HOSTAWAY_API_BASE = 'https://api.hostaway.com/v1';

interface HostawayTokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
}

interface HostawayListing {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zipcode: string;
  thumbnailUrl?: string;
  picture?: string;
  propertyTypeId?: number;
  externalListingName?: string;

  // ── Detailed fields (from /listings/{id}) ──
  description?: string;
  houseRules?: string;
  wifiName?: string;
  wifiPassword?: string;
  checkInTimeStart?: number; // 0-23 or time int like 16 = 4pm
  checkInTimeEnd?: number;
  checkOutTime?: number;     // 0-23 or time int like 10 = 10am
  personCapacity?: number;
  maxNumberOfGuests?: number;
  numberOfBedrooms?: number;
  numberOfBathrooms?: number;
  numberOfBeds?: number;
  bedrooms?: number;
  bathrooms?: number;
  beds?: number;
  price?: number;
  cleaningFee?: number;
  securityDepositFee?: number;
  priceForExtraPerson?: number;
  extraPersonFee?: number;
  minimumStay?: number;
  maximumStay?: number;
  doorCode?: string;
  doorSecurityCode?: string;
  cancellationPolicy?: string;
  cancellationPolicyAirbnb?: string;
  cancellationPolicyBookingCom?: string;
  checkInInstructions?: string;
  checkOutInstructions?: string;
  latitude?: number;
  longitude?: number;
  squareFeet?: number;
  floor?: number;
  propertyType?: string;
  roomType?: string;

  // Amenities as array of objects
  listingAmenities?: { amenityId: number; amenityName?: string }[];
  amenities?: number[];

  // Bed type details
  listingBedTypes?: {
    bedTypeId: number;
    quantity: number;
    roomName?: string;
    bedTypeName?: string;
  }[];
}

interface HostawayConversation {
  id: number;
  listingMapId: number;
  reservationId?: number;
  guestName?: string;
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string;
  guestPhone?: string;
  guestPicture?: string;
  channelId?: number;
  channelName?: string;
  arrivalDate?: string;
  departureDate?: string;
  isStarred?: boolean;
  isArchived?: boolean;
  isRead?: boolean;
  lastMessage?: string;
  lastMessageSentAt?: string;
  listingName?: string;
  source?: string; // Channel source name (airbnb, vrbo, booking, etc.)
  // Additional fields that Hostaway may return
  guest?: {
    id?: number;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    picture?: string;
  };
  reservation?: {
    id?: number;
    guestName?: string;
    guestFirstName?: string;
    guestLastName?: string;
    guestEmail?: string;
    guestPhone?: string;
  };
}

// Hostaway Reservation interface
interface HostawayReservation {
  id: number;
  listingMapId: number;
  channelId?: number;
  channelName?: string;
  guestName?: string;
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string;
  guestPhone?: string;
  arrivalDate?: string;
  departureDate?: string;
  status?: string;
  totalPrice?: number;
  currency?: string;
  adults?: number;
  children?: number;
  source?: string;
}

interface HostawayMessage {
  id: number;
  conversationId: number;
  body: string;
  isIncoming: boolean;
  status: string;
  insertedOn: string;
  sentOn?: string;
  senderName?: string;
}

interface HostawayApiResponse<T> {
  status: string;
  result: T;
  count?: number;
  limit?: number;
  offset?: number;
}

// Store the access token in memory (backup for quick access)
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get an access token using account ID and API key
 * First checks secure storage, then refreshes if needed
 * Hostaway uses OAuth 2.0 Client Credentials Grant
 */
export async function getAccessToken(
  accountId: string,
  apiKey: string
): Promise<string> {
  // Check memory cache first
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  // Check secure storage for valid token
  const storedToken = await getStoredAccessToken();
  if (storedToken) {
    // Update memory cache
    cachedToken = {
      token: storedToken.accessToken,
      expiresAt: storedToken.expiresAt,
    };
    console.log('[Hostaway] Using stored access token');
    return storedToken.accessToken;
  }

  // Need to fetch new token
  console.log('[Hostaway] Fetching new access token...');

  const response = await fetch(`${HOSTAWAY_API_BASE}/accessTokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: accountId,
      client_secret: apiKey,
      scope: 'general',
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Hostaway] Token error:', error);

    // If 401/403, credentials are invalid
    if (response.status === 401 || response.status === 403) {
      await clearAccessToken();
      throw new Error('INVALID_CREDENTIALS');
    }

    throw new Error(`Failed to get access token: ${response.status}`);
  }

  const data: HostawayTokenResponse = await response.json();

  // Store token securely
  await storeAccessToken(data.access_token, data.expires_in);

  // Update memory cache (expires_in is in seconds, subtract 5 minutes for safety)
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  console.log('[Hostaway] Access token obtained and stored securely');
  return data.access_token;
}

/**
 * Initialize connection with credentials and store them securely
 * Call this when user first connects their Hostaway account
 */
export async function initializeConnection(
  accountId: string,
  apiKey: string
): Promise<boolean> {
  try {
    // Validate credentials by getting a token
    await getAccessToken(accountId, apiKey);

    // Store credentials securely
    await storeCredentials(accountId, apiKey);

    console.log('[Hostaway] Connection initialized and credentials stored');
    return true;
  } catch (error) {
    console.error('[Hostaway] Failed to initialize connection:', error);
    return false;
  }
}

/**
 * Try to restore connection from stored credentials
 * Call this on app startup to check for existing connection
 */
export async function restoreConnection(): Promise<{
  connected: boolean;
  accountId?: string;
  apiKey?: string;
  needsReauth?: boolean;
}> {
  try {
    // Check if we have stored credentials
    const hasCredentials = await hasStoredCredentials();
    if (!hasCredentials) {
      return { connected: false };
    }

    const credentials = await getCredentials();
    if (!credentials) {
      return { connected: false };
    }

    // Check if we have a valid token
    const storedToken = await getStoredAccessToken();

    if (storedToken) {
      // We have valid credentials and token
      console.log('[Hostaway] Connection restored from secure storage');
      return {
        connected: true,
        accountId: credentials.accountId,
        apiKey: credentials.apiKey,
      };
    }

    // Token expired, try to refresh
    const needsRefresh = await tokenNeedsRefresh();
    if (needsRefresh || !storedToken) {
      try {
        await getAccessToken(credentials.accountId, credentials.apiKey);
        console.log('[Hostaway] Token refreshed successfully');
        return {
          connected: true,
          accountId: credentials.accountId,
          apiKey: credentials.apiKey,
        };
      } catch (error) {
        if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
          console.log('[Hostaway] Stored credentials are invalid, need re-auth');
          return {
            connected: false,
            needsReauth: true,
          };
        }
        throw error;
      }
    }

    return {
      connected: true,
      accountId: credentials.accountId,
      apiKey: credentials.apiKey,
    };
  } catch (error) {
    console.error('[Hostaway] Failed to restore connection:', error);
    return { connected: false };
  }
}

/**
 * Disconnect Hostaway - clears all stored credentials and tokens
 */
export async function disconnectHostaway(): Promise<void> {
  await clearAllCredentials();
  cachedToken = null;
  console.log('[Hostaway] Disconnected and all credentials cleared');
}

/**
 * Validate API credentials by attempting to get a token
 */
export async function validateCredentials(
  accountId: string,
  apiKey: string
): Promise<boolean> {
  try {
    await getAccessToken(accountId, apiKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch all listings/properties from Hostaway
 */
export async function fetchListings(
  accountId: string,
  apiKey: string
): Promise<HostawayListing[]> {
  const token = await getAccessToken(accountId, apiKey);

  console.log('[Hostaway] Fetching listings...');

  const response = await fetch(`${HOSTAWAY_API_BASE}/listings?limit=100`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Hostaway] Listings error:', error);
    throw new Error(`Failed to fetch listings: ${response.status}`);
  }

  const data: HostawayApiResponse<HostawayListing[]> = await response.json();
  console.log(`[Hostaway] Fetched ${data.result?.length || 0} listings`);
  return data.result || [];
}

/**
 * Fetch detailed listing data for a single property.
 * Returns the full listing object with WiFi, description, amenities, pricing, etc.
 */
export async function fetchListingDetail(
  accountId: string,
  apiKey: string,
  listingId: number
): Promise<HostawayListing | null> {
  try {
    const token = await getAccessToken(accountId, apiKey);
    console.log(`[Hostaway] Fetching detail for listing ${listingId}...`);

    const response = await fetch(`${HOSTAWAY_API_BASE}/listings/${listingId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      console.error(`[Hostaway] Listing detail error: ${response.status}`);
      return null;
    }

    const data: HostawayApiResponse<HostawayListing> = await response.json();
    console.log(`[Hostaway] Fetched detail for listing ${listingId}: ${data.result?.name || 'unknown'}`);
    return data.result || null;
  } catch (err) {
    console.error('[Hostaway] fetchListingDetail error:', err);
    return null;
  }
}

/**
 * Fetch all conversations from Hostaway
 */
export async function fetchConversations(
  accountId: string,
  apiKey: string
): Promise<HostawayConversation[]> {
  const token = await getAccessToken(accountId, apiKey);

  console.log('[Hostaway] Fetching conversations...');

  const response = await fetch(
    `${HOSTAWAY_API_BASE}/conversations?limit=50&includeResources=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('[Hostaway] Conversations error:', error);
    throw new Error(`Failed to fetch conversations: ${response.status}`);
  }

  const data: HostawayApiResponse<HostawayConversation[]> = await response.json();
  const conversations = data.result || [];
  console.log(`[Hostaway] Fetched ${conversations.length} conversations from all channels`);

  // Debug: Log channel distribution
  const channelCounts: Record<string, number> = {};
  conversations.forEach(conv => {
    const channel = conv.channelName || conv.source || `channelId:${conv.channelId}` || 'unknown';
    channelCounts[channel] = (channelCounts[channel] || 0) + 1;

    // Log Vrbo messages specifically for debugging
    const isVrbo = (conv.channelName?.toLowerCase().includes('vrbo') ||
                    conv.channelName?.toLowerCase().includes('homeaway') ||
                    conv.source?.toLowerCase().includes('vrbo') ||
                    conv.source?.toLowerCase().includes('homeaway') ||
                    conv.channelId === 2016); // Vrbo channel ID in Hostaway
    if (isVrbo) {
      console.log(`[Hostaway] Vrbo message fetched: ${conv.id} - Guest: ${conv.guestName || 'Unknown'} - Channel: ${conv.channelName || conv.source || conv.channelId}`);
    }
  });
  console.log('[Hostaway] Channel distribution:', JSON.stringify(channelCounts));

  // Debug: Log first conversation to see what fields are available
  if (conversations.length > 0) {
    console.log('[Hostaway] Sample conversation fields:', JSON.stringify(conversations[0], null, 2));
  }

  return conversations;
}

/**
 * Fetch a single reservation by ID to get guest details
 */
export async function fetchReservation(
  accountId: string,
  apiKey: string,
  reservationId: number
): Promise<HostawayReservation | null> {
  const token = await getAccessToken(accountId, apiKey);

  console.log(`[Hostaway] Fetching reservation ${reservationId}...`);

  try {
    const response = await fetch(
      `${HOSTAWAY_API_BASE}/reservations/${reservationId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`[Hostaway] Reservation ${reservationId} error: ${response.status}`);
      return null;
    }

    const data: HostawayApiResponse<HostawayReservation> = await response.json();
    console.log(`[Hostaway] Reservation ${reservationId} guest:`, data.result?.guestName || data.result?.guestFirstName);
    return data.result || null;
  } catch (error) {
    console.error(`[Hostaway] Failed to fetch reservation ${reservationId}:`, error);
    return null;
  }
}

/**
 * Helper function to extract guest name from conversation data
 * Checks multiple possible fields where Hostaway might return the name
 */
export function extractGuestName(conv: HostawayConversation): string {
  // Try direct guestName field
  if (conv.guestName && conv.guestName.trim()) {
    return conv.guestName.trim();
  }

  // Try combining first and last name
  const firstName = conv.guestFirstName || conv.guest?.firstName || '';
  const lastName = conv.guestLastName || conv.guest?.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();
  if (fullName) {
    return fullName;
  }

  // Try nested guest object
  if (conv.guest?.name && conv.guest.name.trim()) {
    return conv.guest.name.trim();
  }

  // Try nested reservation object
  if (conv.reservation?.guestName && conv.reservation.guestName.trim()) {
    return conv.reservation.guestName.trim();
  }

  const resFirstName = conv.reservation?.guestFirstName || '';
  const resLastName = conv.reservation?.guestLastName || '';
  const resFullName = `${resFirstName} ${resLastName}`.trim();
  if (resFullName) {
    return resFullName;
  }

  return 'Unknown Guest';
}

/**
 * Fetch messages for a specific conversation
 */
export async function fetchMessages(
  accountId: string,
  apiKey: string,
  conversationId: number
): Promise<HostawayMessage[]> {
  const token = await getAccessToken(accountId, apiKey);

  console.log(`[Hostaway] Fetching messages for conversation ${conversationId}...`);

  const response = await fetch(
    `${HOSTAWAY_API_BASE}/conversations/${conversationId}/messages?limit=100&includeScheduledMessages=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('[Hostaway] Messages error:', error);
    throw new Error(`Failed to fetch messages: ${response.status}`);
  }

  const data: HostawayApiResponse<HostawayMessage[]> = await response.json();
  console.log(`[Hostaway] Fetched ${data.result?.length || 0} messages`);
  return data.result || [];
}

/**
 * Send a message to a guest
 */
export async function sendMessage(
  accountId: string,
  apiKey: string,
  conversationId: number,
  message: string
): Promise<HostawayMessage> {
  const token = await getAccessToken(accountId, apiKey);

  console.log(`[Hostaway] Sending message to conversation ${conversationId}...`);

  const response = await fetch(
    `${HOSTAWAY_API_BASE}/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body: message,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('[Hostaway] Send message error:', error);
    throw new Error(`Failed to send message: ${response.status}`);
  }

  const data: HostawayApiResponse<HostawayMessage> = await response.json();
  console.log('[Hostaway] Message sent successfully');
  return data.result;
}

/**
 * Fetch ALL conversations with pagination
 * Returns all conversations across all pages
 */
export async function fetchAllConversations(
  accountId: string,
  apiKey: string,
  onProgress?: (fetched: number, total: number | null) => void
): Promise<HostawayConversation[]> {
  const token = await getAccessToken(accountId, apiKey);
  const allConversations: HostawayConversation[] = [];
  const limit = 100;
  let offset = 0;
  let hasMore = true;

  console.log('[Hostaway] Fetching all conversations with pagination...');

  while (hasMore) {
    const response = await fetch(
      `${HOSTAWAY_API_BASE}/conversations?limit=${limit}&offset=${offset}&includeResources=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[Hostaway] Conversations pagination error:', error);
      throw new Error(`Failed to fetch conversations: ${response.status}`);
    }

    const data: HostawayApiResponse<HostawayConversation[]> = await response.json();
    const conversations = data.result || [];

    allConversations.push(...conversations);

    // Report progress
    if (onProgress) {
      onProgress(allConversations.length, data.count || null);
    }

    console.log(`[Hostaway] Fetched ${allConversations.length} conversations (offset: ${offset})`);

    // Check if there are more pages
    if (conversations.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`[Hostaway] Total conversations fetched: ${allConversations.length}`);
  return allConversations;
}

/**
 * Fetch with timeout wrapper
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Fetch ALL messages for a conversation with pagination
 */
export async function fetchAllMessages(
  accountId: string,
  apiKey: string,
  conversationId: number
): Promise<HostawayMessage[]> {
  const token = await getAccessToken(accountId, apiKey);
  const allMessages: HostawayMessage[] = [];
  const limit = 100;
  let offset = 0;
  let hasMore = true;
  let retryCount = 0;
  const maxRetries = 2;

  console.log(`[Hostaway] Fetching all messages for conversation ${conversationId}...`);

  while (hasMore) {
    try {
      const response = await fetchWithTimeout(
        `${HOSTAWAY_API_BASE}/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        15000 // 15 second timeout per request
      );

      if (!response.ok) {
        // If 404, conversation might not exist anymore
        if (response.status === 404) {
          console.warn(`[Hostaway] Conversation ${conversationId} not found`);
          return allMessages;
        }
        const error = await response.text();
        console.error('[Hostaway] Messages pagination error:', error);
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }

      const data: HostawayApiResponse<HostawayMessage[]> = await response.json();
      const messages = data.result || [];

      allMessages.push(...messages);
      retryCount = 0; // Reset retry count on success

      if (messages.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.error(`[Hostaway] Error fetching messages for conversation ${conversationId}:`, error);
      retryCount++;

      if (retryCount > maxRetries) {
        console.warn(`[Hostaway] Max retries reached for conversation ${conversationId}, skipping`);
        return allMessages; // Return what we have so far
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }

  console.log(`[Hostaway] Total messages fetched for conversation ${conversationId}: ${allMessages.length}`);
  return allMessages;
}

/**
 * Fetch complete history - all conversations with all their messages
 * Used for comprehensive AI training
 */
export async function fetchCompleteHistory(
  accountId: string,
  apiKey: string,
  onProgress?: (phase: string, current: number, total: number) => void
): Promise<{
  conversations: HostawayConversation[];
  messagesByConversation: Record<number, HostawayMessage[]>;
  totalMessages: number;
}> {
  console.log('[Hostaway] Starting complete history fetch...');

  // Phase 1: Fetch all conversations
  const conversations = await fetchAllConversations(
    accountId,
    apiKey,
    (fetched, total) => {
      if (onProgress) {
        onProgress('conversations', fetched, total || fetched);
      }
    }
  );

  // Phase 2: Fetch messages for each conversation
  const messagesByConversation: Record<number, HostawayMessage[]> = {};
  let totalMessages = 0;

  for (let i = 0; i < conversations.length; i++) {
    const conv = conversations[i];

    if (onProgress) {
      onProgress('messages', i + 1, conversations.length);
    }

    try {
      const messages = await fetchAllMessages(accountId, apiKey, conv.id);
      messagesByConversation[conv.id] = messages;
      totalMessages += messages.length;
    } catch (error) {
      console.error(`[Hostaway] Failed to fetch messages for conversation ${conv.id}:`, error);
      messagesByConversation[conv.id] = [];
    }

    // Small delay between conversations to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`[Hostaway] Complete history fetch done: ${conversations.length} conversations, ${totalMessages} messages`);

  return {
    conversations,
    messagesByConversation,
    totalMessages,
  };
}

/**
 * Filter messages by date range (client-side filtering)
 * Since Hostaway API doesn't have built-in date parameters
 */
export function filterMessagesByDateRange(
  messages: HostawayMessage[],
  startDate?: Date,
  endDate?: Date
): HostawayMessage[] {
  return messages.filter(msg => {
    const msgDate = parseHostawayTimestamp(msg.insertedOn);
    if (startDate && msgDate < startDate) return false;
    if (endDate && msgDate > endDate) return false;
    return true;
  });
}

// Clear cached token (for logout) - also clears secure storage
export async function clearTokenCache() {
  cachedToken = null;
  await clearAccessToken();
}

// Calendar/Availability Types
export interface HostawayCalendarDay {
  date: string; // YYYY-MM-DD
  status: 'available' | 'booked' | 'blocked' | 'pending';
  price?: number;
  minimumStay?: number;
  reservationId?: number;
  isCheckIn?: boolean;
  isCheckOut?: boolean;
}

export interface HostawayCalendarReservation {
  id: number;
  listingMapId: number;
  channelId?: number;
  channelName?: string;
  source?: string;
  guestName?: string;
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string;
  guestPhone?: string;
  arrivalDate: string;
  departureDate: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: string;
  totalPrice?: number;
  currency?: string;
  adults?: number;
  children?: number;
  nights?: number;
  basePrice?: number;
  cleaningFee?: number;
  securityDeposit?: number;
  notes?: string;
  confirmationCode?: string;
}

export interface HostawayBlock {
  id: number;
  listingMapId: number;
  startDate: string;
  endDate: string;
  note?: string;
  isBlocked: boolean;
}

/**
 * Fetch all reservations for calendar view
 * Supports date range filtering
 */
export async function fetchCalendarReservations(
  accountId: string,
  apiKey: string,
  options?: {
    startDate?: string; // YYYY-MM-DD
    endDate?: string;
    listingId?: number;
    status?: string;
  }
): Promise<HostawayCalendarReservation[]> {
  const token = await getAccessToken(accountId, apiKey);

  const params = new URLSearchParams();
  params.append('limit', '100');

  if (options?.startDate) {
    params.append('arrivalStartDate', options.startDate);
  }
  if (options?.endDate) {
    params.append('arrivalEndDate', options.endDate);
  }
  if (options?.listingId) {
    params.append('listingId', String(options.listingId));
  }
  if (options?.status) {
    params.append('status', options.status);
  }

  console.log('[Hostaway] Fetching calendar reservations...');

  const allReservations: HostawayCalendarReservation[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    params.set('offset', String(offset));

    const response = await fetch(
      `${HOSTAWAY_API_BASE}/reservations?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[Hostaway] Calendar reservations error:', error);
      throw new Error(`Failed to fetch reservations: ${response.status}`);
    }

    const data: HostawayApiResponse<HostawayCalendarReservation[]> = await response.json();
    const reservations = data.result || [];

    allReservations.push(...reservations);

    if (reservations.length < 100) {
      hasMore = false;
    } else {
      offset += 100;
    }

    // Rate limiting protection
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`[Hostaway] Fetched ${allReservations.length} calendar reservations`);
  return allReservations;
}

/**
 * Fetch calendar availability for a specific listing
 */
export async function fetchListingAvailability(
  accountId: string,
  apiKey: string,
  listingId: number,
  startDate: string,
  endDate: string
): Promise<HostawayCalendarDay[]> {
  const token = await getAccessToken(accountId, apiKey);

  console.log(`[Hostaway] Fetching availability for listing ${listingId}...`);

  const response = await fetch(
    `${HOSTAWAY_API_BASE}/listings/${listingId}/calendar?startDate=${startDate}&endDate=${endDate}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('[Hostaway] Availability error:', error);
    throw new Error(`Failed to fetch availability: ${response.status}`);
  }

  const data: HostawayApiResponse<Record<string, unknown>> = await response.json();

  // Transform calendar response to our format
  const calendarDays: HostawayCalendarDay[] = [];
  const calendar = data.result || {};

  Object.entries(calendar).forEach(([date, dayData]) => {
    const day = dayData as {
      status?: string;
      price?: number;
      minimumStay?: number;
      reservationId?: number;
      isCheckIn?: boolean;
      isCheckOut?: boolean;
    };

    calendarDays.push({
      date,
      status: (day.status as HostawayCalendarDay['status']) || 'available',
      price: day.price,
      minimumStay: day.minimumStay,
      reservationId: day.reservationId,
      isCheckIn: day.isCheckIn,
      isCheckOut: day.isCheckOut,
    });
  });

  console.log(`[Hostaway] Fetched ${calendarDays.length} calendar days for listing ${listingId}`);
  return calendarDays;
}

/**
 * Fetch blocked dates for a listing
 */
export async function fetchListingBlocks(
  accountId: string,
  apiKey: string,
  listingId: number
): Promise<HostawayBlock[]> {
  const token = await getAccessToken(accountId, apiKey);

  console.log(`[Hostaway] Fetching blocks for listing ${listingId}...`);

  const response = await fetch(
    `${HOSTAWAY_API_BASE}/listings/${listingId}/calendar/blocked`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    // Some listings might not support blocked dates
    if (response.status === 404) {
      return [];
    }
    const error = await response.text();
    console.error('[Hostaway] Blocks error:', error);
    throw new Error(`Failed to fetch blocks: ${response.status}`);
  }

  const data: HostawayApiResponse<HostawayBlock[]> = await response.json();
  console.log(`[Hostaway] Fetched ${data.result?.length || 0} blocks for listing ${listingId}`);
  return data.result || [];
}

/**
 * Update calendar pricing/availability
 */
export async function updateCalendarDay(
  accountId: string,
  apiKey: string,
  listingId: number,
  date: string,
  updates: {
    price?: number;
    minimumStay?: number;
    isAvailable?: boolean;
  }
): Promise<boolean> {
  const token = await getAccessToken(accountId, apiKey);

  console.log(`[Hostaway] Updating calendar for listing ${listingId} on ${date}...`);

  const response = await fetch(
    `${HOSTAWAY_API_BASE}/listings/${listingId}/calendar`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        [date]: updates,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('[Hostaway] Calendar update error:', error);
    return false;
  }

  console.log('[Hostaway] Calendar updated successfully');
  return true;
}

/**
 * Create a block on a listing
 */
export async function createBlock(
  accountId: string,
  apiKey: string,
  listingId: number,
  startDate: string,
  endDate: string,
  note?: string
): Promise<HostawayBlock | null> {
  const token = await getAccessToken(accountId, apiKey);

  console.log(`[Hostaway] Creating block for listing ${listingId}...`);

  const response = await fetch(
    `${HOSTAWAY_API_BASE}/listings/${listingId}/calendar/blocked`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        note,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('[Hostaway] Create block error:', error);
    return null;
  }

  const data: HostawayApiResponse<HostawayBlock> = await response.json();
  console.log('[Hostaway] Block created successfully');
  return data.result;
}

/**
 * Delete a block
 */
export async function deleteBlock(
  accountId: string,
  apiKey: string,
  listingId: number,
  blockId: number
): Promise<boolean> {
  const token = await getAccessToken(accountId, apiKey);

  console.log(`[Hostaway] Deleting block ${blockId} for listing ${listingId}...`);

  const response = await fetch(
    `${HOSTAWAY_API_BASE}/listings/${listingId}/calendar/blocked/${blockId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('[Hostaway] Delete block error:', error);
    return false;
  }

  console.log('[Hostaway] Block deleted successfully');
  return true;
}

// Export types
export type {
  HostawayListing,
  HostawayConversation,
  HostawayMessage,
  HostawayReservation,
};
