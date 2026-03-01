import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, RefreshControl, AppState, type AppStateStatus, FlatList } from 'react-native';
import { colors, typography, spacing, radius } from '@/lib/design-tokens';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore, type Conversation, type InboxSortPreference, type Guest } from '@/lib/store';
import { getDemoConversations } from '@/lib/demo-data';
import { ConversationItem } from './ConversationItem';
import { DemoModeBanner } from './DemoModeBanner';

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
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  fetchListings,
  fetchConversations,
  fetchMessages,
  fetchReservation,
  extractGuestName,
} from '@/lib/hostaway';
import {
  analyzeConversationSentiment,
  SENTIMENT_PRIORITY,
} from '@/lib/sentiment-analysis';
import { checkAndSendScheduledMessages } from '@/lib/automation-engine';
import { convertListingToProperty, getChannelPlatform, convertHostawayMessage } from '@/lib/hostaway-utils';
import { UndoToast } from './UndoToast';
import {
  notifyNewGuestMessage,
  notifyAutomationSent,
  setBadgeCount,
} from '@/lib/push-notifications';




// Helper function to get the effective timestamp for sorting
function getEffectiveTimestamp(conversation: Conversation): number {
  if (conversation.lastActivityTimestamp) {
    return new Date(conversation.lastActivityTimestamp).getTime();
  }
  if (conversation.lastMessage?.timestamp) {
    return new Date(conversation.lastMessage.timestamp).getTime();
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
    const unreadA = a.unreadCount > 0 ? 1 : 0;
    const unreadB = b.unreadCount > 0 ? 1 : 0;
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

type FilterTab = 'all' | 'unread' | 'check_in' | 'check_out';

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

  const selectedPropertyId = useAppStore((s) => s.settings.selectedPropertyId);
  const accountId = useAppStore((s) => s.settings.accountId);
  const apiKey = useAppStore((s) => s.settings.apiKey);
  const inboxSortPreference = useAppStore((s) => s.settings.inboxSortPreference);
  const setSelectedProperty = useAppStore((s) => s.setSelectedProperty);
  const setProperties = useAppStore((s) => s.setProperties);
  const setConversations = useAppStore((s) => s.setConversations);
  const isDemoMode = useAppStore((s) => s.isDemoMode);


  const settings = useAppStore((s) => s.settings);
  const scheduledMessages = useAppStore((s) => s.scheduledMessages);
  const archiveConversation = useAppStore((s) => s.archiveConversation);

  // Multi-select mode for bulk archival
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Track if initial load has happened
  const hasInitialLoaded = useRef(false);
  const lastRefreshTime = useRef<number>(0);
  const [, setLastSyncTime] = useState<Date | null>(null);
  const [isSilentRefreshing, setIsSilentRefreshing] = useState(false);

  const filteredConversations = useMemo(() => {
    let result = [...conversations];

    if (selectedPropertyId) {
      result = result.filter((c) => c.property.id === selectedPropertyId);
    }

    // Filter by active tab
    switch (activeFilter) {
      case 'unread':
        // A conversation is truly unread only when:
        // 1. It has unreadCount > 0, AND
        // 2. The last message is from a guest (host hasn't replied yet)
        // This matches ConversationItem's visual isUnread logic
        result = result.filter((c) => {
          if (c.unreadCount <= 0) return false;
          const lastSender = c.lastMessage?.sender;
          return lastSender !== 'host'; // Host already replied = not unread
        });
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
      unread: active.filter((c) => c.unreadCount > 0 && c.lastMessage?.sender !== 'host').length,
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

  const handleRefresh = useCallback(async (silent = false) => {
    if (silent) {
      setIsSilentRefreshing(true);
    } else {
      setIsRefreshing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (isDemoMode || !accountId || !apiKey) {
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

      const listings = await fetchListings(accountId, apiKey);
      const newProperties = listings.map(convertListingToProperty);
      setProperties(newProperties);
      console.log(`[Refresh] Updated ${newProperties.length} properties`);

      const hostawayConversations = await fetchConversations(accountId, apiKey);
      console.log(`[Refresh] Found ${hostawayConversations.length} conversations`);

      // Build a lookup of existing conversations to preserve local state
      const existingMap = new Map(conversations.map(c => [c.id, c]));

      const newConversations: Conversation[] = [];

      // Fetch full message details for the most recent 30 conversations
      // Beyond that, show them in the list using summary data from API
      const DETAIL_LIMIT = 30;

      for (let i = 0; i < hostawayConversations.length; i++) {
        const conv = hostawayConversations[i];

        // For conversations beyond the detail limit, create lightweight entries
        if (i >= DETAIL_LIMIT) {
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
              timestamp: new Date(conv.lastMessageSentAt || Date.now()),
              isRead: true,
            } : undefined,
            unreadCount: (() => {
              const existing = existingMap.get(String(conv.id));
              if (!existing) return conv.isRead ? 0 : 1; // New conversation: use Hostaway
              if (existing.unreadCount === 0) {
                // Was read locally — only mark unread if there's a genuinely new message
                const existingTs = existing.lastMessage?.timestamp ? new Date(existing.lastMessage.timestamp).getTime() : 0;
                const newTs = conv.lastMessageSentAt ? new Date(conv.lastMessageSentAt).getTime() : 0;
                return newTs > existingTs ? 1 : 0;
              }
              return existing.unreadCount; // Preserve existing unread count
            })(),
            status: conv.isArchived ? 'archived' : 'active',
            checkInDate: conv.arrivalDate ? new Date(conv.arrivalDate) : undefined,
            checkOutDate: conv.departureDate ? new Date(conv.departureDate) : undefined,
            platform: getChannelPlatform(conv.channelName, conv.channelId, conv.source),
            hasAiDraft: false,
          };
          // Preserve local state
          const existing = existingMap.get(lightConv.id);
          if (existing) {
            lightConv.hasAiDraft = existing.hasAiDraft;
            lightConv.workflowStatus = existing.workflowStatus;
            lightConv.lastActivityTimestamp = existing.lastActivityTimestamp;
          }
          newConversations.push(lightConv);
          continue;
        }
        try {
          const messages = await fetchMessages(accountId, apiKey, conv.id);

          const property = newProperties.find((p) => p.id === String(conv.listingMapId)) || {
            id: String(conv.listingMapId),
            name: conv.listingName || 'Unknown Property',
            address: '',
          };

          let guestName = extractGuestName(conv);
          let numberOfGuests: number | undefined;
          let checkInDate: Date | undefined = conv.arrivalDate ? new Date(conv.arrivalDate) : undefined;
          let checkOutDate: Date | undefined = conv.departureDate ? new Date(conv.departureDate) : undefined;

          if (conv.reservationId) {
            console.log(`[Refresh] Fetching reservation ${conv.reservationId} for guest details...`);
            const reservation = await fetchReservation(accountId, apiKey, conv.reservationId);
            if (reservation) {
              // Get guest name if unknown
              if (guestName === 'Unknown Guest') {
                const resName = reservation.guestName ||
                  `${reservation.guestFirstName || ''} ${reservation.guestLastName || ''}`.trim();
                if (resName) {
                  guestName = resName;
                  console.log(`[Refresh] Got guest name from reservation: ${guestName}`);
                }
              }
              // Get number of guests (adults + children)
              const adults = reservation.adults || 0;
              const children = reservation.children || 0;
              numberOfGuests = adults + children;
              console.log(`[Refresh] Got guest count from reservation: ${numberOfGuests} (${adults} adults, ${children} children)`);

              // Get dates from reservation if not in conversation
              if (!checkInDate && reservation.arrivalDate) {
                checkInDate = new Date(reservation.arrivalDate);
                console.log(`[Refresh] Got check-in date from reservation: ${checkInDate}`);
              }
              if (!checkOutDate && reservation.departureDate) {
                checkOutDate = new Date(reservation.departureDate);
                console.log(`[Refresh] Got check-out date from reservation: ${checkOutDate}`);
              }
            }
          }

          const guest: Guest = {
            id: String(conv.id),
            name: guestName,
            avatar: conv.guestPicture || conv.guest?.picture,
            email: conv.guestEmail || conv.guest?.email,
            phone: conv.guestPhone || conv.guest?.phone,
          };

          console.log(`[Refresh] Conversation ${conv.id} guest: ${guest.name}`);

          const convertedMessages = messages.map((m) => convertHostawayMessage(m, String(conv.id)));
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
              if (!existing) return conv.isRead ? 0 : 1; // New conversation: use Hostaway
              if (existing.unreadCount === 0) {
                // Was read locally — only mark unread if there's a genuinely new message
                const existingTs = existing.lastMessage?.timestamp ? new Date(existing.lastMessage.timestamp).getTime() : 0;
                const newLastMsg = sortedMessages[sortedMessages.length - 1];
                const newTs = newLastMsg?.timestamp ? new Date(newLastMsg.timestamp).getTime() : 0;
                return newTs > existingTs ? 1 : 0;
              }
              return existing.unreadCount; // Preserve existing unread count
            })(),
            status: conv.isArchived ? 'archived' : 'active',
            checkInDate,
            checkOutDate,
            numberOfGuests,
            platform: getChannelPlatform(conv.channelName, conv.channelId, conv.source),
            hasAiDraft: false,
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

          newConversations.push(conversation);
        } catch (msgError) {
          console.error(`[Refresh] Failed to fetch messages for conversation ${conv.id}:`, msgError);
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

      // Update badge count
      const totalUnread = newConversations.reduce((sum, c) => sum + c.unreadCount, 0);
      setBadgeCount(totalUnread).catch(console.error);

      // Run automation engine
      if (scheduledMessages.length > 0) {
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
            accountId,
            apiKey,
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
      if (!silent) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }

    setIsRefreshing(false);
    setIsSilentRefreshing(false);
  }, [isDemoMode, accountId, apiKey, setProperties, setConversations, conversations, scheduledMessages, settings]);

  // Auto-refresh on mount (or load demo data)
  useEffect(() => {
    if (!hasInitialLoaded.current) {
      hasInitialLoaded.current = true;
      if (!isDemoMode && accountId && apiKey) {
        console.log('[Inbox] Auto-refreshing on mount...');
        handleRefresh();
      } else if (isDemoMode || (!accountId && !apiKey)) {
        // Load demo conversations for reviewers / first-time users
        if (conversations.length === 0) {
          console.log('[Inbox] Loading demo data...');
          setConversations(getDemoConversations());
        }
      }
    }
  }, [isDemoMode, accountId, apiKey, handleRefresh, conversations.length, setConversations]);

  // Auto-refresh every 30 seconds while inbox is open
  useEffect(() => {
    if (isDemoMode || !accountId || !apiKey) return;

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
      if (nextAppState === 'active' && !isDemoMode && accountId && apiKey) {
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
    { id: 'check_in', label: 'Check-in', icon: Clock, count: stats.checkIn },
    { id: 'check_out', label: 'Check-out', icon: Clock, count: stats.checkOut },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* ── Rork-style Header ── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, backgroundColor: '#FFFFFF' }}>
          <Text style={{ fontSize: 32, fontFamily: typography.fontFamily.bold, color: '#000000', letterSpacing: -0.5 }} accessibilityRole="header">
            Inbox
          </Text>
        </View>

        {/* ── Search Bar ── */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 4, backgroundColor: '#FFFFFF' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E5E5EA', borderRadius: 10, paddingHorizontal: 10, height: 36 }}>
            <Search size={16} color="#8E8E93" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search guests, properties..."
              placeholderTextColor="#8E8E93"
              style={{ flex: 1, fontSize: 16, color: '#000', marginLeft: 6, paddingVertical: 0 }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search guests and properties"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={12} accessible accessibilityRole="button" accessibilityLabel="Clear search">
                <X size={16} color="#8E8E93" />
              </Pressable>
            )}
          </View>
        </View>

        {/* ── Rork-style Filter Pills (horizontal scroll) ── */}
        <View style={{ paddingVertical: 8, backgroundColor: '#FFFFFF' }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
            style={{ flexGrow: 0 }}
          >
            {tabs.map((tab) => {
              const isActive = activeFilter === tab.id;
              const TabIcon = tab.icon;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => handleFilterChange(tab.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 20,
                    backgroundColor: isActive ? colors.primary.DEFAULT : '#FFFFFF',
                  }}
                >
                  <TabIcon size={14} color={isActive ? '#FFFFFF' : '#6B7280'} />
                  <Text
                    style={{
                      fontFamily: typography.fontFamily.medium,
                      fontSize: 14,
                      color: isActive ? '#FFFFFF' : '#1F2937',
                      marginLeft: 6,
                    }}
                  >
                    {tab.label}
                  </Text>
                  {tab.count !== undefined && tab.count > 0 && (
                    <View style={{
                      marginLeft: 6,
                      backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : colors.primary.DEFAULT,
                      borderRadius: 10,
                      minWidth: 20,
                      height: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 5,
                    }}>
                      <Text style={{ fontSize: 11, fontFamily: typography.fontFamily.semibold, color: '#FFFFFF' }}>
                        {tab.count}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Demo Mode Banner */}
        {(isDemoMode || (!accountId && !apiKey)) && (
          <DemoModeBanner
            onConnectPMS={() => {
              // Navigate to settings to connect PMS — use dynamic import to avoid circular deps
              import('expo-router').then(({ router }) => router.push('/(tabs)/settings'));
            }}
          />
        )}

        {/* Conversation List — clean white background, cards have shadow for separation */}
        <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
          {filteredConversations.length > 0 ? (
            <FlatList
              ref={flatListRef}
              data={filteredConversations}
              windowSize={5}
              maxToRenderPerBatch={8}
              initialNumToRender={10}
              removeClippedSubviews={false}
              renderItem={({ item }) => (
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
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
              )}
              keyExtractor={(item) => item.id}
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
                <RefreshControl refreshing={isRefreshing} onRefresh={() => handleRefresh(false)} tintColor="#14B8A6" colors={['#14B8A6']} />
              }
            >
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['8'] }}>
                {/* Filter-specific empty state icons */}
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: activeFilter === 'unread' ? colors.primary.muted : colors.bg.elevated,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
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
                <Text style={{ fontSize: 20, fontFamily: typography.fontFamily.bold, color: colors.text.primary, textAlign: 'center' }}>
                  {selectedPropertyId
                    ? 'No conversations for this property'
                    : activeFilter === 'unread'
                    ? 'All caught up!'
                    : activeFilter === 'check_in'
                    ? 'No upcoming check-ins'
                    : activeFilter === 'check_out'
                    ? 'No upcoming check-outs'
                    : 'No conversations'}
                </Text>
                <Text style={{ fontSize: 15, fontFamily: typography.fontFamily.regular, color: colors.text.muted, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
                  {selectedPropertyId
                    ? 'Try selecting "All Properties" to see all conversations.'
                    : activeFilter === 'unread'
                    ? 'No unread messages to review.'
                    : activeFilter === 'check_in'
                    ? 'No guests arriving in the next 48 hours.'
                    : activeFilter === 'check_out'
                    ? 'No guests departing in the next 48 hours.'
                    : 'Pull down to refresh your inbox.'}
                </Text>
                {selectedPropertyId && (
                  <Pressable
                    onPress={() => setSelectedProperty(null)}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.7 : 1,
                      marginTop: 20,
                      backgroundColor: colors.primary.DEFAULT,
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      borderRadius: radius.md,
                      shadowColor: colors.primary.DEFAULT,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 4,
                    })}
                  >
                    <Text style={{ color: '#FFFFFF', fontFamily: typography.fontFamily.semibold, fontSize: 15 }}>View All Properties</Text>
                  </Pressable>
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
          paddingBottom: 34,
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
