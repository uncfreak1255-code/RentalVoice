import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react-native';
import { colors, radius, typography } from '@/lib/design-tokens';
import type { DailyBriefingViewModel } from '@/lib/daily-briefing';

interface DailyBriefingCardProps {
  briefing: DailyBriefingViewModel;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onPressAction: (conversationId: string) => void;
}

export type { DailyBriefingViewModel } from '@/lib/daily-briefing';

export function DailyBriefingCard({
  briefing,
  collapsed,
  onToggleCollapsed,
  onPressAction,
}: DailyBriefingCardProps) {
  const visibleActions = briefing.actions.slice(0, 2);
  const remainingActionCount = Math.max(briefing.actions.length - visibleActions.length, 0);

  if (collapsed) {
    return (
      <Pressable
        onPress={onToggleCollapsed}
        accessibilityRole="button"
        accessibilityLabel="Expand daily briefing"
        style={{
          marginHorizontal: 18,
          marginBottom: 10,
          backgroundColor: '#FFFFFF',
          borderRadius: 18,
          borderWidth: 1,
          borderColor: '#DDE7F0',
          paddingHorizontal: 14,
          paddingVertical: 11,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: '#E6FFFB',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Sparkles size={15} color={colors.primary.DEFAULT} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: typography.fontFamily.semibold,
              fontSize: 13.5,
              color: colors.text.primary,
            }}
          >
            {briefing.title}
          </Text>
          <Text
            style={{
              marginTop: 2,
              fontFamily: typography.fontFamily.regular,
              fontSize: 11.5,
              color: colors.text.muted,
            }}
          >
            {briefing.summary}
          </Text>
        </View>
        <ChevronDown size={16} color="#7B8AA0" strokeWidth={2.15} />
      </Pressable>
    );
  }

  return (
    <View
      style={{
        marginHorizontal: 18,
        marginBottom: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#DDE7F0',
        paddingHorizontal: 15,
        paddingVertical: 12,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: '#E6FFFB',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
          }}
        >
          <Sparkles size={16} color={colors.primary.DEFAULT} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: typography.fontFamily.bold,
              fontSize: 15.5,
              color: colors.text.primary,
              letterSpacing: -0.2,
            }}
          >
            {briefing.title}
          </Text>
          <Text
            style={{
              marginTop: 2,
              fontFamily: typography.fontFamily.regular,
              fontSize: 12.5,
              color: colors.text.muted,
              lineHeight: 17,
            }}
          >
            {briefing.summary}
          </Text>
        </View>
        <Pressable
          onPress={onToggleCollapsed}
          accessibilityRole="button"
          accessibilityLabel="Collapse daily briefing"
          hitSlop={10}
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronUp size={16} color="#7B8AA0" strokeWidth={2.15} />
        </Pressable>
      </View>

      <View style={{ gap: 7 }}>
        {visibleActions.map((action) => (
          <Pressable
            key={action.id}
            onPress={() => onPressAction(action.conversationId)}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={{
              backgroundColor: colors.bg.subtle,
              borderRadius: radius.md,
              paddingHorizontal: 13,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: '#ECF2F8',
            }}
          >
            <Text
              style={{
                fontFamily: typography.fontFamily.semibold,
                fontSize: 13.5,
                color: colors.text.primary,
                lineHeight: 18,
              }}
            >
              {action.label}
            </Text>
            <Text
              style={{
                marginTop: 2,
                fontFamily: typography.fontFamily.regular,
                fontSize: 11.5,
                color: colors.text.muted,
              }}
            >
              {action.meta}
            </Text>
          </Pressable>
        ))}
        {remainingActionCount > 0 ? (
          <Pressable
            onPress={onToggleCollapsed}
            accessibilityRole="button"
            accessibilityLabel={`Show ${remainingActionCount} more briefing action${remainingActionCount === 1 ? '' : 's'}`}
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: 4,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                fontFamily: typography.fontFamily.medium,
                fontSize: 11.5,
                color: '#6B7A90',
              }}
            >
              +{remainingActionCount} more
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
