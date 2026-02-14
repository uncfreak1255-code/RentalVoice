import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/lib/store';
import { ArrowLeft, CheckCircle, AlertCircle, Eye, EyeOff, Cpu, ChevronDown, RotateCcw } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { initializeConnection, disconnectHostaway, validateCredentials } from '@/lib/hostaway';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

const AI_PROVIDERS = [
  {
    key: 'anthropic', name: 'Anthropic', color: '#D97706',
    models: ['claude-sonnet-4-20250514', 'claude-3.5-haiku'],
    pricePerMToken: { 'claude-sonnet-4-20250514': 3.0, 'claude-3.5-haiku': 0.25 },
  },
  {
    key: 'openai', name: 'OpenAI', color: '#10B981',
    models: ['gpt-4o', 'gpt-4o-mini'],
    pricePerMToken: { 'gpt-4o': 2.5, 'gpt-4o-mini': 0.15 },
  },
  {
    key: 'google', name: 'Google', color: '#3B82F6',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro'],
    pricePerMToken: { 'gemini-2.0-flash': 0.1, 'gemini-1.5-pro': 1.25 },
  },
  {
    key: 'grok', name: 'Grok (xAI)', color: '#8B5CF6',
    models: ['grok-2', 'grok-2-mini'],
    pricePerMToken: { 'grok-2': 2.0, 'grok-2-mini': 0.3 },
  },
];

interface ApiSettingsScreenProps {
  onBack: () => void;
}

