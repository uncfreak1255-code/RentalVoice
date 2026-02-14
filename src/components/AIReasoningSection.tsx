import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import {
  ChevronDown,
  ChevronUp,
  Brain,
  History,
  Database,
  CheckCircle,
  AlertTriangle,
  Info,
  Sparkles,
  MessageSquare,
  FileText,
  Zap,
  AlertCircle,
  ArrowRight,
  Globe,
  SkipForward,
  GitBranch,
  Anchor,
  MessageCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';
import type {
  EnhancedAIResponse,
  HistoricalMatchInfo,
  KnowledgeConflict,
  DetectedTopic,
  SentimentAnalysis,
  ConfidenceScore,
  SkippedTopicInfo,
  ConversationContextAnalysis,
  IntraThreadLearning,
} from '@/lib/ai-enhanced';
import { getLanguageDisplayInfo, getCulturalProfile } from '@/lib/cultural-tone';

export interface ReasoningStep {
  id: string;
  type: 'source' | 'analysis' | 'decision' | 'warning' | 'historical' | 'cultural' | 'skipped' | 'context' | 'thread_style' | 'thread_continuity';
  title: string;
  description: string;
  confidence?: number;
  icon?: 'history' | 'database' | 'brain' | 'check' | 'alert' | 'sparkles' | 'globe' | 'skip' | 'branch' | 'anchor' | 'message';
  details?: string[];
}

interface AIReasoningSectionProps {
  response: EnhancedAIResponse;
  onFixConflict?: (conflict: KnowledgeConflict, field: string, newValue: string) => void;
  style?: ViewStyle;
}

// Build reasoning steps from AI response
function buildReasoningSteps(response: EnhancedAIResponse): ReasoningStep[] {
  const steps: ReasoningStep[] = [];

  // Step 1: Sentiment Analysis
  steps.push({
    id: 'sentiment',
    type: 'analysis',
    title: 'Sentiment Detection',
    description: getSentimentDescription(response.sentiment),
    icon: 'brain',
    details: [
      `Primary: ${response.sentiment.primary}`,
      `Intensity: ${response.sentiment.intensity}%`,
      `Emotions: ${response.sentiment.emotions.join(', ')}`,
      response.sentiment.requiresEscalation ? 'Escalation flagged' : 'No escalation needed',
    ],
  });

  // Step 2: Context Analysis (Thread awareness)
  if (response.contextAnalysis) {
    const ctx = response.contextAnalysis;
    const directionLabels: Record<string, string> = {
      'new_topic': 'New topic introduced',
      'followup': 'Follow-up to previous exchange',
      'clarification': 'Guest needs clarification',
      'resolution': 'Guest acknowledging/wrapping up',
    };

    steps.push({
      id: 'context',
      type: 'context',
      title: 'Conversation Context',
      description: directionLabels[ctx.threadDirection] || 'Analyzing thread',
      icon: 'branch',
      details: [
        `Thread direction: ${ctx.threadDirection}`,
        `Total exchanges: ${ctx.totalExchanges}`,
        ctx.recentHostTopics.length > 0
          ? `Recently covered: ${ctx.recentHostTopics.join(', ')}`
          : 'No recent topics from host',
      ],
    });
  }

  // Step 3: Skipped Topics (Repetition avoidance)
  if (response.skippedTopics && response.skippedTopics.length > 0) {
    steps.push({
      id: 'skipped',
      type: 'skipped',
      title: 'Skipped Topics',
      description: `${response.skippedTopics.length} topic(s) already answered - not repeating`,
      icon: 'skip',
      details: response.skippedTopics.map(s =>
        `${s.topic}: ${s.reason}`
      ),
    });
  }

  // Step 4: Topic Detection
  steps.push({
    id: 'topics',
    type: 'analysis',
    title: 'Topics Identified',
    description: response.topics.length > 0
      ? `Found ${response.topics.length} topic(s): ${response.topics.map(t => t.topic).join(', ')}`
      : 'No new topics to address',
    icon: 'sparkles',
    details: response.topics.length > 0
      ? response.topics.map(t =>
          `${t.topic} (${t.hasAnswer ? 'Knowledge available' : 'No specific knowledge'})`
        )
      : ['Response will acknowledge guest message'],
  });

  // Step 5: Cultural Tone Adaptation
  if (response.culturalToneApplied) {
    const langInfo = getLanguageDisplayInfo(response.culturalToneApplied);
    const profile = getCulturalProfile(response.culturalToneApplied);
    const adaptations = response.culturalAdaptations || [];

    steps.push({
      id: 'cultural',
      type: 'cultural',
      title: 'Cultural Tone Adaptation',
      description: `${langInfo.flag} Adapted for ${langInfo.name} (${langInfo.culturalNote})`,
      icon: 'globe',
      details: [
        `Formality: ${profile.formalityDefault >= 70 ? 'Formal' : profile.formalityDefault >= 40 ? 'Semi-formal' : 'Casual'}`,
        `Warmth: ${profile.warmthDefault >= 70 ? 'Warm' : profile.warmthDefault >= 40 ? 'Friendly' : 'Reserved'}`,
        `Directness: ${profile.directnessDefault >= 70 ? 'Direct' : profile.directnessDefault >= 40 ? 'Balanced' : 'Indirect'}`,
        ...adaptations.slice(0, 3),
      ],
    });
  }

  // Step 6: Historical Match (if found)
  if (response.historicalMatches?.foundMatches) {
    const matches = response.historicalMatches;
    steps.push({
      id: 'historical',
      type: 'historical',
      title: 'Similar Past Replies Found',
      description: matches.usedHistoricalBasis
        ? `Using ${matches.matchCount} historical match(es) with ${matches.topMatchScore}% similarity`
        : `Found ${matches.matchCount} similar reply(ies), but confidence too low to use`,
      confidence: matches.topMatchScore,
      icon: 'history',
      details: matches.matchedPatterns.map(p =>
        `${p.intent}: "${p.responsePreview}" (${p.score}% match)`
      ),
    });
  } else {
    steps.push({
      id: 'historical',
      type: 'source',
      title: 'Historical Replies',
      description: 'No similar past replies found - generating fresh response',
      icon: 'history',
    });
  }

  // Step 7: Knowledge Base Usage
  const topicsWithKnowledge = response.topics.filter(t => t.hasAnswer).length;
  if (topicsWithKnowledge > 0) {
    steps.push({
      id: 'knowledge',
      type: 'source',
      title: 'Knowledge Base',
      description: `Using property knowledge for ${topicsWithKnowledge} topic(s)`,
      icon: 'database',
      details: response.topics
        .filter(t => t.hasAnswer)
        .map(t => `${t.topic}: Information available`),
    });
  }

  // Step 8: Intra-Thread Style Anchoring
  if (response.intraThreadLearning?.styleAnchor.hasAnchor) {
    const anchor = response.intraThreadLearning.styleAnchor;
    const warmthLabels = { warm: 'Warm & friendly', neutral: 'Balanced', professional: 'Professional' };
    const brevityLabels = { brief: 'Brief (< 30 words)', moderate: 'Moderate', detailed: 'Detailed (80+ words)' };

    steps.push({
      id: 'thread_style',
      type: 'thread_style',
      title: 'Thread Style Anchor',
      description: `Matching your ${anchor.warmthLevel} tone from this thread`,
      icon: 'anchor',
      details: [
        `Warmth: ${warmthLabels[anchor.warmthLevel]}`,
        `Brevity: ${brevityLabels[anchor.brevityLevel]}`,
        anchor.usesEmojis ? 'Using emojis (like you did)' : 'No emojis (matching your style)',
        anchor.greetingStyle ? `Greeting: "${anchor.greetingStyle}"` : 'No specific greeting detected',
        anchor.signoffStyle ? `Sign-off: "${anchor.signoffStyle}"` : 'No specific sign-off detected',
        anchor.resolvedTopics.length > 0
          ? `Already resolved: ${anchor.resolvedTopics.join(', ')}`
          : undefined,
      ].filter(Boolean) as string[],
    });
  }

  // Step 9: Thread Continuity
  if (response.intraThreadLearning?.continuity.guestReferencesHostReply) {
    const continuity = response.intraThreadLearning.continuity;
    const sentimentLabels = {
      positive: 'Positive - they liked your response!',
      negative: 'Negative - they had issues',
      neutral: 'Neutral reference',
      unknown: 'Unknown',
    };

    steps.push({
      id: 'thread_continuity',
      type: 'thread_continuity',
      title: 'Guest References Your Reply',
      description: continuity.sentimentTowardPriorReply === 'positive'
        ? 'Guest positively received your last reply'
        : continuity.sentimentTowardPriorReply === 'negative'
        ? 'Guest had issues with your last reply'
        : 'Guest is following up on your reply',
      icon: 'message',
      details: [
        `Sentiment: ${sentimentLabels[continuity.sentimentTowardPriorReply]}`,
        continuity.referencedContent
          ? `Referenced: ${continuity.referencedContent}`
          : 'General reference to prior reply',
        continuity.suggestedAcknowledgment
          ? `Suggested opener: "${continuity.suggestedAcknowledgment}"`
          : undefined,
      ].filter(Boolean) as string[],
    });
  }

  // Step 10: Confidence Factors
  steps.push({
    id: 'confidence',
    type: 'decision',
    title: 'Confidence Score',
    description: `Overall confidence: ${response.confidence.overall}%`,
    confidence: response.confidence.overall,
    icon: 'check',
    details: [
      `Sentiment Match: ${response.confidence.factors.sentimentMatch}%`,
      `Knowledge Available: ${response.confidence.factors.knowledgeAvailable}%`,
      `Topic Coverage: ${response.confidence.factors.topicCoverage}%`,
      `Style Match: ${response.confidence.factors.styleMatch}%`,
      `Safety Check: ${response.confidence.factors.safetyCheck}%`,
    ],
  });

  // Step 11: Warnings (if any)
  if (response.confidence.warnings.length > 0) {
    steps.push({
      id: 'warnings',
      type: 'warning',
      title: 'Warnings',
      description: `${response.confidence.warnings.length} warning(s) detected`,
      icon: 'alert',
      details: response.confidence.warnings,
    });
  }

  // Step 12: Knowledge Conflicts (if any)
  if (response.knowledgeConflicts.length > 0) {
    steps.push({
      id: 'conflicts',
      type: 'warning',
      title: 'Knowledge Conflicts',
      description: `${response.knowledgeConflicts.length} potential issue(s) in property data`,
      icon: 'alert',
      details: response.knowledgeConflicts.map(c => `${c.field}: ${c.issue}`),
    });
  }

  return steps;
}

function getSentimentDescription(sentiment: SentimentAnalysis): string {
  if (sentiment.primary === 'urgent') {
    return 'Guest has an urgent issue requiring immediate attention';
  }
  if (sentiment.primary === 'negative') {
    if (sentiment.emotions.includes('angry')) {
      return 'Guest is upset - response crafted with extra empathy';
    }
    if (sentiment.emotions.includes('frustrated')) {
      return 'Guest is frustrated - addressing concerns first';
    }
    return 'Guest has concerns - providing thoughtful response';
  }
  if (sentiment.primary === 'positive') {
    if (sentiment.emotions.includes('excited')) {
      return 'Guest is excited - matching their enthusiasm';
    }
    return 'Guest is in good spirits - keeping tone positive';
  }
  return 'Neutral inquiry - providing helpful, friendly response';
}

function getStepIcon(icon?: string, color: string = colors.text.disabled) {
  const size = 16;
  switch (icon) {
    case 'history':
      return <History size={size} color={color} />;
    case 'database':
      return <Database size={size} color={color} />;
    case 'brain':
      return <Brain size={size} color={color} />;
    case 'check':
      return <CheckCircle size={size} color={color} />;
    case 'alert':
      return <AlertTriangle size={size} color={color} />;
    case 'sparkles':
      return <Sparkles size={size} color={color} />;
    case 'globe':
      return <Globe size={size} color={color} />;
    case 'skip':
      return <SkipForward size={size} color={color} />;
    case 'branch':
      return <GitBranch size={size} color={color} />;
    case 'anchor':
      return <Anchor size={size} color={color} />;
    case 'message':
      return <MessageCircle size={size} color={color} />;
    default:
      return <Info size={size} color={color} />;
  }
}

// Semantic step colors using design tokens where possible
const STEP_COLORS = {
  source: '#3B82F6',
  analysis: '#8B5CF6',
  decision: colors.success.DEFAULT,
  warning: '#F59E0B',
  historical: colors.primary.DEFAULT,
  cultural: '#EC4899',
  skipped: colors.accent.DEFAULT,
  context: '#06B6D4',
  thread_style: '#8B5CF6',
  thread_continuity: colors.success.DEFAULT,
} as const;

function getStepColor(type: ReasoningStep['type']): string {
  return STEP_COLORS[type] || colors.text.disabled;
}

export function AIReasoningSection({
  response,
  onFixConflict,
  style,
}: AIReasoningSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const reasoningSteps = buildReasoningSteps(response);

  const toggleExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded(!isExpanded);
  };

  const toggleStepExpanded = (stepId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  return (
    <View style={[ars.root, style]}>
      {/* Header - Always visible */}
      <Pressable
        onPress={toggleExpanded}
        style={({ pressed }) => [ars.headerRow, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={ars.headerLeft}>
          <View style={ars.brainIconWrap}>
            <Brain size={18} color="#A855F7" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ars.headerTitle}>How I Arrived at This</Text>
            <Text style={ars.headerSubtitle}>
              {response.historicalMatches?.usedHistoricalBasis
                ? `Based on ${response.historicalMatches.matchCount} similar past repl${response.historicalMatches.matchCount === 1 ? 'y' : 'ies'}`
                : 'AI-generated response'}
              {' '}({response.confidence.overall}% confidence)
            </Text>
          </View>
        </View>
        <View style={ars.chevronWrap}>
          {isExpanded ? (
            <ChevronUp size={18} color={colors.text.muted} />
          ) : (
            <ChevronDown size={18} color={colors.text.muted} />
          )}
        </View>
      </Pressable>

      {/* Expanded Content */}
      {isExpanded && (
        <Animated.View entering={FadeIn.duration(200)} style={ars.expandedContent}>
          {/* Reasoning Steps */}
          <View style={ars.stepsContainer}>
            {reasoningSteps.map((step, index) => (
              <Animated.View
                key={step.id}
                entering={FadeInDown.delay(index * 50).duration(200)}
              >
                <Pressable
                  onPress={() => step.details && toggleStepExpanded(step.id)}
                  style={({ pressed }) => [
                    ars.stepRow,
                    index < reasoningSteps.length - 1 && ars.stepBorder,
                    { opacity: pressed && step.details ? 0.7 : 1 },
                  ]}
                >
                  {/* Step Number / Icon */}
                  <View
                    style={[ars.stepIconWrap, { backgroundColor: `${getStepColor(step.type)}20` }]}
                  >
                    {getStepIcon(step.icon, getStepColor(step.type))}
                  </View>

                  {/* Content */}
                  <View style={{ flex: 1 }}>
                    <View style={ars.stepTitleRow}>
                      <Text style={ars.stepTitle}>
                        {step.title}
                      </Text>
                      {step.confidence !== undefined && (
                        <View
                          style={[ars.confidencePill, {
                            backgroundColor:
                              step.confidence >= 80
                                ? `${colors.success.DEFAULT}20`
                                : step.confidence >= 60
                                ? '#F59E0B20'
                                : `${colors.danger.DEFAULT}20`,
                          }]}
                        >
                          <Text
                            style={[ars.confidenceText, {
                              color:
                                step.confidence >= 80
                                  ? colors.success.DEFAULT
                                  : step.confidence >= 60
                                  ? '#F59E0B'
                                  : colors.danger.DEFAULT,
                            }]}
                          >
                            {step.confidence}%
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={ars.stepDescription}>
                      {step.description}
                    </Text>

                    {/* Expanded Details */}
                    {step.details && expandedSteps.has(step.id) && (
                      <Animated.View
                        entering={FadeIn.duration(150)}
                        style={ars.detailsPanel}
                      >
                        {step.details.map((detail, idx) => (
                          <View
                            key={idx}
                            style={ars.detailRow}
                          >
                            <View style={ars.detailDot} />
                            <Text style={ars.detailText}>
                              {detail}
                            </Text>
                          </View>
                        ))}
                      </Animated.View>
                    )}

                    {/* Expand indicator */}
                    {step.details && !expandedSteps.has(step.id) && (
                      <Text style={ars.tapHint}>
                        Tap for details
                      </Text>
                    )}
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </View>

          {/* Knowledge Conflicts with Quick Fix */}
          {response.knowledgeConflicts.length > 0 && (
            <View style={ars.conflictsSection}>
              <View style={ars.conflictsHeader}>
                <AlertCircle size={14} color="#F59E0B" />
                <Text style={ars.conflictsTitle}>
                  Potential Data Issues
                </Text>
              </View>
              {response.knowledgeConflicts.map((conflict, idx) => (
                <ConflictCard
                  key={idx}
                  conflict={conflict}
                  onFix={onFixConflict}
                />
              ))}
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

// Conflict Card with One-Click Fix
interface ConflictCardProps {
  conflict: KnowledgeConflict;
  onFix?: (conflict: KnowledgeConflict, field: string, newValue: string) => void;
}

function ConflictCard({ conflict, onFix }: ConflictCardProps) {
  const [showFix, setShowFix] = useState(false);

  const handleShowFix = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFix(!showFix);
  };

  const handleApplyFix = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onFix?.(conflict, conflict.field, conflict.suggestedFix || '');
  };

  const borderColor =
    conflict.severity === 'high'
      ? colors.danger.DEFAULT
      : conflict.severity === 'medium'
      ? '#F59E0B'
      : colors.text.disabled;

  const severityBg =
    conflict.severity === 'high'
      ? colors.danger.muted
      : conflict.severity === 'medium'
      ? '#F59E0B20'
      : `${colors.text.disabled}20`;

  const severityColor =
    conflict.severity === 'high'
      ? colors.danger.DEFAULT
      : conflict.severity === 'medium'
      ? '#F59E0B'
      : colors.text.disabled;

  return (
    <View style={[ars.conflictCard, { borderLeftColor: borderColor }]}>
      <View style={ars.conflictTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={ars.conflictField}>
            {conflict.field.replace(/([A-Z])/g, ' $1').trim()}
          </Text>
          <Text style={ars.conflictIssue}>
            {conflict.issue}
          </Text>
        </View>
        <View style={[ars.severityBadge, { backgroundColor: severityBg }]}>
          <Text style={[ars.severityText, { color: severityColor }]}>
            {conflict.severity}
          </Text>
        </View>
      </View>

      {conflict.suggestedFix && (
        <>
          <Pressable
            onPress={handleShowFix}
            style={({ pressed }) => [ars.showFixBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Zap size={12} color={colors.primary.DEFAULT} />
            <Text style={ars.showFixText}>
              {showFix ? 'Hide suggestion' : 'Show quick fix'}
            </Text>
          </Pressable>

          {showFix && (
            <Animated.View
              entering={FadeIn.duration(150)}
              style={ars.fixPanel}
            >
              <Text style={ars.fixDescription}>
                {conflict.suggestedFix}
              </Text>
              {onFix && (
                <Pressable
                  onPress={handleApplyFix}
                  style={({ pressed }) => [ars.fixBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={ars.fixBtnText}>
                    Update Knowledge Base
                  </Text>
                  <ArrowRight size={14} color={colors.primary.DEFAULT} />
                </Pressable>
              )}
            </Animated.View>
          )}
        </>
      )}
    </View>
  );
}

// Compact version for inbox list items
export function AIReasoningBadge({
  response,
  onPress,
}: {
  response: EnhancedAIResponse;
  onPress?: () => void;
}) {
  const hasHistoricalBasis = response.historicalMatches?.usedHistoricalBasis;
  const hasConflicts = response.knowledgeConflicts.length > 0;
  const hasWarnings = response.confidence.warnings.length > 0;
  const hasCulturalTone = response.culturalToneApplied && response.culturalToneApplied !== 'en';
  const hasSkippedTopics = response.skippedTopics && response.skippedTopics.length > 0;
  const hasStyleAnchor = response.intraThreadLearning?.styleAnchor.hasAnchor;
  const hasPositiveContinuity = response.intraThreadLearning?.continuity.sentimentTowardPriorReply === 'positive';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [ars.badgeRow, { opacity: pressed ? 0.7 : 1 }]}
    >
      {hasPositiveContinuity && (
        <View style={[ars.badgePill, { backgroundColor: `${colors.success.DEFAULT}20` }]}>
          <MessageCircle size={10} color={colors.success.DEFAULT} />
          <Text style={[ars.badgePillText, { color: colors.success.light }]}>
            +feedback
          </Text>
        </View>
      )}

      {hasStyleAnchor && !hasPositiveContinuity && (
        <View style={[ars.badgePill, { backgroundColor: '#8B5CF620' }]}>
          <Anchor size={10} color="#8B5CF6" />
          <Text style={[ars.badgePillText, { color: '#A78BFA' }]}>
            styled
          </Text>
        </View>
      )}

      {hasSkippedTopics && (
        <View style={[ars.badgePill, { backgroundColor: colors.accent.muted }]}>
          <SkipForward size={10} color={colors.accent.DEFAULT} />
          <Text style={[ars.badgePillText, { color: colors.accent.light }]}>
            {response.skippedTopics!.length} skipped
          </Text>
        </View>
      )}

      {hasCulturalTone && (
        <View style={[ars.badgePill, { backgroundColor: '#EC489920' }]}>
          <Globe size={10} color="#EC4899" />
          <Text style={[ars.badgePillText, { color: '#F472B6' }]}>
            {getLanguageDisplayInfo(response.culturalToneApplied!).flag}
          </Text>
        </View>
      )}

      {hasHistoricalBasis && (
        <View style={[ars.badgePill, { backgroundColor: colors.primary.muted }]}>
          <History size={10} color={colors.primary.DEFAULT} />
          <Text style={[ars.badgePillText, { color: colors.primary.light }]}>
            {response.historicalMatches?.matchCount} match
          </Text>
        </View>
      )}

      {hasConflicts && (
        <View style={[ars.badgePill, { backgroundColor: '#F59E0B20' }]}>
          <AlertTriangle size={10} color="#F59E0B" />
          <Text style={[ars.badgePillText, { color: '#FBBF24' }]}>
            {response.knowledgeConflicts.length} issue
          </Text>
        </View>
      )}

      {hasWarnings && !hasConflicts && (
        <View style={[ars.badgePill, { backgroundColor: `${colors.bg.hover}80`, marginRight: 0 }]}>
          <Info size={10} color={colors.text.muted} />
          <Text style={[ars.badgePillText, { color: colors.text.muted }]}>
            {response.confidence.warnings.length} note
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const ars = StyleSheet.create({
  root: {
    backgroundColor: `${colors.bg.elevated}80`,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  brainIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    backgroundColor: '#A855F720',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing['3'],
  },
  headerTitle: {
    color: colors.text.primary,
    fontFamily: typography.fontFamily.medium,
    fontSize: 14,
  },
  headerSubtitle: {
    color: colors.text.muted,
    fontSize: 12,
    marginTop: 2,
  },
  chevronWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: `${colors.bg.hover}80`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedContent: {
    paddingHorizontal: spacing['4'],
    paddingBottom: spacing['4'],
  },
  stepsContainer: {
    borderTopWidth: 1,
    borderTopColor: `${colors.bg.hover}80`,
    paddingTop: spacing['3'],
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing['2.5'],
  },
  stepBorder: {
    borderBottomWidth: 1,
    borderBottomColor: `${colors.bg.hover}50`,
  },
  stepIconWrap: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing['3'],
    marginTop: 2,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepTitle: {
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.medium,
    fontSize: 14,
  },
  confidencePill: {
    paddingHorizontal: spacing['2'],
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  confidenceText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
  },
  stepDescription: {
    color: colors.text.disabled,
    fontSize: 12,
    marginTop: 2,
  },
  detailsPanel: {
    marginTop: spacing['2'],
    backgroundColor: `${colors.bg.hover}50`,
    borderRadius: radius.lg,
    padding: spacing['2.5'],
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing['1'],
  },
  detailDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.text.disabled,
    marginTop: 6,
    marginRight: spacing['2'],
  },
  detailText: {
    color: colors.text.muted,
    fontSize: 12,
    flex: 1,
  },
  tapHint: {
    color: `${colors.text.disabled}80`,
    fontSize: 12,
    marginTop: spacing['1'],
  },
  conflictsSection: {
    marginTop: spacing['4'],
    paddingTop: spacing['3'],
    borderTopWidth: 1,
    borderTopColor: `${colors.bg.hover}80`,
  },
  conflictsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing['2'],
  },
  conflictsTitle: {
    color: '#FBBF24',
    fontFamily: typography.fontFamily.medium,
    fontSize: 14,
    marginLeft: spacing['1.5'],
  },
  conflictCard: {
    backgroundColor: `${colors.bg.hover}50`,
    borderRadius: radius.lg,
    padding: spacing['3'],
    marginBottom: spacing['2'],
    borderLeftWidth: 2,
  },
  conflictTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  conflictField: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: typography.fontFamily.medium,
    textTransform: 'capitalize' as const,
  },
  conflictIssue: {
    color: colors.text.muted,
    fontSize: 12,
    marginTop: 2,
  },
  severityBadge: {
    paddingHorizontal: spacing['2'],
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  severityText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
  },
  showFixBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing['2'],
  },
  showFixText: {
    color: colors.primary.light,
    fontSize: 12,
    marginLeft: spacing['1'],
  },
  fixPanel: {
    marginTop: spacing['2'],
    backgroundColor: `${colors.bg.elevated}80`,
    borderRadius: radius.lg,
    padding: spacing['2'],
  },
  fixDescription: {
    color: colors.text.muted,
    fontSize: 12,
    marginBottom: spacing['2'],
  },
  fixBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.muted,
    borderRadius: radius.lg,
    paddingVertical: spacing['2'],
  },
  fixBtnText: {
    color: colors.primary.light,
    fontSize: 14,
    fontFamily: typography.fontFamily.medium,
    marginRight: spacing['1'],
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing['2'],
    paddingVertical: spacing['1'],
    borderRadius: radius.full,
    marginRight: spacing['1.5'],
  },
  badgePillText: {
    fontSize: 12,
    marginLeft: spacing['1'],
  },
});
