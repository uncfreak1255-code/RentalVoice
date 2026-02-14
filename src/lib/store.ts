import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface Guest {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
  phone?: string;
  language?: string;
  detectedLanguage?: string; // Auto-detected from messages
  preferredLanguage?: string; // Explicitly set preference
  previousStays?: number;
  isVip?: boolean;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  image?: string;
}

// Property Knowledge Base for AI
export interface PropertyKnowledge {
  propertyId: string;
  wifiName?: string;
  wifiPassword?: string;
  checkInInstructions?: string;
  checkInTime?: string;
  checkOutInstructions?: string;
  checkOutTime?: string;
  parkingInfo?: string;
  houseRules?: string;
  applianceGuide?: string;
  localRecommendations?: string;
  emergencyContacts?: string;
  customNotes?: string;
  tonePreference?: 'friendly' | 'professional' | 'casual';
  earlyCheckInFee?: number;
  lateCheckOutFee?: number;
  earlyCheckInAvailable?: boolean;
  lateCheckOutAvailable?: boolean;
}

// Issue tracking
export interface Issue {
  id: string;
  conversationId: string;
  category: 'maintenance' | 'cleanliness' | 'amenity' | 'noise' | 'access' | 'other';
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
  resolvedAt?: Date;
  notes?: string;
}

// Scheduled message template
export interface ScheduledMessage {
  id: string;
  propertyId: string;
  triggerType: 'before_checkin' | 'after_checkin' | 'before_checkout' | 'after_checkout' | 'custom';
  triggerHours: number; // hours before/after trigger event
  template: string;
  isActive: boolean;
  name: string;
  // Smart template features
  aiPersonalization?: boolean;
  personalizationInstructions?: string;
  category?: 'check_in' | 'check_out' | 'welcome' | 'review_request' | 'issue_response' | 'upsell' | 'custom';
}

// Analytics data
export interface AnalyticsData {
  totalMessagesHandled: number;
  aiResponsesApproved: number;
  aiResponsesEdited: number;
  aiResponsesRejected: number;
  averageResponseTime: number; // in seconds
  issuesResolved: number;
  upsellsGenerated: number;
  upsellRevenue: number;
  guestSatisfactionScores: number[];
  lastUpdated: Date;
}

// Learning data for AI improvement
export interface LearningEntry {
  id: string;
  originalResponse: string;
  editedResponse?: string;
  wasApproved: boolean;
  wasEdited: boolean;
  guestIntent: string;
  propertyId: string;
  timestamp: Date;
}

// Host style profile for AI mimicry
export interface HostStyleProfile {
  propertyId: string; // 'global' for host-wide, or specific property ID
  // Tone analysis
  formalityLevel: number; // 0 = casual, 100 = very formal
  warmthLevel: number; // 0 = distant, 100 = very warm
  // Common patterns
  commonGreetings: string[];
  commonSignoffs: string[];
  usesEmojis: boolean;
  emojiFrequency: number; // 0-100
  averageResponseLength: number;
  // Vocabulary patterns
  commonPhrases: string[];
  avoidedWords: string[];
  // Response patterns by intent
  intentPatterns: Record<string, string[]>; // intent -> sample responses
  // Training stats
  samplesAnalyzed: number;
  lastUpdated: Date;
}

// AI Learning Progress
export interface AILearningProgress {
  totalMessagesAnalyzed: number;
  totalEditsLearned: number;
  totalApprovalsLearned: number;
  accuracyScore: number; // 0-100 based on approval rate
  lastTrainingDate: Date;
  isTraining: boolean;
  trainingProgress: number; // 0-100
}

// History Sync Status for comprehensive data fetching
export interface HistorySyncStatus {
  lastFullSync: Date | null;
  lastIncrementalSync: Date | null;
  totalConversationsSynced: number;
  totalMessagesSynced: number;
  isSyncing: boolean;
  isPaused: boolean;
  syncPhase: 'idle' | 'conversations' | 'messages' | 'analyzing' | 'complete' | 'error';
  syncProgress: number; // 0-100
  syncError: string | null;
  // Date range settings for filtering
  dateRangeStart: Date | null;
  dateRangeEnd: Date | null;
  dateRangeMonths: number; // Default months to fetch
  // Enhanced progress tracking
  processedConversations: number;
  processedMessages: number;
  estimatedTimeRemaining: number | null;
  currentBatch: number;
  totalBatches: number;
  errorCount: number;
  errorLog: Array<{
    timestamp: number;
    phase: string;
    message: string;
    conversationId?: number;
  }>;
  // Resumability
  canResume: boolean;
}

