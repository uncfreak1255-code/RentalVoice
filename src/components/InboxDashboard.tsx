import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, RefreshControl, AppState, type AppStateStatus, FlatList } from 'react-native';
import { colors, typography, spacing, radius } from '@/lib/design-tokens';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore, type Conversation, type InboxSortPreference, type Guest } from '@/lib/store';
import { getDemoConversations } from '@/lib/demo-data';
import { ConversationItem } from './ConversationItem';
import { DemoModeBanner } from './DemoModeBanner';
import { DailyBriefingCard } from './DailyBriefingCard';
import { checkAndRetrainIfNeeded } from '@/lib/auto-import';
import { buildDailyBriefing } from '@/lib/daily-briefing';
import { isRenderableUnreadConversation } from '@/lib/inbox-trust';

import {
  Inbox,
  Archive,
  Clock,
  ListTodo,
  CheckCircle2,
  DoorOpen,
  LogOut,
  CheckSquare,
  Square,
  X,
  Search,
  MessageSquarePlus,
  AlertTriangle,
  RefreshCw,
  Settings,
} from 'lucide-react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import * as Haptics from 'expo-haptics';
import {
  fetchListings,
  fetchConversations,
  fetchMessages,
  fetchReservation,
  extractGuestName,
} from '@/lib/hostaway';
import { features } from '@/lib/config';
import {
  getHostawayConversationsViaServer,
  getHostawayListingsViaServer,
  getHostawayMessagesViaServer,
  getHostawayReservationViaServer,
} from '@/lib/api-client';
import {
  analyzeConversationSentiment,
  SENTIMENT_PRIORITY,
} from '@/lib/sentiment-analysis';
import { checkAndSendScheduledMessages } from '@/lib/automation-engine';
import { convertListingToProperty, getChannelPlatform, convertHostawayMessage, parseHostawayTimestamp } from '@/lib/hostaway-utils';
import { UndoToast } from './UndoToast';
import {
  notifyNewGuestMessage,
  notifyAutomationSent,
  setBadgeCount,
} from '@/lib/push-notifications';




// Helper function to get the effective timestamp for sorting
// Prioritize actual message timestamp over local activity timestamp
// to match Hostaway's sort order (most recent message at top)
function getEffectiveTimestamp(conversation: Conversation): number {
  // Use the last message timestamp as the primary sort key
  if (conversation.lastMessage?.timestamp) {
    return new Date(conversation.lastMessage.timestamp).getTime();
  }
  // Fallback to local activity timestamp
  if (conversation.lastActivityTimestamp) {
    return new Date(conversation.lastActivityTimestamp).getTime();
  }
  return 0;
}

// Sorting utility functions
function sortByRecent(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => {
    const timeA = getEffectiveTimestamp(a);
    const timeB = getEffectiveTimestamp(b);
    return timeB - timeA;
  });
}

function sortByUnreadFirst(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => {
    const unreadA = isRenderableUnreadConversation(a) ? 1 : 0;
    const unreadB = isRenderableUnreadConversation(b) ? 1 : 0;
    if (unreadB !== unreadA) {
      return unreadB - unreadA;
    }
    const timeA = getEffectiveTimestamp(a);
    const timeB = getEffectiveTimestamp(b);
    return timeB - timeA;
  });
}

function sortByUrgentFirst(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => {
    const sentimentA = analyzeConversationSentiment(a);
    const sentimentB = analyzeConversationSentiment(b);
    const priorityA = SENTIMENT_PRIORITY[sentimentA.currentSentiment];
    const priorityB = SENTIMENT_PRIORITY[sentimentB.currentSentiment];

    if (priorityB !== priorityA) {
      return priorityB - priorityA;
    }

    const urgentA = a.status === 'urgent' ? 1 : 0;
    const urgentB = b.status === 'urgent' ? 1 : 0;
    if (urgentB !== urgentA) {
      return urgentB - urgentA;
    }

    const timeA = getEffectiveTimestamp(a);
    const timeB = getEffectiveTimestamp(b);
    return timeB - timeA;
  });
}

function applySortPreference(conversations: Conversation[], preference: InboxSortPreference): Conversation[] {
  switch (preference) {
    case 'unread_first':
      return sortByUnreadFirst(conversations);
    case 'urgent_first':
      return sortByUrgentFirst(conversations);
    case 'recent':
    default:
      return sortByRecent(conversations);
  }
}

function formatSyncTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 10_000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

type FilterTab = 'all' | 'unread' | 'inquiry' | 'check_in' | 'check_out';

interface InboxDashboardProps {
  onSelectConversation: (id: string) => void;
  onOpenSettings: () => void;
  onOpenCalendar?: () => void;
}

// convertListingToProperty, getChannelPlatform, convertHostawayMessage imported from '@/lib/hostaway-utils'