export function ApiSettingsScreen({ onBack }: ApiSettingsScreenProps) {
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const storedAccountId = useAppStore((s) => s.settings.accountId);
  const storedApiKey = useAppStore((s) => s.settings.apiKey);
  const setCredentials = useAppStore((s) => s.setCredentials);
  const setDemoMode = useAppStore((s) => s.setDemoMode);
  const resetStore = useAppStore((s) => s.resetStore);
  const aiProviderUsage = useAppStore((s) => s.aiProviderUsage);
  const setProviderModel = useAppStore((s) => s.setProviderModel);
  const resetProviderUsage = useAppStore((s) => s.resetProviderUsage);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  const [accountId, setAccountId] = useState(storedAccountId || '');
  const [apiKey, setApiKey] = useState(storedApiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!accountId.trim() || !apiKey.trim()) {
      setError('Please enter both Account ID and API Key');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSaving(true);
    setError(null);
    try {
      const isValid = await validateCredentials(accountId.trim(), apiKey.trim());
      if (!isValid) {
        setError('Invalid credentials. Please check your Account ID and API Key.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setIsSaving(false);
        return;
      }
      const success = await initializeConnection(accountId.trim(), apiKey.trim());
      if (success) {
        setCredentials(accountId.trim(), apiKey.trim());
        setDemoMode(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setError('Failed to initialize connection. Please try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err) {
      console.error('[ApiSettings] Connection error:', err);
      setError('Failed to connect. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUseDemoMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDemoMode(true);
    setAccountId('');
    setApiKey('');
    setCredentials('', '');
  };

  const handleDisconnect = async () => {
    Alert.alert('Disconnect Hostaway', 'This will remove your saved credentials securely. You will need to re-enter them to reconnect.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: async () => {
        setIsDisconnecting(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        try {
          await disconnectHostaway();
          setAccountId('');
          setApiKey('');
          setCredentials('', '');
          setDemoMode(true);
        } catch (err) {
          console.error('[ApiSettings] Disconnect error:', err);
          Alert.alert('Error', 'Failed to disconnect. Please try again.');
        } finally {
          setIsDisconnecting(false);
        }
      }},
    ]);
  };

  const isConnected = !isDemoMode && storedApiKey && storedAccountId;
  const hasInput = accountId.trim() && apiKey.trim();

  return (
    <View style={ap.root}>
      <LinearGradient colors={[colors.bg.elevated, colors.bg.subtle]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 150 }} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Animated.View entering={FadeIn.duration(300)} style={ap.header}>
          <Pressable onPress={onBack} style={({ pressed }) => [ap.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <ArrowLeft size={20} color={colors.text.primary} />
          </Pressable>
          <Text style={ap.headerTitle}>Hostaway API</Text>
        </Animated.View>

        <ScrollView style={ap.scroll} showsVerticalScrollIndicator={false}>
          {/* Status Card */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={[ap.statusCard, { backgroundColor: isConnected ? colors.primary.muted : isDemoMode ? colors.accent.muted : colors.bg.elevated + '80' }]}>
            <View style={ap.statusRow}>
              {isConnected ? <CheckCircle size={24} color={colors.primary.DEFAULT} /> : <AlertCircle size={24} color={isDemoMode ? colors.warning.DEFAULT : colors.text.disabled} />}
              <Text style={ap.statusTitle}>{isConnected ? 'Connected' : isDemoMode ? 'Demo Mode' : 'Not Connected'}</Text>
            </View>
            <Text style={ap.statusDesc}>
              {isConnected ? 'Your Hostaway account is connected. Messages and properties are syncing.' : isDemoMode ? 'Using sample data. Connect your Hostaway API to access real properties.' : 'Enter your API key to connect your Hostaway account.'}
            </Text>
          </Animated.View>

          {/* Account ID */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={ap.fieldWrap}>
            <Text style={ap.fieldLabel}>Account ID</Text>
            <View style={ap.inputWrap}>
              <TextInput value={accountId} onChangeText={(t) => { setAccountId(t); setError(null); }} placeholder="Enter your Hostaway Account ID" placeholderTextColor={colors.text.disabled} style={ap.input} autoCapitalize="none" autoCorrect={false} keyboardType="number-pad" />
            </View>
          </Animated.View>

          {/* API Key */}
          <Animated.View entering={FadeInDown.delay(250).duration(400)} style={ap.fieldWrapLg}>
            <Text style={ap.fieldLabel}>API Secret Key</Text>
            <View style={ap.inputRow}>
              <TextInput value={apiKey} onChangeText={(t) => { setApiKey(t); setError(null); }} placeholder="Enter your Hostaway API Secret Key" placeholderTextColor={colors.text.disabled} secureTextEntry={!showKey} style={ap.inputFlex} autoCapitalize="none" autoCorrect={false} />
              <Pressable onPress={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff size={20} color={colors.text.disabled} /> : <Eye size={20} color={colors.text.disabled} />}
              </Pressable>
            </View>
            <Text style={ap.hint}>Find your credentials in Hostaway Dashboard → Settings → API</Text>
          </Animated.View>

          {/* Error */}
          {error && (
            <Animated.View entering={FadeIn.duration(200)} style={ap.fieldWrap}>
              <View style={ap.errorCard}>
                <AlertCircle size={18} color={colors.danger.DEFAULT} />
                <Text style={ap.errorText}>{error}</Text>
              </View>
            </Animated.View>
          )}

          {/* Save */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={ap.fieldWrap}>
            <Pressable onPress={handleSave} disabled={!hasInput || isSaving} style={({ pressed }) => [ap.primaryBtn, { backgroundColor: hasInput ? colors.primary.DEFAULT : colors.bg.hover, opacity: pressed ? 0.8 : 1 }]}>
              {isSaving ? (
                <><ActivityIndicator size="small" color={colors.text.primary} /><Text style={[ap.btnText, { marginLeft: spacing['2'] }]}>Connecting...</Text></>
              ) : (
                <Text style={[ap.btnText, { color: hasInput ? colors.text.primary : colors.text.disabled }]}>{isConnected ? 'Update Connection' : 'Connect API'}</Text>
              )}
            </Pressable>
          </Animated.View>

          {/* Demo Mode */}
          {!isDemoMode && (
            <Animated.View entering={FadeInDown.delay(400).duration(400)} style={ap.fieldWrap}>
              <Pressable onPress={handleUseDemoMode} style={({ pressed }) => [ap.secondaryBtn, { opacity: pressed ? 0.8 : 1 }]}>
                <Text style={ap.secondaryText}>Use Demo Mode</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Disconnect */}
          {isConnected && (
            <Animated.View entering={FadeInDown.delay(400).duration(400)} style={ap.fieldWrap}>
              <Pressable onPress={handleDisconnect} disabled={isDisconnecting} style={({ pressed }) => [ap.dangerBtn, { backgroundColor: isDisconnecting ? colors.bg.elevated + '80' : colors.danger.muted, opacity: pressed ? 0.8 : 1 }]}>
                {isDisconnecting ? (
                  <><ActivityIndicator size="small" color={colors.text.muted} /><Text style={[ap.secondaryText, { marginLeft: spacing['2'] }]}>Disconnecting...</Text></>
                ) : (
                  <Text style={ap.dangerText}>Disconnect API</Text>
                )}
              </Pressable>
            </Animated.View>
          )}

          {/* Security Note */}
          <Animated.View entering={FadeInDown.delay(450).duration(400)} style={ap.securityCard}>
            <View style={ap.securityRow}>
              <CheckCircle size={18} color={colors.primary.DEFAULT} />
              <View style={{ flex: 1, marginLeft: spacing['2'] }}>
                <Text style={ap.securityTitle}>Secure Storage</Text>
                <Text style={ap.securityDesc}>Your credentials are encrypted and stored securely using platform-native encryption (Keychain on iOS, Keystore on Android).</Text>
              </View>
            </View>
          </Animated.View>

          {/* Help */}
          <Animated.View entering={FadeInDown.delay(500).duration(400)} style={ap.helpCard}>
            <Text style={ap.helpTitle}>Need help?</Text>
            <Text style={ap.helpDesc}>
              To get your Hostaway credentials:{'\n'}1. Log in to your Hostaway dashboard{'\n'}2. Go to Settings → API{'\n'}3. Copy your Account ID and API Secret Key
            </Text>
          </Animated.View>

          {/* AI Provider Usage & Model Picker */}
          <Animated.View entering={FadeInDown.delay(550).duration(400)} style={{ marginBottom: spacing['4'] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing['3'], marginLeft: 4 }}>
              <Cpu size={16} color={colors.text.disabled} />
              <Text style={{ color: colors.text.disabled, fontSize: 12, fontFamily: typography.fontFamily.semibold, textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: spacing['2'] }}>AI Providers</Text>
            </View>
            {AI_PROVIDERS.map((provider) => {
              const usage = aiProviderUsage[provider.key];
              const selectedModel = usage?.selectedModel || provider.models[0];
              const isExpanded = expandedProvider === provider.key;
              const cost = usage ? ((usage.estimatedTokens / 1_000_000) * ((provider.pricePerMToken as unknown as Record<string, number>)[selectedModel] || 1)).toFixed(4) : '0.0000';

              return (
                <Pressable key={provider.key} onPress={() => { setExpandedProvider(isExpanded ? null : provider.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={{ backgroundColor: `${colors.bg.elevated}E6`, borderRadius: radius.xl, marginBottom: spacing['3'], overflow: 'hidden' }}>
                  {/* Provider Header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing['4'] }}>
                    <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: provider.color + '20', alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] }}>
                      <Cpu size={18} color={provider.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 15 }}>{provider.name}</Text>
                      <Text style={{ color: colors.text.disabled, fontSize: 12 }}>{selectedModel}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['2'] }}>
                      {usage && usage.requestCount > 0 && (
                        <View style={{ backgroundColor: provider.color + '20', paddingHorizontal: spacing['2'], paddingVertical: 2, borderRadius: radius.sm }}>
                          <Text style={{ color: provider.color, fontSize: 11, fontFamily: typography.fontFamily.medium }}>{usage.requestCount} req</Text>
                        </View>
                      )}
                      <ChevronDown size={16} color={colors.text.disabled} style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }} />
                    </View>
                  </View>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <Animated.View entering={FadeIn.duration(200)} style={{ paddingHorizontal: spacing['4'], paddingBottom: spacing['4'], borderTopWidth: 1, borderTopColor: colors.border.subtle }}>
                      {/* Model Picker */}
                      <Text style={{ color: colors.text.disabled, fontSize: 12, fontFamily: typography.fontFamily.medium, marginTop: spacing['3'], marginBottom: spacing['2'] }}>Model</Text>
                      <View style={{ flexDirection: 'row', gap: spacing['2'], marginBottom: spacing['4'] }}>
                        {provider.models.map((model) => (
                          <Pressable key={model} onPress={() => { setProviderModel(provider.key, model); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                            style={{ flex: 1, paddingVertical: spacing['2'], paddingHorizontal: spacing['3'], borderRadius: radius.md,
                              backgroundColor: selectedModel === model ? provider.color + '20' : colors.bg.hover, alignItems: 'center' }}>
                            <Text style={{ color: selectedModel === model ? provider.color : colors.text.disabled, fontSize: 13, fontFamily: typography.fontFamily.medium }} numberOfLines={1}>{model}</Text>
                          </Pressable>
                        ))}
                      </View>

                      {/* Usage Stats */}
                      <View style={{ flexDirection: 'row', gap: spacing['3'], marginBottom: spacing['3'] }}>
                        <View style={{ flex: 1, backgroundColor: colors.bg.hover, borderRadius: radius.md, padding: spacing['3'] }}>
                          <Text style={{ color: colors.text.disabled, fontSize: 11 }}>Requests</Text>
                          <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.bold, fontSize: 18 }}>{usage?.requestCount || 0}</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: colors.bg.hover, borderRadius: radius.md, padding: spacing['3'] }}>
                          <Text style={{ color: colors.text.disabled, fontSize: 11 }}>Est. Tokens</Text>
                          <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.bold, fontSize: 18 }}>{usage?.estimatedTokens ? `${(usage.estimatedTokens / 1000).toFixed(1)}K` : '0'}</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: colors.bg.hover, borderRadius: radius.md, padding: spacing['3'] }}>
                          <Text style={{ color: colors.text.disabled, fontSize: 11 }}>Est. Cost</Text>
                          <Text style={{ color: '#22C55E', fontFamily: typography.fontFamily.bold, fontSize: 18 }}>${cost}</Text>
                        </View>
                      </View>

                      {/* Reset */}
                      <Pressable onPress={() => { resetProviderUsage(provider.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
                        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['2'],
                          borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.subtle, opacity: pressed ? 0.7 : 1, gap: spacing['2'] })}>
                        <RotateCcw size={14} color={colors.text.disabled} />
                        <Text style={{ color: colors.text.disabled, fontSize: 13 }}>Reset Usage</Text>
                      </Pressable>
                    </Animated.View>
                  )}
                </Pressable>
              );
            })}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const ap = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: { paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.bg.elevated + '80', alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  headerTitle: { fontSize: 20, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
  scroll: { flex: 1, paddingHorizontal: spacing['4'] },
  statusCard: { borderRadius: radius.xl, padding: spacing['5'], marginBottom: spacing['6'] },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing['3'] },
  statusTitle: { color: colors.text.primary, fontFamily: typography.fontFamily.semibold, fontSize: 18, marginLeft: spacing['3'] },
  statusDesc: { color: colors.text.muted, fontSize: 14 },
  fieldWrap: { marginBottom: spacing['4'] },
  fieldWrapLg: { marginBottom: spacing['6'] },
  fieldLabel: { color: colors.text.muted, fontSize: 14, fontFamily: typography.fontFamily.medium, marginBottom: spacing['2'], marginLeft: spacing['1'] },
  inputWrap: { backgroundColor: colors.bg.elevated + '80', borderRadius: radius.md },
  input: { color: colors.text.primary, paddingHorizontal: spacing['4'], paddingVertical: spacing['4'] },
  inputRow: { backgroundColor: colors.bg.elevated + '80', borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', paddingRight: spacing['3'] },
  inputFlex: { flex: 1, color: colors.text.primary, paddingHorizontal: spacing['4'], paddingVertical: spacing['4'] },
  hint: { color: colors.text.disabled, fontSize: 12, marginTop: spacing['2'], marginLeft: spacing['1'] },
  errorCard: { backgroundColor: colors.danger.muted, borderRadius: radius.md, padding: spacing['3'], flexDirection: 'row', alignItems: 'center' },
  errorText: { color: colors.danger.light, fontSize: 14, marginLeft: spacing['2'], flex: 1 },
  primaryBtn: { borderRadius: radius.md, paddingVertical: spacing['4'], alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  btnText: { color: colors.text.primary, fontFamily: typography.fontFamily.semibold },
  secondaryBtn: { borderRadius: radius.md, paddingVertical: spacing['4'], alignItems: 'center', backgroundColor: colors.bg.elevated + '80' },
  secondaryText: { color: colors.text.muted, fontFamily: typography.fontFamily.medium },
  dangerBtn: { borderRadius: radius.md, paddingVertical: spacing['4'], alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  dangerText: { color: colors.danger.DEFAULT, fontFamily: typography.fontFamily.medium },
  securityCard: { backgroundColor: colors.primary.muted, borderRadius: radius.md, padding: spacing['4'], marginBottom: spacing['4'] },
  securityRow: { flexDirection: 'row', alignItems: 'flex-start' },
  securityTitle: { color: colors.primary.light, fontFamily: typography.fontFamily.medium, fontSize: 14 },
  securityDesc: { color: colors.text.muted, fontSize: 12, marginTop: 4 },
  helpCard: { backgroundColor: colors.bg.elevated + '4D', borderRadius: radius.md, padding: spacing['4'], marginBottom: spacing['8'] },
  helpTitle: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, marginBottom: spacing['2'] },
  helpDesc: { color: colors.text.muted, fontSize: 14, lineHeight: 20 },
});
