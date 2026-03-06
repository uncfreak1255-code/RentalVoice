import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Linking, StyleSheet, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Brain, CreditCard, Shield, Sparkles, Zap } from 'lucide-react-native';
import { colors, typography } from '@/lib/design-tokens';
import { SectionHeader, SectionFooter, ValueRow, s } from './ui/SettingsComponents';
import { trackBillingEvent } from '@/lib/usage-tracker';
import {
  createBillingPortal,
  createCheckoutSession,
  getBillingStatus,
  getCurrentEntitlements,
  trackProductEvent,
  setSupermemoryAddon,
  type BillingStatus,
  type EntitlementsResponse,
} from '@/lib/api-client';
import { LinkRow } from './ui/SettingsComponents';

interface BillingScreenProps {
  onBack: () => void;
  source?: string;
  checkoutStatus?: string;
  portalStatus?: string;
  onOpenFounderDiagnostics?: () => void;
}

type ManagedPlan = 'starter' | 'professional' | 'business' | 'enterprise';

interface PlanCardConfig {
  id: ManagedPlan;
  title: string;
  summary: string;
  highlights: string[];
}

const PLAN_CARDS: PlanCardConfig[] = [
  {
    id: 'starter',
    title: 'Starter',
    summary: 'For individual hosts starting with managed drafts.',
    highlights: ['2 properties', '100 drafts / month', 'Manual review workflow'],
  },
  {
    id: 'professional',
    title: 'Professional',
    summary: 'Best fit for live operators who want stronger automation and memory.',
    highlights: ['10 properties', 'Auto-Pilot enabled', 'Supermemory included'],
  },
  {
    id: 'business',
    title: 'Business',
    summary: 'For larger portfolios that need more scale and shared memory.',
    highlights: ['50 properties', '5,000 drafts / month', 'Shared memory across team workflows'],
  },
  {
    id: 'enterprise',
    title: 'Enterprise',
    summary: 'For large teams that need the highest limits and premium routing.',
    highlights: ['Unlimited properties', 'Unlimited drafts', 'Highest memory and routing limits'],
  },
];

