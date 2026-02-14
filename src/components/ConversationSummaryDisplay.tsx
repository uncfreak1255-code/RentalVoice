import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,

  useAnimatedStyle,
  useSharedValue,

  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Clock,
  HelpCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';
import type { Conversation } from '@/lib/store';
import {
  generateConversationSummary,
  needsSummary,
  getStatusColor,
  getStatusLabel,
  getInboxPreviewSummary,
  MIN_MESSAGES_FOR_SUMMARY,
  type ConversationSummary,
} from '@/lib/conversation-summary';

interface ConversationSummaryDisplayProps {
  conversation: Conversation;
  variant?: 'full' | 'compact' | 'badge';
  onRefresh?: () => void;
  style?: ViewStyle;
}

export function ConversationSummaryDisplay({
  conversation,
  variant = 'full',
  onRefresh,
  style,
}: ConversationSummaryDisplayProps) {
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const realMessageCount = conversation.messages.filter(m => m.sender !== 'ai_draft').length;
  const showSummary = realMessageCount >= MIN_MESSAGES_FOR_SUMMARY;

  // Animation for loading
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (isLoading) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1000 }),
        -1,
        false
      );
    } else {
      rotation.value = 0;
    }
  }, [isLoading]);

  const loadingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Generate summary when needed
  useEffect(() => {
    const generateSummaryIfNeeded = async () => {
      if (!showSummary) return;

      // Check if we need a new summary
      if (needsSummary(conversation, summary || undefined)) {
        setIsLoading(true);
        setError(null);
        try {
          const newSummary = await generateConversationSummary(conversation, true);
          setSummary(newSummary);
        } catch (err) {
          console.error('[Summary] Generation failed:', err);
          setError('Could not generate summary');
        } finally {
          setIsLoading(false);
        }
      }
    };

    generateSummaryIfNeeded();
  }, [conversation.messages.length, showSummary]);

  const handleRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsLoading(true);
    setError(null);
    try {
      const newSummary = await generateConversationSummary(conversation, true);
      setSummary(newSummary);
      onRefresh?.();
    } catch (err) {
      setError('Could not refresh summary');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded(!isExpanded);
  };

  // Don't show anything if not enough messages
  if (!showSummary) {
    return null;
  }

  // Badge variant - ultra compact for lists
  if (variant === 'badge') {
    return (
      <SummaryBadge
        summary={summary}
        isLoading={isLoading}
        loadingStyle={loadingStyle}
      />
    );
  }

  // Compact variant - for inbox list items
  if (variant === 'compact') {
    return (
      <CompactSummary
        summary={summary}
        isLoading={isLoading}
        loadingStyle={loadingStyle}
        style={style}
      />
    );
  }

  // Full variant - for chat header
  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={[cs.root, style]}
    >
      {/* Header */}
      <Pressable
        onPress={toggleExpanded}
        style={({ pressed }) => [cs.headerRow, { opacity: pressed ? 0.8 : 1 }]}
      >
        <View style={cs.headerIconWrap}>
          <Sparkles size={16} color="#818CF8" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cs.headerLabel}>
            Conversation Summary
          </Text>
          {isLoading ? (
            <View style={cs.rowCenter}>
              <Animated.View style={loadingStyle}>
                <RefreshCw size={12} color={colors.text.disabled} />
              </Animated.View>
              <Text style={[cs.mutedText, { marginLeft: spacing['2'] }]}>Generating...</Text>
            </View>
          ) : summary ? (
            <Text style={cs.summaryText} numberOfLines={isExpanded ? undefined : 1}>
              {summary.summary}
            </Text>
          ) : error ? (
            <Text style={cs.errorText}>{error}</Text>
          ) : (
            <Text style={cs.mutedText}>Analyzing conversation...</Text>
          )}
        </View>
        <View style={cs.rowCenter}>
          {summary && (
            <StatusBadge status={summary.currentStatus} />
          )}
          <View style={cs.chevronWrap}>
            {isExpanded ? (
              <ChevronUp size={14} color={colors.text.muted} />
            ) : (
              <ChevronDown size={14} color={colors.text.muted} />
            )}
          </View>
        </View>
      </Pressable>

      {/* Expanded Content */}
      {isExpanded && summary && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={cs.expandedContent}
        >
          {/* Topics */}
          {summary.topics.length > 0 && (
            <View style={{ marginTop: spacing['3'] }}>
              <Text style={cs.sectionLabel}>Topics Discussed</Text>
              <View style={cs.topicsWrap}>
                {summary.topics.map((topic, idx) => (
                  <View key={idx} style={cs.topicChip}>
                    <Text style={cs.topicText}>{topic}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Key Points */}
          {summary.keyPoints.length > 0 && (
            <View style={{ marginTop: spacing['3'] }}>
              <Text style={cs.sectionLabel}>Key Points</Text>
              {summary.keyPoints.map((point, idx) => (
                <View key={idx} style={cs.pointRow}>
                  <View style={cs.pointDot} />
                  <Text style={cs.pointText}>{point}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Next Action */}
          {summary.nextAction && (
            <View style={cs.nextActionBox}>
              <View style={cs.rowCenter}>
                <AlertCircle size={14} color="#F59E0B" />
                <Text style={cs.nextActionLabel}>Next Action</Text>
              </View>
              <Text style={cs.nextActionText}>{summary.nextAction}</Text>
            </View>
          )}

          {/* Footer */}
          <View style={cs.footer}>
            <Text style={cs.footerCount}>
              {summary.messageCount} messages analyzed
            </Text>
            <Pressable
              onPress={handleRefresh}
              style={({ pressed }) => [cs.rowCenter, { opacity: pressed ? 0.7 : 1 }]}
            >
              {isLoading ? (
                <Animated.View style={loadingStyle}>
                  <RefreshCw size={12} color={colors.text.disabled} />
                </Animated.View>
              ) : (
                <RefreshCw size={12} color={colors.text.disabled} />
              )}
              <Text style={cs.refreshText}>Refresh</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// Compact summary for inbox list
function CompactSummary({
  summary,
  isLoading,
  loadingStyle,
  style,
}: {
  summary: ConversationSummary | null;
  isLoading: boolean;
  loadingStyle: any;
  style?: ViewStyle;
}) {
  if (isLoading) {
    return (
      <View style={[cs.rowCenter, style]}>
        <Animated.View style={loadingStyle}>
          <RefreshCw size={10} color={colors.text.disabled} />
        </Animated.View>
        <Text style={cs.compactLoadingText}>Summarizing...</Text>
      </View>
    );
  }

  if (!summary) {
    return null;
  }

  const previewText = getInboxPreviewSummary(summary);

  return (
    <View style={[cs.rowCenter, style]}>
      <Sparkles size={10} color="#818CF8" />
      <Text style={cs.compactPreview} numberOfLines={1}>
        {previewText}
      </Text>
      <StatusBadge status={summary.currentStatus} size="small" />
    </View>
  );
}

// Badge for ultra-compact display
function SummaryBadge({
  summary,
  isLoading,
  loadingStyle,
}: {
  summary: ConversationSummary | null;
  isLoading: boolean;
  loadingStyle: any;
}) {
  if (isLoading) {
    return (
      <Animated.View
        style={[loadingStyle, cs.badgeLoading]}
      >
        <RefreshCw size={10} color={colors.text.disabled} />
      </Animated.View>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <StatusBadge status={summary.currentStatus} size="small" iconOnly />
  );
}

// Status badge component
function StatusBadge({
  status,
  size = 'normal',
  iconOnly = false,
}: {
  status: ConversationSummary['currentStatus'];
  size?: 'small' | 'normal';
  iconOnly?: boolean;
}) {
  const color = getStatusColor(status);
  const label = getStatusLabel(status);

  const getIcon = () => {
    const iconSize = size === 'small' ? 10 : 12;
    switch (status) {
      case 'inquiry':
        return <HelpCircle size={iconSize} color={color} />;
      case 'negotiating':
        return <Clock size={iconSize} color={color} />;
      case 'resolved':
        return <CheckCircle size={iconSize} color={color} />;
      case 'pending_action':
        return <AlertCircle size={iconSize} color={color} />;
      case 'follow_up':
        return <RefreshCw size={iconSize} color={color} />;
      default:
        return <MessageSquare size={iconSize} color={color} />;
    }
  };

  if (iconOnly) {
    return (
      <View
        style={[
          cs.statusIconOnly,
          {
            width: size === 'small' ? 20 : 24,
            height: size === 'small' ? 20 : 24,
            backgroundColor: `${color}20`,
          },
        ]}
      >
        {getIcon()}
      </View>
    );
  }

  return (
    <View
      style={[cs.statusBadge, {
        paddingHorizontal: size === 'small' ? spacing['1.5'] : spacing['2'],
        paddingVertical: size === 'small' ? 2 : spacing['1'],
        backgroundColor: `${color}20`,
      }]}
    >
      {getIcon()}
      <Text
        style={[cs.statusText, {
          fontSize: size === 'small' ? 10 : 12,
          color,
        }]}
      >
        {label}
      </Text>
    </View>
  );
}

// Hook for managing conversation summaries
export function useConversationSummary(conversation: Conversation) {
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const realMessageCount = conversation.messages.filter(m => m.sender !== 'ai_draft').length;
  const shouldHaveSummary = realMessageCount >= MIN_MESSAGES_FOR_SUMMARY;

  const refresh = async () => {
    if (!shouldHaveSummary) return;

    setIsLoading(true);
    try {
      const newSummary = await generateConversationSummary(conversation, true);
      setSummary(newSummary);
    } catch (err) {
      console.error('[Summary Hook] Generation failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-generate on mount and when messages change significantly
  useEffect(() => {
    if (shouldHaveSummary && needsSummary(conversation, summary || undefined)) {
      refresh();
    }
  }, [conversation.messages.length, shouldHaveSummary]);

  return {
    summary,
    isLoading,
    refresh,
    shouldHaveSummary,
  };
}

// Export for inbox use
export { StatusBadge };

// ─── Styles ──────────────────────────────────────────────────
const cs = StyleSheet.create({
  root: {
    backgroundColor: `${colors.bg.elevated}99`,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    backgroundColor: '#818CF820',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing['3'],
  },
  headerLabel: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    marginBottom: 2,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mutedText: {
    color: colors.text.disabled,
    fontSize: 14,
  },
  summaryText: {
    color: colors.text.primary,
    fontSize: 14,
  },
  errorText: {
    color: colors.danger.light,
    fontSize: 14,
  },
  chevronWrap: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: `${colors.bg.hover}80`,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing['2'],
  },
  expandedContent: {
    paddingHorizontal: spacing['4'],
    paddingBottom: spacing['4'],
    borderTopWidth: 1,
    borderTopColor: `${colors.bg.hover}80`,
  },
  sectionLabel: {
    color: colors.text.disabled,
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing['2'],
  },
  topicsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  topicChip: {
    backgroundColor: `${colors.bg.hover}80`,
    borderRadius: radius.full,
    paddingHorizontal: spacing['2.5'],
    paddingVertical: spacing['1'],
    marginRight: spacing['1.5'],
    marginBottom: spacing['1.5'],
  },
  topicText: {
    color: colors.text.secondary,
    fontSize: 12,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing['1'],
  },
  pointDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: '#818CF8',
    marginRight: spacing['2'],
  },
  pointText: {
    color: colors.text.muted,
    fontSize: 12,
  },
  nextActionBox: {
    marginTop: spacing['3'],
    backgroundColor: '#F59E0B15',
    borderRadius: radius.lg,
    padding: spacing['3'],
    borderWidth: 1,
    borderColor: '#F59E0B30',
  },
  nextActionLabel: {
    color: '#FBBF24',
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    marginLeft: spacing['2'],
  },
  nextActionText: {
    color: colors.text.secondary,
    fontSize: 14,
    marginTop: spacing['1'],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing['3'],
    paddingTop: spacing['3'],
    borderTopWidth: 1,
    borderTopColor: `${colors.bg.hover}50`,
  },
  footerCount: {
    color: `${colors.text.disabled}80`,
    fontSize: 12,
  },
  refreshText: {
    color: colors.text.disabled,
    fontSize: 12,
    marginLeft: spacing['1'],
  },
  compactLoadingText: {
    color: `${colors.text.disabled}80`,
    fontSize: 12,
    marginLeft: spacing['1.5'],
  },
  compactPreview: {
    color: colors.text.disabled,
    fontSize: 12,
    marginLeft: spacing['1.5'],
    flex: 1,
  },
  badgeLoading: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: `${colors.bg.hover}80`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconOnly: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
  },
  statusText: {
    fontFamily: typography.fontFamily.medium,
    marginLeft: spacing['1'],
  },
});
