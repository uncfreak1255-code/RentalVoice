import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, TrendingUp } from 'lucide-react-native';
import { useAppStore } from '@/lib/store';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';
import { useThemeColors } from '@/lib/useThemeColors';
import { AccuracyDial } from '@/components/ui/AccuracyDial';

// TODO(voice-profile): these three consts are placeholder seed data. The store
// doesn't yet expose voice-profile phrases/boundaries/traits — they need to be
// wired to real learning output before this screen goes past "mirror preview".
// Until then, values shown are illustrative, not user data.
const DEFAULT_GO_TO_PHRASES = [
  'Hope this helps!',
  'Looking forward to having you',
  'Let me know if…',
  'Feel free to',
  'Happy to help',
  'Enjoy your stay',
];

const DEFAULT_BOUNDARIES = [
  { label: 'Refund or credit offers', on: true },
  { label: 'Legal or liability language', on: true },
  { label: 'Bookings beyond 6 months out', on: false },
  { label: 'Requests for discounts > 15%', on: true },
];

interface Trait {
  left: string;
  right: string;
  value: number;
}

const DEFAULT_TRAITS: Trait[] = [
  { left: 'Formal', right: 'Casual', value: 72 },
  { left: 'Brief', right: 'Detailed', value: 58 },
  { left: 'Reserved', right: 'Warm', value: 88 },
  { left: 'Rarely emoji', right: 'Emoji-friendly', value: 45 },
];

export function VoiceProfileScreen() {
  const t = useThemeColors();
  const learningProgress = useAppStore((s) => s.aiLearningProgress);
  const autopilotThreshold = useAppStore((s) => s.settings.autoPilotConfidenceThreshold) || 80;

  const accuracy = Math.max(0, Math.min(100, Math.round(learningProgress.accuracyScore || 0)));
  const samples = learningProgress.totalMessagesAnalyzed || 0;
  const editsThisWeek = learningProgress.realTimeEditsCount || 0;

  const weeklyDelta = useMemo(() => {
    // Placeholder — the app doesn't yet track a historical accuracy series.
    // Once replay-history is wired, swap in: accuracy - accuracyLastWeek.
    if (accuracy === 0) return null;
    return 7;
  }, [accuracy]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg.base }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: t.bg.card, borderBottomColor: t.border.subtle }]}>
          <Text style={[styles.title, { color: t.text.primary }]} accessibilityRole="header">
            Your voice
          </Text>
          <Text style={[styles.subtitle, { color: t.text.muted }]}>
            How the AI sees your hosting style
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing['4'], paddingBottom: spacing['12'] }}>
          {/* Accuracy dial + delta */}
          <View style={[styles.accuracyCard, { backgroundColor: t.bg.card, borderColor: t.border.subtle }]}>
            <AccuracyDial value={accuracy || 0} />
            <View style={{ flex: 1, marginLeft: 18 }}>
              <Text style={[styles.accuracyNumber, { color: t.text.primary }]}>
                {accuracy}% accurate
              </Text>
              {weeklyDelta !== null ? (
                <View style={styles.deltaPill}>
                  <TrendingUp size={11} color={colors.success.DEFAULT} />
                  <Text style={styles.deltaText}>+{weeklyDelta}% this week</Text>
                </View>
              ) : null}
              <Text style={[styles.accuracyCopy, { color: t.text.muted }]}>
                AutoPilot unlocks at {autopilotThreshold}%. Every edit you make teaches the AI.
              </Text>
            </View>
          </View>

          {/* Tone traits */}
          <SectionCard
            t={t}
            title="Your tone"
            subtitle={samples ? `Reflected from ${samples} real messages` : 'Send more drafts so we can reflect your tone'}
          >
            <View style={{ gap: 12 }}>
              {DEFAULT_TRAITS.map((trait) => (
                <Trait key={`${trait.left}-${trait.right}`} t={t} trait={trait} />
              ))}
            </View>
          </SectionCard>

          {/* Go-to phrases */}
          <SectionCard
            t={t}
            title="Go-to phrases"
            subtitle="The AI will weave these in when natural"
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {DEFAULT_GO_TO_PHRASES.map((phrase) => (
                <View key={phrase} style={styles.phraseChip}>
                  <Text style={styles.phraseText}>{phrase}</Text>
                </View>
              ))}
              <Pressable style={[styles.phraseChip, styles.phraseAddChip]} accessibilityRole="button" accessibilityLabel="Add go-to phrase">
                <Plus size={12} color={t.text.muted} />
                <Text style={[styles.phraseText, { color: t.text.muted, marginLeft: 4 }]}>Add</Text>
              </Pressable>
            </View>
          </SectionCard>

          {/* Boundaries */}
          <SectionCard
            t={t}
            title="Boundaries"
            subtitle="Never auto-send if message contains…"
          >
            {DEFAULT_BOUNDARIES.map((b) => (
              <BoundaryRow key={b.label} t={t} label={b.label} initialOn={b.on} />
            ))}
          </SectionCard>

          {/* Recent edits */}
          <SectionCard
            t={t}
            title="What you taught me this week"
            subtitle={editsThisWeek > 0 ? `${editsThisWeek} pattern${editsThisWeek === 1 ? '' : 's'} picked up from edits` : 'No edits this week yet'}
          >
            {/* TODO(voice-profile): these three EditRow entries are placeholder
                before/after copy. Wire to real host edits from the learning
                pipeline before showing this as truth. */}
            <EditRow
              t={t}
              before="I can help with that."
              after="Happy to help with that!"
              note="Warmer opener"
            />
            <EditRow
              t={t}
              before="The check-in time is 4 PM."
              after="Check-in is 4 PM on the dot 🔑"
              note="Added emoji + rhythm"
            />
            <EditRow
              t={t}
              before="Please let me know."
              after="Let me know if you need anything else!"
              note="More inviting close"
            />
          </SectionCard>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ── Section card ────────────────────────────────────────────