// Quick Reply Template for AI learning
export interface QuickReplyTemplate {
  id: string;
  name: string;
  content: string;
  // Categorization
  category: 'wifi' | 'check_in' | 'check_out' | 'parking' | 'amenities' | 'issue' | 'thanks' | 'booking' | 'general';
  // Matching keywords for intent detection
  keywords: string[];
  // Property-specific or global
  propertyId: string | null; // null = global template
  // Priority for matching (higher = more priority)
  priority: number;
  // Source of template
  source: 'manual' | 'csv_import' | 'favorite' | 'hostaway' | 'airbnb';
  // Usage stats
  usageCount: number;
  lastUsed: Date | null;
  // AI analysis results
  analyzedTone?: 'formal' | 'casual' | 'friendly' | 'professional';
  analyzedLength?: 'short' | 'medium' | 'long';
  // Creation info
  createdAt: Date;
  updatedAt: Date;
}

// Favorite message (marked by host)
export interface FavoriteMessage {
  id: string;
  messageId: string;
  conversationId: string;
  content: string;
  guestIntent: string;
  propertyId: string;
  createdAt: Date;
}

// Learned language style for cultural tone adaptation
export interface LearnedLanguageStyle {
  languageCode: string;
  samplesAnalyzed: number;
  // Learned adjustments (overrides cultural defaults)
  learnedFormality?: number;
  learnedWarmth?: number;
  learnedGreetings: string[];
  learnedSignoffs: string[];
  commonPhrases: string[];
  lastUpdated: Date;
}

// Cultural tone settings
export interface CulturalToneSettings {
  enabled: boolean;
  autoDetectLanguage: boolean;
  useLearnedStyles: boolean;
  // Per-language style overrides from historical examples
  learnedStyles: Record<string, LearnedLanguageStyle>;
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  sender: 'guest' | 'host' | 'ai_draft';
  timestamp: Date;
  isRead: boolean;
  aiConfidence?: number;
  isApproved?: boolean;
  detectedIntent?: string;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'urgent';
  language?: string;
  translatedContent?: string;
  isScheduled?: boolean;
  scheduledFor?: Date;
  // Cultural tone adaptation info
  culturalToneApplied?: string; // Language code of cultural tone applied
  culturalAdaptations?: string[]; // List of adaptations made
}

// Activity types for conversation sorting
export type ConversationActivityType =
  | 'message_received'
  | 'message_sent'
  | 'ai_draft_created'
  | 'status_changed'
  | 'read_status_changed'
  | 'urgency_changed'
  | 'note_added'
  | 'feedback_received';

export interface Conversation {
  id: string;
  guest: Guest;
  property: Property;
  messages: Message[];
  lastMessage?: Message;
  unreadCount: number;
  status: 'active' | 'archived' | 'urgent';
  workflowStatus?: 'inbox' | 'todo' | 'follow_up' | 'resolved' | 'archived';
  checkInDate?: Date;
  checkOutDate?: Date;
  numberOfGuests?: number; // Total guests (adults + children)
  platform: 'airbnb' | 'booking' | 'vrbo' | 'direct';
  hasAiDraft: boolean;
  aiDraftContent?: string; // The actual AI draft text to pre-load in compose box
  aiDraftConfidence?: number; // Confidence level of the AI draft (0-100)
  autoPilotEnabled?: boolean; // Per-conversation auto-pilot
  issues?: Issue[];
  lastResponseTime?: number; // Time to respond in seconds
  aiDraftSentAt?: Date;
  // Activity tracking for sorting
  lastActivityTimestamp?: Date; // Most recent activity timestamp
  lastActivityType?: ConversationActivityType; // Type of last activity
}

// Inbox sorting preference options
export type InboxSortPreference = 'recent' | 'unread_first' | 'urgent_first';

export interface AppSettings {
  accountId: string | null;
  apiKey: string | null;
  isOnboarded: boolean;
  autoPilotEnabled: boolean;
  autoPilotConfidenceThreshold: number;
  selectedPropertyId: string | null;
  hostName?: string;
  notificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  expoPushToken: string | null;
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string;
  defaultLanguage: string;
  timezone: string;
  // Privacy settings
  privacyScanEnabled: boolean;
  privacyAutoAnonymize: boolean;
  privacySensitivityLevel: 'low' | 'medium' | 'high';
  // Cultural Tone Adaptation Settings
  culturalToneEnabled: boolean;
  autoDetectGuestLanguage: boolean;
  useLearnedLanguageStyles: boolean;
  // AutoPilot/CoPilot Mode Settings (NEW)
  pilotMode: 'copilot' | 'autopilot'; // CoPilot is default (manual review)
  autoPilotScheduleEnabled: boolean;
  autoPilotScheduleDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  autoPilotScheduleStart: string; // HH:mm format
  autoPilotScheduleEnd: string; // HH:mm format
  escalateSensitiveTopics: boolean; // Always route money/complaints to CoPilot
  escalationTopics: string[]; // Topics that bypass AutoPilot
  escalateNegativeSentiment: boolean; // Escalate negative/frustrated/urgent sentiment to CoPilot
  // Inbox sorting preference
  inboxSortPreference: InboxSortPreference;
  // Privacy & Security
  biometricLockEnabled: boolean;
  analyticsEnabled: boolean;
  // Language response preference
  responseLanguageMode: 'host_language' | 'match_guest';
  // Notification categories
  notificationCategories: {
    newMessage: boolean;
    aiDraftReady: boolean;
    issueDetected: boolean;
    checkoutReminder: boolean;
    upsellResponse: boolean;
  };
  mutedPropertyIds: string[];
}

