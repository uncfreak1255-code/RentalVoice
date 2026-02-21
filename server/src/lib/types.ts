/**
 * Shared Types — Single source of truth for all backend types
 * 
 * 📁 server/src/lib/types.ts
 * Purpose: Type definitions shared across routes, services, adapters
 * Depends on: None (root types file)
 * Used by: All routes, services, middleware, adapters
 */

// ============================================================
// User & Organization
// ============================================================

export type PlanTier = 'starter' | 'professional' | 'business' | 'enterprise';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  plan: PlanTier;
  trialEndsAt: Date | null;
  stripeCustomerId: string | null;
}

export interface Organization {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
}

export interface OrgMember {
  orgId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
}

// ============================================================
// PMS Connections (Unified Interface)
// ============================================================

export type PMSProvider = 'hostaway' | 'guesty' | 'lodgify' | 'hospitable';

export interface PMSConnection {
  id: string;
  orgId: string;
  provider: PMSProvider;
  accountId: string;
  encryptedCredentials: string; // AES-256-GCM encrypted
  oauthToken: string | null;
  oauthRefreshToken: string | null;
  tokenExpiresAt: Date | null;
  connectedAt: Date;
  lastSyncAt: Date | null;
  status: 'active' | 'disconnected' | 'error';
}

// ============================================================
// Unified PMS Data Types (adapter output)
// ============================================================

export interface UnifiedProperty {
  id: string;
  externalId: string;
  pmsProvider: PMSProvider;
  name: string;
  address: string | null;
  imageUrl: string | null;
  bedroomCount: number;
  bathroomCount: number;
  maxGuests: number;
}

export interface UnifiedGuest {
  id: string;
  externalId: string;
  name: string;
  email: string | null;
  phone: string | null;
  language: string | null;
}

export interface UnifiedMessage {
  id: string;
  externalId: string;
  conversationId: string;
  sender: 'host' | 'guest' | 'system';
  content: string;
  sentAt: Date;
  isRead: boolean;
}

export interface UnifiedConversation {
  id: string;
  externalId: string;
  pmsProvider: PMSProvider;
  property: UnifiedProperty;
  guest: UnifiedGuest;
  messages: UnifiedMessage[];
  status: 'active' | 'archived';
  checkInDate: Date | null;
  checkOutDate: Date | null;
  platform: 'airbnb' | 'booking' | 'vrbo' | 'direct' | 'unknown';
}

// ============================================================
// AI Configuration
// ============================================================

export type AIProvider = 'openai' | 'anthropic' | 'google';

export interface AIConfig {
  id: string;
  orgId: string;
  mode: 'managed' | 'byok';
  provider: AIProvider | null; // null = use managed default
  encryptedApiKey: string | null; // null = managed mode
  model: string | null;
  createdAt: Date;
}

// ============================================================
// AI Usage Tracking
// ============================================================

export interface AIUsageRecord {
  id: string;
  orgId: string;
  month: string; // YYYY-MM format
  provider: AIProvider;
  requests: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

// ============================================================
// API Request/Response Types
// ============================================================

export interface AIGenerateRequest {
  message: string;
  conversationHistory?: { role: string; content: string }[];
  propertyId?: string;
  guestName?: string;
  guestLanguage?: string;
  responseLanguageMode?: string;
  hostDefaultLanguage?: string;
}

export interface AIGenerateResponse {
  draft: string;
  confidence: number;
  detectedLanguage: string;
  provider: AIProvider;
  model: string;
  tokensUsed: { input: number; output: number };
}

export interface AIUsageResponse {
  month: string;
  draftsUsed: number;
  draftsLimit: number;
  tokensUsed: number;
}

// ============================================================
// API Error
// ============================================================

export interface ApiError {
  message: string;
  code: string;
  status: number;
  details?: Record<string, unknown>;
}

// ============================================================
// Auth
// ============================================================

export interface AuthTokenPayload {
  userId: string;
  orgId: string;
  email: string;
  plan: PlanTier;
  iat: number;
  exp: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: Omit<User, 'stripeCustomerId'>;
}

// ============================================================
// Plan Limits (aligned with competitive_growth_strategy.md)
// ============================================================

export interface PlanLimits {
  maxProperties: number;
  maxDraftsPerMonth: number;
  managedAI: boolean;
  teamMembers: number;
  autopilot: boolean;
  aiModel: string;             // default AI model for this tier
  overageDraftCost: number;    // USD per extra draft beyond limit
  extraPropertyCost: number;   // USD per extra property/mo beyond included
  styleLearning: 'basic' | 'full' | 'full_custom';
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  starter: {
    maxProperties: 2,
    maxDraftsPerMonth: 100,
    managedAI: false,
    teamMembers: 1,
    autopilot: false,
    aiModel: 'gpt-4o-mini',
    overageDraftCost: 0,       // no overage — hard cap on free tier
    extraPropertyCost: 0,      // cannot add extra properties on free
    styleLearning: 'basic',
  },
  professional: {
    maxProperties: 10,
    maxDraftsPerMonth: 1000,
    managedAI: true,
    teamMembers: 3,
    autopilot: true,
    aiModel: 'gpt-4o',
    overageDraftCost: 0.02,    // $0.02 per extra draft
    extraPropertyCost: 5,      // $5/prop/mo beyond 10
    styleLearning: 'full',
  },
  business: {
    maxProperties: 50,
    maxDraftsPerMonth: 5000,
    managedAI: true,
    teamMembers: Infinity,
    autopilot: true,
    aiModel: 'gpt-4o',
    overageDraftCost: 0.01,    // $0.01 per extra draft
    extraPropertyCost: 3,      // $3/prop/mo beyond 50
    styleLearning: 'full_custom',
  },
  enterprise: {
    maxProperties: Infinity,
    maxDraftsPerMonth: Infinity,
    managedAI: true,
    teamMembers: Infinity,
    autopilot: true,
    aiModel: 'gpt-4o',
    overageDraftCost: 0,
    extraPropertyCost: 0,
    styleLearning: 'full_custom',
  },
};