function titleCasePlan(plan: string): string {
  if (plan === 'professional') return 'Professional';
  if (plan === 'starter') return 'Starter';
  if (plan === 'business') return 'Business';
  if (plan === 'enterprise') return 'Enterprise';
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

export function BillingScreen({ onBack, source = 'settings', checkoutStatus, portalStatus, onOpenFounderDiagnostics }: BillingScreenProps) {
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState<string | null>(null);
  const trackedEntryRef = useRef<string | null>(null);
  const trackedReturnRef = useRef<string | null>(null);

  const loadState = useCallback(async () => {
    setIsLoading(true);
    try {
      const [billing, currentEntitlements] = await Promise.all([
        getBillingStatus(),
        getCurrentEntitlements(),
      ]);
      setBillingStatus(billing);
      setEntitlements(currentEntitlements);
    } catch (error) {
      console.error('[BillingScreen] Failed to load billing state:', error);
      Alert.alert('Billing unavailable', 'Unable to load billing details right now.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  useEffect(() => {
    const entryKey = `${source}:${checkoutStatus || 'none'}:${portalStatus || 'none'}`;
    if (trackedEntryRef.current === entryKey) {
      return;
    }
    trackedEntryRef.current = entryKey;
    const properties = {
      source,
      checkout_status: checkoutStatus || null,
      portal_status: portalStatus || null,
    };
    Promise.allSettled([
      trackBillingEvent('billing_screen_viewed', properties),
      trackProductEvent({ eventName: 'billing_screen_viewed', category: 'billing', source, properties, occurredAt: new Date().toISOString() }),
    ]).catch(console.error);
  }, [checkoutStatus, portalStatus, source]);

  useEffect(() => {
    if (!checkoutStatus && !portalStatus) {
      return;
    }

    const returnKey = `${checkoutStatus || 'none'}:${portalStatus || 'none'}`;
    if (trackedReturnRef.current === returnKey) {
      return;
    }
    trackedReturnRef.current = returnKey;

    const properties = {
      source,
      checkout_status: checkoutStatus || null,
      portal_status: portalStatus || null,
    };
    Promise.allSettled([
      trackBillingEvent('billing_returned', properties),
      trackProductEvent({ eventName: 'billing_returned', category: 'billing', source, properties, occurredAt: new Date().toISOString() }),
    ]).catch(console.error);
  }, [checkoutStatus, portalStatus, source]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadState();
      }
    });
    return () => subscription.remove();
  }, [loadState]);

  const activePlan = (billingStatus?.plan || entitlements?.plan || 'starter') as ManagedPlan;
  const billingBypass = billingStatus?.billingBypass === true;
  const founderAccess = billingStatus?.founderAccess === true;
  const supermemoryIncluded = entitlements?.entitlements.supermemoryEnabled === true;
  const supermemoryAddonActive = entitlements?.entitlements.supermemoryAddonActive === true;
  const canManageAddon = activePlan === 'starter' && !billingBypass;

  const recommendedPlan = useMemo<ManagedPlan>(() => {
    if (activePlan === 'starter') return 'professional';
    if (activePlan === 'professional') return 'business';
    return activePlan;
  }, [activePlan]);

  const openCheckout = useCallback(async (plan: ManagedPlan) => {
    if (plan === activePlan || billingBypass) {
      return;
    }

    setIsBusy(`checkout:${plan}`);
    try {
      await Promise.allSettled([
        trackBillingEvent('billing_checkout_started', { source, plan }),
        trackProductEvent({
          eventName: 'billing_checkout_started',
          category: 'billing',
          source,
          properties: { source, plan },
          occurredAt: new Date().toISOString(),
        }),
      ]);
      const session = await createCheckoutSession(plan);
      await Linking.openURL(session.url);
    } catch (error) {
      console.error('[BillingScreen] Failed to start checkout:', error);
      Alert.alert('Checkout unavailable', 'Unable to open checkout right now.');
    } finally {
      setIsBusy(null);
    }
  }, [activePlan, billingBypass, source]);

  const openPortal = useCallback(async () => {
    if (billingBypass) {
      return;
    }

    setIsBusy('portal');
    try {
      await Promise.allSettled([
        trackBillingEvent('billing_portal_opened', { source, plan: activePlan }),
        trackProductEvent({
          eventName: 'billing_portal_opened',
          category: 'billing',
          source,
          properties: { source, plan: activePlan },
          occurredAt: new Date().toISOString(),
        }),
      ]);
      const portal = await createBillingPortal();
      await Linking.openURL(portal.url);
    } catch (error) {
      console.error('[BillingScreen] Failed to open billing portal:', error);
      Alert.alert('Billing portal unavailable', 'No billing portal is available for this account yet.');
    } finally {
      setIsBusy(null);
    }
  }, [activePlan, billingBypass, source]);

  const toggleAddon = useCallback(async () => {
    if (!canManageAddon) {
      return;
    }

    const nextActive = !supermemoryAddonActive;
    setIsBusy('addon');
    try {
      await setSupermemoryAddon(nextActive);
      const eventName = nextActive ? 'billing_memory_addon_enabled' : 'billing_memory_addon_disabled';
      await Promise.allSettled([
        trackBillingEvent(eventName, { source, plan: activePlan }),
        trackProductEvent({
          eventName,
          category: 'billing',
          source,
          properties: { source, plan: activePlan },
          occurredAt: new Date().toISOString(),
        }),
      ]);
      await loadState();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('[BillingScreen] Failed to update add-on:', error);
      Alert.alert('Update failed', 'Unable to update memory add-on right now.');
    } finally {
      setIsBusy(null);
    }
  }, [activePlan, canManageAddon, loadState, source, supermemoryAddonActive]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <ArrowLeft size={20} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Plans & Billing</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
            </View>
          ) : (
            <>
              {(checkoutStatus || portalStatus) && (
                <View style={styles.statusBanner}>
                  <Text style={styles.statusBannerTitle}>
                    {checkoutStatus === 'success'
                      ? 'Checkout completed'
                      : checkoutStatus === 'cancelled'
                        ? 'Checkout cancelled'
                        : 'Returned from billing portal'}
                  </Text>
                  <Text style={styles.statusBannerBody}>
                    {checkoutStatus === 'success'
                      ? 'We refreshed your billing status. If your plan has not updated yet, Stripe may still be finalizing the webhook. Tap refresh below.'
                      : checkoutStatus === 'cancelled'
                        ? 'No subscription changes were made. You can review plans again whenever you are ready.'
                        : 'Billing changes made in the portal should appear below after refresh.'}
                  </Text>
                  <Pressable onPress={loadState} style={({ pressed }) => [styles.statusBannerButton, pressed && styles.pressed]}>
                    <Text style={styles.statusBannerButtonText}>Refresh now</Text>
                  </Pressable>
                </View>
              )}

              <SectionHeader title="Account Status" />
              <View style={s.card}>
                <ValueRow
                  icon={<CreditCard size={18} color={colors.primary.DEFAULT} />}
                  label="Current Plan"
                  value={titleCasePlan(activePlan)}
                />
                <ValueRow
                  icon={<Zap size={18} color={colors.primary.DEFAULT} />}
                  label="Trial"
                  value={billingStatus?.isTrialing ? `${billingStatus.trialDaysLeft} days left` : 'Inactive'}
                />
                <ValueRow
                  icon={<Shield size={18} color={colors.primary.DEFAULT} />}
                  label="Billing Access"
                  value={billingBypass ? 'Founder bypass' : billingStatus?.hasPaymentMethod ? 'Configured' : 'Not configured'}
                  isLast
                />
              </View>
              <SectionFooter
                text={
                  founderAccess
                    ? 'Founder access is active on this account. Subscription prompts are disabled here so your personal workspace keeps full access.'
                    : 'All upgrade decisions here use the server billing state, not local app state.'
                }
              />

              <SectionHeader title="Memory" />
              <View style={s.card}>
                <ValueRow
                  icon={<Brain size={18} color={colors.primary.DEFAULT} />}
                  label="Memory Mode"
                  value={
                    entitlements?.entitlements.supermemoryMode === 'full'
                      ? 'Full'
                      : entitlements?.entitlements.supermemoryMode === 'degraded'
                        ? 'Degraded'
                        : 'Off'
                  }
                />
                <ValueRow
                  icon={<Sparkles size={18} color={colors.primary.DEFAULT} />}
                  label="Memory Add-on"
                  value={
                    activePlan !== 'starter'
                      ? 'Included in plan'
                      : supermemoryAddonActive
                        ? 'Active'
                        : 'Not active'
                  }
                  isLast={!canManageAddon}
                />
                {canManageAddon && (
                  <Pressable onPress={toggleAddon} style={({ pressed }) => [styles.inlineActionRow, pressed && styles.pressed]} disabled={isBusy === 'addon'}>
                    <View style={styles.inlineActionIcon}>
                      <Brain size={18} color={colors.primary.DEFAULT} />
                    </View>
                    <Text style={styles.inlineActionLabel}>
                      {isBusy === 'addon'
                        ? 'Updating Memory Add-on'
                        : supermemoryAddonActive
                          ? 'Disable Memory Add-on'
                          : 'Enable Memory Add-on'}
                    </Text>
                  </Pressable>
                )}
              </View>
              <SectionFooter text="Starter can add memory capacity without changing the rest of the workspace workflow." />

              <SectionHeader title="Upgrade Options" />
              {PLAN_CARDS.map((plan) => {
                const isCurrent = plan.id === activePlan;
                const isRecommended = plan.id === recommendedPlan && !isCurrent && !billingBypass;
                const isDisabled = isCurrent || billingBypass;

                return (
                  <View key={plan.id} style={styles.planCard}>
                    <View style={styles.planHeaderRow}>
                      <View>
                        <Text style={styles.planTitle}>{plan.title}</Text>
                        <Text style={styles.planSummary}>{plan.summary}</Text>
                      </View>
                      <View style={styles.planBadges}>
                        {isCurrent && <Text style={styles.planBadge}>Current</Text>}
                        {isRecommended && <Text style={[styles.planBadge, styles.recommendedBadge]}>Recommended</Text>}
                      </View>
                    </View>
                    {plan.highlights.map((item) => (
                      <Text key={item} style={styles.planBullet}>• {item}</Text>
                    ))}
                    <Pressable
                      disabled={isDisabled || !!isBusy}
                      onPress={() => openCheckout(plan.id)}
                      style={({ pressed }) => [
                        styles.planButton,
                        (isDisabled || pressed) && styles.pressed,
                        isDisabled && styles.planButtonDisabled,
                      ]}
                    >
                      <Text style={[styles.planButtonText, isDisabled && styles.planButtonTextDisabled]}>
                        {billingBypass
                          ? 'Founder access active'
                          : isCurrent
                            ? 'Current plan'
                            : isBusy === `checkout:${plan.id}`
                              ? 'Opening checkout...'
                              : `Choose ${plan.title}`}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}

              {!billingBypass && (
                <>
                  <SectionHeader title="Billing Management" />
                  <View style={s.card}>
                    <Pressable onPress={openPortal} style={({ pressed }) => [styles.inlineActionRow, pressed && styles.pressed]} disabled={isBusy === 'portal'}>
                      <View style={styles.inlineActionIcon}>
                        <CreditCard size={18} color={colors.primary.DEFAULT} />
                      </View>
                      <Text style={styles.inlineActionLabel}>
                        {isBusy === 'portal' ? 'Opening Billing Portal' : 'Open Billing Portal'}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}

              {founderAccess && onOpenFounderDiagnostics && (
                <>
                  <SectionHeader title="Founder Tools" />
                  <View style={s.card}>
                    <LinkRow
                      icon={<Shield size={18} color={colors.primary.DEFAULT} />}
                      label="Founder Diagnostics"
                      onPress={onOpenFounderDiagnostics}
                      isLast
                    />
                  </View>
                </>
              )}
            </>
          )}
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
  statusBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary.DEFAULT + '30',
  },
  statusBannerTitle: {
    fontSize: 16,
    fontFamily: typography.fontFamily.medium,
    color: '#000000',
    marginBottom: 6,
  },
  statusBannerBody: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: '#6B7280',
    lineHeight: 18,
  },
  statusBannerButton: {
    marginTop: 12,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary.DEFAULT + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBannerButtonText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary.DEFAULT,
  },
  inlineActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 16,
    height: 50,
  },
  inlineActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary.DEFAULT + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  inlineActionLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: typography.fontFamily.regular,
    color: colors.primary.DEFAULT,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
  },
  planHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  planTitle: {
    fontSize: 17,
    fontFamily: typography.fontFamily.medium,
    color: '#000000',
  },
  planSummary: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: '#6B7280',
    marginTop: 4,
    maxWidth: 220,
  },
  planBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  planBadge: {
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  recommendedBadge: {
    color: colors.primary.DEFAULT,
    backgroundColor: colors.primary.DEFAULT + '18',
  },
  planBullet: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: '#374151',
    marginBottom: 6,
  },
  planButton: {
    height: 44,
    marginTop: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.DEFAULT,
  },
  planButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  planButtonText: {
    fontSize: 15,
    fontFamily: typography.fontFamily.medium,
    color: '#FFFFFF',
  },
  planButtonTextDisabled: {
    color: '#6B7280',
  },
  pressed: {
    opacity: 0.75,
  },
});
