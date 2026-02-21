import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl, AppState, type AppStateStatus, Animated as RNAnimated, Easing, FlatList } from 'react-native';
import { colors, typography, spacing, radius } from '@/lib/design-tokens';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore, type Conversation, type InboxSortPreference, type Guest } from '@/lib/store';
import { ConversationItem } from './ConversationItem';
import { PropertySelector } from './PropertySelector';

import { PremiumPressable } from '@/components/ui';
import {
  Inbox,
  Archive,
  AlertTriangle,
  Settings,
  Sparkles,
  CheckCircle,
  Clock,
  ListTodo,
  Frown,
  Calendar,
  RefreshCw,
  CheckSquare,
  Square,
  X,
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

// Format relative time for last sync
function formatLastSync(date: Date | null): string {
  if (!date) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return 'Over 1h ago';
}

// Spinning sync icon component
function SyncIndicator({ isSyncing }: { isSyncing: boolean }) {
  const spinValue = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (isSyncing) {
      spinValue.setValue(0);
      RNAnimated.loop(
        RNAnimated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.stopAnimation();
    }
  }, [isSyncing, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <RNAnimated.View style={{ transform: [{ rotate: spin }] }}>
      <RefreshCw size={12} color={isSyncing ? '#14B8A6' : '#9CA3AF'} />
    </RNAnimated.View>
  );
}

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

type FilterTab = 'all' | 'todo' | 'follow_up' | 'urgent' | 'ai_drafts' | 'resolved' | 'archived' | 'negative';

interface InboxDashboardProps {
  onSelectConversation: (id: string) => void;
  onOpenSettings: () => void;
  onOpenCalendar?: () => void;
}

// convertListingToProperty, getChannelPlatform, convertHostawayMessage imported from '@/lib/hostaway-utils'

export function InboxDashboard({ onSelectConversation, onOpenSettings, onOpenCalendar }: InboxDashboardProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [isPropertySelectorOpen, setPropertySelectorOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const flatListRef = useRef<FlatList<any>>(null);

  const conversations = useAppStore((s) => s.conversations);
  const properties = useAppStore((s) => s.properties);
  const selectedPropertyId = useAppStore((s) => s.settings.selectedPropertyId);
  const accountId = useAppStore((s) => s.settings.accountId);
  const apiKey = useAppStore((s) => s.settings.apiKey);
  const inboxSortPreference = useAppStore((s) => s.settings.inboxSortPreference);
  const setSelectedProperty = useAppStore((s) => s.setSelectedProperty);
  const setProperties = useAppStore((s) => s.setProperties);
  const setConversations = useAppStore((s) => s.setConversations);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const autoPilotEnabled = useAppStore((s) => s.settings.autoPilotEnabled);

  const settings = useAppStore((s) => s.settings);
  const scheduledMessages = useAppStore((s) => s.scheduledMessages);
  const archiveConversation = useAppStore((s) => s.archiveConversation);

  // Multi-select mode for bulk archival
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Track if initial load has happened
  const hasInitialLoaded = useRef(false);
  const lastRefreshTime = useRef<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isSilentRefreshing, setIsSilentRefreshing] = useState(false);

  const filteredConversations = useMemo(() => {
    let result = [...conversations];

    if (selectedPropertyId) {
      result = result.filter((c) => c.property.id === selectedPropertyId);
    }

    switch (activeFilter) {
      case 'todo':
        result = result.filter((c) => c.workflowStatus === 'todo' || (!c.workflowStatus && c.unreadCount > 0));
        break;
      case 'follow_up':
        result = result.filter((c) => c.workflowStatus === 'follow_up');
        break;
      case 'urgent':
        result = result.filter((c) => c.status === 'urgent');
        break;
      case 'ai_drafts':
        result = result.filter((c) => c.hasAiDraft === true);
        break;
      case 'resolved':
        result = result.filter((c) => c.workflowStatus === 'resolved');
        break;
      case 'archived':
        result = result.filter((c) => c.status === 'archived' || c.workflowStatus === 'archived');
        break;
      case 'negative':
        result = result.filter((c) => {
          const sentiment = analyzeConversationSentiment(c);
          return sentiment.currentSentiment === 'negative' ||
            sentiment.currentSentiment === 'frustrated' ||
            sentiment.currentSentiment === 'urgent' ||
            sentiment.escalationRequired;
        });
        break;
      default:
        result = result.filter((c) => c.status !== 'archived' && c.workflowStatus !== 'archived');
        break;
    }

    return applySortPreference(result, inboxSortPreference);
  }, [conversations, selectedPropertyId, activeFilter, inboxSortPreference]);

  // Smart Inbox: split into "Needs Reply" and "Responded" sections
  const { needsReply, responded } = useMemo(() => {
    const needs: Conversation[] = [];
    const done: Conversation[] = [];

    for (const conv of filteredConversations) {
      const lastMsg = conv.messages?.[conv.messages.length - 1];
      const isNeedsReply =
        conv.unreadCount > 0 ||
        conv.hasAiDraft ||
        (lastMsg?.sender === 'guest') ||
        conv.status === 'urgent' ||
        conv.workflowStatus === 'todo';

      if (isNeedsReply) {
        needs.push(conv);
      } else {
        done.push(conv);
      }
    }

    return { needsReply: needs, responded: done };
  }, [filteredConversations]);

  // Build sectioned data for FlatList (type-tagged for rendering)
  type SectionItem = { type: 'header'; title: string; count: number } | { type: 'conversation'; data: Conversation; dimmed: boolean };
  const sectionedData = useMemo((): SectionItem[] => {
    const items: SectionItem[] = [];

    if (needsReply.length > 0) {
      items.push({ type: 'header', title: 'Needs Reply', count: needsReply.length });
      for (const conv of needsReply) {
        items.push({ type: 'conversation', data: conv, dimmed: false });
      }
    }

    if (responded.length > 0) {
      items.push({ type: 'header', title: 'Responded', count: responded.length });
      for (const conv of responded) {
        items.push({ type: 'conversation', data: conv, dimmed: true });
      }
    }

    return items;
  }, [needsReply, responded]);

  const stats = useMemo(() => {
    const active = conversations.filter((c) => c.status !== 'archived' && c.workflowStatus !== 'archived');

    const negativeCount = active.filter((c) => {
      const sentiment = analyzeConversationSentiment(c);
      return sentiment.currentSentiment === 'negative' ||
        sentiment.currentSentiment === 'frustrated' ||
        sentiment.currentSentiment === 'urgent' ||
        sentiment.escalationRequired;
    }).length;

    return {
      total: active.length,
      urgent: conversations.filter((c) => c.status === 'urgent').length,
      unread: active.reduce((sum, c) => sum + c.unreadCount, 0),
      drafts: conversations.filter((c) => c.hasAiDraft === true).length,
      todo: conversations.filter((c) => c.workflowStatus === 'todo' || (!c.workflowStatus && c.unreadCount > 0)).length,
      followUp: conversations.filter((c) => c.workflowStatus === 'follow_up').length,
      resolved: conversations.filter((c) => c.workflowStatus === 'resolved').length,
      negative: negativeCount,
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
      await new Promise((resolve) => setTimeout(resolve, 1000));
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
      const convSlice = hostawayConversations.slice(0, 20);

      const newConversations: Conversation[] = [];

      for (let i = 0; i < convSlice.length; i++) {
        const conv = convSlice[i];
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
            unreadCount: conv.isRead ? 0 : 1,
            status: conv.isArchived ? 'archived' : 'active',
            checkInDate,
            checkOutDate,
            numberOfGuests,
            platform: getChannelPlatform(conv.channelName, conv.channelId, conv.source),
            hasAiDraft: false,
          };

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

  // Auto-refresh on mount
  useEffect(() => {
    if (!hasInitialLoaded.current && !isDemoMode && accountId && apiKey) {
      hasInitialLoaded.current = true;
      console.log('[Inbox] Auto-refreshing on mount...');
      handleRefresh();
    }
  }, [isDemoMode, accountId, apiKey, handleRefresh]);

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

  const tabs: { id: FilterTab; label: string; icon: React.ComponentType<{ size: number; color: string }>; count?: number }[] = [
    { id: 'all', label: 'All', icon: Inbox, count: stats.total },
    { id: 'todo', label: 'Unread', icon: ListTodo, count: stats.unread },
    { id: 'negative', label: 'Attention', icon: Frown, count: stats.negative },
    { id: 'urgent', label: 'Urgent', icon: AlertTriangle, count: stats.urgent },
    { id: 'ai_drafts', label: 'AI Drafts', icon: Sparkles, count: stats.drafts },
    { id: 'follow_up', label: 'Follow-Up', icon: Clock, count: stats.followUp },
    { id: 'resolved', label: 'Done', icon: CheckCircle, count: stats.resolved },
    { id: 'archived', label: 'Archived', icon: Archive },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.base }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View
          style={{
            paddingHorizontal: spacing['4'],
            paddingTop: spacing['3'],
            paddingBottom: spacing['2'],
            backgroundColor: colors.bg.card,
          }}
        >
          {/* Title Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 28, fontFamily: typography.fontFamily.bold, color: colors.text.primary, letterSpacing: -0.5 }}>
              Inbox
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Connection Status */}
              {isDemoMode ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: spacing['3'] }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary.DEFAULT, marginRight: 6 }} />
                  <Text style={{ fontSize: 12, color: colors.primary.DEFAULT, fontFamily: typography.fontFamily.semibold }}>Demo</Text>
                </View>
              ) : accountId ? (
                <PremiumPressable
                  hapticFeedback="light"
                  onPress={() => handleRefresh(false)}
                  style={{ flexDirection: 'row', alignItems: 'center', marginRight: spacing['3'] }}
                >
                  <SyncIndicator isSyncing={isSilentRefreshing || isRefreshing} />
                  <Text style={{ fontSize: 11, color: isSilentRefreshing ? colors.primary.DEFAULT : colors.text.muted, fontFamily: typography.fontFamily.medium, marginLeft: 4 }}>
                    {isSilentRefreshing ? 'Syncing...' : lastSyncTime ? formatLastSync(lastSyncTime) : 'Tap to sync'}
                  </Text>
                </PremiumPressable>
              ) : null}

              {autoPilotEnabled && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.primary.muted,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: radius.sm,
                    marginRight: 10,
                  }}
                >
                  <Sparkles size={14} color={colors.primary.DEFAULT} />
                  <Text style={{ color: colors.primary.DEFAULT, fontSize: 12, fontFamily: typography.fontFamily.semibold, marginLeft: 5 }}>Auto</Text>
                </View>
              )}

              {onOpenCalendar && (
                <PremiumPressable
                  hapticFeedback="light"
                  onPress={onOpenCalendar}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.md,
                    backgroundColor: colors.bg.elevated,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8,
                  }}
                >
                  <Calendar size={20} color={colors.text.muted} />
                </PremiumPressable>
              )}

              <PremiumPressable
                hapticFeedback="light"
                onPress={onOpenSettings}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Settings size={20} color={colors.text.muted} />
              </PremiumPressable>
            </View>
          </View>

          {/* Property Selector - Larger, More Prominent */}
          <View style={{ marginTop: 16, marginBottom: 12 }}>
            <PropertySelector
              properties={properties}
              selectedId={selectedPropertyId}
              onSelect={setSelectedProperty}
              isOpen={isPropertySelectorOpen}
              onToggle={() => setPropertySelectorOpen(!isPropertySelectorOpen)}
            />
          </View>
        </View>

        {/* Filter Chips — Apple-clean text pills */}
        <View style={{ paddingVertical: spacing['2'], backgroundColor: colors.bg.subtle }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing['4'], gap: 6 }}
            style={{ flexGrow: 0 }}
          >
            {tabs.map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <PremiumPressable
                  hapticFeedback="light"
                  key={tab.id}
                  onPress={() => handleFilterChange(tab.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: radius.full,
                    backgroundColor: isActive ? colors.primary.DEFAULT : 'transparent',
                    borderWidth: isActive ? 0 : 1,
                    borderColor: isActive ? 'transparent' : colors.border.DEFAULT,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: typography.fontFamily.medium,
                      fontSize: 14,
                      color: isActive ? '#FFFFFF' : colors.text.primary,
                    }}
                  >
                    {tab.label}
                  </Text>
                  {tab.count !== undefined && tab.count > 0 && (
                    <Text
                      style={{
                        marginLeft: 6,
                        fontSize: 12,
                        fontFamily: typography.fontFamily.semibold,
                        color: isActive ? 'rgba(255,255,255,0.8)' : colors.text.muted,
                      }}
                    >
                      {tab.count}
                    </Text>
                  )}
                </PremiumPressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Conversation List - Light gray background for card separation */}
        <View style={{ flex: 1, backgroundColor: colors.bg.base }}>
          {filteredConversations.length > 0 ? (
            <FlatList
              ref={flatListRef}
              data={sectionedData}
              windowSize={5}
              maxToRenderPerBatch={8}
              initialNumToRender={10}
              removeClippedSubviews={false}
              renderItem={({ item: sectionItem }) => {
                if (sectionItem.type === 'header') {
                  return (
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: spacing['4'],
                      paddingTop: spacing['4'],
                      paddingBottom: spacing['2'],
                      backgroundColor: colors.bg.base,
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: sectionItem.title === 'Needs Reply' ? colors.accent.DEFAULT : colors.text.disabled,
                          marginRight: 8,
                        }} />
                        <Text style={{
                          fontSize: 13,
                          fontFamily: typography.fontFamily.bold,
                          color: colors.text.primary,
                          textTransform: 'uppercase',
                          letterSpacing: 0.8,
                        }}>
                          {sectionItem.title}
                        </Text>
                      </View>
                      <View style={{
                        backgroundColor: sectionItem.title === 'Needs Reply' ? colors.accent.muted : colors.bg.elevated,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: radius.full,
                      }}>
                        <Text style={{
                          fontSize: 12,
                          fontFamily: typography.fontFamily.semibold,
                          color: sectionItem.title === 'Needs Reply' ? colors.accent.DEFAULT : colors.text.muted,
                        }}>
                          {sectionItem.count}
                        </Text>
                      </View>
                    </View>
                  );
                }

                const item = sectionItem.data;
                return (
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
                    style={{ opacity: sectionItem.dimmed ? 0.6 : 1 }}
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
                );
              }}
              keyExtractor={(item) => item.type === 'header' ? `header-${item.title}` : item.data.id}
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
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: radius.xl,
                    backgroundColor: colors.bg.elevated,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
                  }}
                >
                  <Inbox size={36} color={colors.text.muted} />
                </View>
                <Text style={{ fontSize: 20, fontFamily: typography.fontFamily.bold, color: colors.text.primary, textAlign: 'center' }}>
                  {selectedPropertyId
                    ? 'No conversations for this property'
                    : 'No conversations'}
                </Text>
                <Text style={{ fontSize: 15, fontFamily: typography.fontFamily.regular, color: colors.text.muted, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
                  {selectedPropertyId
                    ? `Try selecting "All Properties" to see all conversations.`
                    : activeFilter === 'urgent'
                    ? "No urgent messages at the moment."
                    : activeFilter === 'archived'
                    ? "No archived conversations."
                    : activeFilter === 'ai_drafts'
                    ? "No AI drafts pending review."
                    : "Pull down to refresh your inbox."}
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
