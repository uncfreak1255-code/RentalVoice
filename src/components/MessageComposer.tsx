import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '@/lib/design-tokens';
import {
  Send,
  Sparkles,
  RefreshCw,
  Edit3,
  Check,
  X,
  Wand2,
  Heart,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Briefcase,
  Coffee,
  AlertTriangle,
  Gauge,
  ChevronDown,
  Paperclip,
  Shield,
  Trash2,
  MoreHorizontal,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { RegenerationOption, ConfidenceScore, SentimentAnalysis, ActionItem, KnowledgeConflict, HistoricalMatchInfo } from '@/lib/ai-enhanced';
import { scanForSensitiveData, type ScanResult } from '@/lib/privacy-scanner';
import { PrivacyAlertBanner, PrivacyIndicator } from './PrivacyAlertBanner';
import { AIReasoningSection } from './AIReasoningSection';
import { ModelPicker } from './ModelPicker';

interface AiDraft {
  content: string;
  confidence: number;
}

interface EnhancedAiDraft extends AiDraft {
  sentiment?: SentimentAnalysis;
  confidenceDetails?: ConfidenceScore;
  actionItems?: ActionItem[];
  regenerationOptions?: RegenerationOption[];
  historicalMatches?: HistoricalMatchInfo;
  knowledgeConflicts?: KnowledgeConflict[];
}

interface MessageComposerProps {
  onSend: (message: string) => void;
  onApproveAiDraft: () => void;
  onRegenerateAiDraft: (modifier?: RegenerationOption['modifier']) => void;
  onEditAiDraft: (newContent: string) => void;
  onDismissAiDraft: () => void;

  aiDraft: EnhancedAiDraft | null;
  isGenerating?: boolean;
  disabled?: boolean;
  autoPilotEnabled?: boolean;
  onAttachMedia?: () => void;
  privacyScanEnabled?: boolean;
  onFixConflict?: (field: string, newValue: string) => void;
  onOpenActionsSheet?: () => void; // Open premium bottom sheet
}

// Regeneration option icons and colors
const regenerationConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  empathy: {
    icon: <Heart size={14} color="#EC4899" />,
    color: '#EC4899',
    bgColor: 'rgba(236,72,153,0.2)',
  },
  shorter: {
    icon: <ArrowDownNarrowWide size={14} color="#3B82F6" />,
    color: '#3B82F6',
    bgColor: 'rgba(59,130,246,0.2)',
  },
  longer: {
    icon: <ArrowUpNarrowWide size={14} color="#8B5CF6" />,
    color: '#8B5CF6',
    bgColor: 'rgba(139,92,246,0.2)',
  },
  formal: {
    icon: <Briefcase size={14} color="#6366F1" />,
    color: '#6366F1',
    bgColor: 'rgba(99,102,241,0.2)',
  },
  casual: {
    icon: <Coffee size={14} color="#F59E0B" />,
    color: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.2)',
  },
};

// Get confidence color
function getConfidenceColor(confidence: number): string {
  if (confidence >= 90) return '#22C55E';
  if (confidence >= 75) return colors.primary.DEFAULT;
  if (confidence >= 60) return '#F59E0B';
  return colors.danger.DEFAULT;
}

// Get sentiment color
function getSentimentColor(sentiment?: SentimentAnalysis['primary']): string {
  switch (sentiment) {
    case 'positive': return '#22C55E';
    case 'neutral': return colors.text.muted;
    case 'negative': return '#F59E0B';
    case 'urgent': return colors.danger.DEFAULT;
    default: return colors.text.muted;
  }
}

