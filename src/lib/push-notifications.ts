/**
 * Push Notifications Service
 * Handles local push notification registration and triggers.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification handling
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
 * Register for push notifications and return the Expo push token.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[PushNotifications] Permission not granted');
      return null;
    }

    // Set notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#14B8A6',
      });

      await Notifications.setNotificationChannelAsync('urgent', {
        name: 'Urgent Guest Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#EF4444',
      });
    }

    // Push token is optional — local notifications work without it
    try {
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: undefined, // Will use app.json config if available
      });
      console.log('[PushNotifications] Token:', token.data);
      return token.data;
    } catch (tokenError) {
      console.log('[PushNotifications] Push token unavailable (local notifications still work):', tokenError);
      return null;
    }
  } catch (error) {
    console.error('[PushNotifications] Registration error:', error);
    return null;
  }
}

/**
 * Check if current time is within quiet hours.
 */
function isQuietHours(quietStart?: string, quietEnd?: string): boolean {
  if (!quietStart || !quietEnd) return false;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentTime = currentHour * 60 + currentMin;

  const [startH, startM] = quietStart.split(':').map(Number);
  const [endH, endM] = quietEnd.split(':').map(Number);
  const startTime = startH * 60 + startM;
  const endTime = endH * 60 + endM;

  if (startTime <= endTime) {
    return currentTime >= startTime && currentTime < endTime;
  }
  // Quiet hours span midnight
  return currentTime >= startTime || currentTime < endTime;
}

interface NotifyOptions {
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

/**
 * Send a local notification for a new guest message.
 */
export async function notifyNewGuestMessage(
  guestName: string,
  messagePreview: string,
  conversationId: string,
  options?: NotifyOptions
): Promise<void> {
  if (isQuietHours(options?.quietHoursStart, options?.quietHoursEnd)) {
    console.log('[PushNotifications] Skipping — quiet hours');
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `💬 ${guestName}`,
      body: messagePreview.length > 120 ? messagePreview.substring(0, 120) + '...' : messagePreview,
      data: { type: 'new_message', conversationId },
      sound: 'default',
      categoryIdentifier: 'guest_message',
    },
    trigger: null, // Send immediately
  });
}

/**
 * Send a local notification when auto-pilot sends a message.
 */
export async function notifyAutoPilotSent(
  guestName: string,
  confidence: number,
  options?: NotifyOptions
): Promise<void> {
  if (isQuietHours(options?.quietHoursStart, options?.quietHoursEnd)) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🤖 AutoPilot Sent',
      body: `Responded to ${guestName} with ${confidence}% confidence`,
      data: { type: 'autopilot_sent' },
    },
    trigger: null,
  });
}

/**
 * Send a local notification when a scheduled automation fires.
 */
export async function notifyAutomationSent(
  automationName: string,
  guestName: string,
  options?: NotifyOptions
): Promise<void> {
  if (isQuietHours(options?.quietHoursStart, options?.quietHoursEnd)) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚡ Automation Sent',
      body: `"${automationName}" sent to ${guestName}`,
      data: { type: 'automation_sent' },
    },
    trigger: null,
  });
}

/**
 * Send an urgent notification for negative sentiment or escalation.
 */
export async function notifyUrgentMessage(
  guestName: string,
  reason: string,
  conversationId: string
): Promise<void> {
  // Urgent notifications bypass quiet hours
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🚨 Urgent: ${guestName}`,
      body: reason,
      data: { type: 'urgent', conversationId },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: null,
  });
}

/**
 * Get the current badge count.
 */
export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

/**
 * Set the badge count.
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear all delivered notifications.
 */
export async function clearAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
  await Notifications.setBadgeCountAsync(0);
}
