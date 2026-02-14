import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface NotificationData {
  conversationId: string;
  propertyId: string;
  guestName: string;
  messagePreview: string;
}

// Storage keys
const PUSH_TOKEN_KEY = 'push_notification_token';
const NOTIFICATIONS_ENABLED_KEY = 'push_notifications_enabled';

// Configure notification handler - how notifications behave when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions and get push token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  let token: string | null = null;

  // Must be a physical device for push notifications
  if (!Device.isDevice) {
    console.log('[Notifications] Push notifications require a physical device');
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission not granted');
      return null;
    }

    // Small delay to ensure native module is ready
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get Expo push token with timeout to prevent hanging
    const getTokenWithTimeout = async (projectId?: string): Promise<string | null> => {
      const timeoutMs = 10000; // 10 second timeout

      const tokenPromise = projectId
        ? Notifications.getExpoPushTokenAsync({ projectId })
        : Notifications.getExpoPushTokenAsync();

      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('Token request timed out')), timeoutMs);
      });

      try {
        const result = await Promise.race([tokenPromise, timeoutPromise]);
        return result?.data ?? null;
      } catch (error) {
        console.log('[Notifications] Token request failed or timed out:', error);
        return null;
      }
    };

    try {
      // First try with project ID if available
      const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
      if (projectId) {
        token = await getTokenWithTimeout(projectId);
        if (token) {
          console.log('[Notifications] Push token:', token);
          await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
        }
      }

      // Fallback: try without project ID
      if (!token) {
        console.log('[Notifications] Trying without project ID...');
        token = await getTokenWithTimeout();
        if (token) {
          console.log('[Notifications] Push token (fallback):', token);
          await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
        }
      }

      if (!token) {
        console.log('[Notifications] Could not get push token');
        return null;
      }
    } catch (tokenError) {
      console.error('[Notifications] Error getting push token:', tokenError);
      return null;
    }

    // Configure Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Guest Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F97316',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }
  } catch (error) {
    console.error('[Notifications] Error in registerForPushNotifications:', error);
    return null;
  }

  return token;
}

/**
 * Get stored push token
 */
export async function getStoredPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Check if notifications are enabled in settings
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  try {
    const enabled = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    return enabled !== 'false'; // Default to true
  } catch {
    return true;
  }
}

/**
 * Set notifications enabled/disabled
 */
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('[Notifications] Error saving notification preference:', error);
  }
}

/**
 * Send a local notification (for testing or when webhook delivers data)
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: NotificationData
): Promise<string> {
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data as unknown as Record<string, unknown>,
      sound: 'default',
      badge: 1,
    },
    trigger: null, // Immediate
  });

  return notificationId;
}

/**
 * Send a notification for a new guest message
 */
export async function notifyNewGuestMessage(
  guestName: string,
  messagePreview: string,
  conversationId: string,
  propertyId: string
): Promise<string | null> {
  const enabled = await areNotificationsEnabled();
  if (!enabled) {
    console.log('[Notifications] Notifications disabled, skipping');
    return null;
  }

  const title = `New Message from ${guestName}`;
  const body = messagePreview.length > 100
    ? messagePreview.substring(0, 100) + '...'
    : messagePreview;

  return sendLocalNotification(title, body, {
    conversationId,
    propertyId,
    guestName,
    messagePreview,
  });
}

/**
 * Update the app badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('[Notifications] Error setting badge count:', error);
  }
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
  await setBadgeCount(0);
}

/**
 * Get the last notification response (for handling notification taps)
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return await Notifications.getLastNotificationResponseAsync();
}

/**
 * Add notification received listener (foreground)
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add notification response listener (tap handling)
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Remove notification listener
 */
export function removeNotificationListener(subscription: Notifications.Subscription): void {
  // Use the new API instead of deprecated removeNotificationSubscription
  subscription.remove();
}

/**
 * Check notification permissions status
 */
export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Schedule a notification for later (e.g., follow-up reminders)
 */
export async function scheduleNotification(
  title: string,
  body: string,
  triggerDate: Date,
  data?: NotificationData
): Promise<string> {
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data as unknown as Record<string, unknown>,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  return notificationId;
}

/**
 * Cancel a scheduled notification
 */
export async function cancelScheduledNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/**
 * Get all scheduled notifications
 */
export async function getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return await Notifications.getAllScheduledNotificationsAsync();
}