// AI Provider Usage Tracking
export interface AIProviderUsage {
  requestCount: number;
  estimatedTokens: number;
  lastUsed: Date | null;
  selectedModel: string;
}

// AutoPilot Action Log Entry
export interface AutoPilotActionLog {
  id: string;
  timestamp: Date;
  conversationId: string;
  guestName: string;
  propertyId: string;
  propertyName: string;
  action: 'auto_sent' | 'routed_to_copilot' | 'escalated' | 'blocked_schedule';
  reason: string;
  confidence: number;
  messagePreview: string;
  wasCorrect?: boolean; // For feedback tracking
}

// Tracked Upsell Offer
export type UpsellOfferStatus = 'sent' | 'accepted' | 'paid' | 'declined' | 'expired';
export interface TrackedUpsellOffer {
  id: string;
  conversationId: string;
  guestName: string;
  propertyId: string;
  propertyName: string;
  offerType: 'early_checkin' | 'late_checkout' | 'gap_night' | 'custom';
  title: string;
  price: number;
  status: UpsellOfferStatus;
  sentAt: Date;
  updatedAt: Date;
  messagePreview: string;
}

// Per-Property AutoPilot Settings
export interface PropertyAutoPilotSettings {
  propertyId: string;
  enabled: boolean;
  confidenceThreshold: number;
  useGlobalSchedule: boolean;
  customScheduleDays?: number[];
  customScheduleStart?: string;
  customScheduleEnd?: string;
}

interface AppState {
  // Settings
  settings: AppSettings;
  setAccountId: (id: string) => void;
  setApiKey: (key: string) => void;
  setCredentials: (accountId: string, apiKey: string) => void;
  setOnboarded: (value: boolean) => void;
  setAutoPilot: (enabled: boolean) => void;
  setAutoPilotThreshold: (threshold: number) => void;
  setSelectedProperty: (id: string | null) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;

  // Conversations
  conversations: Conversation[];
  setConversations: (conversations: Conversation[]) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  addMessage: (conversationId: string, message: Message) => void;
  markAsRead: (conversationId: string) => void;
  markAllAsRead: () => void;
  archiveConversation: (conversationId: string) => void;
  setWorkflowStatus: (conversationId: string, status: Conversation['workflowStatus']) => void;

  // Properties
  properties: Property[];
  setProperties: (properties: Property[]) => void;

  // Property Knowledge Base
  propertyKnowledge: Record<string, PropertyKnowledge>;
  setPropertyKnowledge: (propertyId: string, knowledge: PropertyKnowledge) => void;
  updatePropertyKnowledge: (propertyId: string, updates: Partial<PropertyKnowledge>) => void;

  // Issues
  issues: Issue[];
  addIssue: (issue: Issue) => void;
  updateIssue: (issueId: string, updates: Partial<Issue>) => void;
  resolveIssue: (issueId: string) => void;

  // Scheduled Messages
  scheduledMessages: ScheduledMessage[];
  addScheduledMessage: (message: ScheduledMessage) => void;
  updateScheduledMessage: (messageId: string, updates: Partial<ScheduledMessage>) => void;
  deleteScheduledMessage: (messageId: string) => void;

  // Analytics
  analytics: AnalyticsData;
  updateAnalytics: (updates: Partial<AnalyticsData>) => void;
  incrementAnalytic: (key: keyof Pick<AnalyticsData, 'totalMessagesHandled' | 'aiResponsesApproved' | 'aiResponsesEdited' | 'aiResponsesRejected' | 'issuesResolved' | 'upsellsGenerated'>) => void;
  addUpsellRevenue: (amount: number) => void;

  // Tracked Upsell Offers
  trackedUpsellOffers: TrackedUpsellOffer[];
  addTrackedUpsellOffer: (offer: TrackedUpsellOffer) => void;
  updateUpsellOfferStatus: (offerId: string, status: UpsellOfferStatus) => void;

  // Learning
  learningEntries: LearningEntry[];
  addLearningEntry: (entry: LearningEntry) => void;

