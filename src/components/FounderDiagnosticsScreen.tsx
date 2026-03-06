import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Brain, CreditCard, Shield, Wifi, Zap } from 'lucide-react-native';
import { colors, typography } from '@/lib/design-tokens';
import { SectionHeader, SectionFooter, ValueRow, s } from './ui/SettingsComponents';
import { getFounderDiagnostics, type FounderDiagnosticsResponse } from '@/lib/api-client';

interface FounderDiagnosticsScreenProps {
  onBack: () => void;
}

export function FounderDiagnosticsScreen({ onBack }: FounderDiagnosticsScreenProps) {
  const [data, setData] = useState<FounderDiagnosticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDiagnostics = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getFounderDiagnostics();
      setData(response);
    } catch (error) {
      console.error('[FounderDiagnosticsScreen] Failed to load diagnostics:', error);
      Alert.alert('Diagnostics unavailable', 'Unable to load founder diagnostics right now.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDiagnostics();
  }, [loadDiagnostics]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <ArrowLeft size={20} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Founder Diagnostics</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
            </View>
          ) : data ? (
            <>
              <SectionHeader title="Identity" />
              <View style={s.card}>
                <ValueRow icon={<Shield size={18} color={colors.primary.DEFAULT} />} label="Founder Access" value={data.founderAccess ? 'Yes' : 'No'} />
                <ValueRow icon={<CreditCard size={18} color={colors.primary.DEFAULT} />} label="Billing Bypass" value={data.billingBypass ? 'Enabled' : 'Disabled'} />
                <ValueRow icon={<Shield size={18} color={colors.primary.DEFAULT} />} label="Effective Plan" value={data.user.effectivePlan} />
                <ValueRow icon={<Shield size={18} color={colors.primary.DEFAULT} />} label="Base Plan" value={data.user.basePlan} isLast />
              </View>

              <SectionHeader title="Organization" />
              <View style={s.card}>
                <ValueRow icon={<Shield size={18} color={colors.primary.DEFAULT} />} label="Org Name" value={data.organization.name || 'Unavailable'} />
                <ValueRow icon={<Shield size={18} color={colors.primary.DEFAULT} />} label="Org Role" value={data.organization.role || 'Unavailable'} />
                <ValueRow icon={<Shield size={18} color={colors.primary.DEFAULT} />} label="Org ID" value={data.organization.id || 'Unavailable'} isLast />
              </View>

              <SectionHeader title="AI + Memory" />
              <View style={s.card}>
                <ValueRow icon={<Brain size={18} color={colors.primary.DEFAULT} />} label="AI Mode" value={data.ai.mode || 'Unavailable'} />
                <ValueRow icon={<Zap size={18} color={colors.primary.DEFAULT} />} label="Drafts This Month" value={String(data.ai.totalDrafts)} />
                <ValueRow icon={<Zap size={18} color={colors.primary.DEFAULT} />} label="Memory Mode" value={data.memory.mode} />
                <ValueRow icon={<Zap size={18} color={colors.primary.DEFAULT} />} label="Memory Add-on" value={data.memory.addonActive ? 'Active' : 'Inactive'} isLast />
              </View>

              <SectionHeader title="PMS" />
              <View style={s.card}>
                <ValueRow icon={<Wifi size={18} color={colors.primary.DEFAULT} />} label="Provider" value={data.pms.provider || 'Not connected'} />
                <ValueRow icon={<Wifi size={18} color={colors.primary.DEFAULT} />} label="Status" value={data.pms.status || 'Unavailable'} />
                <ValueRow icon={<Wifi size={18} color={colors.primary.DEFAULT} />} label="Account ID" value={data.pms.accountId || 'Unavailable'} isLast />
              </View>

              <SectionHeader title="Recent Billing Events" />
              <View style={styles.eventsCard}>
                {data.recentBillingEvents.length === 0 ? (
                  <Text style={styles.emptyText}>No billing telemetry events recorded yet.</Text>
                ) : (
                  data.recentBillingEvents.map((event, index) => (
                    <View key={`${event.event_name}-${event.created_at}-${index}`} style={[styles.eventRow, index < data.recentBillingEvents.length - 1 && styles.eventBorder]}>
                      <Text style={styles.eventName}>{event.event_name}</Text>
                      <Text style={styles.eventMeta}>{event.source || 'unknown'} · {new Date(event.created_at).toLocaleString()}</Text>
                    </View>
                  ))
                )}
              </View>
              <SectionFooter text="Use this screen to verify founder access, effective plan, PMS connection, and the billing telemetry stream on your own account." />
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: typography.fontFamily.bold,
    color: '#000000',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  loadingWrap: {
    paddingTop: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  eventRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  eventBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  eventName: {
    fontSize: 15,
    fontFamily: typography.fontFamily.medium,
    color: '#000000',
    marginBottom: 4,
  },
  eventMeta: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: '#6B7280',
  },
  emptyText: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: '#6B7280',
  },
});
