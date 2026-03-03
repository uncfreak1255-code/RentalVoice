/**
 * Supermemory Integration Service
 * 
 * Provides persistent semantic memory for AI learning.
 * Replaces keyword-based pattern matching with vector-based semantic search.
 * 
 * Integration points:
 *  - learnFromReply: stores guest→host exchanges as memories
 *  - searchMemories: semantic search for relevant past responses
 *  - getHostProfile: retrieves learned host style profile
 * 
 * Container tagging strategy:
 *  - "property_{id}": property-specific memories
 *  - "host_global": cross-property host style patterns
 *  - "intent_{type}": intent-classified memories
 */

import Supermemory from 'supermemory';

// ── Configuration ────────────────────────────────────────

const SUPERMEMORY_API_KEY = process.env.EXPO_PUBLIC_SUPERMEMORY_API_KEY;

const CONFIG = {
  maxSearchResults: 5,
  relevanceThreshold: 0.3,
  maxContentLength: 2000,      // Max chars per memory
  batchSize: 10,               // Memories per batch during bulk import
  batchDelayMs: 500,           // Delay between batches (rate limiting)
  retryAttempts: 2,
  retryDelayMs: 1000,
};

// ── Types ────────────────────────────────────────────────

export interface MemoryEntry {
  guestMessage: string;
  hostResponse: string;
  intent: string;
  sentiment: string;
  propertyId?: string;
  wasEdited: boolean;
  timestamp: Date;
}

export interface MemorySearchResult {
  memory: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface HostMemoryProfile {
  staticFacts: string[];   // Persistent host characteristics
  dynamicContext: string[]; // Recent behavior patterns
}

// ── Service ──────────────────────────────────────────────

class SupermemoryService {
  private client: Supermemory | null = null;
  private isAvailable = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initialize();
  }

  /**
   * Initialize the Supermemory client
   */
  private async initialize(): Promise<void> {
    if (!SUPERMEMORY_API_KEY || SUPERMEMORY_API_KEY === 'your-key-here') {
      console.log('[Supermemory] No API key configured — running in offline mode');
      this.isAvailable = false;
      return;
    }

    try {
      this.client = new Supermemory({
        apiKey: SUPERMEMORY_API_KEY,
      });
      this.isAvailable = true;
      console.log('[Supermemory] ✅ Client initialized');
    } catch (error) {
      console.error('[Supermemory] Failed to initialize:', error);
      this.isAvailable = false;
    }
  }

