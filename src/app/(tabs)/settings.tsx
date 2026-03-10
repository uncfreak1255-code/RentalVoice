import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { SettingsScreen } from '@/components/SettingsScreen';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/lib/store';
import { colors } from '@/lib/design-tokens';

// Map settings screen names to their route paths
const settingsRoutes: Record<string, string> = {
  propertyKnowledge: '/settings/property-knowledge',
  issueTracker: '/settings/issue-tracker',
  automations: '/settings/automations',
  analytics: '/settings/analytics',
  upsells: '/settings/upsells',
  billing: '/settings/billing?source=settings',
  billingMemory: '/settings/billing?source=memory_limit',
  founderDiagnostics: '/settings/founder-diagnostics',
  founderAccess: '/settings/founder-access',
  apiSettings: '/settings/api',
  syncData: '/settings/sync-data',
  languageSettings: '/settings/language',
  helpCenter: '/settings/help-center',
  privacySecurity: '/settings/privacy-security',

  aiLearning: '/settings/ai-learning',
  webhookSetup: '/settings/webhook-setup',
  notificationSettings: '/settings/notifications',
  autoPilotSettings: '/settings/auto-pilot',
  autoPilotAuditLog: '/settings/auto-pilot-audit',
  sentimentTrends: '/settings/sentiment-trends',
  // Legacy compatibility route only. Keep this mapped so old links fail safely,
  // but do not reintroduce provider-management UI into the active settings flow.
  aiProviders: '/settings/ai-providers',
  reviewResponse: '/settings/review-response',
};

export default function SettingsTab() {
  const router = useRouter();
  const resetStore = useAppStore((s) => s.resetStore);

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
    <View style={styles.container}>
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
    backgroundColor: colors.bg.base,
  },
});
