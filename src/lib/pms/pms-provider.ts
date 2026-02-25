/**
 * PMS Provider Interface
 * 
 * Universal interface for Property Management System integrations.
 * All PMS adapters (Hostaway, Guesty, OwnerRez, etc.) implement this interface.
 * The app never imports PMS-specific modules directly — always go through this layer.
 */

import type { Property, Message, Conversation } from '../store';

// ============================================================
// Universal PMS Types
// ============================================================

export type PMSProviderId = 'hostaway' | 'guesty' | 'ownerrez' | 'hospitable' | 'lodgify';

export interface PMSProviderInfo {
  id: PMSProviderId;
  name: string;
  icon: string;
  color: string;
  description: string;
  /** Fields required for authentication (displayed in onboarding) */
  credentialFields: PMSCredentialField[];
}

export interface PMSCredentialField {
  key: string;
  label: string;
  placeholder: string;
  secure?: boolean;       // mask input (API keys)
  helpText?: string;
}

export interface PMSConnectionStatus {
  connected: boolean;
  providerId: PMSProviderId;
  accountId?: string;
  lastSyncAt?: Date;
  needsReauth?: boolean;
}

export interface PMSReservation {
  id: string;
  propertyId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  checkIn: Date;
  checkOut: Date;
  adults?: number;
  children?: number;
  totalPrice?: number;
  currency?: string;
  channel?: string;       // 'airbnb' | 'vrbo' | 'booking' | 'direct'
  status?: string;
}

export interface PMSListingDetail {
  id: string;
  name: string;
  address?: string;
  description?: string;
  thumbnailUrl?: string;
  bedrooms?: number;
  bathrooms?: number;
  maxGuests?: number;
  checkInTime?: string;
  checkOutTime?: string;
  wifiName?: string;
  wifiPassword?: string;
  houseRules?: string;
  amenities?: string[];
  /** Raw data from the PMS for knowledge extraction */
  raw?: Record<string, unknown>;
}

// ============================================================
// PMS Provider Interface
// ============================================================

export interface PMSProvider {
  readonly info: PMSProviderInfo;

  // Connection lifecycle
  connect(credentials: Record<string, string>): Promise<boolean>;
  disconnect(): Promise<void>;
  restoreConnection(): Promise<PMSConnectionStatus>;
  validateCredentials(credentials: Record<string, string>): Promise<boolean>;

  // Properties
  fetchProperties(): Promise<Property[]>;
  fetchPropertyDetail(propertyId: string): Promise<PMSListingDetail | null>;

  // Conversations & Messages
  fetchConversations(onProgress?: (fetched: number, total: number | null) => void): Promise<Conversation[]>;
  fetchMessages(conversationId: string): Promise<Message[]>;
  sendMessage(conversationId: string, content: string): Promise<void>;

  // Reservations
  fetchReservation(reservationId: string): Promise<PMSReservation | null>;
}

// ============================================================
// Provider Registry
// ============================================================

/** All supported PMS providers with their metadata */
export const PMS_PROVIDERS: PMSProviderInfo[] = [
  {
    id: 'hostaway',
    name: 'Hostaway',
    icon: 'home',
    color: '#14B8A6',
    description: 'Connect your Hostaway account to sync properties and guest messages.',
    credentialFields: [
      { key: 'accountId', label: 'Account ID', placeholder: 'Your Hostaway Account ID' },
      { key: 'apiKey', label: 'API Key', placeholder: 'Your Hostaway API Key', secure: true, helpText: 'Find this in Hostaway → Settings → API Keys' },
    ],
  },
  {
    id: 'guesty',
    name: 'Guesty',
    icon: 'building',
    color: '#6366F1',
    description: 'Connect your Guesty account to sync properties and guest messages.',
    credentialFields: [
      { key: 'apiKey', label: 'API Token', placeholder: 'Your Guesty API Token', secure: true, helpText: 'Find this in Guesty → Marketplace → API' },
    ],
  },
  {
    id: 'ownerrez',
    name: 'OwnerRez',
    icon: 'key',
    color: '#F59E0B',
    description: 'Connect your OwnerRez account to sync properties and guest messages.',
    credentialFields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'Your OwnerRez API Key', secure: true },
      { key: 'apiSecret', label: 'API Secret', placeholder: 'Your OwnerRez API Secret', secure: true },
    ],
  },
  {
    id: 'hospitable',
    name: 'Hospitable',
    icon: 'message-circle',
    color: '#3B82F6',
    description: 'Connect your Hospitable account to sync properties and guest messages.',
    credentialFields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'Your Hospitable API Key', secure: true },
    ],
  },
  {
    id: 'lodgify',
    name: 'Lodgify',
    icon: 'globe',
    color: '#10B981',
    description: 'Connect your Lodgify account to sync properties and guest messages.',
    credentialFields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'Your Lodgify API Key', secure: true, helpText: 'Find this in Lodgify → Settings → Account → API Key' },
    ],
  },
];

// ============================================================
// Active Provider Management
// ============================================================

let activeProvider: PMSProvider | null = null;

/** Set the active PMS provider (called after successful connection) */
export function setActiveProvider(provider: PMSProvider): void {
  activeProvider = provider;
}

/** Get the currently active PMS provider */
export function getActiveProvider(): PMSProvider | null {
  return activeProvider;
}

/** Get provider info by ID */
export function getProviderInfo(id: PMSProviderId): PMSProviderInfo | undefined {
  return PMS_PROVIDERS.find(p => p.id === id);
}
