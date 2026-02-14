/**
 * PMS Adapter Interface
 * 
 * 📁 server/src/adapters/pms-adapter.ts
 * Purpose: Unified interface that all PMS adapters must implement
 * Depends on: lib/types.ts
 * Used by: services/pms-service.ts, routes that need PMS data
 * 
 * Contract: All adapters implement this interface. Route handlers
 * use ONLY UnifiedProperty/UnifiedConversation/UnifiedMessage types.
 * PMS-specific types are internal to each adapter file.
 */

import type {
  UnifiedProperty,
  UnifiedConversation,
  UnifiedMessage,
  PMSProvider,
} from '../lib/types.js';

export interface PMSAdapter {
  /** Which PMS this adapter handles */
  readonly provider: PMSProvider;

  /**
   * Test the connection credentials.
   * Returns true if the credentials are valid and the PMS is reachable.
   */
  testConnection(credentials: PMSCredentials): Promise<boolean>;

  /**
   * Fetch all properties for the connected account.
   */
  getProperties(credentials: PMSCredentials): Promise<UnifiedProperty[]>;

  /**
   * Fetch conversations, optionally filtered by date range.
   */
  getConversations(
    credentials: PMSCredentials,
    options?: { since?: Date; propertyId?: string; limit?: number }
  ): Promise<UnifiedConversation[]>;

  /**
   * Fetch a single conversation by its external ID.
   */
  getConversation(
    credentials: PMSCredentials,
    conversationId: string
  ): Promise<UnifiedConversation | null>;

  /**
   * Send a message in a conversation.
   */
  sendMessage(
    credentials: PMSCredentials,
    conversationId: string,
    content: string
  ): Promise<UnifiedMessage>;
}

/**
 * Credentials shape passed to adapters.
 * Adapters extract what they need based on their provider.
 */
export interface PMSCredentials {
  accountId: string;
  apiKey?: string; // Decrypted API key
  oauthToken?: string;
  oauthRefreshToken?: string;
  tokenExpiresAt?: Date;
}

/**
 * Registry of available PMS adapters.
 * New adapters register themselves here.
 */
const adapterRegistry = new Map<PMSProvider, PMSAdapter>();

export function registerAdapter(adapter: PMSAdapter): void {
  adapterRegistry.set(adapter.provider, adapter);
}

export function getAdapter(provider: PMSProvider): PMSAdapter {
  const adapter = adapterRegistry.get(provider);
  if (!adapter) {
    throw new Error(`[PMS] No adapter registered for provider: ${provider}`);
  }
  return adapter;
}

export function listAdapters(): PMSProvider[] {
  return [...adapterRegistry.keys()];
}