  /**
   * Ensure client is ready before any operation
   */
  private async ensureReady(): Promise<boolean> {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }
    return this.isAvailable && this.client !== null;
  }

  /**
   * Store a guest→host exchange as a memory
   * Called after host approves, edits, or sends an independent reply
   */
  async storeMemory(entry: MemoryEntry): Promise<boolean> {
    if (!(await this.ensureReady())) return false;

    try {
      // Format the memory content for semantic richness
      const content = this.formatMemoryContent(entry);
      
      // Build container tags for organized retrieval
      const containerTags = this.buildContainerTags(entry);

      await this.client!.add({
        content,
        containerTags,
      });

      console.log(`[Supermemory] ✅ Stored memory (intent: ${entry.intent}, property: ${entry.propertyId || 'global'})`);
      return true;
    } catch (error) {
      console.error('[Supermemory] Failed to store memory:', error);
      return false;
    }
  }

  /**
   * Search for semantically similar past responses
   * Returns the most relevant host responses for a given guest message
   */
  async searchMemories(
    guestMessage: string,
    propertyId?: string,
    limit: number = CONFIG.maxSearchResults
  ): Promise<MemorySearchResult[]> {
    if (!(await this.ensureReady())) return [];

    try {
      // Build container tags to scope the search
      const containerTags: string[] = [];
      if (propertyId) {
        containerTags.push(`property_${propertyId}`);
      }
      containerTags.push('host_global');

      const response = await this.client!.search.execute({
        q: guestMessage,
        containerTags,
        limit,
      });

      const results: MemorySearchResult[] = (response.results || []).map((r: any) => ({
        memory: r.content || r.memory || '',
        score: r.score,
        metadata: r.metadata,
      }));

      console.log(`[Supermemory] 🔍 Found ${results.length} memories for: "${guestMessage.substring(0, 50)}..."`);
      return results;
    } catch (error) {
      console.error('[Supermemory] Search failed:', error);
      return [];
    }
  }

  /**
   * Search for property-specific memories only
   * Useful for property-specific knowledge like WiFi, check-in codes, etc.
   */
  async searchPropertyMemories(
    query: string,
    propertyId: string,
    limit: number = 3
  ): Promise<MemorySearchResult[]> {
    if (!(await this.ensureReady())) return [];

    try {
      const response = await this.client!.search.execute({
        q: query,
        containerTags: [`property_${propertyId}`],
        limit,
      });

      return (response.results || []).map((r: any) => ({
        memory: r.content || r.memory || '',
        score: r.score,
        metadata: r.metadata,
      }));
    } catch (error) {
      console.error('[Supermemory] Property search failed:', error);
      return [];
    }
  }

  /**
   * Get the learned host profile from Supermemory
   * Returns static facts and dynamic context about the host's style
   */
  async getHostProfile(propertyId?: string): Promise<HostMemoryProfile | null> {
    if (!(await this.ensureReady())) return null;

    try {
      const containerTag = propertyId ? `property_${propertyId}` : 'host_global';
      
      const response = await this.client!.profile({
        containerTag,
      });

      return {
        staticFacts: response.profile?.static || [],
        dynamicContext: response.profile?.dynamic || [],
      };
    } catch (error) {
      console.error('[Supermemory] Profile fetch failed:', error);
      return null;
    }
  }

  /**
   * Bulk import existing response patterns into Supermemory
   * Used during initial migration from AsyncStorage-based system
   */
  async bulkImport(entries: MemoryEntry[], onProgress?: (done: number, total: number) => void): Promise<number> {
    if (!(await this.ensureReady())) return 0;

    let imported = 0;
    const total = entries.length;

    for (let i = 0; i < total; i += CONFIG.batchSize) {
      const batch = entries.slice(i, i + CONFIG.batchSize);
      
      const results = await Promise.allSettled(
        batch.map(entry => this.storeMemory(entry))
      );

      imported += results.filter(r => r.status === 'fulfilled' && r.value === true).length;
      
      onProgress?.(Math.min(i + CONFIG.batchSize, total), total);

      // Rate limiting pause between batches
      if (i + CONFIG.batchSize < total) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.batchDelayMs));
      }
    }

    console.log(`[Supermemory] Bulk import complete: ${imported}/${total} memories stored`);
    return imported;
  }

  // ── Helpers ──────────────────────────────────────────

  /**
   * Format a memory entry for optimal semantic retrieval
   * Structures content so Supermemory can extract intent, style, and facts
   */
  private formatMemoryContent(entry: MemoryEntry): string {
    const parts: string[] = [];

    // Guest message context
    parts.push(`Guest asked: ${entry.guestMessage}`);
    
    // Host response (the core memory)
    parts.push(`Host replied: ${entry.hostResponse}`);

    // Metadata for richer semantic matching
    if (entry.intent && entry.intent !== 'general') {
      parts.push(`Intent: ${entry.intent}`);
    }
    if (entry.wasEdited) {
      parts.push(`Note: This was a manually edited/corrected response (high quality signal)`);
    }
    if (entry.propertyId) {
      parts.push(`Property: ${entry.propertyId}`);
    }

    const content = parts.join('\n');
    
    // Truncate if too long
    return content.length > CONFIG.maxContentLength
      ? content.substring(0, CONFIG.maxContentLength) + '...'
      : content;
  }

  /**
   * Build container tags for organized memory retrieval
   */
  private buildContainerTags(entry: MemoryEntry): string[] {
    const tags: string[] = ['host_global'];

    if (entry.propertyId) {
      tags.push(`property_${entry.propertyId}`);
    }

    if (entry.intent && entry.intent !== 'general') {
      tags.push(`intent_${entry.intent}`);
    }

    if (entry.wasEdited) {
      tags.push('edited_response');
    }

    return tags;
  }

  /**
   * Check if Supermemory is available and configured
   */
  async isConfigured(): Promise<boolean> {
    return this.ensureReady();
  }

  /**
   * Get service status for diagnostics
   */
  getStatus(): { configured: boolean; apiKeyPresent: boolean } {
    return {
      configured: this.isAvailable,
      apiKeyPresent: !!SUPERMEMORY_API_KEY && SUPERMEMORY_API_KEY !== 'your-key-here',
    };
  }
}

// Export singleton
export const supermemoryService = new SupermemoryService();
