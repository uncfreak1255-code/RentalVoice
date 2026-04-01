import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { generateSmartReplies, type SmartReply } from '@/lib/smart-replies';
import { colors, typography, spacing } from '@/lib/design-tokens';

interface SmartReplyBarProps {
  guestMessage: string;
  propertyKnowledge?: any;
  onSelect: (reply: SmartReply) => void;
}

export function SmartReplyBar({ guestMessage, propertyKnowledge, onSelect }: SmartReplyBarProps) {
  const replies = useMemo(
    () => generateSmartReplies(guestMessage, propertyKnowledge),
    [guestMessage, propertyKnowledge],
  );

  if (replies.length === 0) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      style={{ paddingHorizontal: spacing['4'], paddingVertical: spacing['2'] }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {replies.map((reply) => (
          <Pressable
            key={reply.id}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(reply);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Quick reply: ${reply.label}`}
            style={({ pressed }) => ({
              flexDirection: 'row' as const,
              alignItems: 'center' as const,
              backgroundColor: pressed ? colors.primary.soft : colors.primary.muted,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.primary.soft,
            })}
          >
            <Text style={{ fontSize: 13, marginRight: 4 }}>{reply.icon}</Text>
            <Text
              style={{
                fontSize: 13,
                fontFamily: typography.fontFamily.medium,
                color: colors.primary.DEFAULT,
              }}
            >
              {reply.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  );
}