interface SectionCardProps {
  t: ReturnType<typeof useThemeColors>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

function SectionCard({ t, title, subtitle, children }: SectionCardProps) {
  return (
    <View style={[styles.section, { backgroundColor: t.bg.card, borderColor: t.border.subtle }]}>
      <View style={{ marginBottom: 12 }}>
        <Text style={[styles.sectionTitle, { color: t.text.primary }]}>{title}</Text>
        {subtitle ? <Text style={[styles.sectionSubtitle, { color: t.text.muted }]}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

// ── Trait slider (read-only visual) ─────────────────────────
function Trait({ t, trait }: { t: ReturnType<typeof useThemeColors>; trait: Trait }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={[styles.traitLabel, { color: t.text.muted }]}>{trait.left}</Text>
        <Text style={[styles.traitLabel, { color: t.text.muted }]}>{trait.right}</Text>
      </View>
      <View style={[styles.traitTrack, { backgroundColor: t.bg.subtle }]}>
        <View
          style={{
            position: 'absolute',
            left: `${trait.value}%`,
            top: '50%',
            marginLeft: -7,
            marginTop: -7,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: colors.primary.DEFAULT,
            borderWidth: 3,
            borderColor: t.bg.card,
            shadowColor: colors.border.DEFAULT,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 1,
          }}
        />
      </View>
    </View>
  );
}

// ── Boundary toggle row ─────────────────────────────────────
function BoundaryRow({
  t,
  label,
  initialOn,
}: {
  t: ReturnType<typeof useThemeColors>;
  label: string;
  initialOn: boolean;
}) {
  const [on, setOn] = React.useState(initialOn);
  return (
    <Pressable
      onPress={() => setOn(!on)}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${label} boundary, ${on ? 'enabled' : 'disabled'}`}
      style={[styles.boundaryRow, { borderTopColor: t.border.subtle }]}
    >
      <Text style={[styles.boundaryLabel, { color: t.text.primary }]}>{label}</Text>
      <View
        style={[
          styles.toggleTrack,
          { backgroundColor: on ? colors.primary.DEFAULT : t.border.DEFAULT },
        ]}
      >
        <View
          style={[
            styles.toggleKnob,
            { left: on ? 18 : 2 },
          ]}
        />
      </View>
    </Pressable>
  );
}

// ── Edit diff row ──────────────────────────────────────────
function EditRow({
  t,
  before,
  after,
  note,
}: {
  t: ReturnType<typeof useThemeColors>;
  before: string;
  after: string;
  note: string;
}) {
  return (
    <View style={[styles.editRow, { borderTopColor: t.border.subtle }]}>
      <Text style={styles.editNote}>{note.toUpperCase()}</Text>
      <Text style={[styles.editBefore, { color: t.text.disabled }]}>{before}</Text>
      <Text style={[styles.editAfter, { color: t.text.primary }]}>→ {after}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing['5'],
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 22,
    fontFamily: typography.fontFamily.bold,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12.5,
    marginTop: 1,
  },
  accuracyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: 12,
  },
  accuracyNumber: {
    fontSize: 20,
    fontFamily: typography.fontFamily.bold,
    letterSpacing: -0.4,
  },
  deltaPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.success.soft,
    marginTop: 4,
  },
  deltaText: {
    fontSize: 11.5,
    fontFamily: typography.fontFamily.bold,
    color: colors.success.DEFAULT,
  },
  accuracyCopy: {
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  section: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing['4'],
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14.5,
    fontFamily: typography.fontFamily.bold,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  traitLabel: {
    fontSize: 11.5,
  },
  traitTrack: {
    position: 'relative',
    height: 6,
    borderRadius: 999,
  },
  phraseChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primary.soft,
    flexDirection: 'row',
    alignItems: 'center',
  },
  phraseAddChip: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.DEFAULT,
  },
  phraseText: {
    fontSize: 12.5,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary.DEFAULT,
    letterSpacing: -0.1,
  },
  boundaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  boundaryLabel: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    letterSpacing: -0.1,
  },
  toggleTrack: {
    width: 40,
    height: 24,
    borderRadius: 999,
    position: 'relative',
  },
  toggleKnob: {
    position: 'absolute',
    top: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  editRow: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  editNote: {
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
    color: colors.ai.DEFAULT,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  editBefore: {
    fontSize: 12.5,
    marginBottom: 3,
    lineHeight: 18,
    textDecorationLine: 'line-through',
  },
  editAfter: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
});
