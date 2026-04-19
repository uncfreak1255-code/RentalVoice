import React from 'react';
import { Tabs } from 'expo-router';
import { MessageSquare, CalendarDays, Sparkles, Settings } from 'lucide-react-native';
import { colors, typography } from '@/lib/design-tokens';
import { useThemeColors } from '@/lib/useThemeColors';
import { useAppStore } from '@/lib/store';
import { isRenderableUnreadConversation } from '@/lib/inbox-trust';

export default function TabLayout() {
  const conversations = useAppStore((s) => s.conversations);
  const unreadCount = conversations.filter((c) =>
    c.status !== 'archived' && c.workflowStatus !== 'archived' && isRenderableUnreadConversation(c)
  ).length;
  const t = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.primary.DEFAULT,
        tabBarInactiveTintColor: t.text.disabled,
        tabBarStyle: {
          backgroundColor: t.bg.base,
          borderTopColor: t.border.subtle,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: 4,
          height: 85,
        },
        tabBarLabelStyle: {
          fontFamily: typography.fontFamily.medium,
          fontSize: 11,
          marginTop: 2,
        },
        sceneStyle: { backgroundColor: t.bg.base },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, size }) => (
            <MessageSquare size={size} color={color} />
          ),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: t.primary.DEFAULT,
            fontSize: 10,
            fontFamily: typography.fontFamily.medium,
            minWidth: 18,
            height: 18,
            lineHeight: 18,
            borderRadius: 9,
          },
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => (
            <CalendarDays size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="voice"
        options={{
          title: 'Voice',
          tabBarIcon: ({ color, size }) => (
            <Sparkles size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
