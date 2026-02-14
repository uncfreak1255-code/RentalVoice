import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { Gauge, ShieldCheck, ShieldAlert, AlertTriangle, Info } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';
import {
  getConfidenceMeterConfig,
  getConfidenceGradient,
  getConfidenceDescription,
  type ConfidenceMeterConfig,
} from '@/lib/autopilot-service';
import type { ConfidenceScore } from '@/lib/ai-enhanced';

interface ConfidenceMeterProps {
  confidence: number;
  confidenceDetails?: ConfidenceScore;
  showLabel?: boolean;
  showDescription?: boolean;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
  animated?: boolean;
  pilotMode?: 'copilot' | 'autopilot';
  threshold?: number;
}

// Size-based style configs using design tokens
const SIZE_STYLES = {
  small: {
    paddingH: spacing['2'],
    paddingV: spacing['1'],
    barHeight: 6,
    fontSize: 12,
    icon: 12,
    badgePH: spacing['1.5'],
    badgePV: 2,
  },
  medium: {
    paddingH: spacing['3'],
    paddingV: spacing['2'],
    barHeight: 8,
    fontSize: 14,
    icon: 14,
    badgePH: spacing['2'],
    badgePV: spacing['1'],
  },
  large: {
    paddingH: spacing['4'],
    paddingV: spacing['3'],
    barHeight: 12,
    fontSize: 16,
    icon: 18,
    badgePH: spacing['3'],
    badgePV: spacing['1.5'],
  },
} as const;

