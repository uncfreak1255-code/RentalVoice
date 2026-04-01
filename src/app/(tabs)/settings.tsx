import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { SettingsScreen } from '@/components/SettingsScreen';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/lib/store';
import { useThemeColors, useIsDark } from '@/lib/useThemeColors';

// Map settings screen names to their route paths
// Only push screens remain as routes; bottom sheet items are handled inline
const settingsRoutes: Record<string, string> = {
  // Push screens (complex, need full navigation)
  aiLearning: '/settings/ai-learning',
  propertyKnowledge: '/settings/property-knowledge',
  analytics: '/settings/analytics',
  privacySecurity: '/settings/privacy-security',

  // Legacy compatibility — keep mapped so old links fail safely
  automations: '/settings/automations',
  apiSettings: '/settings/api',
  syncData: '/settings/sync-data',
  helpCenter: '/settings/help-center',
  notificationSettings: '/settings/notifications',
  autoPilotSettings: '/settings/auto-pilot',
  autoPilotAuditLog: '/settings/auto-pilot-audit',
  aiProviders: '/settings/ai-providers',
  testVoice: '/settings/test-voice',
  issueTracker: '/settings/issue-tracker',
  webhookSetup: '/settings/webhook-setup',
  sentimentTrends: '/settings/sentiment-trends',
  reviewResponse: '/settings/review-response',
  languageSettings: '/settings/language',

  // v1: billing/commercial/founder screens hidden from production navigation.
  // Accessible in __DEV__ only — files are NOT deleted, just ungated for dev.
  ...__DEV__ ? {
    upsells: '/settings/upsells',
    billing: '/settings/billing?source=settings',
    billingMemory: '/settings/billing?source=memory_limit',
    founderDiagnostics: '/settings/founder-diagnostics',
    founderAccess: '/settings/founder-access',
  } : {},
};

export default function SettingsTab() {
  const router = useRouter();
  const resetStore = useAppStore((s) => s.resetStore);
  const isDark = useIsDark();

  const handleNavigate = useCallback((screen: string) => {
    const route = settingsRoutes[screen];
    if (route) {
      router.push(route as any);
    } else {
      console.warn(`[SettingsTab] Unknown settings screen: ${screen}`);
    }
  }, [router]);

  const handleLogout = useCallback(() => {
    resetStore();
  }, [resetStore]);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
      <SettingsScreen
        onBack={() => router.back()}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
