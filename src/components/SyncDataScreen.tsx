import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/lib/store';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Home,
  MessageSquare,
  Users,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  fetchListings,
  fetchConversations,
  fetchMessages,
  fetchReservation,
  extractGuestName,
} from '@/lib/hostaway';
import { convertListingToProperty, getChannelPlatform, convertHostawayMessage } from '@/lib/hostaway-utils';
import type { Conversation, Guest } from '@/lib/store';

interface SyncDataScreenProps {
  onBack: () => void;
}

function formatTimeAgo(date: Date | null): string {
  if (!date) return 'Never';
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

// convertListingToProperty, getChannelPlatform, convertHostawayMessage imported from '@/lib/hostaway-utils'

export function SyncDataScreen({ onBack }: SyncDataScreenProps) {
  const properties = useAppStore((s) => s.properties);
  const conversations = useAppStore((s) => s.conversations);
  const accountId = useAppStore((s) => s.settings.accountId);
  const apiKey = useAppStore((s) => s.settings.apiKey);
  const setProperties = useAppStore((s) => s.setProperties);
  const setConversations = useAppStore((s) => s.setConversations);
  const historySyncStatus = useAppStore((s) => s.historySyncStatus);
  const updateHistorySyncStatus = useAppStore((s) => s.updateHistorySyncStatus);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState('');

  const rotation = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const isConnected = !!(accountId && apiKey);
  const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0);
  const totalGuests = new Set(conversations.map((c) => c.guest.id)).size;

  const syncItems = [
    {
      id: 'properties',
      label: 'Properties',
      icon: Home,
      count: properties.length,
      lastSynced: historySyncStatus.lastFullSync,
      color: '#14B8A6',
    },
    {
      id: 'conversations',
      label: 'Conversations',
      icon: MessageSquare,
      count: conversations.length,
      lastSynced: historySyncStatus.lastFullSync,
      color: '#3B82F6',
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: MessageSquare,
      count: totalMessages,
      lastSynced: historySyncStatus.lastFullSync,
      color: '#8B5CF6',
    },
    {
      id: 'guests',
      label: 'Guest Profiles',
      icon: Users,
      count: totalGuests,
      lastSynced: historySyncStatus.lastFullSync,
      color: '#F59E0B',
    },
  ];

  const handleSync = useCallback(async () => {
    if (!accountId || !apiKey) {
      Alert.alert('Not Connected', 'Please connect your Hostaway account in Settings first.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSyncing(true);
    setSyncError(null);
    setSyncProgress('Connecting to Hostaway...');
    rotation.value = withRepeat(
      withTiming(360, { duration: 1000, easing: Easing.linear }),
      -1,
      false
    );

    updateHistorySyncStatus({ isSyncing: true, syncPhase: 'conversations', syncError: null });

    try {
      // Fetch properties
      setSyncProgress('Fetching properties...');
      const listings = await fetchListings(accountId, apiKey);
      const newProperties = listings.map(convertListingToProperty);
      setProperties(newProperties);

      // Fetch conversations
      setSyncProgress(`Fetching conversations...`);
      const hostawayConversations = await fetchConversations(accountId, apiKey);

      updateHistorySyncStatus({ syncPhase: 'messages' });

      const newConversations: Conversation[] = [];
      const total = Math.min(hostawayConversations.length, 30);
      let totalMsgCount = 0;

      for (let i = 0; i < total; i++) {
        const conv = hostawayConversations[i];
        setSyncProgress(`Loading messages ${i + 1}/${total}...`);

        try {
          const messages = await fetchMessages(accountId, apiKey, conv.id);
          totalMsgCount += messages.length;

          const property = newProperties.find((p) => p.id === String(conv.listingMapId)) || {
            id: String(conv.listingMapId),
            name: conv.listingName || 'Unknown Property',
            address: '',
          };

          let guestName = extractGuestName(conv);
          let numberOfGuests: number | undefined;
          let checkInDate = conv.arrivalDate ? new Date(conv.arrivalDate) : undefined;
          let checkOutDate = conv.departureDate ? new Date(conv.departureDate) : undefined;

          if (conv.reservationId) {
            const reservation = await fetchReservation(accountId, apiKey, conv.reservationId);
            if (reservation) {
              if (guestName === 'Unknown Guest') {
                const resName =
                  reservation.guestName ||
                  `${reservation.guestFirstName || ''} ${reservation.guestLastName || ''}`.trim();
                if (resName) guestName = resName;
              }
              numberOfGuests = (reservation.adults || 0) + (reservation.children || 0);
              if (!checkInDate && reservation.arrivalDate)
                checkInDate = new Date(reservation.arrivalDate);
              if (!checkOutDate && reservation.departureDate)
                checkOutDate = new Date(reservation.departureDate);
            }
          }

          const guest: Guest = {
            id: String(conv.id),
            name: guestName,
            avatar: conv.guestPicture || conv.guest?.picture,
            email: conv.guestEmail || conv.guest?.email,
            phone: conv.guestPhone || conv.guest?.phone,
          };

          const convertedMessages = messages
            .map((m) => convertHostawayMessage(m, String(conv.id)))
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

          newConversations.push({
            id: String(conv.id),
            guest,
            property,
            messages: convertedMessages,
            lastMessage: convertedMessages[convertedMessages.length - 1],
            unreadCount: conv.isRead ? 0 : 1,
            status: conv.isArchived ? 'archived' : 'active',
            checkInDate,
            checkOutDate,
            numberOfGuests,
            platform: getChannelPlatform(conv.channelName, conv.channelId, conv.source),
            hasAiDraft: false,
          });
        } catch (msgError) {
          console.error(`[Sync] Failed conversation ${conv.id}:`, msgError);
        }
      }

      setConversations(newConversations);
      updateHistorySyncStatus({
        isSyncing: false,
        syncPhase: 'complete',
        lastFullSync: new Date(),
        totalConversationsSynced: newConversations.length,
        totalMessagesSynced: totalMsgCount,
      });

      setSyncProgress('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setSyncError(errorMsg);
      setSyncProgress('');
      updateHistorySyncStatus({
        isSyncing: false,
        syncPhase: 'error',
        syncError: errorMsg,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    rotation.value = 0;
    setIsSyncing(false);
  }, [
    accountId,
    apiKey,
    rotation,
    setProperties,
    setConversations,
    updateHistorySyncStatus,
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderBottomWidth: 1,
            borderBottomColor: '#E5E7EB',
          }}
        >
          <Pressable
            onPress={onBack}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: '#F3F4F6',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            })}
          >
            <ArrowLeft size={20} color="#374151" />
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>Data Sync</Text>
        </Animated.View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Connection Status Card */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(400)}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: isConnected ? '#D1FAE5' : '#FEE2E2',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              {isConnected ? (
                <Wifi size={20} color="#10B981" />
              ) : (
                <WifiOff size={20} color="#EF4444" />
              )}
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '600',
                  color: isConnected ? '#065F46' : '#991B1B',
                  marginLeft: 10,
                }}
              >
                {isConnected ? 'Connected to Hostaway' : 'Not Connected'}
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 20 }}>
              {isConnected
                ? `Account ${accountId} · Auto-sync every 30s in Inbox`
                : 'Connect your Hostaway account in Settings to sync data.'}
            </Text>
            {historySyncStatus.lastFullSync && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 10,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: '#F3F4F6',
                }}
              >
                <Clock size={13} color="#9CA3AF" />
                <Text style={{ fontSize: 13, color: '#9CA3AF', marginLeft: 6 }}>
                  Last full sync: {formatTimeAgo(historySyncStatus.lastFullSync)}
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Data Sources */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: '#6B7280',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 8,
                marginLeft: 4,
              }}
            >
              Data Sources
            </Text>
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: '#E5E7EB',
              }}
            >
              {syncItems.map((item, index) => (
                <View
                  key={item.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    borderBottomWidth: index < syncItems.length - 1 ? 1 : 0,
                    borderBottomColor: '#F3F4F6',
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: `${item.color}10`,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <item.icon size={20} color={item.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>
                      {item.label}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>
                      {item.count > 0
                        ? `${item.count} items · ${formatTimeAgo(item.lastSynced)}`
                        : 'No data yet'}
                    </Text>
                  </View>
                  {item.count > 0 ? (
                    <View
                      style={{
                        backgroundColor: '#F0FDF4',
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 12,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#16A34A' }}>
                        {item.count}
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={{
                        backgroundColor: '#F3F4F6',
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 12,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#9CA3AF' }}>—</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Error Banner */}
          {syncError && (
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={{
                backgroundColor: '#FEF2F2',
                borderRadius: 12,
                padding: 14,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'flex-start',
                borderWidth: 1,
                borderColor: '#FECACA',
              }}
            >
              <AlertTriangle size={16} color="#DC2626" style={{ marginTop: 1 }} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#991B1B' }}>Sync Failed</Text>
                <Text style={{ fontSize: 13, color: '#DC2626', marginTop: 2 }}>{syncError}</Text>
              </View>
            </Animated.View>
          )}

          {/* Sync Button */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={{ marginBottom: 16 }}>
            <Pressable
              onPress={handleSync}
              disabled={isSyncing || !isConnected}
              style={({ pressed }) => ({
                opacity: pressed || isSyncing ? 0.85 : !isConnected ? 0.5 : 1,
                backgroundColor: '#14B8A6',
                borderRadius: 14,
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#14B8A6',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 3,
              })}
            >
              <Animated.View style={isSyncing ? animatedStyle : undefined}>
                <RefreshCw size={20} color="#FFFFFF" />
              </Animated.View>
              <Text
                style={{
                  color: '#FFFFFF',
                  fontWeight: '600',
                  fontSize: 16,
                  marginLeft: 8,
                }}
              >
                {isSyncing
                  ? syncProgress || 'Syncing...'
                  : isConnected
                  ? 'Sync Now'
                  : 'Connect Hostaway First'}
              </Text>
            </Pressable>
          </Animated.View>

          {/* Info Card */}
          <Animated.View
            entering={FadeInDown.delay(400).duration(400)}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              padding: 16,
              marginBottom: 24,
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <CheckCircle size={16} color="#14B8A6" />
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827', marginLeft: 8 }}>
                Auto-Sync Active
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: '#6B7280', lineHeight: 20 }}>
              Your Inbox automatically syncs with Hostaway every 30 seconds and when you open the
              app. Use this screen for a full data refresh.
            </Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
