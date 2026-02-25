import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// Network Status Hook — Lightweight offline detection
// Uses fetch-based connectivity check (no extra npm deps)
// ============================================================

const BACKEND_HEALTH_URL = `${process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3001'}/api/health`;
const FALLBACK_CHECK_URL = 'https://clients3.google.com/generate_204';
const CHECK_INTERVAL_MS = 15_000; // Check every 15s when foregrounded
const QUEUE_STORAGE_KEY = '@rental_voice_message_queue';

export type NetworkStatus = 'online' | 'offline' | 'checking';

export interface QueuedMessage {
  id: string;
  conversationId: string;
  content: string;
  timestamp: number;
}

/**
 * Hook that monitors network connectivity via periodic fetch checks.
 * Also provides message queue for offline composed messages.
 */
export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>('online');
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkConnectivity = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      // Try backend health first, fall back to Google connectivity check
      let response: Response;
      try {
        response = await fetch(BACKEND_HEALTH_URL, {
          method: 'GET',
          signal: controller.signal,
        });
      } catch {
        // Backend unreachable, try Google as fallback
        response = await fetch(FALLBACK_CHECK_URL, {
          method: 'HEAD',
          signal: controller.signal,
        });
      }

      clearTimeout(timeout);
      setStatus(response.ok ? 'online' : 'offline');
    } catch {
      setStatus('offline');
    }
  }, []);

  // Load queued messages from storage on mount
  useEffect(() => {
    async function loadQueue() {
      try {
        const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
        if (stored) setQueue(JSON.parse(stored));
      } catch {
        // Ignore storage errors
      }
    }
    loadQueue();
  }, []);

  // Start periodic connectivity checks
  useEffect(() => {
    checkConnectivity(); // Initial check

    intervalRef.current = setInterval(checkConnectivity, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkConnectivity]);

  // Queue a message for sending when back online
  const enqueueMessage = useCallback(async (msg: Omit<QueuedMessage, 'id' | 'timestamp'>) => {
    const newMsg: QueuedMessage = {
      ...msg,
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };

    setQueue((prev) => {
      const updated = [...prev, newMsg];
      AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });

    return newMsg;
  }, []);

  // Remove a message from the queue (after successful send)
  const dequeueMessage = useCallback(async (messageId: string) => {
    setQueue((prev) => {
      const updated = prev.filter((m) => m.id !== messageId);
      AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  // Clear entire queue
  const clearQueue = useCallback(async () => {
    setQueue([]);
    await AsyncStorage.removeItem(QUEUE_STORAGE_KEY).catch(() => {});
  }, []);

  return {
    isOffline: status === 'offline',
    isOnline: status === 'online',
    status,
    queue,
    queueLength: queue.length,
    enqueueMessage,
    dequeueMessage,
    clearQueue,
    recheckNow: checkConnectivity,
  };
}
