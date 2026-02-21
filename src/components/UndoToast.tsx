/**
 * UndoToast — Shows a countdown toast when autopilot queues a message.
 * The user can tap "Undo" to cancel before the message actually sends.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { Undo2, Send, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, radius, elevation } from '@/lib/design-tokens';
import {
  getPendingMessages,
  cancelPendingMessage,
  UNDO_DELAY_MS,
  type PendingMessage,
} from '@/lib/automation-engine';

export function UndoToast() {
  const [pending, setPending] = useState<PendingMessage[]>([]);

  // Poll pending messages every second to update the countdown
  useEffect(() => {
    const interval = setInterval(() => {
      const current = getPendingMessages();
      setPending(current);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleUndo = useCallback((key: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    cancelPendingMessage(key);
    setPending(getPendingMessages());
  }, []);

  const handleDismiss = useCallback((key: string) => {
    // Just dismiss the toast UI — message will still send
    setPending((prev) => prev.filter((p) => p.key !== key));
  }, []);

  if (pending.length === 0) return null;

  return (
    <View style={s.container}>
      {pending.map((msg) => {
        const elapsed = Date.now() - msg.queuedAt;
        const remaining = Math.max(0, Math.ceil((UNDO_DELAY_MS - elapsed) / 1000));

        return (
          <Animated.View
            key={msg.key}
            entering={FadeInDown.duration(250)}
            exiting={FadeOutDown.duration(200)}
            style={s.toast}
          >
            <View style={s.iconWrap}>
              <Send size={16} color={colors.accent.DEFAULT} />
            </View>

            <View style={s.body}>
              <Text style={s.title} numberOfLines={1}>
                Sending "{msg.scheduledName}" to {msg.guestName}
              </Text>
              <Text style={s.subtitle}>
                Sends in {remaining}s
              </Text>
            </View>

            <Pressable
              onPress={() => handleUndo(msg.key)}
              style={({ pressed }) => [s.undoBtn, pressed && s.undoBtnPressed]}
              hitSlop={8}
            >
              <Undo2 size={14} color="#FFF" />
              <Text style={s.undoText}>Undo</Text>
            </Pressable>

            <Pressable
              onPress={() => handleDismiss(msg.key)}
              style={s.closeBtn}
              hitSlop={8}
            >
              <X size={14} color={colors.text.disabled} />
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: spacing['4'],
    right: spacing['4'],
    zIndex: 999,
    gap: spacing['1'],
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    paddingVertical: spacing['2'],
    paddingHorizontal: spacing['3'],
    gap: spacing['2'],
    ...elevation.lg,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  title: {
    ...typography.styles.bodySmMedium,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginTop: 1,
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  undoBtnPressed: {
    opacity: 0.8,
  },
  undoText: {
    ...typography.styles.badge,
    color: '#FFF',
  },
  closeBtn: {
    padding: 4,
  },
});