export function InboxDashboard({ onSelectConversation, onOpenSettings, onOpenCalendar }: InboxDashboardProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const [isRefreshing, setIsRefreshing] = useState(false);
  const flatListRef = useRef<FlatList<any>>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const conversations = useAppStore((s) => s.conversations);
  const issues = useAppStore((s) => s.issues);

  const selectedPropertyId = useAppStore((s) => s.settings.selectedPropertyId);
  const accountId = useAppStore((s) => s.settings.accountId);
  const apiKey = useAppStore((s) => s.settings.apiKey);
  const inboxSortPreference = useAppStore((s) => s.settings.inboxSortPreference);
  const setSelectedProperty = useAppStore((s) => s.setSelectedProperty);
  const setProperties = useAppStore((s) => s.setProperties);
  const setConversations = useAppStore((s) => s.setConversations);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const exitDemoMode = useAppStore((s) => s.exitDemoMode);
  const historySyncStatus = useAppStore((s) => s.historySyncStatus);


  const settings = useAppStore((s) => s.settings);
  const scheduledMessages = useAppStore((s) => s.scheduledMessages);
  const archiveConversation = useAppStore((s) => s.archiveConversation);

  // Multi-select mode for bulk archival
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Track if initial load has happened
  const hasInitialLoaded = useRef(false);
  const hasRecoveredEmptyInbox = useRef(false);
  const lastRefreshTime = useRef<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isSilentRefreshing, setIsSilentRefreshing] = useState(false);
  const [isBriefingCollapsed, setIsBriefingCollapsed] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(
    !isDemoMode && (features.serverProxiedAI || Boolean(accountId && apiKey))
  );

  const filteredConversations = useMemo(() => {
    let result = [...conversations];

    if (selectedPropertyId) {
      result = result.filter((c) => c.property.id === selectedPropertyId);
    }

    // Filter by active tab
    switch (activeFilter) {
      case 'unread':
        result = result.filter((c) => isRenderableUnreadConversation(c));
        break;
      case 'inquiry':
        result = result.filter((c) => c.isInquiry === true);
        break;
      case 'check_in': {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 2);
        result = result.filter((c) => {
          if (!c.checkInDate) return false;
          const checkIn = new Date(c.checkInDate);
          return checkIn >= now && checkIn <= tomorrow;
        });
        break;
      }
      case 'check_out': {
        const now2 = new Date();
        const tomorrow2 = new Date(now2);
        tomorrow2.setDate(tomorrow2.getDate() + 2);
        result = result.filter((c) => {
          if (!c.checkOutDate) return false;
          const checkOut = new Date(c.checkOutDate);
          return checkOut >= now2 && checkOut <= tomorrow2;
        });
        break;
      }
      default:
        result = result.filter((c) => c.status !== 'archived' && c.workflowStatus !== 'archived');
        break;
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) =>
        (c.guest?.name || '').toLowerCase().includes(q) ||
        (c.property?.name || '').toLowerCase().includes(q) ||
        (c.lastMessage?.content || '').toLowerCase().includes(q)
      );
    }

    return applySortPreference(result, inboxSortPreference);
  }, [conversations, selectedPropertyId, activeFilter, inboxSortPreference, searchQuery]);

  // Flat list — no Needs Reply/Responded sections (Rork style)

  const stats = useMemo(() => {
    const active = conversations.filter((c) => c.status !== 'archived' && c.workflowStatus !== 'archived');
    const now = new Date();
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 2);

    return {
      total: active.length,
      unread: active.filter((c) => isRenderableUnreadConversation(c)).length,
      inquiry: active.filter((c) => c.isInquiry === true).length,
      checkIn: active.filter((c) => {
        if (!c.checkInDate) return false;
        const d = new Date(c.checkInDate);
        return d >= now && d <= soon;
      }).length,
      checkOut: active.filter((c) => {
        if (!c.checkOutDate) return false;
        const d = new Date(c.checkOutDate);
        return d >= now && d <= soon;
      }).length,
    };
  }, [conversations]);

  const dailyBriefing = useMemo(() => {
    if (activeFilter !== 'all' || searchQuery.trim()) {
      return null;
    }

    return buildDailyBriefing({
      conversations,
      issues,
      now: new Date(),
    });
  }, [activeFilter, conversations, issues, searchQuery]);

  const handleRefresh = useCallback(async (silent = false) => {
    if (silent) {
      setIsSilentRefreshing(true);
    } else {
      setIsRefreshing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (isDemoMode || (!features.serverProxiedAI && (!accountId || !apiKey))) {
      // Load demo data so Apple reviewers / first-time users see a populated inbox
      if (conversations.length === 0) {
        setConversations(getDemoConversations());
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      setIsRefreshing(false);
      setIsSilentRefreshing(false);
      return;
    }

    try {
      console.log('[Refresh] Fetching latest data from Hostaway...');

      const listings = features.serverProxiedAI
        ? await getHostawayListingsViaServer(100)
        : await fetchListings(accountId!, apiKey!);
      const newProperties = listings.map((listing) => convertListingToProperty(listing as any));
      setProperties(newProperties);
      console.log(`[Refresh] Updated ${newProperties.length} properties`);

      const hostawayConversations = features.serverProxiedAI
        ? await getHostawayConversationsViaServer(50)
        : await fetchConversations(accountId!, apiKey!);
      console.log(`[Refresh] Found ${hostawayConversations.length} conversations`);

      // Build a lookup of existing conversations to preserve local state
      const existingMap = new Map(conversations.map(c => [c.id, c]));

      const newConversations: Conversation[] = [];

      // Fetch full message details for the most recent 30 conversations
      // Beyond that, show them in the list using summary data from API
      const DETAIL_LIMIT = 30;

      // Separate lightweight (beyond limit) from detailed conversations
      const lightweightConvs = hostawayConversations.slice(DETAIL_LIMIT);
      const detailConvs = hostawayConversations.slice(0, DETAIL_LIMIT);

      // Process lightweight conversations (no API calls needed)
      for (const conv of lightweightConvs) {
          const guestName = extractGuestName(conv);
          const property = newProperties.find((p) => p.id === String(conv.listingMapId)) || {
            id: String(conv.listingMapId),
            name: conv.listingName || 'Unknown Property',
            address: '',
          };
          const lightConv: Conversation = {
            id: String(conv.id),
            guest: {
              id: String(conv.id),
              name: guestName,
              avatar: conv.guestPicture || conv.guest?.picture,
              email: conv.guestEmail || conv.guest?.email,
              phone: conv.guestPhone || conv.guest?.phone,
            },
            property,
            messages: [],
            lastMessage: conv.lastMessage ? {
              id: `last-${conv.id}`,
              conversationId: String(conv.id),
              content: conv.lastMessage,
              sender: 'guest',
              timestamp: parseHostawayTimestamp(conv.lastMessageSentAt || Date.now()),
              isRead: true,
            } : undefined,
            unreadCount: (() => {
              const existing = existingMap.get(String(conv.id));
              if (!existing) return conv.isRead ? 0 : 1;
              if (existing.unreadCount === 0) {
                const existingTs = existing.lastMessage?.timestamp ? new Date(existing.lastMessage.timestamp).getTime() : 0;
                const newTs = conv.lastMessageSentAt ? parseHostawayTimestamp(conv.lastMessageSentAt).getTime() : 0;
                return newTs > existingTs ? 1 : 0;
              }
              return existing.unreadCount;
            })(),
            status: conv.isArchived ? 'archived' : 'active',
            checkInDate: conv.arrivalDate ? new Date(conv.arrivalDate) : undefined,
            checkOutDate: conv.departureDate ? new Date(conv.departureDate) : undefined,
            platform: getChannelPlatform(conv.channelName, conv.channelId, conv.source),
            hasAiDraft: false,
            isInquiry: !conv.reservationId,
          };
          const existing = existingMap.get(lightConv.id);
          if (existing) {
            lightConv.hasAiDraft = existing.hasAiDraft;
            lightConv.workflowStatus = existing.workflowStatus;
            lightConv.lastActivityTimestamp = existing.lastActivityTimestamp;
          }
          newConversations.push(lightConv);
      }

      // Helper to fetch full details for a single conversation
      const fetchConversationDetails = async (conv: typeof hostawayConversations[0]): Promise<Conversation | null> => {
        try {
          // Fetch messages and reservation in parallel for each conversation
          const [messagesResult, reservationResult] = await Promise.allSettled([
            features.serverProxiedAI
              ? getHostawayMessagesViaServer(conv.id, 100)
              : fetchMessages(accountId!, apiKey!, conv.id),
            conv.reservationId
              ? (
                features.serverProxiedAI
                  ? getHostawayReservationViaServer(conv.reservationId)
                  : fetchReservation(accountId!, apiKey!, conv.reservationId)
              )
              : Promise.resolve(null),
          ]);

          const fetchedMessages = messagesResult.status === 'fulfilled' ? messagesResult.value : [];
          const reservation = reservationResult.status === 'fulfilled' ? reservationResult.value : null;

          if (messagesResult.status === 'rejected') {
            console.error(`[Refresh] Failed to fetch messages for conversation ${conv.id}:`, messagesResult.reason);
          }

          const property = newProperties.find((p) => p.id === String(conv.listingMapId)) || {
            id: String(conv.listingMapId),
            name: conv.listingName || 'Unknown Property',
            address: '',
          };

          let guestName = extractGuestName(conv);
          let numberOfGuests: number | undefined;
          let checkInDate: Date | undefined = conv.arrivalDate ? new Date(conv.arrivalDate) : undefined;
          let checkOutDate: Date | undefined = conv.departureDate ? new Date(conv.departureDate) : undefined;

          if (reservation) {
            if (guestName === 'Unknown Guest') {
              const resName = reservation.guestName ||
                `${reservation.guestFirstName || ''} ${reservation.guestLastName || ''}`.trim();
              if (resName) guestName = resName;
            }
            const adults = reservation.adults || 0;
            const children = reservation.children || 0;
            numberOfGuests = adults + children;
            if (!checkInDate && reservation.arrivalDate) checkInDate = new Date(reservation.arrivalDate);
            if (!checkOutDate && reservation.departureDate) checkOutDate = new Date(reservation.departureDate);
          }

          const guest: Guest = {
            id: String(conv.id),
            name: guestName,
            avatar: conv.guestPicture || conv.guest?.picture,
            email: conv.guestEmail || conv.guest?.email,
            phone: conv.guestPhone || conv.guest?.phone,
          };

          const convertedMessages = fetchedMessages.map((m) => convertHostawayMessage(m, String(conv.id)));
          const sortedMessages = convertedMessages.sort(
            (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
          );

          const conversation: Conversation = {
            id: String(conv.id),
            guest,
            property,
            messages: sortedMessages,
            lastMessage: sortedMessages[sortedMessages.length - 1],
            unreadCount: (() => {
              const existing = existingMap.get(String(conv.id));
              if (!existing) return conv.isRead ? 0 : 1;
              if (existing.unreadCount === 0) {
                const existingTs = existing.lastMessage?.timestamp ? new Date(existing.lastMessage.timestamp).getTime() : 0;
                const newLastMsg = sortedMessages[sortedMessages.length - 1];
                const newTs = newLastMsg?.timestamp ? new Date(newLastMsg.timestamp).getTime() : 0;
                return newTs > existingTs ? 1 : 0;
              }
              return existing.unreadCount;
            })(),
            status: conv.isArchived ? 'archived' : 'active',
            checkInDate,
            checkOutDate,
            numberOfGuests,
            platform: getChannelPlatform(conv.channelName, conv.channelId, conv.source),
            hasAiDraft: false,
            isInquiry: !conv.reservationId || (reservation?.status ? ['inquiry', 'enquiry', 'new'].includes(reservation.status.toLowerCase()) : false),
          };

          // Preserve local state from existing conversation
          const existing = existingMap.get(conversation.id);
          if (existing) {
            conversation.hasAiDraft = existing.hasAiDraft;
            conversation.aiDraftContent = existing.aiDraftContent;
            conversation.aiDraftConfidence = existing.aiDraftConfidence;
            conversation.aiDraftSentAt = existing.aiDraftSentAt;
            conversation.workflowStatus = existing.workflowStatus;
            conversation.autoPilotEnabled = existing.autoPilotEnabled;
            conversation.lastActivityTimestamp = existing.lastActivityTimestamp;
            conversation.lastActivityType = existing.lastActivityType;
          }

          return conversation;
        } catch (err) {
          console.error(`[Refresh] Failed to process conversation ${conv.id}:`, err);
          return null;
        }
      };

      // Fetch detailed conversations in parallel batches of 3 with inter-batch delay
      const BATCH_SIZE = 3;
      for (let batch = 0; batch < Math.ceil(detailConvs.length / BATCH_SIZE); batch++) {
        if (batch > 0) await new Promise(r => setTimeout(r, 300));
        const batchSlice = detailConvs.slice(batch * BATCH_SIZE, (batch + 1) * BATCH_SIZE);
        const results = await Promise.allSettled(
          batchSlice.map(conv => fetchConversationDetails(conv))
        );
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            newConversations.push(result.value);
          }
        }
      }

      // Detect new unread messages for push notifications
      const previousIds = new Set(conversations.map((c) => c.messages.map((m) => m.id)).flat());
      for (const conv of newConversations) {
        for (const msg of conv.messages) {
          if (msg.sender === 'guest' && !previousIds.has(msg.id)) {
            notifyNewGuestMessage(
              conv.guest.name,
              msg.content,
              conv.id,
              { quietHoursStart: settings.quietHoursStart, quietHoursEnd: settings.quietHoursEnd }
            ).catch(console.error);
          }
        }
      }

      setConversations(newConversations);
      console.log(`[Refresh] Updated ${newConversations.length} conversations`);
      setLastSyncTime(new Date());
      setLoadError(null);

      // Update badge count
      const totalUnread = newConversations.reduce((sum, c) => sum + c.unreadCount, 0);
      setBadgeCount(totalUnread).catch(console.error);

      // Run automation engine
      if (scheduledMessages.length > 0 && !features.serverProxiedAI) {
        try {
          const allKnowledge = useAppStore.getState().propertyKnowledge;
          const propertyKnowledge: Record<string, import('@/lib/store').PropertyKnowledge> = {};
          for (const prop of newProperties) {
            if (allKnowledge[prop.id]) propertyKnowledge[prop.id] = allKnowledge[prop.id];
          }
          const automationResults = await checkAndSendScheduledMessages({
            conversations: newConversations,
            properties: newProperties,
            scheduledMessages,
            accountId: accountId!,
            apiKey: apiKey!,
            hostName: settings.hostName,
            propertyKnowledge,
          });
          for (const result of automationResults) {
            if (result.success) {
              const conv = newConversations.find((c) => c.id === result.conversationId);
              const sched = scheduledMessages.find((s) => s.id === result.messageId);
              if (conv && sched) {
                notifyAutomationSent(sched.name, conv.guest.name).catch(console.error);
              }
            }
          }
        } catch (autoErr) {
          console.error('[Refresh] Automation engine error:', autoErr);
        }
      }

      if (!silent) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('[Refresh] Error refreshing data:', error);
      setLoadError(
        error instanceof Error ? error.message : 'Could not load conversations. Check your connection.'
      );
      if (!silent) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }

    setIsRefreshing(false);
    setIsSilentRefreshing(false);
    setIsInitialLoading(false);
  }, [isDemoMode, accountId, apiKey, setProperties, setConversations, conversations, scheduledMessages, settings]);

  // Auto-refresh on mount (or load demo data)
  useEffect(() => {
    if (!hasInitialLoaded.current) {
      hasInitialLoaded.current = true;
      if (!isDemoMode && (features.serverProxiedAI || (accountId && apiKey))) {
        console.log('[Inbox] Auto-refreshing on mount...');
        handleRefresh();

        // Silently check if AI response index needs rebuilding
        checkAndRetrainIfNeeded().catch(console.error);
      } else if (isDemoMode || (!features.serverProxiedAI && !accountId && !apiKey)) {
        // Load demo conversations for reviewers / first-time users
        if (conversations.length === 0) {
          console.log('[Inbox] Loading demo data...');
          setConversations(getDemoConversations());
        }
      }
    }
  }, [isDemoMode, accountId, apiKey, handleRefresh, conversations.length, setConversations]);

  // Recover once if a connected inbox unexpectedly drops to zero conversations
  // after the initial load already succeeded.
  useEffect(() => {
    const isConnected = features.serverProxiedAI || Boolean(accountId && apiKey);

    if (!hasInitialLoaded.current || isDemoMode || !isConnected) {
      return;
    }

    if (conversations.length > 0) {
      hasRecoveredEmptyInbox.current = false;
      return;
    }

    if (isRefreshing || isSilentRefreshing || hasRecoveredEmptyInbox.current) {
      return;
    }

    hasRecoveredEmptyInbox.current = true;
    console.log('[Inbox] Recovering unexpectedly empty inbox...');
    handleRefresh(true);
  }, [isDemoMode, accountId, apiKey, conversations.length, isRefreshing, isSilentRefreshing, handleRefresh]);

  // Auto-refresh every 30 seconds while inbox is open
  useEffect(() => {
    if (isDemoMode || (!features.serverProxiedAI && (!accountId || !apiKey))) return;

    const intervalId = setInterval(() => {
      const now = Date.now();
      // Only refresh if not currently refreshing and more than 25 seconds since last
      if (!isRefreshing && !isSilentRefreshing && now - lastRefreshTime.current > 25000) {
        console.log('[Inbox] Auto-polling for new messages...');
        handleRefresh(true); // Silent refresh
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(intervalId);
  }, [isDemoMode, accountId, apiKey, isRefreshing, isSilentRefreshing, handleRefresh]);

  // Auto-refresh when app comes back to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && !isDemoMode && (features.serverProxiedAI || (accountId && apiKey))) {
        const now = Date.now();
        // Only refresh if more than 30 seconds since last refresh
        if (now - lastRefreshTime.current > 30000) {
          console.log('[Inbox] Auto-refreshing on app foreground...');
          handleRefresh();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isDemoMode, accountId, apiKey, handleRefresh]);

  // Update last refresh time when refresh completes
  useEffect(() => {
    if (!isRefreshing) {
      lastRefreshTime.current = Date.now();
      setLastSyncTime(new Date());
    }
  }, [isRefreshing]);

  const handleFilterChange = useCallback((filter: FilterTab) => {
    setActiveFilter(filter);
    setIsSelectMode(false);
    setSelectedIds(new Set());
  }, [setActiveFilter, setIsSelectMode, setSelectedIds]);

  // Rork-style filter tabs: All, Unread, Check-in, Check-out
  const tabs: { id: FilterTab; label: string; icon: React.ComponentType<{ size: number; color: string }>; count?: number }[] = [
    { id: 'all', label: 'All', icon: Inbox, count: stats.total },
    { id: 'unread', label: 'Unread', icon: ListTodo, count: stats.unread },
    { id: 'inquiry', label: 'Inquiry', icon: MessageSquarePlus, count: stats.inquiry },
    { id: 'check_in', label: 'Check-in', icon: Clock, count: stats.checkIn },
    { id: 'check_out', label: 'Check-out', icon: Clock, count: stats.checkOut },
  ];

  const showSyncBanner = !isDemoMode && (
    historySyncStatus.isSyncing
    || historySyncStatus.syncPhase === 'error'
    || ((features.serverProxiedAI || (!!accountId && !!apiKey))
      && !historySyncStatus.lastFullSync
      && conversations.length === 0)
  );

  const syncBannerText = historySyncStatus.syncPhase === 'error'
    ? `Sync stopped — ${historySyncStatus.syncError || 'an error occurred'}. Reopen the app to retry.`
    : historySyncStatus.isSyncing
      ? historySyncStatus.syncPhase === 'messages'
        ? `Syncing guest history in the background • ${historySyncStatus.processedMessages} messages fetched`
        : historySyncStatus.syncPhase === 'conversations'
          ? `Connecting your inbox • ${historySyncStatus.processedConversations} conversations indexed`
          : 'Training your workspace in the background'
      : 'Your workspace is connected. Background sync will finish inside the app.';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.base }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* ── Rork-style Header ── */}
        <View style={{ paddingHorizontal: spacing['5'], paddingTop: 12, paddingBottom: 4, backgroundColor: colors.bg.base }}>
          <Text style={{ fontSize: 34, fontFamily: typography.fontFamily.bold, color: colors.text.primary, letterSpacing: -0.5 }} accessibilityRole="header">
            Inbox
          </Text>
        </View>

        {/* ── Search Bar ── */}
        <View style={{ paddingHorizontal: spacing['5'], paddingBottom: 4, backgroundColor: colors.bg.base }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.border.DEFAULT, borderRadius: 10, paddingHorizontal: 10, height: 36 }}>
            <Search size={16} color={colors.text.disabled} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search guests, properties..."
              placeholderTextColor={colors.text.disabled}
              style={{ flex: 1, fontSize: 16, color: colors.text.primary, marginLeft: 6, paddingVertical: 0 }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search guests and properties"
              testID="inbox-search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={12} accessible accessibilityRole="button" accessibilityLabel="Clear search">
                <X size={16} color={colors.text.disabled} />
              </Pressable>
            )}
          </View>
        </View>

        {/* ── Filter Chips (mockup style) ── */}
        <View style={{ paddingVertical: 8, backgroundColor: colors.bg.base }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
            style={{ flexGrow: 0 }}
          >
            {tabs.map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => handleFilterChange(tab.id)}
                  accessibilityRole="tab"
                  accessibilityLabel={`${tab.label} filter${tab.count ? `, ${tab.count} conversations` : ''}`}
                  accessibilityState={{ selected: isActive }}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: spacing['4'],
                    borderRadius: 18,
                    backgroundColor: isActive ? colors.text.primary : colors.bg.subtle,
                    minHeight: spacing['8'],
                    justifyContent: 'center',
                  }}
                  testID={`inbox-filter-${tab.id}`}
                >
                  <Text
                    style={{
                      fontFamily: isActive ? typography.fontFamily.semibold : typography.fontFamily.medium,
                      fontSize: 13,
                      color: isActive ? colors.text.inverse : colors.text.secondary,
                    }}
                  >
                    {tab.label}{tab.count !== undefined && tab.count > 0 ? ` (${tab.count})` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Sync Status */}
        {lastSyncTime && !isRefreshing && (
          <Text style={{ textAlign: 'center', fontSize: 11, color: colors.text.disabled, paddingVertical: 4 }}>
            Updated {formatSyncTime(lastSyncTime)}
          </Text>
        )}
        {isRefreshing && (
          <Text style={{ textAlign: 'center', fontSize: 11, color: colors.primary.DEFAULT, paddingVertical: 4 }}>
            Loading conversations...
          </Text>
        )}

        {/* Demo Mode Banner */}
        {isDemoMode && (
          <DemoModeBanner
            onExitDemo={() => {
              exitDemoMode();
              import('expo-router').then(({ router }) => router.replace('/onboarding'));
            }}
          />
        )}

        {showSyncBanner && (
          <View style={{ paddingHorizontal: spacing['5'], paddingBottom: 8, backgroundColor: colors.bg.base }}>
            <View
              style={{
                borderRadius: 18,
                padding: spacing['4'],
                backgroundColor: colors.bg.subtle,
                borderWidth: 1,
                borderColor: colors.border.DEFAULT,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.semibold, fontSize: 15 }}>
                    {historySyncStatus.syncPhase === 'error' ? 'Sync paused' : 'Background sync is running'}
                  </Text>
                  <Text style={{ color: colors.text.muted, fontSize: 13, lineHeight: 18, marginTop: 4 }}>
                    {syncBannerText}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    import('expo-router').then(({ router }) => router.push('/settings/sync-data'));
                  }}
                  style={{
                    minHeight: spacing['8'],
                    paddingHorizontal: spacing['3'],
                    borderRadius: 9999,
                    backgroundColor: colors.border.DEFAULT,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colors.text.primary, fontSize: 12, fontFamily: typography.fontFamily.medium }}>
                    View Sync
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    useAppStore.getState().updateHistorySyncStatus({
                      isSyncing: false,
                      syncPhase: 'idle',
                      syncError: null,
                    });
                  }}
                  hitSlop={12}
                  style={{ padding: 4 }}
                >
                  <X size={16} color={colors.text.disabled} />
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Conversation List — clean white background, cards have shadow for separation */}
        <View style={{ flex: 1, backgroundColor: colors.bg.base }}>
          {dailyBriefing && (
            <DailyBriefingCard
              briefing={dailyBriefing}
              collapsed={isBriefingCollapsed}
              onToggleCollapsed={() => setIsBriefingCollapsed((value) => !value)}
              onPressAction={onSelectConversation}
            />
          )}
          {filteredConversations.length > 0 ? (
            <FlatList
              ref={flatListRef}
              data={filteredConversations}
              testID="inbox-conversation-list"
              windowSize={5}
              maxToRenderPerBatch={8}
              initialNumToRender={10}
              removeClippedSubviews={false}
              renderItem={({ item }) => {
                const renderRightActions = () => {
                  return (
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        archiveConversation(item.id);
                      }}
                      style={{
                        backgroundColor: colors.danger.DEFAULT,
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: 80,
                      }}
                    >
                      <Archive size={22} color={colors.text.inverse} />
                      <Text style={{ color: colors.text.inverse, fontSize: 12, fontFamily: typography.fontFamily.medium, marginTop: 4 }}>Archive</Text>
                    </Pressable>
                  );
                };

                return (
                  <ReanimatedSwipeable
                    renderRightActions={renderRightActions}
                    overshootRight={false}
                    rightThreshold={40}
                  >
                    <Pressable
                      onPress={() => {
                        if (isSelectMode) {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          });
                        } else {
                          onSelectConversation(item.id);
                        }
                      }}
                      onLongPress={() => {
                        if (!isSelectMode) {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setIsSelectMode(true);
                          setSelectedIds(new Set([item.id]));
                        }
                      }}
                      delayLongPress={400}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.base }}>
                        {isSelectMode && (
                          <View style={{ paddingLeft: spacing['3'], justifyContent: 'center' }}>
                            {selectedIds.has(item.id) ? (
                              <CheckSquare size={22} color={colors.primary.DEFAULT} />
                            ) : (
                              <Square size={22} color={colors.text.muted} />
                            )}
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <ConversationItem
                            conversation={item}
                            onPress={() => {
                              if (isSelectMode) {
                                setSelectedIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(item.id)) next.delete(item.id);
                                  else next.add(item.id);
                                  return next;
                                });
                              } else {
                                onSelectConversation(item.id);
                              }
                            }}
                          />
                        </View>
                      </View>
                    </Pressable>
                  </ReanimatedSwipeable>
                );
              }}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => (
                <View style={{ marginLeft: 66, height: 0.5, backgroundColor: colors.border.DEFAULT }} />
              )}
              contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={() => handleRefresh(false)}
                  tintColor={colors.primary.DEFAULT}
                  colors={[colors.primary.DEFAULT]}
                />
              }
            />
          ) : (
            <ScrollView
              contentContainerStyle={{ flex: 1 }}
              refreshControl={
                <RefreshControl refreshing={isRefreshing} onRefresh={() => handleRefresh(false)} tintColor={colors.primary.DEFAULT} colors={[colors.primary.DEFAULT]} />
              }
            >
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['8'] }}>
                {/* ── Initial loading state ── */}
                {isInitialLoading && !loadError ? (
                  <>
                    <View
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        backgroundColor: colors.primary.muted,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: spacing['5'],
                      }}
                    >
                      <RefreshCw size={36} color={colors.primary.DEFAULT} />
                    </View>
                    <Text style={{ ...typography.styles.h2, color: colors.text.primary, textAlign: 'center' }}>
                      Loading conversations...
                    </Text>
                    <Text style={{ ...typography.styles.body, color: colors.text.muted, textAlign: 'center', marginTop: spacing['2'] }}>
                      Fetching your latest guest messages from Hostaway.
                    </Text>
                  </>
                ) : loadError ? (
                  /* ── Error state ── */
                  <>
                    <View
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        backgroundColor: colors.danger.muted,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: spacing['5'],
                      }}
                    >
                      <AlertTriangle size={36} color={colors.danger.DEFAULT} />
                    </View>
                    <Text style={{ ...typography.styles.h2, color: colors.text.primary, textAlign: 'center' }}>
                      Something went wrong
                    </Text>
                    <Text style={{ ...typography.styles.body, color: colors.text.muted, textAlign: 'center', marginTop: spacing['2'] }}>
                      {loadError}
                    </Text>
                    <Pressable
                      onPress={() => handleRefresh(false)}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.7 : 1,
                        marginTop: spacing['5'],
                        backgroundColor: colors.primary.DEFAULT,
                        paddingHorizontal: spacing['5'],
                        paddingVertical: spacing['3'],
                        borderRadius: radius.md,
                      })}
                    >
                      <Text style={{ color: colors.text.inverse, fontFamily: typography.fontFamily.semibold, fontSize: 15 }}>Retry</Text>
                    </Pressable>
                  </>
                ) : !features.serverProxiedAI && !accountId && !apiKey && !isDemoMode ? (
                  /* ── Not connected state ── */
                  <>
                    <View
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        backgroundColor: colors.bg.elevated,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: spacing['5'],
                      }}
                    >
                      <Settings size={36} color={colors.text.muted} />
                    </View>
                    <Text style={{ ...typography.styles.h2, color: colors.text.primary, textAlign: 'center' }}>
                      No conversations yet
                    </Text>
                    <Text style={{ ...typography.styles.body, color: colors.text.muted, textAlign: 'center', marginTop: spacing['2'] }}>
                      Connect Hostaway to get started.
                    </Text>
                    <Pressable
                      onPress={onOpenSettings}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.7 : 1,
                        marginTop: spacing['5'],
                        backgroundColor: colors.primary.DEFAULT,
                        paddingHorizontal: spacing['5'],
                        paddingVertical: spacing['3'],
                        borderRadius: radius.md,
                      })}
                    >
                      <Text style={{ color: colors.text.inverse, fontFamily: typography.fontFamily.semibold, fontSize: 15 }}>Go to Settings</Text>
                    </Pressable>
                  </>
                ) : (
                  /* ── Filter-specific empty states ── */
                  <>
                    <View
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        backgroundColor: activeFilter === 'unread' ? colors.primary.muted : colors.bg.elevated,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: spacing['5'],
                      }}
                    >
                      {activeFilter === 'unread' ? (
                        <CheckCircle2 size={36} color={colors.primary.DEFAULT} />
                      ) : activeFilter === 'check_in' ? (
                        <DoorOpen size={36} color={colors.primary.DEFAULT} />
                      ) : activeFilter === 'check_out' ? (
                        <LogOut size={36} color={colors.primary.DEFAULT} />
                      ) : (
                        <Inbox size={36} color={colors.text.muted} />
                      )}
                    </View>
                    <Text style={{ ...typography.styles.h2, color: colors.text.primary, textAlign: 'center' }}>
                      {selectedPropertyId
                        ? 'No conversations for this property'
                        : activeFilter === 'unread'
                        ? 'All caught up!'
                        : activeFilter === 'check_in'
                        ? 'No upcoming check-ins'
                        : activeFilter === 'check_out'
                        ? 'No upcoming check-outs'
                        : 'No conversations yet'}
                    </Text>
                    <Text style={{ ...typography.styles.body, color: colors.text.muted, textAlign: 'center', marginTop: spacing['2'] }}>
                      {selectedPropertyId
                        ? 'Try selecting "All Properties" to see all conversations.'
                        : activeFilter === 'unread'
                        ? 'No unread messages to review.'
                        : activeFilter === 'check_in'
                        ? 'No guests arriving in the next 48 hours.'
                        : activeFilter === 'check_out'
                        ? 'No guests departing in the next 48 hours.'
                        : 'Pull down to refresh, or new messages will appear automatically.'}
                    </Text>
                    {selectedPropertyId && (
                      <Pressable
                        onPress={() => setSelectedProperty(null)}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.7 : 1,
                          marginTop: spacing['5'],
                          backgroundColor: colors.primary.DEFAULT,
                          paddingHorizontal: spacing['5'],
                          paddingVertical: spacing['3'],
                          borderRadius: radius.md,
                        })}
                      >
                        <Text style={{ color: colors.text.inverse, fontFamily: typography.fontFamily.semibold, fontSize: 15 }}>View All Properties</Text>
                      </Pressable>
                    )}
                  </>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </SafeAreaView>

      {/* Bulk Action Bar */}
      {isSelectMode && (
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.bg.elevated,
          borderTopWidth: 1,
          borderTopColor: colors.border.subtle,
          paddingBottom: spacing['8'],
          paddingTop: spacing['3'],
          paddingHorizontal: spacing['4'],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Pressable
            onPress={() => {
              setIsSelectMode(false);
              setSelectedIds(new Set());
            }}
            accessibilityRole="button"
            accessibilityLabel="Cancel selection"
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: spacing['2'],
              paddingHorizontal: spacing['3'],
            })}
          >
            <X size={18} color={colors.text.muted} />
            <Text style={{ color: colors.text.muted, fontFamily: typography.fontFamily.medium, fontSize: 14, marginLeft: spacing['1'] }}>Cancel</Text>
          </Pressable>

          <Text style={{ color: colors.text.secondary, fontFamily: typography.fontFamily.semibold, fontSize: 14 }}>
            {selectedIds.size} selected
          </Text>

          <View style={{ flexDirection: 'row', gap: spacing['2'] }}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                selectedIds.forEach((id) => archiveConversation(id));
                setIsSelectMode(false);
                setSelectedIds(new Set());
              }}
              disabled={selectedIds.size === 0}
              accessibilityRole="button"
              accessibilityLabel={`Archive ${selectedIds.size} selected conversations`}
              accessibilityState={{ disabled: selectedIds.size === 0 }}
              style={({ pressed }) => ({
                opacity: selectedIds.size === 0 ? 0.4 : pressed ? 0.7 : 1,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.bg.hover,
                paddingVertical: spacing['2'],
                paddingHorizontal: spacing['3'],
                borderRadius: radius.md,
              })}
            >
              <Archive size={16} color={colors.text.primary} />
              <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.semibold, fontSize: 13, marginLeft: spacing['1'] }}>Archive</Text>
            </Pressable>
          </View>
        </View>
      )}

      <UndoToast />
    </View>
  );
}