  // Host Style Profiles (per-property AI mimicry)
  hostStyleProfiles: Record<string, HostStyleProfile>;
  updateHostStyleProfile: (propertyId: string, updates: Partial<HostStyleProfile>) => void;
  resetHostStyleProfile: (propertyId: string) => void;

  // AI Learning Progress
  aiLearningProgress: AILearningProgress;
  updateAILearningProgress: (updates: Partial<AILearningProgress>) => void;
  resetAILearning: () => void;

  // History Sync Status
  historySyncStatus: HistorySyncStatus;
  updateHistorySyncStatus: (updates: Partial<HistorySyncStatus>) => void;
  setHistoryDateRange: (startDate: Date | null, endDate: Date | null) => void;
  resetHistorySyncStatus: () => void;

  // Quick Reply Templates
  quickReplyTemplates: QuickReplyTemplate[];
  addQuickReplyTemplate: (template: QuickReplyTemplate) => void;
  updateQuickReplyTemplate: (id: string, updates: Partial<QuickReplyTemplate>) => void;
  deleteQuickReplyTemplate: (id: string) => void;
  incrementTemplateUsage: (id: string) => void;
  importTemplatesFromCSV: (templates: Omit<QuickReplyTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsed'>[]) => void;

  // Favorite Messages
  favoriteMessages: FavoriteMessage[];
  addFavoriteMessage: (favorite: FavoriteMessage) => void;
  removeFavoriteMessage: (id: string) => void;
  convertFavoriteToTemplate: (favoriteId: string, templateData: Partial<QuickReplyTemplate>) => void;

  // AutoPilot Action Logs
  autoPilotLogs: AutoPilotActionLog[];
  addAutoPilotLog: (log: AutoPilotActionLog) => void;
  markLogCorrectness: (logId: string, wasCorrect: boolean) => void;
  clearAutoPilotLogs: () => void;

  // Per-Property AutoPilot Settings
  propertyAutoPilotSettings: Record<string, PropertyAutoPilotSettings>;
  updatePropertyAutoPilotSettings: (propertyId: string, settings: Partial<PropertyAutoPilotSettings>) => void;

  // Learned Language Styles (for cultural tone adaptation)
  learnedLanguageStyles: Record<string, LearnedLanguageStyle>;
  updateLearnedLanguageStyle: (languageCode: string, updates: Partial<LearnedLanguageStyle>) => void;
  resetLearnedLanguageStyles: () => void;

  // AI Provider Usage
  aiProviderUsage: Record<string, AIProviderUsage>;
  incrementProviderUsage: (provider: string, tokens: number) => void;
  setProviderModel: (provider: string, model: string) => void;
  resetProviderUsage: (provider: string) => void;

  // Active conversation
  activeConversationId: string | null;
  setActiveConversation: (id: string | null) => void;

  // Demo mode
  isDemoMode: boolean;
  setDemoMode: (value: boolean) => void;

  // Reset
  resetStore: () => void;
}

const initialSettings: AppSettings = {
  accountId: null,
  apiKey: null,
  isOnboarded: false,
  autoPilotEnabled: false,
  autoPilotConfidenceThreshold: 85,
  selectedPropertyId: null,
  hostName: undefined,
  notificationsEnabled: true,
  pushNotificationsEnabled: true,
  expoPushToken: null,
  quietHoursStart: undefined,
  quietHoursEnd: undefined,
  defaultLanguage: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  // Privacy settings defaults
  privacyScanEnabled: true,
  privacyAutoAnonymize: false,
  privacySensitivityLevel: 'medium',
  // Cultural Tone Adaptation defaults
  culturalToneEnabled: true,
  autoDetectGuestLanguage: true,
  useLearnedLanguageStyles: true,
  // AutoPilot/CoPilot Mode Settings defaults
  pilotMode: 'copilot', // CoPilot is default (safer)
  autoPilotScheduleEnabled: false,
  autoPilotScheduleDays: [1, 2, 3, 4, 5], // Mon-Fri by default
  autoPilotScheduleStart: '09:00',
  autoPilotScheduleEnd: '17:00',
  escalateSensitiveTopics: true, // Always escalate sensitive by default
  escalationTopics: ['refund', 'complaint', 'money', 'legal', 'damage', 'cancel'],
  escalateNegativeSentiment: true, // Escalate negative sentiment by default
  // Inbox sorting preference default
  inboxSortPreference: 'recent', // Default to most recent activity first
  // Privacy & Security defaults
  biometricLockEnabled: false,
  analyticsEnabled: true,
  // Language response preference
  responseLanguageMode: 'match_guest',
  // Notification categories defaults
  notificationCategories: {
    newMessage: true,
    aiDraftReady: true,
    issueDetected: true,
    checkoutReminder: true,
    upsellResponse: true,
  },
  mutedPropertyIds: [],
};

const initialAnalytics: AnalyticsData = {
  totalMessagesHandled: 0,
  aiResponsesApproved: 0,
  aiResponsesEdited: 0,
  aiResponsesRejected: 0,
  averageResponseTime: 0,
  issuesResolved: 0,
  upsellsGenerated: 0,
  upsellRevenue: 0,
  guestSatisfactionScores: [],
  lastUpdated: new Date(),
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Settings
      settings: initialSettings,
      setAccountId: (id) =>
        set((state) => ({
          settings: { ...state.settings, accountId: id },
        })),
      setApiKey: (key) =>
        set((state) => ({
          settings: { ...state.settings, apiKey: key },
        })),
      setCredentials: (accountId, apiKey) =>
        set((state) => ({
          settings: { ...state.settings, accountId, apiKey },
        })),
      setOnboarded: (value) =>
        set((state) => ({
          settings: { ...state.settings, isOnboarded: value },
        })),
      setAutoPilot: (enabled) =>
        set((state) => ({
          settings: { ...state.settings, autoPilotEnabled: enabled },
        })),
      setAutoPilotThreshold: (threshold) =>
        set((state) => ({
          settings: { ...state.settings, autoPilotConfidenceThreshold: threshold },
        })),
      setSelectedProperty: (id) =>
        set((state) => ({
          settings: { ...state.settings, selectedPropertyId: id },
        })),
      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),

