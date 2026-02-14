import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Alert, ActivityIndicator, Linking, Switch, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronDown, ChevronUp, Check, X, Eye, EyeOff, ExternalLink, Shield, Zap, Trash2, GripVertical } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AI_PROVIDERS, type AIProvider, type AIProviderConfig, getAIKey, setAIKey, deleteAIKey, setProviderEnabled, getProviderOrder, setProviderOrder, testAIKey, clearAllAIKeys, getAllProviderStatuses } from '@/lib/ai-keys';
import { signInWithGoogle, signOutGoogle, getGoogleAuthStatus, getGoogleClientId, type GoogleAuthStatus } from '@/lib/google-auth';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

interface AIProviderSettingsScreenProps { onBack: () => void; }
interface ProviderState { hasKey: boolean; isUserKey: boolean; enabled: boolean; keyValue: string; showKey: boolean; testing: boolean; testResult: 'valid' | 'invalid' | null; testError: string | null; expanded: boolean; saving: boolean; }
const DEFAULT_PROVIDER_STATE: ProviderState = { hasKey: false, isUserKey: false, enabled: true, keyValue: '', showKey: false, testing: false, testResult: null, testError: null, expanded: false, saving: false };

export function AIProviderSettingsScreen({ onBack }: AIProviderSettingsScreenProps) {
  const [providerStates, setProviderStates] = useState<Record<AIProvider, ProviderState>>({} as Record<AIProvider, ProviderState>);
  const [providerOrder, setOrderState] = useState<AIProvider[]>(['google', 'anthropic', 'openai']);
  const [loading, setLoading] = useState(true);
  const [googleOAuthStatus, setGoogleOAuthStatus] = useState<GoogleAuthStatus>({ signedIn: false, hasClientId: false });
  const [googleClientIdInput, setGoogleClientIdInput] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => { loadProviderStates(); }, []);

  const loadProviderStates = async () => {
    setLoading(true);
    try {
      const statuses = await getAllProviderStatuses();
      const order = await getProviderOrder();
      setOrderState(order);
      const states: Record<string, ProviderState> = {};
      for (const provider of AI_PROVIDERS) { const status = statuses[provider.id]; states[provider.id] = { ...DEFAULT_PROVIDER_STATE, hasKey: status.hasKey, isUserKey: status.isUserKey, enabled: status.enabled }; }
      setProviderStates(states as Record<AIProvider, ProviderState>);
      const oauthStatus = await getGoogleAuthStatus();
      setGoogleOAuthStatus(oauthStatus);
      const clientId = await getGoogleClientId();
      if (clientId) setGoogleClientIdInput(clientId);
    } catch (error) { console.error('[AIProviderSettings] Failed to load:', error); }
    finally { setLoading(false); }
  };

  const updateProviderState = useCallback((provider: AIProvider, updates: Partial<ProviderState>) => {
    setProviderStates((prev) => ({ ...prev, [provider]: { ...prev[provider], ...updates } }));
  }, []);

  const handleToggleExpand = (provider: AIProvider) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateProviderState(provider, { expanded: !providerStates[provider]?.expanded }); };
  const handleToggleEnabled = async (provider: AIProvider, value: boolean) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); await setProviderEnabled(provider, value); updateProviderState(provider, { enabled: value }); };

  const handleSaveKey = async (provider: AIProvider) => {
    const state = providerStates[provider]; if (!state?.keyValue.trim()) return;
    updateProviderState(provider, { saving: true }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try { await setAIKey(provider, state.keyValue.trim()); updateProviderState(provider, { saving: false, hasKey: true, isUserKey: true, testResult: null, testError: null }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
    catch { updateProviderState(provider, { saving: false }); Alert.alert('Error', 'Failed to save API key. Please try again.'); }
  };

  const handleTestKey = async (provider: AIProvider) => {
    const state = providerStates[provider]; const keyToTest = state?.keyValue.trim() || (await getAIKey(provider));
    if (!keyToTest) { Alert.alert('No Key', 'Enter an API key first.'); return; }
    updateProviderState(provider, { testing: true, testResult: null, testError: null }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try { const result = await testAIKey(provider, keyToTest); updateProviderState(provider, { testing: false, testResult: result.valid ? 'valid' : 'invalid', testError: result.error || null }); if (result.valid) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
    catch { updateProviderState(provider, { testing: false, testResult: 'invalid', testError: 'Test failed unexpectedly' }); }
  };

  const handleDeleteKey = async (provider: AIProvider) => {
    Alert.alert('Remove Key', `Remove your saved ${AI_PROVIDERS.find((p) => p.id === provider)?.name} key? The app will fall back to the default key if available.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); await deleteAIKey(provider); const key = await getAIKey(provider); updateProviderState(provider, { hasKey: key !== null, isUserKey: false, keyValue: '', testResult: null, testError: null }); } },
    ]);
  };

  const handleMoveProvider = async (provider: AIProvider, direction: 'up' | 'down') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const idx = providerOrder.indexOf(provider);
    if (direction === 'up' && idx > 0) { const n = [...providerOrder]; [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]]; setOrderState(n); await setProviderOrder(n); }
    else if (direction === 'down' && idx < providerOrder.length - 1) { const n = [...providerOrder]; [n[idx], n[idx + 1]] = [n[idx + 1], n[idx]]; setOrderState(n); await setProviderOrder(n); }
  };

  const handleClearAll = () => {
    Alert.alert('Clear All Keys', 'Remove all saved API keys? The app will fall back to default keys if available.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: async () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); await clearAllAIKeys(); await loadProviderStates(); } },
    ]);
  };

  const getBadgeStyle = (state: ProviderState) => {
    if (!state.hasKey) return { text: 'No Key', bg: colors.bg.hover, fg: colors.text.muted };
    if (state.testResult === 'valid') return { text: 'Verified', bg: colors.accent.muted, fg: colors.accent.DEFAULT };
    if (state.testResult === 'invalid') return { text: 'Invalid', bg: colors.danger.muted, fg: colors.danger.DEFAULT };
    if (state.isUserKey) return { text: 'Custom', bg: colors.primary.muted, fg: colors.primary.DEFAULT };
    return { text: 'Default', bg: colors.bg.hover, fg: colors.text.muted };
  };

  const renderProviderCard = (config: AIProviderConfig, index: number) => {
    const state = providerStates[config.id] || DEFAULT_PROVIDER_STATE;
    const badge = getBadgeStyle(state);
    const orderIdx = providerOrder.indexOf(config.id);

    return (
      <Animated.View key={config.id} entering={FadeInDown.delay(index * 80).duration(400)} style={{ marginBottom: spacing['3'] }}>
        <View style={ai.listCard}>
          {/* Header */}
          <Pressable onPress={() => handleToggleExpand(config.id)} style={({ pressed }) => [ai.providerHeader, { opacity: pressed ? 0.8 : 1 }]}>
            <View style={[ai.priorityNum, { backgroundColor: config.color + '20' }]}>
              <Text style={{ color: config.color, fontSize: 14, fontFamily: typography.fontFamily.bold }}>{orderIdx + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={ai.rowCenter}>
                <Text style={ai.providerName}>{config.name}</Text>
                {!state.enabled && <View style={ai.offBadge}><Text style={{ color: colors.text.disabled, fontSize: 10, fontFamily: typography.fontFamily.medium }}>OFF</Text></View>}
              </View>
              <Text style={ai.providerDesc}>{config.description}</Text>
            </View>
            <View style={[ai.statusBadge, { backgroundColor: badge.bg }]}><Text style={{ color: badge.fg, fontSize: 12, fontFamily: typography.fontFamily.medium }}>{badge.text}</Text></View>
            {state.expanded ? <ChevronUp size={18} color={colors.text.disabled} /> : <ChevronDown size={18} color={colors.text.disabled} />}
          </Pressable>

          {/* Expanded panel */}
          {state.expanded && (
            <Animated.View entering={FadeInUp.duration(200)}>
              <View style={ai.expandedWrap}>
                {/* Enable toggle */}
                <View style={[ai.rowBetween, { marginBottom: spacing['4'] }]}>
                  <Text style={ai.label}>Enable provider</Text>
                  <Switch value={state.enabled} onValueChange={(v) => handleToggleEnabled(config.id, v)} trackColor={{ false: '#334155', true: config.color }} thumbColor="#FFFFFF" />
                </View>
                {/* API Key Input */}
                <Text style={ai.inputLabel}>API Key</Text>
                <View style={ai.inputRow}>
                  <TextInput style={ai.input} placeholder={config.placeholder} placeholderTextColor="#475569" value={state.keyValue} onChangeText={(text) => updateProviderState(config.id, { keyValue: text })} secureTextEntry={!state.showKey} autoCapitalize="none" autoCorrect={false} />
                  <Pressable onPress={() => updateProviderState(config.id, { showKey: !state.showKey })} style={({ pressed }) => ({ paddingHorizontal: spacing['3'], paddingVertical: spacing['3'], opacity: pressed ? 0.6 : 1 })}>
                    {state.showKey ? <EyeOff size={18} color={colors.text.disabled} /> : <Eye size={18} color={colors.text.disabled} />}
                  </Pressable>
                </View>
                {/* Test result */}
                {state.testResult && (
                  <View style={[ai.testResult, { backgroundColor: state.testResult === 'valid' ? colors.accent.muted : colors.danger.muted }]}>
                    {state.testResult === 'valid' ? <Check size={14} color={colors.accent.DEFAULT} /> : <X size={14} color={colors.danger.DEFAULT} />}
                    <Text style={{ marginLeft: spacing['2'], fontSize: 12, color: state.testResult === 'valid' ? colors.accent.DEFAULT : colors.danger.DEFAULT }}>{state.testResult === 'valid' ? 'Key is valid! Connected successfully.' : state.testError || 'Invalid API key'}</Text>
                  </View>
                )}
                {/* Action buttons */}
                <View style={[ai.rowCenter, { gap: spacing['2'], marginBottom: spacing['4'] }]}>
                  <Pressable onPress={() => handleSaveKey(config.id)} disabled={!state.keyValue.trim() || state.saving} style={({ pressed }) => [ai.actionBtn, { flex: 1, backgroundColor: state.keyValue.trim() ? colors.accent.DEFAULT : colors.bg.hover, opacity: pressed ? 0.8 : 1 }]}>
                    {state.saving ? <ActivityIndicator size="small" color="#FFF" /> : <><Check size={15} color={state.keyValue.trim() ? '#FFF' : colors.text.disabled} /><Text style={{ marginLeft: 6, fontSize: 14, fontFamily: typography.fontFamily.semibold, color: state.keyValue.trim() ? '#FFF' : colors.text.disabled }}>Save</Text></>}
                  </Pressable>
                  <Pressable onPress={() => handleTestKey(config.id)} disabled={state.testing} style={({ pressed }) => [ai.actionBtn, { flex: 1, backgroundColor: colors.bg.hover, opacity: pressed ? 0.8 : 1 }]}>
                    {state.testing ? <ActivityIndicator size="small" color={colors.text.disabled} /> : <><Zap size={15} color={colors.text.disabled} /><Text style={{ marginLeft: 6, fontSize: 14, fontFamily: typography.fontFamily.semibold, color: colors.text.secondary }}>Test</Text></>}
                  </Pressable>
                  {state.isUserKey && (
                    <Pressable onPress={() => handleDeleteKey(config.id)} style={({ pressed }) => [ai.deleteBtn, { opacity: pressed ? 0.8 : 1 }]}>
                      <Trash2 size={16} color={colors.danger.DEFAULT} />
                    </Pressable>
                  )}
                </View>
                {/* Priority reorder */}
                <View style={ai.rowBetween}>
                  <View style={ai.rowCenter}><GripVertical size={14} color="#475569" /><Text style={{ color: colors.text.disabled, fontSize: 12, marginLeft: 4 }}>Priority #{orderIdx + 1}</Text></View>
                  <View style={[ai.rowCenter, { gap: spacing['2'] }]}>
                    <Pressable onPress={() => handleMoveProvider(config.id, 'up')} disabled={orderIdx === 0} style={({ pressed }) => [ai.reorderBtn, { backgroundColor: orderIdx === 0 ? colors.bg.elevated : colors.bg.hover, opacity: pressed ? 0.7 : 1 }]}>
                      <ChevronUp size={16} color={orderIdx === 0 ? '#334155' : colors.text.disabled} />
                    </Pressable>
                    <Pressable onPress={() => handleMoveProvider(config.id, 'down')} disabled={orderIdx === providerOrder.length - 1} style={({ pressed }) => [ai.reorderBtn, { backgroundColor: orderIdx === providerOrder.length - 1 ? colors.bg.elevated : colors.bg.hover, opacity: pressed ? 0.7 : 1 }]}>
                      <ChevronDown size={16} color={orderIdx === providerOrder.length - 1 ? '#334155' : colors.text.disabled} />
                    </Pressable>
                  </View>
                </View>
                {/* Get API key link */}
                <Pressable onPress={() => Linking.openURL(config.docsUrl)} style={({ pressed }) => [ai.docsLink, { opacity: pressed ? 0.7 : 1 }]}>
                  <ExternalLink size={13} color={colors.text.disabled} /><Text style={{ color: colors.text.muted, fontSize: 12, marginLeft: 6 }}>Get your {config.name} API key →</Text>
                </Pressable>

                {/* Google Sign-In Section */}
                {config.id === 'google' && (
                  <View style={ai.googleSection}>
                    <View style={[ai.rowCenter, { marginBottom: spacing['3'] }]}>
                      <Shield size={14} color="#4285F4" /><Text style={{ color: colors.text.secondary, fontSize: 14, fontFamily: typography.fontFamily.semibold, marginLeft: spacing['2'] }}>Or sign in with Google</Text>
                    </View>
                    <Text style={{ color: colors.text.disabled, fontSize: 12, marginBottom: spacing['3'] }}>Use your Google account instead of an API key. Requires a Google Cloud OAuth Client ID.</Text>
                    {googleOAuthStatus.signedIn ? (
                      <View style={ai.googleConnected}>
                        <View style={[ai.rowBetween]}>
                          <View style={[ai.rowCenter, { flex: 1 }]}>
                            <View style={ai.googleCheck}><Check size={16} color={colors.accent.DEFAULT} /></View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: colors.accent.light, fontSize: 14, fontFamily: typography.fontFamily.semibold }}>Google Account Connected</Text>
                              {googleOAuthStatus.email && <Text style={{ color: colors.accent.DEFAULT + '99', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{googleOAuthStatus.email}</Text>}
                            </View>
                          </View>
                          <Pressable onPress={async () => { await signOutGoogle(); const status = await getGoogleAuthStatus(); setGoogleOAuthStatus(status); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }} style={({ pressed }) => [ai.signOutBtn, { opacity: pressed ? 0.7 : 1 }]}>
                            <Text style={{ color: colors.text.secondary, fontSize: 12, fontFamily: typography.fontFamily.medium }}>Sign Out</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View>
                        <Text style={ai.inputLabel}>OAuth Client ID</Text>
                        <TextInput style={[ai.input, { backgroundColor: colors.bg.elevated + '99', borderRadius: radius.md, paddingHorizontal: spacing['3'], paddingVertical: spacing['3'], marginBottom: spacing['3'] }]} placeholder="123456789.apps.googleusercontent.com" placeholderTextColor="#475569" value={googleClientIdInput} onChangeText={setGoogleClientIdInput} autoCapitalize="none" autoCorrect={false} />
                        <Pressable onPress={async () => {
                          if (!googleClientIdInput.trim()) { Alert.alert('Client ID Required', 'Enter your Google OAuth Client ID first.'); return; }
                          setSigningIn(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          const result = await signInWithGoogle(googleClientIdInput.trim()); setSigningIn(false);
                          if (result.success) { const status = await getGoogleAuthStatus(); setGoogleOAuthStatus(status); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
                          else Alert.alert('Sign-In Failed', result.error || 'Please try again.');
                        }} disabled={signingIn || !googleClientIdInput.trim()} style={({ pressed }) => [ai.actionBtn, { backgroundColor: googleClientIdInput.trim() ? '#4285F4' : colors.bg.hover, opacity: pressed ? 0.8 : 1 }]}>
                          {signingIn ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={{ fontSize: 14, fontFamily: typography.fontFamily.semibold, color: googleClientIdInput.trim() ? '#FFF' : colors.text.disabled }}>Sign in with Google</Text>}
                        </Pressable>
                        <Pressable onPress={() => Linking.openURL('https://console.cloud.google.com/apis/credentials')} style={({ pressed }) => [ai.rowCenter, { marginTop: spacing['2'], opacity: pressed ? 0.7 : 1 }]}>
                          <ExternalLink size={11} color={colors.text.disabled} /><Text style={{ color: colors.text.disabled, fontSize: 12, marginLeft: 4 }}>Create OAuth Client ID in Google Cloud Console →</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </Animated.View>
          )}
        </View>
      </Animated.View>
    );
  };

  if (loading) {
    return <View style={[ai.root, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator size="large" color={colors.accent.DEFAULT} /></View>;
  }

  const sortedProviders = [...AI_PROVIDERS].sort((a, b) => providerOrder.indexOf(a.id) - providerOrder.indexOf(b.id));

  return (
    <View style={ai.root}>
      <LinearGradient colors={[colors.bg.subtle, colors.bg.base]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 150 }} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Animated.View entering={FadeIn.duration(300)} style={ai.header}>
          <Pressable onPress={onBack} style={({ pressed }) => [ai.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <ArrowLeft size={20} color="#FFFFFF" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={ai.title}>AI Providers</Text>
            <Text style={{ color: colors.text.disabled, fontSize: 12, marginTop: 2 }}>Manage your API keys</Text>
          </View>
        </Animated.View>

        <ScrollView style={{ flex: 1, paddingHorizontal: spacing['4'] }} showsVerticalScrollIndicator={false}>
          {/* Info banner */}
          <Animated.View entering={FadeInDown.duration(400)} style={ai.infoBanner}>
            <Shield size={16} color={colors.accent.DEFAULT} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: spacing['3'] }}>
              <Text style={{ color: colors.text.secondary, fontSize: 14, fontFamily: typography.fontFamily.medium }}>Keys stay on your device</Text>
              <Text style={{ color: colors.text.disabled, fontSize: 12, marginTop: 4 }}>API keys are stored securely using your device's encrypted keychain. They are never sent to our servers.</Text>
            </View>
          </Animated.View>

          {/* Fallback chain label */}
          <Animated.View entering={FadeInDown.delay(50).duration(400)} style={[ai.rowCenter, { marginBottom: spacing['3'], marginLeft: 4 }]}>
            <Zap size={12} color={colors.text.disabled} />
            <Text style={{ color: colors.text.disabled, fontSize: 12, fontFamily: typography.fontFamily.semibold, textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 6 }}>Fallback Chain — tried in order</Text>
          </Animated.View>

          {sortedProviders.map((config, index) => renderProviderCard(config, index))}

          {/* Clear all button */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={{ marginTop: spacing['3'], marginBottom: spacing['10'] }}>
            <Pressable onPress={handleClearAll} style={({ pressed }) => [ai.clearAllBtn, { opacity: pressed ? 0.8 : 1 }]}>
              <Trash2 size={16} color={colors.danger.DEFAULT} /><Text style={{ color: colors.danger.light, fontSize: 14, fontFamily: typography.fontFamily.semibold, marginLeft: spacing['2'] }}>Clear All Custom Keys</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const ai = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: { paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  title: { fontSize: 20, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
  listCard: { backgroundColor: colors.bg.card, borderRadius: radius.xl, overflow: 'hidden' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  providerHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing['4'], paddingVertical: spacing['4'] },
  priorityNum: { width: 28, height: 28, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  providerName: { color: colors.text.primary, fontFamily: typography.fontFamily.semibold, fontSize: 16 },
  providerDesc: { color: colors.text.disabled, fontSize: 12, marginTop: 2 },
  offBadge: { backgroundColor: colors.bg.hover, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.xs, marginLeft: spacing['2'] },
  statusBadge: { paddingHorizontal: spacing['2'], paddingVertical: 4, borderRadius: radius.full, marginRight: spacing['2'] },
  expandedWrap: { borderTopWidth: 1, borderTopColor: colors.border.subtle, paddingHorizontal: spacing['4'], paddingVertical: spacing['4'] },
  label: { color: colors.text.secondary, fontSize: 14, fontFamily: typography.fontFamily.medium },
  inputLabel: { color: colors.text.muted, fontSize: 12, fontFamily: typography.fontFamily.medium, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing['2'] },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.elevated + '99', borderRadius: radius.md, overflow: 'hidden', marginBottom: spacing['2'] },
  input: { flex: 1, color: colors.text.primary, fontSize: 14, fontFamily: 'monospace' },
  testResult: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing['3'], paddingHorizontal: spacing['3'], paddingVertical: spacing['2'], borderRadius: radius.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: radius.md },
  deleteBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.danger.muted },
  reorderBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  docsLink: { flexDirection: 'row', alignItems: 'center', marginTop: spacing['3'], paddingTop: spacing['3'], borderTopWidth: 1, borderTopColor: colors.border.subtle },
  googleSection: { marginTop: spacing['4'], paddingTop: spacing['4'], borderTopWidth: 1, borderTopColor: colors.border.subtle },
  googleConnected: { backgroundColor: colors.accent.muted, borderWidth: 1, borderColor: colors.accent.DEFAULT + '33', borderRadius: radius.md, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'] },
  googleCheck: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.accent.muted, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  signOutBtn: { backgroundColor: colors.bg.hover + 'CC', paddingHorizontal: spacing['3'], paddingVertical: 6, borderRadius: radius.sm },
  infoBanner: { backgroundColor: colors.bg.elevated + '4D', borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], marginBottom: spacing['5'], flexDirection: 'row', alignItems: 'flex-start' },
  clearAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['3'], borderRadius: radius.md, backgroundColor: colors.danger.muted },
});
