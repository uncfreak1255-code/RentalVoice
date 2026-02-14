import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInUp } from 'react-native-reanimated';
import { Shield, AlertTriangle, Eye, EyeOff, ChevronDown, ChevronUp, Lock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';
import {
  type ScanResult,
  getDataTypeLabel,
  getSeverityColor,
  getSeverityBgColor,
} from '@/lib/privacy-scanner';

interface PrivacyAlertBannerProps {
  scanResult: ScanResult;
  onAnonymize: () => void;
  onDismiss: () => void;
  compact?: boolean;
}

export function PrivacyAlertBanner({
  scanResult,
  onAnonymize,
  onDismiss,
  compact = false,
}: PrivacyAlertBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!scanResult.hasIssues) return null;

  const criticalCount = scanResult.matches.filter(m => m.severity === 'critical').length;
  const highCount = scanResult.matches.filter(m => m.severity === 'high').length;
  const hasHighRisk = criticalCount > 0 || highCount > 0;

  // Get the most severe issue for the header
  const topIssue = scanResult.matches.reduce((prev, curr) => {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return severityOrder[curr.severity] > severityOrder[prev.severity] ? curr : prev;
  }, scanResult.matches[0]);

  const getBannerColors = () => {
    if (criticalCount > 0) return { bg: `${colors.danger.DEFAULT}22`, border: `${colors.danger.DEFAULT}66`, text: colors.danger.light };
    if (highCount > 0) return { bg: `${colors.accent.DEFAULT}22`, border: `${colors.accent.DEFAULT}66`, text: colors.accent.light };
    return { bg: '#F59E0B22', border: '#F59E0B66', text: '#FBBF24' };
  };

  const bannerColors = getBannerColors();

  if (compact) {
    return (
      <Animated.View
        entering={SlideInUp.duration(200)}
        exiting={FadeOut.duration(150)}
        style={[pa.compactRoot, {
          backgroundColor: bannerColors.bg,
          borderColor: bannerColors.border,
        }]}
      >
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setIsExpanded(!isExpanded);
          }}
          style={pa.rowCenter}
        >
          <Shield size={14} color={getSeverityColor(topIssue.severity)} />
          <Text style={[pa.compactTitle, { color: bannerColors.text }]}>
            {scanResult.totalMatches} sensitive item{scanResult.totalMatches > 1 ? 's' : ''} detected
          </Text>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onAnonymize();
            }}
            style={pa.compactAnonBtn}
          >
            <Text style={pa.compactAnonText}>Anonymize</Text>
          </Pressable>
          {isExpanded ? (
            <ChevronUp size={16} color={colors.text.disabled} />
          ) : (
            <ChevronDown size={16} color={colors.text.disabled} />
          )}
        </Pressable>

        {isExpanded && (
          <Animated.View entering={FadeIn.duration(150)} style={pa.compactExpanded}>
            {scanResult.matches.slice(0, 3).map((match, idx) => (
              <View key={idx} style={pa.compactMatchRow}>
                <View
                  style={[pa.severityDot, { backgroundColor: getSeverityColor(match.severity) }]}
                />
                <Text style={pa.matchLabel}>
                  {getDataTypeLabel(match.type)}
                </Text>
                <Text style={pa.matchSuggestion}>
                  → {match.suggestion.slice(0, 15)}{match.suggestion.length > 15 ? '...' : ''}
                </Text>
              </View>
            ))}
            {scanResult.matches.length > 3 && (
              <Text style={pa.moreText}>
                +{scanResult.matches.length - 3} more
              </Text>
            )}
          </Animated.View>
        )}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={SlideInUp.duration(250)}
      exiting={FadeOut.duration(150)}
      style={[pa.fullRoot, {
        backgroundColor: bannerColors.bg,
        borderColor: bannerColors.border,
      }]}
    >
      {/* Header */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setIsExpanded(!isExpanded);
        }}
        style={pa.headerRow}
      >
        <View style={[pa.headerIcon, { backgroundColor: getSeverityBgColor(topIssue.severity) }]}>
          {hasHighRisk ? (
            <AlertTriangle size={18} color={getSeverityColor(topIssue.severity)} />
          ) : (
            <Shield size={18} color={getSeverityColor(topIssue.severity)} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[pa.headerTitle, { color: bannerColors.text }]}>
            {hasHighRisk ? 'Sensitive Data Warning' : 'Privacy Notice'}
          </Text>
          <Text style={pa.headerSubtitle}>
            {scanResult.totalMatches} item{scanResult.totalMatches > 1 ? 's' : ''} • Risk: {scanResult.riskScore}%
          </Text>
        </View>
        {isExpanded ? (
          <ChevronUp size={20} color={colors.text.disabled} />
        ) : (
          <ChevronDown size={20} color={colors.text.disabled} />
        )}
      </Pressable>

      {/* Expanded Details */}
      {isExpanded && (
        <Animated.View entering={FadeIn.duration(200)} style={pa.expandedContent}>
          {/* Issues List */}
          <View style={pa.issuesPanel}>
            <Text style={pa.sectionLabel}>
              Detected Items
            </Text>
            {scanResult.matches.map((match, idx) => (
              <View
                key={idx}
                style={[
                  pa.issueRow,
                  idx < scanResult.matches.length - 1 && pa.issueRowBorder,
                ]}
              >
                <View
                  style={[pa.issueIcon, { backgroundColor: getSeverityBgColor(match.severity) }]}
                >
                  {match.severity === 'critical' || match.severity === 'high' ? (
                    <AlertTriangle size={12} color={getSeverityColor(match.severity)} />
                  ) : (
                    <Eye size={12} color={getSeverityColor(match.severity)} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={pa.issueTypeLabel}>
                    {getDataTypeLabel(match.type)}
                  </Text>
                  <View style={[pa.rowCenter, { marginTop: 2 }]}>
                    <Text style={pa.issueFoundLabel}>Found: </Text>
                    <Text style={pa.issueValue}>
                      {match.value.length > 20 ? `${match.value.slice(0, 20)}...` : match.value}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={[pa.severityLabel, { color: getSeverityColor(match.severity) }]}
                  >
                    {match.severity}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Recommendations */}
          {scanResult.recommendations.length > 0 && (
            <View style={{ marginBottom: spacing['3'] }}>
              <Text style={pa.sectionLabel}>
                Recommendations
              </Text>
              {scanResult.recommendations.slice(0, 2).map((rec, idx) => (
                <View key={idx} style={pa.recRow}>
                  <Text style={pa.recBullet}>•</Text>
                  <Text style={pa.recText}>{rec}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <View style={pa.rowCenter}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onAnonymize();
              }}
              style={({ pressed }) => [pa.anonBtn, { opacity: pressed ? 0.8 : 1 }]}
            >
              <Lock size={16} color="#FFFFFF" />
              <Text style={pa.anonBtnText}>Auto-Anonymize</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onDismiss();
              }}
              style={({ pressed }) => [pa.dismissBtn, { opacity: pressed ? 0.8 : 1 }]}
            >
              <EyeOff size={16} color={colors.text.muted} />
              <Text style={pa.dismissBtnText}>Dismiss</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// Simple inline indicator for use in text inputs
interface PrivacyIndicatorProps {
  riskScore: number;
  issueCount: number;
  onPress?: () => void;
}

export function PrivacyIndicator({ riskScore, issueCount, onPress }: PrivacyIndicatorProps) {
  if (issueCount === 0) return null;

  const getColor = () => {
    if (riskScore >= 70) return colors.danger.DEFAULT;
    if (riskScore >= 40) return '#F59E0B';
    return '#3B82F6';
  };

  const color = getColor();

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={[pa.indicatorPill, { backgroundColor: `${color}20` }]}
    >
      <Shield size={12} color={color} />
      <Text style={[pa.indicatorText, { color }]}>
        {issueCount}
      </Text>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const pa = StyleSheet.create({
  compactRoot: {
    marginHorizontal: spacing['4'],
    marginBottom: spacing['2'],
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['2'],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  fullRoot: {
    marginHorizontal: spacing['4'],
    marginBottom: spacing['3'],
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactTitle: {
    fontSize: 14,
    fontFamily: typography.fontFamily.medium,
    marginLeft: spacing['1.5'],
    flex: 1,
  },
  compactAnonBtn: {
    backgroundColor: `${colors.bg.hover}80`,
    paddingHorizontal: spacing['2.5'],
    paddingVertical: spacing['1'],
    borderRadius: radius.full,
    marginRight: spacing['2'],
  },
  compactAnonText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
  },
  compactExpanded: {
    marginTop: spacing['2'],
    paddingTop: spacing['2'],
    borderTopWidth: 1,
    borderTopColor: `${colors.bg.hover}80`,
  },
  compactMatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing['1'],
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    marginRight: spacing['2'],
  },
  matchLabel: {
    color: colors.text.muted,
    fontSize: 12,
    flex: 1,
  },
  matchSuggestion: {
    color: colors.text.disabled,
    fontSize: 12,
  },
  moreText: {
    color: colors.text.disabled,
    fontSize: 12,
    marginTop: spacing['1'],
  },
  headerRow: {
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing['3'],
  },
  headerTitle: {
    fontFamily: typography.fontFamily.semibold,
  },
  headerSubtitle: {
    color: colors.text.muted,
    fontSize: 14,
  },
  expandedContent: {
    paddingHorizontal: spacing['4'],
    paddingBottom: spacing['4'],
  },
  issuesPanel: {
    backgroundColor: `${colors.bg.card}80`,
    borderRadius: radius.lg,
    padding: spacing['3'],
    marginBottom: spacing['3'],
  },
  sectionLabel: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: typography.fontFamily.semibold,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: spacing['2'],
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing['2'],
  },
  issueRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: `${colors.bg.hover}80`,
  },
  issueIcon: {
    width: 24,
    height: 24,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing['2'],
  },
  issueTypeLabel: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: typography.fontFamily.medium,
  },
  issueFoundLabel: {
    color: colors.text.disabled,
    fontSize: 12,
  },
  issueValue: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
  },
  severityLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    textTransform: 'capitalize' as const,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing['1'],
  },
  recBullet: {
    color: colors.text.disabled,
    fontSize: 14,
  },
  recText: {
    color: colors.text.secondary,
    fontSize: 14,
    marginLeft: spacing['2'],
    flex: 1,
  },
  anonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.DEFAULT,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['2.5'],
    borderRadius: radius.lg,
    marginRight: spacing['2'],
  },
  anonBtnText: {
    color: '#FFFFFF',
    fontFamily: typography.fontFamily.semibold,
    marginLeft: spacing['1.5'],
  },
  dismissBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.hover,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['2.5'],
    borderRadius: radius.lg,
  },
  dismissBtnText: {
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.medium,
    marginLeft: spacing['1.5'],
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
    fontFamily: typography.fontFamily.medium,
    marginLeft: spacing['1'],
  },
});
