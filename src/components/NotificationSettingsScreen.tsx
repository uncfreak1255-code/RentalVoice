import React from 'react';
import { View, Text, Pressable, ScrollView, Switch, Alert, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/lib/store';
import { ArrowLeft, BellOff, Moon, Clock, MessageCircle, Sparkles, AlertTriangle, CalendarCheck, DollarSign, Home, VolumeX } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

interface NotificationSettingsScreenProps { onBack: () => void; }

const CATEGORIES = [
  { key: 'newMessage' as const, label: 'New Messages', desc: 'When a guest sends a new message', icon: MessageCircle, color: colors.accent.DEFAULT },
  { key: 'aiDraftReady' as const, label: 'AI Draft Ready', desc: 'When an AI draft is ready for review', icon: Sparkles, color: '#A855F7' },
  { key: 'issueDetected' as const, label: 'Issue Detected', desc: 'When AI detects a potential issue', icon: AlertTriangle, color: '#F59E0B' },
  { key: 'checkoutReminder' as const, label: 'Checkout Reminders', desc: 'Before guest checkout', icon: CalendarCheck, color: '#06B6D4' },
  { key: 'upsellResponse' as const, label: 'Upsell Responses', desc: 'When a guest responds to an offer', icon: DollarSign, color: '#22C55E' },
];

export function NotificationSettingsScreen({ onBack }: NotificationSettingsScreenProps) {
  const pushEnabled = useAppStore((s) => s.settings.pushNotificationsEnabled);
  const categories = useAppStore((s) => s.settings.notificationCategories);
  const quietStart = useAppStore((s) => s.settings.quietHoursStart);
  const quietEnd = useAppStore((s) => s.settings.quietHoursEnd);
  const mutedIds = useAppStore((s) => s.settings.mutedPropertyIds);
  const properties = useAppStore((s) => s.properties);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const handleCategoryToggle = (key: keyof typeof categories, value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateSettings({ notificationCategories: { ...categories, [key]: value } });
  };

  const handleQuietHoursToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (quietStart) {
      updateSettings({ quietHoursStart: undefined, quietHoursEnd: undefined });
    } else {
      updateSettings({ quietHoursStart: '22:00', quietHoursEnd: '07:00' });
    }
  };

  const handleQuietTimeChange = (field: 'quietHoursStart' | 'quietHoursEnd') => {
    const options = field === 'quietHoursStart'
      ? ['20:00', '21:00', '22:00', '23:00', '00:00']
      : ['06:00', '07:00', '08:00', '09:00', '10:00'];
    const labels = options.map((t) => {
      const [h, m] = t.split(':');
      const hr = parseInt(h, 10);
      return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
    });
    Alert.alert(
      field === 'quietHoursStart' ? 'Quiet Hours Start' : 'Quiet Hours End',
      'Select time',
      [...labels.map((label, i) => ({ text: label, onPress: () => updateSettings({ [field]: options[i] }) })), { text: 'Cancel', style: 'cancel' as const }]
    );
  };

  const formatTime = (time?: string) => {
    if (!time) return '--:--';
    const [h, m] = time.split(':');
    const hr = parseInt(h, 10);
    return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
  };

  const togglePropertyMute = (propertyId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMuted = mutedIds.includes(propertyId)
      ? mutedIds.filter((id) => id !== propertyId)
      : [...mutedIds, propertyId];
    updateSettings({ mutedPropertyIds: newMuted });
  };

  return (
    <View style={ns.root}>
      <LinearGradient colors={[colors.bg.subtle, colors.bg.base]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 150 }} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={ns.header}>
          <Pressable onPress={onBack} style={({ pressed }) => [ns.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <ArrowLeft size={20} color="#FFFFFF" />
          </Pressable>
          <Text style={ns.title}>Notification Settings</Text>
        </Animated.View>

        <ScrollView style={ns.scroll} showsVerticalScrollIndicator={false}>
          {/* Master Toggle Info */}
          {!pushEnabled && (
            <Animated.View entering={FadeInDown.duration(300)} style={ns.warningCard}>
              <BellOff size={20} color="#F59E0B" />
              <Text style={ns.warningText}>Push notifications are disabled. Enable them in the main Settings to receive alerts.</Text>
            </Animated.View>
          )}

          {/* Notification Categories */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={ns.section}>
            <Text style={ns.sectionLabel}>Notification Categories</Text>
            <View style={ns.card}>
              {CATEGORIES.map((cat, i) => {
                const Icon = cat.icon;
                return (
                  <View key={cat.key} style={[ns.catRow, i < CATEGORIES.length - 1 && ns.borderBottom]}>
                    <View style={[ns.iconBox, { backgroundColor: cat.color + '20' }]}>
                      <Icon size={18} color={cat.color} />
                    </View>
                    <View style={{ flex: 1, marginRight: spacing['3'] }}>
                      <Text style={ns.catLabel}>{cat.label}</Text>
                      <Text style={ns.catDesc}>{cat.desc}</Text>
                    </View>
                    <Switch
                      value={categories[cat.key]}
                      onValueChange={(v) => handleCategoryToggle(cat.key, v)}
                      trackColor={{ false: '#334155', true: cat.color }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                );
              })}
            </View>
          </Animated.View>

          {/* Quiet Hours */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={ns.section}>
            <Text style={ns.sectionLabel}>Quiet Hours</Text>
            <View style={ns.card}>
              <View style={ns.catRow}>
                <View style={[ns.iconBox, { backgroundColor: '#6366F120' }]}>
                  <Moon size={18} color="#6366F1" />
                </View>
                <View style={{ flex: 1, marginRight: spacing['3'] }}>
                  <Text style={ns.catLabel}>Do Not Disturb</Text>
                  <Text style={ns.catDesc}>Silence notifications during set hours</Text>
                </View>
                <Switch
                  value={!!quietStart}
                  onValueChange={handleQuietHoursToggle}
                  trackColor={{ false: '#334155', true: '#6366F1' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              {quietStart && (
                <View style={[ns.timeRow, ns.borderTop]}>
                  <View style={ns.timeBlock}>
                    <Text style={ns.timeLabel}>From</Text>
                    <Pressable onPress={() => handleQuietTimeChange('quietHoursStart')} style={({ pressed }) => [ns.timePicker, { opacity: pressed ? 0.7 : 1 }]}>
                      <Clock size={14} color={colors.accent.DEFAULT} />
                      <Text style={ns.timeValue}>{formatTime(quietStart)}</Text>
                    </Pressable>
                  </View>
                  <Text style={ns.timeSep}>→</Text>
                  <View style={ns.timeBlock}>
                    <Text style={ns.timeLabel}>Until</Text>
                    <Pressable onPress={() => handleQuietTimeChange('quietHoursEnd')} style={({ pressed }) => [ns.timePicker, { opacity: pressed ? 0.7 : 1 }]}>
                      <Clock size={14} color={colors.accent.DEFAULT} />
                      <Text style={ns.timeValue}>{formatTime(quietEnd)}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Per-Property Muting */}
          {properties.length > 0 && (
            <Animated.View entering={FadeInDown.delay(300).duration(400)} style={[ns.section, { marginBottom: spacing['8'] }]}>
              <Text style={ns.sectionLabel}>Per-Property Muting</Text>
              <View style={ns.card}>
                {properties.map((prop, i) => {
                  const isMuted = mutedIds.includes(prop.id);
                  return (
                    <View key={prop.id} style={[ns.catRow, i < properties.length - 1 && ns.borderBottom]}>
                      <View style={[ns.iconBox, { backgroundColor: isMuted ? '#EF444420' : '#22C55E20' }]}>
                        {isMuted ? <VolumeX size={18} color="#EF4444" /> : <Home size={18} color="#22C55E" />}
                      </View>
                      <View style={{ flex: 1, marginRight: spacing['3'] }}>
                        <Text style={ns.catLabel}>{prop.name}</Text>
                        <Text style={ns.catDesc}>{isMuted ? 'Muted — no notifications' : 'Active — receiving notifications'}</Text>
                      </View>
                      <Pressable
                        onPress={() => togglePropertyMute(prop.id)}
                        style={({ pressed }) => [ns.muteBtn, isMuted && ns.muteBtnActive, { opacity: pressed ? 0.7 : 1 }]}
                      >
                        <Text style={[ns.muteBtnText, isMuted && ns.muteBtnTextActive]}>{isMuted ? 'Unmute' : 'Mute'}</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const ns = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: { paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  title: { fontSize: 20, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
  scroll: { flex: 1, paddingHorizontal: spacing['4'] },
  section: { marginBottom: spacing['6'] },
  sectionLabel: { color: colors.text.disabled, fontSize: 12, fontFamily: typography.fontFamily.semibold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing['2'], marginLeft: 4 },
  card: { backgroundColor: `${colors.bg.elevated}E6`, borderRadius: radius.xl, overflow: 'hidden' },
  catRow: { flexDirection: 'row', alignItems: 'center', padding: spacing['4'] },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  borderTop: { borderTopWidth: 1, borderTopColor: colors.border.subtle },
  iconBox: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  catLabel: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 15 },
  catDesc: { color: colors.text.disabled, fontSize: 13, marginTop: 2 },
  warningCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F59E0B15', borderRadius: radius.xl, padding: spacing['4'], marginBottom: spacing['4'], gap: spacing['3'] },
  warningText: { color: '#F59E0B', fontSize: 14, flex: 1 },
  timeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing['4'], paddingVertical: spacing['3'] },
  timeBlock: { flex: 1 },
  timeLabel: { color: colors.text.disabled, fontSize: 12, marginBottom: 4 },
  timePicker: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.hover, paddingHorizontal: spacing['3'], paddingVertical: spacing['2'], borderRadius: radius.md, gap: spacing['2'], alignSelf: 'flex-start' },
  timeValue: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 15 },
  timeSep: { color: colors.text.disabled, fontSize: 18, marginHorizontal: spacing['2'] },
  muteBtn: { paddingHorizontal: spacing['3'], paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border.subtle },
  muteBtnActive: { backgroundColor: '#EF444420', borderColor: '#EF4444' },
  muteBtnText: { color: colors.text.secondary, fontSize: 13, fontFamily: typography.fontFamily.medium },
  muteBtnTextActive: { color: '#EF4444' },
});
