import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useAppStore } from './store';
import {
  registerForPushNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  removeNotificationListener,
  getLastNotificationResponse,
  setBadgeCount,
  getStoredPushToken,
  type NotificationData,
} from './notifications';

interface NotificationContextType {
  expoPushToken: string | null;
  isRegistered: boolean;
  isLoadingToken: boolean;
  tokenError: string | null;
  registerForNotifications: () => Promise<void>;
  refreshToken: () => Promise<void>;
  lastNotificationData: NotificationData | null;
}

const NotificationContext = createContext<NotificationContextType>({
  expoPushToken: null,
  isRegistered: false,
  isLoadingToken: false,
  tokenError: null,
  registerForNotifications: async () => {},
  refreshToken: async () => {},
  lastNotificationData: null,
});

export function useNotifications() {
  return useContext(NotificationContext);
}

interface NotificationProviderProps {
  children: React.ReactNode;
  onNotificationTap?: (data: NotificationData) => void;
}

export function NotificationProvider({ children, onNotificationTap }: NotificationProviderProps) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [lastNotificationData, setLastNotificationData] = useState<NotificationData | null>(null);

  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  const conversations = useAppStore((s) => s.conversations);
  const setActiveConversation = useAppStore((s) => s.setActiveConversation);

  // Calculate total unread count for badge
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  // Update badge count when unread count changes
  useEffect(() => {
    setBadgeCount(totalUnread);
  }, [totalUnread]);

  // Register for push notifications (always fetches token regardless of settings)
  const registerForNotifications = useCallback(async () => {
    setIsLoadingToken(true);
    setTokenError(null);
    try {
      const token = await registerForPushNotifications();
      if (token) {
        setExpoPushToken(token);
        setIsRegistered(true);
        console.log('[NotificationProvider] Registered with token:', token);
      } else {
        // Check if it's a device issue
        if (!Device.isDevice) {
          setTokenError('Push notifications require a physical device');
        } else {
          setTokenError('Could not get push token. Check notification permissions.');
        }
      }
    } catch (error) {
      console.error('[NotificationProvider] Error registering:', error);
      setTokenError('Failed to get push token. Please try again.');
    } finally {
      setIsLoadingToken(false);
    }
  }, []);

  // Refresh token - force re-fetch
  const refreshToken = useCallback(async () => {
    setIsLoadingToken(true);
    setTokenError(null);
    try {
      const token = await registerForPushNotifications();
      if (token) {
        setExpoPushToken(token);
        setIsRegistered(true);
        console.log('[NotificationProvider] Token refreshed:', token);
      } else {
        if (!Device.isDevice) {
          setTokenError('Push notifications require a physical device');
        } else {
          setTokenError('Could not refresh token. Check notification permissions.');
        }
      }
    } catch (error) {
      console.error('[NotificationProvider] Error refreshing token:', error);
      setTokenError('Failed to refresh token. Please try again.');
    } finally {
      setIsLoadingToken(false);
    }
  }, []);

  // Handle notification received while app is foregrounded
  const handleNotificationReceived = useCallback((notification: Notifications.Notification) => {
    const rawData = notification.request.content.data as Record<string, unknown> | undefined;

    // Log channel info for all incoming messages (webhook events)
    const channel = rawData?.channel || rawData?.channelName || rawData?.source || 'unknown';
    const channelId = rawData?.channelId;
    console.log(`[NotificationProvider] message.created from ${channel} (channelId: ${channelId}):`, {
      conversationId: rawData?.conversationId,
      guestName: rawData?.guestName,
      propertyId: rawData?.propertyId,
    });

    // Log specifically for Vrbo messages
    const channelStr = String(channel).toLowerCase();
    if (channelStr.includes('vrbo') || channelStr.includes('homeaway') || channelId === 2016) {
      console.log(`[NotificationProvider] Vrbo message received: ${rawData?.conversationId}`);
    }

    if (rawData?.conversationId && typeof rawData.conversationId === 'string') {
      const data: NotificationData = {
        conversationId: rawData.conversationId,
        propertyId: String(rawData.propertyId ?? ''),
        guestName: String(rawData.guestName ?? ''),
        messagePreview: String(rawData.messagePreview ?? ''),
      };
      // Silently update the conversation - the inbox will auto-refresh
      setLastNotificationData(data);
    }
  }, []);

  // Handle notification tap
  const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse) => {
    console.log('[NotificationProvider] Notification tapped:', response);

    const rawData = response.notification.request.content.data as Record<string, unknown> | undefined;
    if (rawData?.conversationId && typeof rawData.conversationId === 'string') {
      const data: NotificationData = {
        conversationId: rawData.conversationId,
        propertyId: String(rawData.propertyId ?? ''),
        guestName: String(rawData.guestName ?? ''),
        messagePreview: String(rawData.messagePreview ?? ''),
      };
      setLastNotificationData(data);

      // Set active conversation for deep linking
      setActiveConversation(data.conversationId);

      // Call the onNotificationTap callback if provided
      onNotificationTap?.(data);
    }
  }, [setActiveConversation, onNotificationTap]);

  // Set up notification listeners
  useEffect(() => {
    // Check for notification that opened the app
    getLastNotificationResponse().then((response) => {
      if (response) {
        handleNotificationResponse(response);
      }
    });

    // Listen for notifications received while app is foregrounded
    notificationListener.current = addNotificationReceivedListener(handleNotificationReceived);

    // Listen for notification taps
    responseListener.current = addNotificationResponseListener(handleNotificationResponse);

    return () => {
      if (notificationListener.current) {
        removeNotificationListener(notificationListener.current);
      }
      if (responseListener.current) {
        removeNotificationListener(responseListener.current);
      }
    };
  }, [handleNotificationReceived, handleNotificationResponse]);

  // Try to load stored token and auto-register on mount
  useEffect(() => {
    let isMounted = true;
    let initTimeoutId: ReturnType<typeof setTimeout> | null = null;

    async function initializeNotifications() {
      if (!isMounted) return;
      setIsLoadingToken(true);

      // Set a max timeout for the entire initialization (15 seconds)
      initTimeoutId = setTimeout(() => {
        if (isMounted && !expoPushToken) {
          console.log('[NotificationProvider] Initialization timed out');
          setIsLoadingToken(false);
          setTokenError('Token request timed out. Tap Refresh to try again.');
        }
      }, 15000);

      try {
        // First try to load any stored token
        const storedToken = await getStoredPushToken();
        if (storedToken && isMounted) {
          setExpoPushToken(storedToken);
          setIsRegistered(true);
          console.log('[NotificationProvider] Loaded stored token:', storedToken);
          setIsLoadingToken(false);
          if (initTimeoutId) clearTimeout(initTimeoutId);
          return;
        }

        // If no stored token and on a physical device, check if we already have permission
        if (Device.isDevice) {
          // Add a small delay to ensure native modules are fully initialized
          await new Promise(resolve => setTimeout(resolve, 500));

          if (!isMounted) return;

          const { status } = await Notifications.getPermissionsAsync();
          if (status === 'granted' && isMounted) {
            // Permission granted, try to get token (this sets loading to false internally)
            await registerForNotifications();
            if (initTimeoutId) clearTimeout(initTimeoutId);
            return;
          }
        }
        // Not a physical device or permission not granted yet
        if (isMounted) {
          setIsLoadingToken(false);
          if (initTimeoutId) clearTimeout(initTimeoutId);
        }
      } catch (error) {
        console.error('[NotificationProvider] Init error:', error);
        if (isMounted) {
          setTokenError('Failed to initialize notifications');
          setIsLoadingToken(false);
          if (initTimeoutId) clearTimeout(initTimeoutId);
        }
      }
    }

    // Delay initialization slightly to avoid race conditions with native modules
    const timer = setTimeout(() => {
      initializeNotifications();
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (initTimeoutId) clearTimeout(initTimeoutId);
    };
  }, [registerForNotifications, expoPushToken]);

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        isRegistered,
        isLoadingToken,
        tokenError,
        registerForNotifications,
        refreshToken,
        lastNotificationData,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