      // Conversations
      conversations: [],
      setConversations: (conversations) => set({ conversations }),
      updateConversation: (id, updates) =>
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id !== id) return c;

            // Determine activity type based on what's being updated
            let activityType: ConversationActivityType | undefined;
            if (updates.status !== undefined && updates.status !== c.status) {
              activityType = updates.status === 'urgent' ? 'urgency_changed' : 'status_changed';
            } else if (updates.hasAiDraft && !c.hasAiDraft) {
              activityType = 'ai_draft_created';
            }

            return {
              ...c,
              ...updates,
              // Update activity tracking if relevant changes detected
              ...(activityType ? {
                lastActivityTimestamp: new Date(),
                lastActivityType: activityType,
              } : {}),
            };
          }),
        })),
      addMessage: (conversationId, message) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: [...c.messages, message],
                  lastMessage: message,
                  hasAiDraft: message.sender === 'ai_draft' ? true : c.hasAiDraft,
                  // Update activity tracking
                  lastActivityTimestamp: new Date(),
                  lastActivityType: message.sender === 'guest'
                    ? 'message_received'
                    : message.sender === 'ai_draft'
                      ? 'ai_draft_created'
                      : 'message_sent',
                }
              : c
          ),
        })),
      markAsRead: (conversationId) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  unreadCount: 0,
                  messages: c.messages.map((m) => ({ ...m, isRead: true })),
                  // Update activity tracking
                  lastActivityTimestamp: new Date(),
                  lastActivityType: 'read_status_changed' as const,
                }
              : c
          ),
        })),
      markAllAsRead: () =>
        set((state) => ({
          conversations: state.conversations.map((c) => ({
            ...c,
            unreadCount: 0,
            messages: c.messages.map((m) => ({ ...m, isRead: true })),
          })),
        })),
      archiveConversation: (conversationId) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  status: 'archived',
                  workflowStatus: 'archived',
                  // Update activity tracking
                  lastActivityTimestamp: new Date(),
                  lastActivityType: 'status_changed' as const,
                }
              : c
          ),
        })),
      setWorkflowStatus: (conversationId, status) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  workflowStatus: status,
                  // Update activity tracking
                  lastActivityTimestamp: new Date(),
                  lastActivityType: 'status_changed' as const,
                }
              : c
          ),
        })),

      // Properties
      properties: [],
      setProperties: (properties) => set({ properties }),

      // Property Knowledge Base
      propertyKnowledge: {},
      setPropertyKnowledge: (propertyId, knowledge) =>
        set((state) => ({
          propertyKnowledge: { ...state.propertyKnowledge, [propertyId]: knowledge },
        })),
      updatePropertyKnowledge: (propertyId, updates) =>
        set((state) => ({
          propertyKnowledge: {
            ...state.propertyKnowledge,
            [propertyId]: { ...state.propertyKnowledge[propertyId], ...updates, propertyId },
          },
        })),

      // Issues
      issues: [],
      addIssue: (issue) =>
        set((state) => ({
          issues: [...state.issues, issue],
        })),
      updateIssue: (issueId, updates) =>
        set((state) => ({
          issues: state.issues.map((i) =>
            i.id === issueId ? { ...i, ...updates } : i
          ),
        })),
      resolveIssue: (issueId) =>
        set((state) => ({
          issues: state.issues.map((i) =>
            i.id === issueId
              ? { ...i, status: 'resolved', resolvedAt: new Date() }
              : i
          ),
        })),

      // Scheduled Messages
      scheduledMessages: [],
      addScheduledMessage: (message) =>
        set((state) => ({
          scheduledMessages: [...state.scheduledMessages, message],
        })),
      updateScheduledMessage: (messageId, updates) =>
        set((state) => ({
          scheduledMessages: state.scheduledMessages.map((m) =>
            m.id === messageId ? { ...m, ...updates } : m
          ),
        })),
      deleteScheduledMessage: (messageId) =>
        set((state) => ({
          scheduledMessages: state.scheduledMessages.filter((m) => m.id !== messageId),
        })),

      // Analytics
      analytics: initialAnalytics,
      updateAnalytics: (updates) =>
        set((state) => ({
          analytics: { ...state.analytics, ...updates, lastUpdated: new Date() },
        })),
      incrementAnalytic: (key) =>
        set((state) => ({
          analytics: {
            ...state.analytics,
            [key]: state.analytics[key] + 1,
            lastUpdated: new Date(),
          },
        })),
      addUpsellRevenue: (amount) =>
        set((state) => ({
          analytics: {
            ...state.analytics,
            upsellRevenue: state.analytics.upsellRevenue + amount,
            upsellsGenerated: state.analytics.upsellsGenerated + 1,
            lastUpdated: new Date(),
          },
        })),

      // Learning
      learningEntries: [],
      addLearningEntry: (entry) =>
        set((state) => ({
          learningEntries: [...state.learningEntries, entry],
        })),

      // Host Style Profiles
      hostStyleProfiles: {},
      updateHostStyleProfile: (propertyId, updates) =>
        set((state) => {
          const existing = state.hostStyleProfiles[propertyId] || {
            propertyId,
            formalityLevel: 50,
            warmthLevel: 70,
            commonGreetings: [],
            commonSignoffs: [],
            usesEmojis: false,
            emojiFrequency: 0,
            averageResponseLength: 150,
            commonPhrases: [],
            avoidedWords: [],
            intentPatterns: {},
            samplesAnalyzed: 0,
            lastUpdated: new Date(),
          };
          return {
            hostStyleProfiles: {
              ...state.hostStyleProfiles,
              [propertyId]: { ...existing, ...updates, lastUpdated: new Date() },
            },
          };
        }),
      resetHostStyleProfile: (propertyId) =>
        set((state) => {
          const newProfiles = { ...state.hostStyleProfiles };
          delete newProfiles[propertyId];
          return { hostStyleProfiles: newProfiles };
        }),

      // AI Learning Progress
      aiLearningProgress: {
        totalMessagesAnalyzed: 0,
        totalEditsLearned: 0,
        totalApprovalsLearned: 0,
        accuracyScore: 0,
        lastTrainingDate: new Date(),
        isTraining: false,
        trainingProgress: 0,
      },
      updateAILearningProgress: (updates) =>
        set((state) => ({
          aiLearningProgress: { ...state.aiLearningProgress, ...updates },
        })),
      resetAILearning: () =>
        set({
          learningEntries: [],
          hostStyleProfiles: {},
          aiLearningProgress: {
            totalMessagesAnalyzed: 0,
            totalEditsLearned: 0,
            totalApprovalsLearned: 0,
            accuracyScore: 0,
            lastTrainingDate: new Date(),
            isTraining: false,
            trainingProgress: 0,
          },
        }),

      // History Sync Status
      historySyncStatus: {
        lastFullSync: null,
        lastIncrementalSync: null,
        totalConversationsSynced: 0,
        totalMessagesSynced: 0,
        isSyncing: false,
        isPaused: false,
        syncPhase: 'idle',
        syncProgress: 0,
        syncError: null,
        dateRangeStart: null,
        dateRangeEnd: null,
        dateRangeMonths: 24,
        processedConversations: 0,
        processedMessages: 0,
        estimatedTimeRemaining: null,
        currentBatch: 0,
        totalBatches: 0,
        errorCount: 0,
        errorLog: [],
        canResume: false,
      },
      updateHistorySyncStatus: (updates) =>
        set((state) => ({
          historySyncStatus: { ...state.historySyncStatus, ...updates },
        })),
      setHistoryDateRange: (startDate, endDate) =>
        set((state) => ({
          historySyncStatus: {
            ...state.historySyncStatus,
            dateRangeStart: startDate,
            dateRangeEnd: endDate,
          },
        })),
      resetHistorySyncStatus: () =>
        set({
          historySyncStatus: {
            lastFullSync: null,
            lastIncrementalSync: null,
            totalConversationsSynced: 0,
            totalMessagesSynced: 0,
            isSyncing: false,
            isPaused: false,
            syncPhase: 'idle',
            syncProgress: 0,
            syncError: null,
            dateRangeStart: null,
            dateRangeEnd: null,
            dateRangeMonths: 24,
            processedConversations: 0,
            processedMessages: 0,
            estimatedTimeRemaining: null,
            currentBatch: 0,
            totalBatches: 0,
            errorCount: 0,
            errorLog: [],
            canResume: false,
          },
        }),

      // Quick Reply Templates
      quickReplyTemplates: [],
      addQuickReplyTemplate: (template) =>
        set((state) => ({
          quickReplyTemplates: [...state.quickReplyTemplates, template],
        })),
      updateQuickReplyTemplate: (id, updates) =>
        set((state) => ({
          quickReplyTemplates: state.quickReplyTemplates.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t
          ),
        })),
      deleteQuickReplyTemplate: (id) =>
        set((state) => ({
          quickReplyTemplates: state.quickReplyTemplates.filter((t) => t.id !== id),
        })),
      incrementTemplateUsage: (id) =>
        set((state) => ({
          quickReplyTemplates: state.quickReplyTemplates.map((t) =>
            t.id === id
              ? { ...t, usageCount: t.usageCount + 1, lastUsed: new Date() }
              : t
          ),
        })),
      importTemplatesFromCSV: (templates) =>
        set((state) => ({
          quickReplyTemplates: [
            ...state.quickReplyTemplates,
            ...templates.map((t) => ({
              ...t,
              id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              usageCount: 0,
              lastUsed: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
          ],
        })),

      // Favorite Messages
      favoriteMessages: [],
      addFavoriteMessage: (favorite) =>
        set((state) => ({
          favoriteMessages: [...state.favoriteMessages, favorite],
        })),
      removeFavoriteMessage: (id) =>
        set((state) => ({
          favoriteMessages: state.favoriteMessages.filter((f) => f.id !== id),
        })),
      convertFavoriteToTemplate: (favoriteId, templateData) =>
        set((state) => {
          const favorite = state.favoriteMessages.find((f) => f.id === favoriteId);
          if (!favorite) return state;

          const newTemplate: QuickReplyTemplate = {
            id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: templateData.name || 'Favorite Response',
            content: favorite.content,
            category: templateData.category || 'general',
            keywords: templateData.keywords || [],
            propertyId: favorite.propertyId || null,
            priority: templateData.priority || 5,
            source: 'favorite',
            usageCount: 0,
            lastUsed: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          return {
            quickReplyTemplates: [...state.quickReplyTemplates, newTemplate],
            favoriteMessages: state.favoriteMessages.filter((f) => f.id !== favoriteId),
          };
        }),

      // AutoPilot Action Logs
      autoPilotLogs: [],
      addAutoPilotLog: (log) =>
        set((state) => ({
          autoPilotLogs: [log, ...state.autoPilotLogs].slice(0, 500), // Keep last 500 logs
        })),
      markLogCorrectness: (logId, wasCorrect) =>
        set((state) => ({
          autoPilotLogs: state.autoPilotLogs.map((l) =>
            l.id === logId ? { ...l, wasCorrect } : l
          ),
        })),
      clearAutoPilotLogs: () => set({ autoPilotLogs: [] }),

      // Tracked Upsell Offers
      trackedUpsellOffers: [],
      addTrackedUpsellOffer: (offer) =>
        set((state) => ({ trackedUpsellOffers: [offer, ...state.trackedUpsellOffers] })),
      updateUpsellOfferStatus: (offerId, status) =>
        set((state) => ({
          trackedUpsellOffers: state.trackedUpsellOffers.map((o) =>
            o.id === offerId ? { ...o, status, updatedAt: new Date() } : o
          ),
        })),

      // Per-Property AutoPilot Settings
      propertyAutoPilotSettings: {},
      updatePropertyAutoPilotSettings: (propertyId, settings) =>
        set((state) => ({
          propertyAutoPilotSettings: {
            ...state.propertyAutoPilotSettings,
            [propertyId]: {
              ...state.propertyAutoPilotSettings[propertyId],
              propertyId,
              enabled: settings.enabled ?? state.propertyAutoPilotSettings[propertyId]?.enabled ?? true,
              confidenceThreshold: settings.confidenceThreshold ?? state.propertyAutoPilotSettings[propertyId]?.confidenceThreshold ?? 90,
              useGlobalSchedule: settings.useGlobalSchedule ?? state.propertyAutoPilotSettings[propertyId]?.useGlobalSchedule ?? true,
              ...settings,
            },
          },
        })),

      // Learned Language Styles (for cultural tone adaptation)
      learnedLanguageStyles: {},
      updateLearnedLanguageStyle: (languageCode, updates) =>
        set((state) => {
          const existing = state.learnedLanguageStyles[languageCode] || {
            languageCode,
            samplesAnalyzed: 0,
            learnedGreetings: [],
            learnedSignoffs: [],
            commonPhrases: [],
            lastUpdated: new Date(),
          };
          return {
            learnedLanguageStyles: {
              ...state.learnedLanguageStyles,
              [languageCode]: {
                ...existing,
                ...updates,
                samplesAnalyzed: (existing.samplesAnalyzed || 0) + 1,
                lastUpdated: new Date(),
              },
            },
          };
        }),
      resetLearnedLanguageStyles: () => set({ learnedLanguageStyles: {} }),

      // AI Provider Usage
      aiProviderUsage: {},
      incrementProviderUsage: (provider, tokens) =>
        set((state) => ({
          aiProviderUsage: {
            ...state.aiProviderUsage,
            [provider]: {
              requestCount: (state.aiProviderUsage[provider]?.requestCount || 0) + 1,
              estimatedTokens: (state.aiProviderUsage[provider]?.estimatedTokens || 0) + tokens,
              lastUsed: new Date(),
              selectedModel: state.aiProviderUsage[provider]?.selectedModel || '',
            },
          },
        })),
      setProviderModel: (provider, model) =>
        set((state) => ({
          aiProviderUsage: {
            ...state.aiProviderUsage,
            [provider]: {
              ...state.aiProviderUsage[provider],
              requestCount: state.aiProviderUsage[provider]?.requestCount || 0,
              estimatedTokens: state.aiProviderUsage[provider]?.estimatedTokens || 0,
              lastUsed: state.aiProviderUsage[provider]?.lastUsed || null,
              selectedModel: model,
            },
          },
        })),
      resetProviderUsage: (provider) =>
        set((state) => ({
          aiProviderUsage: {
            ...state.aiProviderUsage,
            [provider]: {
              requestCount: 0,
              estimatedTokens: 0,
              lastUsed: null,
              selectedModel: state.aiProviderUsage[provider]?.selectedModel || '',
            },
          },
        })),

      // Active conversation
      activeConversationId: null,
      setActiveConversation: (id) => set({ activeConversationId: id }),

      // Demo mode
      isDemoMode: false,
      setDemoMode: (value) => set({ isDemoMode: value }),

      // Reset
      resetStore: () =>
        set({
          settings: initialSettings,
          conversations: [],
          properties: [],
          propertyKnowledge: {},
          issues: [],
          scheduledMessages: [],
          analytics: initialAnalytics,
          learningEntries: [],
          hostStyleProfiles: {},
          aiLearningProgress: {
            totalMessagesAnalyzed: 0,
            totalEditsLearned: 0,
            totalApprovalsLearned: 0,
            accuracyScore: 0,
            lastTrainingDate: new Date(),
            isTraining: false,
            trainingProgress: 0,
          },
          historySyncStatus: {
            lastFullSync: null,
            lastIncrementalSync: null,
            totalConversationsSynced: 0,
            totalMessagesSynced: 0,
            isSyncing: false,
            isPaused: false,
            syncPhase: 'idle',
            syncProgress: 0,
            syncError: null,
            dateRangeStart: null,
            dateRangeEnd: null,
            dateRangeMonths: 24,
            processedConversations: 0,
            processedMessages: 0,
            estimatedTimeRemaining: null,
            currentBatch: 0,
            totalBatches: 0,
            errorCount: 0,
            errorLog: [],
            canResume: false,
          },
          quickReplyTemplates: [],
          favoriteMessages: [],
          autoPilotLogs: [],
          propertyAutoPilotSettings: {},
          learnedLanguageStyles: {},
          activeConversationId: null,
          isDemoMode: false,
        }),
    }),
    {
      name: 'rental-reply-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        settings: state.settings,
        isDemoMode: state.isDemoMode,
        properties: state.properties,
        conversations: state.conversations,
        propertyKnowledge: state.propertyKnowledge,
        scheduledMessages: state.scheduledMessages,
        analytics: state.analytics,
        learningEntries: state.learningEntries,
        issues: state.issues,
        hostStyleProfiles: state.hostStyleProfiles,
        aiLearningProgress: state.aiLearningProgress,
        historySyncStatus: state.historySyncStatus,
        quickReplyTemplates: state.quickReplyTemplates,
        favoriteMessages: state.favoriteMessages,
        autoPilotLogs: state.autoPilotLogs,
        propertyAutoPilotSettings: state.propertyAutoPilotSettings,
        learnedLanguageStyles: state.learnedLanguageStyles,
      }),
    }
  )
);