export function MessageComposer({
  onSend,
  onApproveAiDraft,
  onRegenerateAiDraft,
  onEditAiDraft,
  onDismissAiDraft,

  aiDraft,
  isGenerating = false,
  disabled = false,
  autoPilotEnabled = false,
  onAttachMedia,
  privacyScanEnabled = true,
  onFixConflict,
  onOpenActionsSheet,
}: MessageComposerProps) {
  const [message, setMessage] = useState('');

  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [editedDraft, setEditedDraft] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const [showRegenerateOptions, setShowRegenerateOptions] = useState(false);
  const [showConfidenceDetails, setShowConfidenceDetails] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [privacyScanResult, setPrivacyScanResult] = useState<ScanResult | null>(null);
  const [showPrivacyAlert, setShowPrivacyAlert] = useState(true);

  // Ref for the draft TextInput to control focus and cursor
  const draftInputRef = useRef<TextInput>(null);

  // Scan for sensitive data when editing drafts
  useEffect(() => {
    if (!privacyScanEnabled) {
      setPrivacyScanResult(null);
      return;
    }

    const textToScan = isEditingDraft ? editedDraft : message;
    if (textToScan.length > 10) {
      // Debounce the scan
      const timeoutId = setTimeout(() => {
        const result = scanForSensitiveData(textToScan);
        setPrivacyScanResult(result);
        if (result.hasIssues) {
          setShowPrivacyAlert(true);
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setPrivacyScanResult(null);
    }
  }, [editedDraft, message, isEditingDraft, privacyScanEnabled]);

  // Also scan AI drafts
  useEffect(() => {
    if (!privacyScanEnabled || !aiDraft?.content || isEditingDraft) {
      return;
    }

    const result = scanForSensitiveData(aiDraft.content);
    if (result.hasIssues) {
      setPrivacyScanResult(result);
      setShowPrivacyAlert(true);
    }
  }, [aiDraft?.content, privacyScanEnabled, isEditingDraft]);

  // Handle anonymization
  const handleAnonymize = useCallback(() => {
    if (!privacyScanResult) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isEditingDraft) {
      setEditedDraft(privacyScanResult.anonymizedText);
    } else {
      setMessage(privacyScanResult.anonymizedText);
    }

    // Clear the scan result after anonymizing
    setPrivacyScanResult(null);
    setShowPrivacyAlert(false);
  }, [privacyScanResult, isEditingDraft]);

  // When we have an AI draft, populate the editing field but don't auto-enter edit mode
  // This allows the host to use either the AI suggestion OR write their own message
  useEffect(() => {
    if (aiDraft && !editedDraft) {
      setEditedDraft(aiDraft.content);
    }
  }, [aiDraft]);

  // Reset when draft is dismissed
  useEffect(() => {
    if (!aiDraft) {
      setIsEditingDraft(false);
      setEditedDraft('');
    }
  }, [aiDraft]);

  const handleMessageChange = (text: string) => {
    setMessage(text);
  };

  const handleClearSuggestion = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsEditingDraft(false);
    setEditedDraft('');
    onDismissAiDraft();
  };

  const handleSend = () => {
    if (!message.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(message.trim());
    setMessage('');
  };

  const handleApprove = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onApproveAiDraft();
  };

  const handleEdit = () => {
    setEditedDraft(aiDraft?.content || '');
    setIsEditingDraft(true);
  };

  const handleSaveEdit = () => {
    if (editedDraft.trim()) {
      onEditAiDraft(editedDraft.trim());
      setIsEditingDraft(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingDraft(false);
    setEditedDraft('');
  };

  const handleRegenerate = (modifier?: RegenerationOption['modifier']) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowTooltip(false);
    setShowRegenerateOptions(false);
    onRegenerateAiDraft(modifier);
  };



  const confidenceDetails = aiDraft?.confidenceDetails;
  const sentiment = aiDraft?.sentiment;
  const actionItems = aiDraft?.actionItems || [];
  const hasWarnings = confidenceDetails?.warnings && confidenceDetails.warnings.length > 0;
  const isBlocked = confidenceDetails?.blockedForAutoSend;

  return (
    <View style={mcStyles.root}>
      {/* Privacy Alert Banner */}
      {privacyScanResult?.hasIssues && showPrivacyAlert && (
        <PrivacyAlertBanner
          scanResult={privacyScanResult}
          onAnonymize={handleAnonymize}
          onDismiss={() => setShowPrivacyAlert(false)}
          compact={!isEditingDraft}
        />
      )}

      {/* Auto-Pilot Mode: Enhanced AI Draft Preview */}
      {autoPilotEnabled && (aiDraft || isGenerating) && !isEditingDraft && (
        <Animated.View
          entering={SlideInDown.duration(300)}
          exiting={FadeOut.duration(200)}
          style={[mcStyles.draftPanel, mcStyles.tealPanel, { maxHeight: 400 }]}
        >
          <ScrollView
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
          <View style={mcStyles.panelInner}>
          {isGenerating ? (
            <View style={mcStyles.rowCenter}>
              <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
              <Text style={mcStyles.tealLabel}>AI is analyzing and drafting a response...</Text>
            </View>
          ) : (
            <>
              <View style={[mcStyles.rowCenter, { marginBottom: spacing['2'] }]}>
                <Sparkles size={14} color={colors.primary.DEFAULT} />
                <Text style={[mcStyles.tealLabel, { fontFamily: typography.fontFamily.medium }]}>
                  AI Draft Ready
                </Text>

                <Pressable
                  onPress={() => setShowConfidenceDetails(!showConfidenceDetails)}
                  style={mcStyles.confidenceBadge}
                >
                  <Gauge size={12} color={getConfidenceColor(aiDraft?.confidence || 0)} />
                  <Text style={[mcStyles.badgeText, { color: getConfidenceColor(aiDraft?.confidence || 0) }]}>
                    {aiDraft?.confidence}%
                  </Text>
                </Pressable>

                {sentiment && (
                  <View style={[mcStyles.sentimentBadge, { backgroundColor: `${getSentimentColor(sentiment.primary)}20` }]}>
                    <Text style={[mcStyles.badgeText, { color: getSentimentColor(sentiment.primary), textTransform: 'capitalize' }]}>
                      {sentiment.primary}
                    </Text>
                  </View>
                )}
              </View>

              {hasWarnings && (
                <Animated.View entering={FadeIn.duration(200)} style={{ marginBottom: spacing['2'] }}>
                  {confidenceDetails.warnings.map((warning, idx) => (
                    <View key={idx} style={mcStyles.warningRow}>
                      <AlertTriangle size={12} color="#F59E0B" />
                      <Text style={mcStyles.warningText}>{warning}</Text>
                    </View>
                  ))}
                </Animated.View>
              )}

              {isBlocked && (
                <View style={mcStyles.blockedBanner}>
                  <Text style={mcStyles.blockedText}>
                    Auto-send blocked: {confidenceDetails.blockReason}
                  </Text>
                </View>
              )}

              {showConfidenceDetails && confidenceDetails && (
                <Animated.View entering={FadeInUp.duration(200)} style={mcStyles.confidencePanel}>
                  <Text style={mcStyles.confidenceTitle}>Confidence Breakdown</Text>
                  <View>
                    {Object.entries(confidenceDetails.factors).map(([key, value]) => (
                      <View key={key} style={mcStyles.factorRow}>
                        <Text style={mcStyles.factorLabel}>
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </Text>
                        <View style={mcStyles.rowCenter}>
                          <View style={mcStyles.progressTrack}>
                            <View style={[mcStyles.progressFill, { width: `${value}%`, backgroundColor: getConfidenceColor(value) }]} />
                          </View>
                          <Text style={[mcStyles.factorValue, { color: getConfidenceColor(value) }]}>
                            {value}%
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </Animated.View>
              )}

              <Text style={mcStyles.draftContent}>
                {aiDraft?.content}
              </Text>

              <View style={mcStyles.actionRow}>
                <Pressable
                  onPress={handleApprove}
                  disabled={isBlocked}
                  style={({ pressed }) => [mcStyles.actionBtn, { backgroundColor: isBlocked ? colors.bg.hover : colors.primary.DEFAULT, opacity: pressed ? 0.8 : 1 }]}
                >
                  <Check size={14} color={isBlocked ? colors.text.muted : "#FFFFFF"} />
                  <Text style={[mcStyles.actionBtnText, { color: isBlocked ? colors.text.disabled : '#FFFFFF' }]}>
                    {isBlocked ? 'Review Required' : 'Send'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleEdit}
                  style={({ pressed }) => [mcStyles.secondaryBtn, { opacity: pressed ? 0.8 : 1 }]}
                >
                  <Edit3 size={14} color={colors.text.muted} />
                  <Text style={mcStyles.secondaryBtnText}>Edit</Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowRegenerateOptions(!showRegenerateOptions)}
                  style={({ pressed }) => [mcStyles.secondaryBtn, { opacity: pressed ? 0.8 : 1 }]}
                >
                  <RefreshCw size={14} color={colors.text.muted} />
                  <Text style={mcStyles.secondaryBtnText}>Regenerate</Text>
                  <ChevronDown size={12} color={colors.text.disabled} style={{ marginLeft: 2 }} />
                </Pressable>

                <Pressable
                  onPress={onDismissAiDraft}
                  style={({ pressed }) => [mcStyles.iconBtn, { opacity: pressed ? 0.8 : 1 }]}
                >
                  <X size={18} color={colors.text.disabled} />
                </Pressable>

                {onOpenActionsSheet && (
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenActionsSheet(); }}
                    onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onOpenActionsSheet(); }}
                    style={({ pressed }) => [mcStyles.iconBtn, { backgroundColor: `${colors.bg.hover}80`, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
                  >
                    <MoreHorizontal size={18} color="#6366F1" />
                  </Pressable>
                )}
              </View>

              {showRegenerateOptions && (
                <Animated.View entering={FadeInUp.duration(200)} style={mcStyles.regenRow}>
                  {(aiDraft?.regenerationOptions || [
                    { id: 'empathy', label: 'More Empathy', modifier: 'empathy' as const },
                    { id: 'shorter', label: 'Shorter', modifier: 'shorter' as const },
                    { id: 'longer', label: 'More Details', modifier: 'longer' as const },
                    { id: 'formal', label: 'Formal', modifier: 'formal' as const },
                    { id: 'casual', label: 'Casual', modifier: 'casual' as const },
                  ]).map((option) => {
                    const config = regenerationConfig[option.modifier];
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => handleRegenerate(option.modifier)}
                        style={({ pressed }) => [mcStyles.regenBtn, { backgroundColor: config?.bgColor || colors.bg.hover, opacity: pressed ? 0.8 : 1 }]}
                      >
                        {config?.icon}
                        <Text style={[mcStyles.regenLabel, { color: config?.color || colors.text.muted }]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </Animated.View>
              )}

              {aiDraft && (
                <Pressable
                  onPress={() => setShowReasoning(!showReasoning)}
                  style={({ pressed }) => [mcStyles.reasoningToggle, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Sparkles size={10} color={colors.text.disabled} />
                  <Text style={mcStyles.reasoningLabel}>
                    {showReasoning ? 'Hide reasoning' : 'Show reasoning'}
                  </Text>
                  <ChevronDown size={10} color={colors.text.disabled} style={{ marginLeft: 2, transform: [{ rotate: showReasoning ? '180deg' : '0deg' }] }} />
                </Pressable>
              )}
              {aiDraft && showReasoning && (
                <View style={{ marginTop: spacing['1'] }}>
                <AIReasoningSection
                  response={{
                    content: aiDraft.content,
                    sentiment: aiDraft.sentiment || { primary: 'neutral', intensity: 50, emotions: [], requiresEscalation: false },
                    topics: [],
                    confidence: aiDraft.confidenceDetails || {
                      overall: aiDraft.confidence,
                      factors: { sentimentMatch: 80, knowledgeAvailable: 70, topicCoverage: 85, styleMatch: 75, safetyCheck: 90 },
                      warnings: [],
                      blockedForAutoSend: false,
                    },
                    actionItems: aiDraft.actionItems || [],
                    knowledgeConflicts: aiDraft.knowledgeConflicts || [],
                    detectedLanguage: 'en',
                    regenerationOptions: aiDraft.regenerationOptions || [],
                    historicalMatches: aiDraft.historicalMatches,
                  }}
                  onFixConflict={onFixConflict ? (_conflict, field, newValue) => {
                    onFixConflict(field, newValue);
                  } : undefined}
                />
                </View>
              )}
            </>
          )}
          </View>
          </ScrollView>
        </Animated.View>
      )}

      {/* Manual Mode: Generating indicator above text box */}
      {!autoPilotEnabled && isGenerating && !isEditingDraft && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={[mcStyles.draftPanel, mcStyles.purplePanel, mcStyles.panelInner]}
        >
          <View style={mcStyles.rowCenter}>
            <ActivityIndicator size="small" color="#A855F7" />
            <Text style={[mcStyles.purpleLabel, { marginLeft: spacing['2'] }]}>Analyzing message and generating suggestion...</Text>
          </View>
        </Animated.View>
      )}

      {/* Edit Draft Mode - Manual mode AI suggestions */}
      {isEditingDraft && !autoPilotEnabled && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={[mcStyles.draftPanel, mcStyles.purplePanel]}
        >
          <ScrollView
            keyboardShouldPersistTaps="always"
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={mcStyles.panelInner}>
              <View style={mcStyles.headerSpaceBetween}>
                <View style={[mcStyles.rowCenter, { flex: 1 }]}>
                  <Wand2 size={14} color="#A855F7" />
                  <Text style={[mcStyles.purpleLabel, { fontFamily: typography.fontFamily.medium }]}>
                    AI Suggestion
                  </Text>

                  {aiDraft && (
                    <Pressable
                      onPress={() => setShowConfidenceDetails(!showConfidenceDetails)}
                      style={[mcStyles.confidenceBadge, { backgroundColor: 'rgba(168,85,247,0.2)' }]}
                    >
                      <Gauge size={10} color={getConfidenceColor(aiDraft.confidence)} />
                      <Text style={[mcStyles.badgeText, { color: getConfidenceColor(aiDraft.confidence) }]}>
                        {aiDraft.confidence}%
                      </Text>
                    </Pressable>
                  )}

                  {sentiment && (
                    <View style={[mcStyles.sentimentBadge, { backgroundColor: `${getSentimentColor(sentiment.primary)}20` }]}>
                      <Text style={[mcStyles.badgeText, { color: getSentimentColor(sentiment.primary), textTransform: 'capitalize' }]}>
                        {sentiment.primary}
                      </Text>
                    </View>
                  )}
                </View>

                <Pressable
                  onPress={handleClearSuggestion}
                  style={({ pressed }) => [{ padding: spacing['1.5'] }, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <X size={16} color={colors.text.disabled} />
                </Pressable>
              </View>

              {hasWarnings && (
                <View style={{ marginBottom: spacing['2'] }}>
                  {confidenceDetails?.warnings.slice(0, 1).map((warning, idx) => (
                    <View key={idx} style={mcStyles.rowCenter}>
                      <AlertTriangle size={10} color="#F59E0B" />
                      <Text style={[mcStyles.warningText, { opacity: 0.8 }]}>{warning}</Text>
                    </View>
                  ))}
                </View>
              )}

              {showConfidenceDetails && confidenceDetails && (
                <Animated.View entering={FadeInUp.duration(200)} style={[mcStyles.confidencePanel, { marginBottom: spacing['2'] }]}>
                  <Text style={mcStyles.confidenceTitle}>Confidence Breakdown</Text>
                  {Object.entries(confidenceDetails.factors).map(([key, value]) => (
                    <View key={key} style={[mcStyles.factorRow, { marginBottom: spacing['1'] }]}>
                      <Text style={mcStyles.factorLabel}>
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </Text>
                      <Text style={[mcStyles.factorValue, { color: getConfidenceColor(value) }]}>
                        {value}%
                      </Text>
                    </View>
                  ))}
                </Animated.View>
              )}

              <TextInput
                ref={draftInputRef}
                value={editedDraft}
                onChangeText={setEditedDraft}
                multiline
                scrollEnabled={true}
                style={mcStyles.editDraftInput}
                placeholderTextColor={colors.text.disabled}
                placeholder="Edit the suggestion..."
                selectionColor="#A855F7"
                textAlignVertical="top"
                editable={true}
              />

              <View style={mcStyles.actionRow}>
                <Pressable
                  onPress={handleSaveEdit}
                  style={({ pressed }) => [mcStyles.actionBtn, { backgroundColor: '#A855F7', opacity: pressed ? 0.8 : 1 }]}
                >
                  <Send size={14} color="#FFFFFF" />
                  <Text style={mcStyles.actionBtnText}>Send</Text>
                </Pressable>

                <Pressable
                  onPress={handleClearSuggestion}
                  style={({ pressed }) => [mcStyles.secondaryBtn, { backgroundColor: `${colors.bg.hover}B3`, opacity: pressed ? 0.8 : 1 }]}
                >
                  <Trash2 size={14} color={colors.danger.DEFAULT} />
                  <Text style={[mcStyles.secondaryBtnText, { color: colors.danger.DEFAULT }]}>Clear</Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowRegenerateOptions(!showRegenerateOptions)}
                  style={({ pressed }) => [mcStyles.secondaryBtn, { opacity: pressed ? 0.8 : 1 }]}
                >
                  <RefreshCw size={14} color={colors.text.muted} />
                  <Text style={mcStyles.secondaryBtnText}>Regenerate</Text>
                  <ChevronDown size={12} color={colors.text.disabled} style={{ marginLeft: 2 }} />
                </Pressable>

                {onOpenActionsSheet && (
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenActionsSheet(); }}
                    onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onOpenActionsSheet(); }}
                    style={({ pressed }) => [mcStyles.actionBtn, { backgroundColor: 'rgba(99,102,241,0.2)', opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
                  >
                    <MoreHorizontal size={14} color="#6366F1" />
                    <Text style={[mcStyles.actionBtnText, { color: '#818CF8' }]}>More</Text>
                  </Pressable>
                )}
              </View>

              {showRegenerateOptions && (
                <Animated.View entering={FadeInUp.duration(200)} style={mcStyles.regenRow}>
                  {[
                    { id: 'empathy', label: 'More Empathy', modifier: 'empathy' as const },
                    { id: 'shorter', label: 'Shorter', modifier: 'shorter' as const },
                    { id: 'longer', label: 'Detailed', modifier: 'longer' as const },
                    { id: 'formal', label: 'Formal', modifier: 'formal' as const },
                    { id: 'casual', label: 'Casual', modifier: 'casual' as const },
                  ].map((option) => {
                    const config = regenerationConfig[option.modifier];
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => handleRegenerate(option.modifier)}
                        style={({ pressed }) => [mcStyles.regenBtn, { backgroundColor: config?.bgColor || colors.bg.hover, opacity: pressed ? 0.8 : 1 }]}
                      >
                        {config?.icon}
                        <Text style={[mcStyles.regenLabel, { color: config?.color || colors.text.muted }]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </Animated.View>
              )}

              {aiDraft && (
                <Pressable
                  onPress={() => setShowReasoning(!showReasoning)}
                  style={({ pressed }) => [mcStyles.reasoningToggle, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Sparkles size={10} color={colors.text.disabled} />
                  <Text style={mcStyles.reasoningLabel}>
                    {showReasoning ? 'Hide reasoning' : 'Show reasoning'}
                  </Text>
                  <ChevronDown size={10} color={colors.text.disabled} style={{ marginLeft: 2, transform: [{ rotate: showReasoning ? '180deg' : '0deg' }] }} />
                </Pressable>
              )}
              {aiDraft && showReasoning && (
                <AIReasoningSection
                  response={{
                    content: aiDraft.content,
                    sentiment: aiDraft.sentiment || { primary: 'neutral', intensity: 50, emotions: [], requiresEscalation: false },
                    topics: [],
                    confidence: aiDraft.confidenceDetails || {
                      overall: aiDraft.confidence,
                      factors: { sentimentMatch: 80, knowledgeAvailable: 70, topicCoverage: 85, styleMatch: 75, safetyCheck: 90 },
                      warnings: [],
                      blockedForAutoSend: false,
                    },
                    actionItems: aiDraft.actionItems || [],
                    knowledgeConflicts: aiDraft.knowledgeConflicts || [],
                    detectedLanguage: 'en',
                    regenerationOptions: aiDraft.regenerationOptions || [],
                    historicalMatches: aiDraft.historicalMatches,
                  }}
                  onFixConflict={onFixConflict ? (_conflict, field, newValue) => {
                    onFixConflict(field, newValue);
                  } : undefined}
                />
              )}
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {/* Edit Draft Mode - Auto-pilot mode */}
      {isEditingDraft && autoPilotEnabled && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={{ backgroundColor: colors.bg.card }}
        >
          <ScrollView
            keyboardShouldPersistTaps="always"
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={mcStyles.panelInner}>
              <View style={mcStyles.headerSpaceBetween}>
                <View style={mcStyles.rowCenter}>
                  <Edit3 size={14} color={colors.accent.DEFAULT} />
                  <Text style={[mcStyles.accentLabel, { fontFamily: typography.fontFamily.medium }]}>
                    Editing AI Draft
                  </Text>
                </View>
                <Pressable
                  onPress={handleClearSuggestion}
                  style={({ pressed }) => [{ padding: spacing['1.5'] }, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <X size={16} color={colors.text.disabled} />
                </Pressable>
              </View>
              <TextInput
                ref={draftInputRef}
                value={editedDraft}
                onChangeText={setEditedDraft}
                multiline
                scrollEnabled={true}
                style={mcStyles.editDraftInputAlt}
                placeholderTextColor={colors.text.disabled}
                autoFocus
                textAlignVertical="top"
                selectionColor={colors.accent.DEFAULT}
                editable={true}
              />
              <View style={mcStyles.actionRow}>
                <Pressable
                  onPress={handleSaveEdit}
                  style={({ pressed }) => [mcStyles.actionBtn, { backgroundColor: colors.accent.DEFAULT, opacity: pressed ? 0.8 : 1 }]}
                >
                  <Check size={14} color="#FFFFFF" />
                  <Text style={mcStyles.actionBtnText}>Save & Send</Text>
                </Pressable>

                <Pressable
                  onPress={handleClearSuggestion}
                  style={({ pressed }) => [mcStyles.secondaryBtn, { backgroundColor: `${colors.bg.hover}B3`, opacity: pressed ? 0.8 : 1 }]}
                >
                  <Trash2 size={14} color={colors.danger.DEFAULT} />
                  <Text style={[mcStyles.secondaryBtnText, { color: colors.danger.DEFAULT }]}>Clear</Text>
                </Pressable>

                <Pressable
                  onPress={handleCancelEdit}
                  style={({ pressed }) => [mcStyles.secondaryBtn, { opacity: pressed ? 0.8 : 1 }]}
                >
                  <Text style={mcStyles.secondaryBtnText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      )}



      {/* Message Input */}
      {!isEditingDraft && (
        <View style={{ flexDirection: 'column', width: '100%' }}>
          {aiDraft && (
            <View style={mcStyles.ownReplyHint}>
              <Edit3 size={12} color={colors.text.muted} />
              <Text style={mcStyles.ownReplyHintText}>
                Write your own reply (AI will learn from this)
              </Text>
            </View>
          )}
        <View style={mcStyles.inputRow}>
          {onAttachMedia && (
            <Pressable
              onPress={onAttachMedia}
              style={({ pressed }) => [mcStyles.attachBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Paperclip size={18} color={colors.text.disabled} />
            </Pressable>
          )}

          <ModelPicker compact />

          <View style={mcStyles.inputContainer}>
            <TextInput
              value={message}
              onChangeText={handleMessageChange}
              placeholder={isGenerating ? "Generating suggestion..." : "Type a message..."}
              placeholderTextColor={colors.text.disabled}
              style={mcStyles.textInput}
              multiline
              editable={!disabled && !isGenerating}
            />
            {privacyScanResult?.hasIssues && !showPrivacyAlert && (
              <PrivacyIndicator
                riskScore={privacyScanResult.riskScore}
                issueCount={privacyScanResult.totalMatches}
                onPress={() => setShowPrivacyAlert(true)}
              />
            )}
          </View>
          <Pressable
            onPress={handleSend}
            disabled={!message.trim() || disabled || isGenerating}
            style={({ pressed }) => [mcStyles.sendBtn, { backgroundColor: message.trim() && !isGenerating ? colors.accent.DEFAULT : colors.bg.hover, opacity: pressed ? 0.8 : 1 }]}
          >
            <Send
              size={20}
              color={message.trim() && !isGenerating ? '#FFFFFF' : colors.text.disabled}
              style={{ marginLeft: 2 }}
            />
          </Pressable>
        </View>
        </View>
      )}
    </View>
  );
}

const mcStyles = StyleSheet.create({
  root: {
    backgroundColor: colors.bg.base,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  draftPanel: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  tealPanel: {
    backgroundColor: `${colors.primary.DEFAULT}10`,
  },
  purplePanel: {
    backgroundColor: 'rgba(168,85,247,0.08)',
  },
  panelInner: {
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
  },
  rowCenter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  headerSpaceBetween: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: spacing['2'],
  },
  tealLabel: {
    color: colors.primary.DEFAULT,
    fontSize: 14,
    marginLeft: spacing['1.5'],
  },
  purpleLabel: {
    color: '#A855F7',
    fontSize: 14,
    marginLeft: spacing['1.5'],
  },
  accentLabel: {
    color: colors.accent.DEFAULT,
    fontSize: 14,
    marginLeft: spacing['1.5'],
  },
  confidenceBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: `${colors.bg.hover}80`,
    paddingHorizontal: spacing['2'],
    paddingVertical: spacing['0.5'],
    borderRadius: radius.full,
    marginLeft: spacing['2'],
  },
  sentimentBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing['2'],
    paddingVertical: spacing['0.5'],
    borderRadius: radius.full,
    marginLeft: spacing['1.5'],
  },
  badgeText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
  },
  warningRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    marginBottom: spacing['1'],
  },
  warningText: {
    color: '#F59E0B',
    fontSize: 12,
    marginLeft: spacing['1'],
    flex: 1,
  },
  blockedBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: `${colors.danger.DEFAULT}20`,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['2'],
    borderRadius: radius.lg,
    marginBottom: spacing['2'],
  },
  blockedText: {
    color: colors.danger.DEFAULT,
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    marginLeft: spacing['1.5'],
  },
  confidencePanel: {
    backgroundColor: `${colors.bg.card}80`,
    borderRadius: radius.xl,
    padding: spacing['3'],
    marginBottom: spacing['2'],
  },
  confidenceTitle: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing['2'],
  },
  factorRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: spacing['1.5'],
  },
  factorLabel: {
    color: colors.text.muted,
    fontSize: 12,
    textTransform: 'capitalize' as const,
    flex: 1,
  },
  progressTrack: {
    width: 60,
    height: 4,
    backgroundColor: colors.bg.hover,
    borderRadius: radius.full,
    overflow: 'hidden' as const,
    marginRight: spacing['2'],
  },
  progressFill: {
    height: '100%' as any,
    borderRadius: radius.full,
  },
  factorValue: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    width: 32,
    textAlign: 'right' as const,
  },
  draftContent: {
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing['3'],
  },
  actionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
  },
  actionBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['2'],
    borderRadius: radius.full,
    marginRight: spacing['2'],
    marginBottom: spacing['1'],
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontFamily: typography.fontFamily.semibold,
    marginLeft: spacing['1.5'],
    fontSize: 14,
  },
  secondaryBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.bg.hover,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['2'],
    borderRadius: radius.full,
    marginRight: spacing['2'],
    marginBottom: spacing['1'],
  },
  secondaryBtnText: {
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.medium,
    marginLeft: spacing['1.5'],
    fontSize: 14,
  },
  iconBtn: {
    padding: spacing['2'],
    borderRadius: radius.full,
    backgroundColor: colors.bg.hover,
    marginRight: spacing['1'],
    marginBottom: spacing['1'],
  },
  regenRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing['2'],
    marginTop: spacing['2'],
  },
  regenBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['1.5'],
    borderRadius: radius.full,
  },
  regenLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    marginLeft: spacing['1'],
  },
  reasoningToggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: spacing['2'],
    padding: spacing['1'],
  },
  reasoningLabel: {
    color: colors.text.disabled,
    fontSize: 12,
    marginLeft: spacing['1'],
  },
  editDraftInput: {
    backgroundColor: `${colors.bg.card}80`,
    color: colors.text.primary,
    borderRadius: radius.xl,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    minHeight: 80,
    maxHeight: 200,
    fontSize: 14,
    marginBottom: spacing['3'],
    borderWidth: 1,
    borderColor: `${colors.primary.DEFAULT}30`,
  },
  editDraftInputAlt: {
    backgroundColor: colors.bg.hover,
    color: colors.text.primary,
    borderRadius: radius.xl,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    minHeight: 80,
    maxHeight: 200,
    fontSize: 14,
    marginBottom: spacing['3'],
  },
  ownReplyHint: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: spacing['2'],
    paddingHorizontal: spacing['4'],
    paddingTop: spacing['2'],
  },
  ownReplyHintText: {
    color: colors.text.muted,
    fontSize: 12,
    marginLeft: spacing['1.5'],
  },
  inputRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.bg.card,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: spacing['2'],
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    backgroundColor: colors.bg.card,
    borderRadius: radius['2xl'],
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['2'],
    marginRight: spacing['2'],
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    color: colors.text.primary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});