export function ConfidenceMeter({
  confidence,
  confidenceDetails,
  showLabel = true,
  showDescription = false,
  size = 'medium',
  onPress,
  animated = true,
  pilotMode = 'copilot',
  threshold = 90,
}: ConfidenceMeterProps) {
  const config = getConfidenceMeterConfig(confidence);
  const [gradientStart, gradientEnd] = getConfidenceGradient(confidence);
  const meetsThreshold = confidence >= threshold;

  // Animation values
  const animatedProgress = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (animated) {
      animatedProgress.value = withTiming(confidence / 100, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      });

      // Pulse animation for high confidence
      if (confidence >= 90) {
        pulseScale.value = withSpring(1.05, { damping: 10 }, () => {
          pulseScale.value = withSpring(1);
        });
      }
    } else {
      animatedProgress.value = confidence / 100;
    }
  }, [confidence, animated]);

  const animatedBarStyle = useAnimatedStyle(() => ({
    width: `${animatedProgress.value * 100}%`,
  }));

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const s = SIZE_STYLES[size];

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <Pressable
      onPress={onPress ? handlePress : undefined}
      disabled={!onPress}
      style={({ pressed }) => ({ opacity: pressed && onPress ? 0.8 : 1 })}
    >
      <Animated.View
        style={[
          animatedContainerStyle,
          cm.container,
          { paddingHorizontal: s.paddingH, paddingVertical: s.paddingV },
        ]}
      >
        {/* Header with confidence badge */}
        <View style={cm.headerRow}>
          <View style={cm.rowCenter}>
            <Gauge size={s.icon} color={config.color} />
            {showLabel && (
              <Text
                style={[cm.labelText, { fontSize: s.fontSize, color: config.color }]}
              >
                {config.label}
              </Text>
            )}
          </View>

          {/* Confidence percentage badge */}
          <View
            style={[cm.badge, {
              paddingHorizontal: s.badgePH,
              paddingVertical: s.badgePV,
              backgroundColor: `${config.color}20`,
            }]}
          >
            <Text
              style={[cm.badgeText, { fontSize: s.fontSize, color: config.color }]}
            >
              {confidence}%
            </Text>
          </View>
        </View>

        {/* Animated progress bar */}
        <View style={[cm.barTrack, { height: s.barHeight }]}>
          <Animated.View style={[{ height: '100%' }, animatedBarStyle]}>
            <LinearGradient
              colors={[gradientStart, gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1, borderRadius: 999 }}
            />
          </Animated.View>
        </View>

        {/* AutoPilot threshold indicator */}
        {pilotMode === 'autopilot' && (
          <View style={cm.thresholdRow}>
            {meetsThreshold ? (
              <>
                <ShieldCheck size={12} color={colors.success.DEFAULT} />
                <Text style={[cm.thresholdText, { color: colors.success.light }]}>
                  Meets {threshold}% threshold - can auto-send
                </Text>
              </>
            ) : (
              <>
                <ShieldAlert size={12} color="#F59E0B" />
                <Text style={[cm.thresholdText, { color: '#FBBF24' }]}>
                  Below {threshold}% threshold - needs review
                </Text>
              </>
            )}
          </View>
        )}

        {/* Description */}
        {showDescription && (
          <Text style={cm.description}>
            {getConfidenceDescription(confidence)}
          </Text>
        )}

        {/* Warnings */}
        {confidenceDetails?.warnings && confidenceDetails.warnings.length > 0 && (
          <View style={{ marginTop: spacing['2'] }}>
            {confidenceDetails.warnings.slice(0, 2).map((warning, idx) => (
              <View key={idx} style={cm.warningRow}>
                <AlertTriangle size={10} color="#F59E0B" />
                <Text style={cm.warningText}>{warning}</Text>
              </View>
            ))}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

// Compact inline confidence indicator
interface ConfidenceIndicatorProps {
  confidence: number;
  onPress?: () => void;
}

export function ConfidenceIndicator({ confidence, onPress }: ConfidenceIndicatorProps) {
  const config = getConfidenceMeterConfig(confidence);

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={[cm.indicatorPill, { backgroundColor: `${config.color}20` }]}
    >
      <Gauge size={12} color={config.color} />
      <Text style={[cm.indicatorText, { color: config.color }]}>
        {confidence}%
      </Text>
    </Pressable>
  );
}

// Detailed confidence breakdown panel
interface ConfidenceBreakdownProps {
  confidenceDetails: ConfidenceScore;
  pilotMode: 'copilot' | 'autopilot';
  threshold: number;
}

export function ConfidenceBreakdown({
  confidenceDetails,
  pilotMode,
  threshold,
}: ConfidenceBreakdownProps) {
  const factorLabels: Record<string, string> = {
    sentimentMatch: 'Sentiment Match',
    knowledgeAvailable: 'Knowledge Available',
    topicCoverage: 'Topic Coverage',
    styleMatch: 'Style Match',
    safetyCheck: 'Safety Check',
  };

  return (
    <View style={cm.breakdownPanel}>
      <View style={cm.breakdownHeader}>
        <Info size={16} color={colors.text.muted} />
        <Text style={cm.breakdownTitle}>Confidence Breakdown</Text>
      </View>

      {Object.entries(confidenceDetails.factors).map(([key, value]) => {
        const config = getConfidenceMeterConfig(value);
        return (
          <View key={key} style={{ marginBottom: spacing['2'] }}>
            <View style={cm.factorRow}>
              <Text style={cm.factorLabel}>
                {factorLabels[key] || key}
              </Text>
              <Text style={[cm.factorValue, { color: config.color }]}>
                {value}%
              </Text>
            </View>
            <View style={cm.factorTrack}>
              <View
                style={[cm.factorFill, {
                  width: `${value}%`,
                  backgroundColor: config.color,
                }]}
              />
            </View>
          </View>
        );
      })}

      {/* Overall score */}
      <View style={cm.overallSection}>
        <View style={cm.overallRow}>
          <Text style={cm.overallLabel}>Overall Score</Text>
          <View style={cm.rowCenter}>
            <Text
              style={[cm.overallScore, {
                color: getConfidenceMeterConfig(confidenceDetails.overall).color,
              }]}
            >
              {confidenceDetails.overall}%
            </Text>
            {pilotMode === 'autopilot' && (
              confidenceDetails.overall >= threshold ? (
                <ShieldCheck size={18} color={colors.success.DEFAULT} />
              ) : (
                <ShieldAlert size={18} color="#F59E0B" />
              )
            )}
          </View>
        </View>
      </View>

      {/* Blocked status */}
      {confidenceDetails.blockedForAutoSend && (
        <View style={cm.blockedBanner}>
          <View style={cm.rowCenter}>
            <AlertTriangle size={16} color={colors.danger.DEFAULT} />
            <Text style={cm.blockedTitle}>Auto-Send Blocked</Text>
          </View>
          {confidenceDetails.blockReason && (
            <Text style={cm.blockedReason}>
              {confidenceDetails.blockReason}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// Mode indicator badge
interface PilotModeBadgeProps {
  mode: 'copilot' | 'autopilot';
  isActive?: boolean;
  size?: 'small' | 'medium';
}

export function PilotModeBadge({ mode, isActive = true, size = 'medium' }: PilotModeBadgeProps) {
  const isCoPilot = mode === 'copilot';
  const isSmall = size === 'small';

  const badgeBg = isCoPilot
    ? isActive ? '#A855F720' : colors.bg.hover
    : isActive ? colors.primary.muted : colors.bg.hover;

  const iconColor = isCoPilot
    ? isActive ? '#A855F7' : colors.text.disabled
    : isActive ? colors.primary.DEFAULT : colors.text.disabled;

  const textColor = isCoPilot
    ? isActive ? '#A855F7' : colors.text.disabled
    : isActive ? colors.primary.light : colors.text.disabled;

  return (
    <View
      style={[cm.modeBadge, {
        backgroundColor: badgeBg,
        paddingHorizontal: isSmall ? spacing['2'] : spacing['3'],
        paddingVertical: isSmall ? 2 : spacing['1'],
      }]}
    >
      {isCoPilot ? (
        <ShieldAlert size={isSmall ? 12 : 14} color={iconColor} />
      ) : (
        <ShieldCheck size={isSmall ? 12 : 14} color={iconColor} />
      )}
      <Text
        style={[cm.modeBadgeText, {
          color: textColor,
          fontSize: isSmall ? 12 : 14,
        }]}
      >
        {isCoPilot ? 'CoPilot' : 'AutoPilot'}
      </Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const cm = StyleSheet.create({
  container: {
    borderRadius: radius.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing['1.5'],
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelText: {
    fontFamily: typography.fontFamily.medium,
    marginLeft: spacing['1.5'],
  },
  badge: {
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeText: {
    fontFamily: typography.fontFamily.bold,
  },
  barTrack: {
    backgroundColor: colors.bg.hover,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing['1.5'],
  },
  thresholdText: {
    fontSize: 12,
    marginLeft: spacing['1'],
  },
  description: {
    color: colors.text.muted,
    fontSize: 12,
    marginTop: spacing['1'],
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing['1'],
  },
  warningText: {
    color: '#FBBF24',
    fontSize: 12,
    marginLeft: spacing['1'],
  },
  indicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing['2'],
    paddingVertical: spacing['1'],
    borderRadius: radius.full,
  },
  indicatorText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    marginLeft: spacing['1'],
  },
  breakdownPanel: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    padding: spacing['4'],
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing['3'],
  },
  breakdownTitle: {
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.medium,
    marginLeft: spacing['2'],
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing['1'],
  },
  factorLabel: {
    color: colors.text.muted,
    fontSize: 14,
  },
  factorValue: {
    fontSize: 14,
    fontFamily: typography.fontFamily.medium,
  },
  factorTrack: {
    height: 6,
    backgroundColor: colors.bg.hover,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  factorFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  overallSection: {
    marginTop: spacing['3'],
    paddingTop: spacing['3'],
    borderTopWidth: 1,
    borderTopColor: colors.bg.hover,
  },
  overallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overallLabel: {
    color: colors.text.primary,
    fontFamily: typography.fontFamily.medium,
  },
  overallScore: {
    fontSize: 18,
    fontFamily: typography.fontFamily.bold,
    marginRight: spacing['2'],
  },
  blockedBanner: {
    marginTop: spacing['3'],
    backgroundColor: colors.danger.muted,
    borderRadius: radius.lg,
    padding: spacing['3'],
  },
  blockedTitle: {
    color: colors.danger.light,
    fontFamily: typography.fontFamily.medium,
    marginLeft: spacing['2'],
  },
  blockedReason: {
    color: `${colors.danger.light}CC`,
    fontSize: 14,
    marginTop: spacing['1'],
  },
  modeBadge: {
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeBadgeText: {
    fontFamily: typography.fontFamily.medium,
    marginLeft: spacing['1'],
  },
});
