import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Switch, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/lib/store';
import { ArrowLeft, Globe, Check, Languages, Sparkles, Users, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { getLanguageDisplayInfo, getCulturalProfile, getCulturalAdaptationSummary } from '@/lib/cultural-tone';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

interface LanguageSettingsScreenProps { onBack: () => void; }

const languages = [
  { code: 'auto', label: 'Auto-Detect', description: 'Automatically detect guest language' },
  { code: 'en', label: 'English', description: 'English' },
  { code: 'es', label: 'Spanish', description: 'Español' },
  { code: 'fr', label: 'French', description: 'Français' },
  { code: 'de', label: 'German', description: 'Deutsch' },
  { code: 'it', label: 'Italian', description: 'Italiano' },
  { code: 'pt', label: 'Portuguese', description: 'Português' },
  { code: 'ar', label: 'Arabic', description: 'العربية' },
  { code: 'fa', label: 'Persian', description: 'فارسی' },
  { code: 'zh', label: 'Chinese', description: '中文' },
  { code: 'ja', label: 'Japanese', description: '日本語' },
  { code: 'ko', label: 'Korean', description: '한국어' },
];

function CulturalTonePreview({ languageCode }: { languageCode: string }) {
  const [expanded, setExpanded] = useState(false);
  const profile = getCulturalProfile(languageCode);
  const displayInfo = getLanguageDisplayInfo(languageCode);
  const summary = getCulturalAdaptationSummary(languageCode);

  const toggleExpanded = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setExpanded(!expanded); };

  return (
    <Animated.View entering={FadeInDown.delay(250).duration(400)} style={ls.sectionGap}>
      <Pressable onPress={toggleExpanded}>
        <View style={ls.card}>
          <View style={ls.rowBetween}>
            <View style={[ls.rowCenter, { flex: 1 }]}>
              <View style={[ls.iconBox, { backgroundColor: '#A855F720' }]}><Users size={20} color="#A855F7" /></View>
              <View style={{ flex: 1 }}>
                <Text style={ls.white}>Cultural Tone Preview</Text>
                <Text style={ls.hint}>{displayInfo.flag} {displayInfo.culturalNote}</Text>
              </View>
            </View>
            {expanded ? <ChevronUp size={20} color={colors.text.disabled} /> : <ChevronDown size={20} color={colors.text.disabled} />}
          </View>

          {expanded && (
            <Animated.View entering={FadeInUp.duration(300)} style={ls.expandedPanel}>
              {/* Formality */}
              <View>
                <View style={ls.meterLabel}><Text style={ls.meterText}>Formality</Text><Text style={ls.meterValue}>{summary.formalityLevel}</Text></View>
                <View style={ls.meterTrack}><View style={[ls.meterFill, { width: `${profile.formalityDefault}%`, backgroundColor: '#A855F7' }]} /></View>
              </View>
              {/* Warmth */}
              <View style={{ marginTop: spacing['3'] }}>
                <View style={ls.meterLabel}><Text style={ls.meterText}>Warmth</Text><Text style={ls.meterValue}>{summary.warmthLevel}</Text></View>
                <View style={ls.meterTrack}><View style={[ls.meterFill, { width: `${profile.warmthDefault}%`, backgroundColor: '#F97316' }]} /></View>
              </View>
              {/* Directness */}
              <View style={{ marginTop: spacing['3'] }}>
                <View style={ls.meterLabel}><Text style={ls.meterText}>Directness</Text><Text style={ls.meterValue}>{profile.directnessDefault >= 70 ? 'Direct' : profile.directnessDefault >= 40 ? 'Balanced' : 'Indirect'}</Text></View>
                <View style={ls.meterTrack}><View style={[ls.meterFill, { width: `${profile.directnessDefault}%`, backgroundColor: '#06B6D4' }]} /></View>
              </View>
              {/* Adaptations */}
              <View style={{ marginTop: spacing['4'] }}>
                <Text style={ls.sectionLabel}>Adaptations Applied</Text>
                <View style={ls.tagWrap}>
                  {summary.adaptations.slice(0, 4).map((a, i) => (
                    <View key={i} style={ls.tag}><Text style={ls.tagText}>{a}</Text></View>
                  ))}
                </View>
              </View>
              {/* Sample Greetings */}
              <View style={{ marginTop: spacing['4'] }}>
                <Text style={ls.sectionLabel}>Sample Greetings</Text>
                <View style={ls.greetingBox}><Text style={ls.greetingText}>{profile.commonGreetings.slice(0, 3).join(' • ')}</Text></View>
              </View>
              {/* Cultural Notes */}
              {profile.culturalNotes.length > 0 && (
                <View style={{ marginTop: spacing['4'] }}>
                  <Text style={ls.sectionLabel}>Cultural Notes</Text>
                  {profile.culturalNotes.slice(0, 2).map((note, i) => (
                    <View key={i} style={ls.noteRow}>
                      <View style={ls.noteDot} />
                      <Text style={[ls.meterText, { flex: 1 }]}>{note}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Animated.View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function LanguageSettingsScreen({ onBack }: LanguageSettingsScreenProps) {
  const defaultLanguage = useAppStore((s) => s.settings.defaultLanguage);
  const culturalToneEnabled = useAppStore((s) => s.settings.culturalToneEnabled);
  const autoDetectGuestLanguage = useAppStore((s) => s.settings.autoDetectGuestLanguage);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [selectedLanguage, setSelectedLanguage] = useState(defaultLanguage || 'auto');

  const handleSelectLanguage = (code: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedLanguage(code);
    updateSettings({ defaultLanguage: code === 'auto' ? 'en' : code });
  };

  const handleCulturalToneToggle = (value: boolean) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); updateSettings({ culturalToneEnabled: value }); };
  const handleAutoDetectToggle = (value: boolean) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); updateSettings({ autoDetectGuestLanguage: value }); };
  const responseMode = useAppStore((s) => s.settings.responseLanguageMode);
  const handleResponseModeToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateSettings({ responseLanguageMode: responseMode === 'match_guest' ? 'host_language' : 'match_guest' });
  };

  return (
    <View style={ls.root}>
      <LinearGradient colors={[colors.bg.subtle, colors.bg.base]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 150 }} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={ls.header}>
          <Pressable onPress={onBack} style={({ pressed }) => [ls.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <ArrowLeft size={20} color={colors.text.primary} />
          </Pressable>
          <Text style={ls.title}>Language & Cultural Tone</Text>
        </Animated.View>

        <ScrollView style={ls.scroll} showsVerticalScrollIndicator={false}>
          {/* Cultural Tone Toggle */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={ls.sectionGap}>
            <View style={ls.card}>
              <View style={ls.rowBetween}>
                <View style={[ls.rowCenter, { flex: 1, marginRight: spacing['4'] }]}>
                  <View style={[ls.iconBox, { backgroundColor: '#A855F720' }]}><Globe size={20} color="#A855F7" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={ls.white}>Cultural Tone Adaptation</Text>
                    <Text style={ls.hint}>Adjust tone for each culture</Text>
                  </View>
                </View>
                <Switch value={culturalToneEnabled} onValueChange={handleCulturalToneToggle} trackColor={{ false: '#334155', true: '#A855F7' }} thumbColor="#FFFFFF" />
              </View>
            </View>
          </Animated.View>

          {/* Auto-Detect Language Toggle */}
          <Animated.View entering={FadeInDown.delay(150).duration(400)} style={ls.sectionGap}>
            <View style={ls.card}>
              <View style={ls.rowBetween}>
                <View style={[ls.rowCenter, { flex: 1, marginRight: spacing['4'] }]}>
                  <View style={[ls.iconBox, { backgroundColor: colors.accent.muted }]}><Languages size={20} color={colors.accent.DEFAULT} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={ls.white}>Auto-Detect Language</Text>
                    <Text style={ls.hint}>Detect guest language from messages</Text>
                  </View>
                </View>
                <Switch value={autoDetectGuestLanguage} onValueChange={handleAutoDetectToggle} trackColor={{ false: '#334155', true: colors.accent.DEFAULT }} thumbColor="#FFFFFF" />
              </View>
            </View>
          </Animated.View>

          {/* Response Language Mode */}
          <Animated.View entering={FadeInDown.delay(175).duration(400)} style={ls.sectionGap}>
            <View style={ls.card}>
              <View style={ls.rowBetween}>
                <View style={[ls.rowCenter, { flex: 1, marginRight: spacing['4'] }]}>
                  <View style={[ls.iconBox, { backgroundColor: '#22C55E20' }]}><MessageCircle size={20} color="#22C55E" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={ls.white}>Response Language</Text>
                    <Text style={ls.hint}>{responseMode === 'match_guest' ? 'Reply in guest\'s detected language' : 'Always reply in your default language'}</Text>
                  </View>
                </View>
              </View>
              <View style={[ls.rowCenter, { marginTop: spacing['3'], gap: spacing['2'] }]}>
                <Pressable
                  onPress={() => { if (responseMode !== 'match_guest') handleResponseModeToggle(); }}
                  style={[ls.modeBtn, responseMode === 'match_guest' && ls.modeBtnActive]}
                >
                  <Text style={[ls.modeBtnText, responseMode === 'match_guest' && ls.modeBtnTextActive]}>Match Guest</Text>
                </Pressable>
                <Pressable
                  onPress={() => { if (responseMode !== 'host_language') handleResponseModeToggle(); }}
                  style={[ls.modeBtn, responseMode === 'host_language' && ls.modeBtnActive]}
                >
                  <Text style={[ls.modeBtnText, responseMode === 'host_language' && ls.modeBtnTextActive]}>My Language</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>

          {/* AI Feature Card */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={[ls.card, { marginBottom: spacing['6'] }]}>
            <View style={[ls.rowCenter, { marginBottom: spacing['2'] }]}>
              <Sparkles size={18} color="#A855F7" />
              <Text style={{ color: '#C084FC', fontFamily: typography.fontFamily.medium, marginLeft: spacing['2'] }}>AI Cultural Intelligence</Text>
            </View>
            <Text style={{ color: colors.text.muted, fontSize: 14, lineHeight: 20 }}>
              AI automatically adapts tone, formality, and expressions based on the guest's cultural background. German guests receive formal, precise responses. Spanish and Italian guests get warmer, more expressive messages. Japanese guests receive highly respectful, formal communication.
            </Text>
          </Animated.View>

          {/* Cultural Tone Preview */}
          {culturalToneEnabled && selectedLanguage !== 'auto' && <CulturalTonePreview languageCode={selectedLanguage} />}

          {/* Language Selection */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={{ marginBottom: spacing['8'] }}>
            <Text style={ls.sectionLabel}>Default Response Language</Text>
            <View style={ls.listCard}>
              {languages.map((lang, index) => {
                const displayInfo = lang.code !== 'auto' ? getLanguageDisplayInfo(lang.code) : null;
                return (
                  <Pressable key={lang.code} onPress={() => handleSelectLanguage(lang.code)} style={({ pressed }) => [ls.langRow, index < languages.length - 1 && ls.borderBottom, { opacity: pressed ? 0.7 : 1 }]}>
                    <View style={{ flex: 1 }}>
                      <View style={ls.rowCenter}>
                        {displayInfo && <Text style={{ marginRight: spacing['2'] }}>{displayInfo.flag}</Text>}
                        <Text style={ls.white}>{lang.label}</Text>
                      </View>
                      <Text style={ls.hint}>{displayInfo ? displayInfo.culturalNote : lang.description}</Text>
                    </View>
                    {selectedLanguage === lang.code && (
                      <View style={ls.checkCircle}><Check size={14} color="#FFFFFF" /></View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* Example Responses */}
          {culturalToneEnabled && (
            <Animated.View entering={FadeInDown.delay(350).duration(400)} style={{ marginBottom: spacing['8'] }}>
              <Text style={ls.sectionLabel}>How Responses Adapt</Text>
              <View style={ls.card}>
                <View style={[ls.rowCenter, { marginBottom: spacing['3'] }]}>
                  <MessageCircle size={16} color={colors.text.disabled} />
                  <Text style={{ color: colors.text.muted, fontSize: 14, marginLeft: spacing['2'] }}>Same question, different cultures:</Text>
                </View>
                {[
                  { label: 'English (Direct)', color: colors.accent.DEFAULT, text: '"The WiFi password is \'welcome2024\'. Let me know if you need anything!"' },
                  { label: 'German (Formal)', color: '#A855F7', text: '"Das WLAN-Passwort lautet \'welcome2024\'. Bei Fragen stehe ich Ihnen gerne zur Verfügung."' },
                  { label: 'Spanish (Warm)', color: '#F97316', text: '"La contraseña WiFi es \'welcome2024\'. No dudes en escribirme si necesitas algo!"' },
                  { label: 'Japanese (Highly Formal)', color: '#EC4899', text: '"WiFiのパスワードは「welcome2024」でございます。何かございましたらお気軽にお申し付けください。"' },
                ].map((ex, i, arr) => (
                  <View key={i} style={[{ marginBottom: spacing['3'], paddingBottom: spacing['3'] }, i < arr.length - 1 && ls.borderBottom]}>
                    <Text style={{ color: ex.color, fontSize: 12, fontFamily: typography.fontFamily.medium, marginBottom: 4 }}>{ex.label}</Text>
                    <Text style={{ color: colors.text.secondary, fontSize: 14 }}>{ex.text}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const ls = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: { paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  title: { fontSize: 20, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
  scroll: { flex: 1, paddingHorizontal: spacing['4'] },
  card: { backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing['4'] },
  listCard: { backgroundColor: colors.bg.card, borderRadius: radius.xl, overflow: 'hidden' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  white: { color: colors.text.primary, fontFamily: typography.fontFamily.medium },
  hint: { color: colors.text.disabled, fontSize: 14, marginTop: 2 },
  sectionGap: { marginBottom: spacing['4'] },
  sectionLabel: { color: colors.text.disabled, fontSize: 12, fontFamily: typography.fontFamily.semibold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing['2'], marginLeft: 4 },
  langRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing['4'], paddingVertical: spacing['4'] },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  checkCircle: { width: 24, height: 24, borderRadius: radius.full, backgroundColor: '#A855F7', alignItems: 'center', justifyContent: 'center' },
  expandedPanel: { marginTop: spacing['4'], paddingTop: spacing['4'], borderTopWidth: 1, borderTopColor: colors.border.subtle },
  meterLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  meterText: { color: colors.text.muted, fontSize: 12 },
  meterValue: { color: colors.text.disabled, fontSize: 12 },
  meterTrack: { height: 8, backgroundColor: colors.bg.hover, borderRadius: radius.full, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: radius.full },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['2'] },
  tag: { backgroundColor: colors.bg.hover, paddingHorizontal: spacing['2'], paddingVertical: 4, borderRadius: radius.sm },
  tagText: { color: colors.text.secondary, fontSize: 12 },
  greetingBox: { backgroundColor: colors.bg.elevated + '4D', borderRadius: radius.md, padding: spacing['3'] },
  greetingText: { color: colors.text.secondary, fontSize: 14 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  noteDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#A855F7', marginTop: 5, marginRight: spacing['2'] },
  modeBtn: { flex: 1, paddingVertical: spacing['2'], paddingHorizontal: spacing['3'], borderRadius: radius.md, backgroundColor: colors.bg.hover, alignItems: 'center' },
  modeBtnActive: { backgroundColor: colors.accent.DEFAULT + '20' },
  modeBtnText: { color: colors.text.disabled, fontSize: 14, fontFamily: typography.fontFamily.medium },
  modeBtnTextActive: { color: colors.accent.DEFAULT },
});
