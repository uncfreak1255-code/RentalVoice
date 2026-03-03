import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, StyleSheet, Keyboard, Platform } from 'react-native';
import { colors, typography, spacing, radius, elevation } from '@/lib/design-tokens';
import { PremiumPressable } from '@/components/ui';
import {
  Send,
  Sparkles,
  RefreshCw,
  Edit3,
  Check,
  X,
  Gauge,
  ChevronDown,
  Paperclip,
  Trash2,
  MoreHorizontal,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, SlideInDown } from 'react-native-reanimated';
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
  onApproveAiDraft: (contentOverride?: string) => void;
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
  onOpenActionsSheet?: () => void;
  rateLimitError?: string | null;
  onDismissRateLimitError?: () => void;
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
  rateLimitError,
  onDismissRateLimitError,
}: MessageComposerProps) {
  const [message, setMessage] = useState('');

  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [editedDraft, setEditedDraft] = useState('');

  const [showReasoning, setShowReasoning] = useState(false);
  const [privacyScanResult, setPrivacyScanResult] = useState<ScanResult | null>(null);
  const [showPrivacyAlert, setShowPrivacyAlert] = useState(true);
  const [isDraftMinimized, setIsDraftMinimized] = useState(false);

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

  // Track keyboard visibility to collapse draft panel
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // When we have an AI draft, populate the editing field but don't auto-enter edit mode
  // This allows the host to use either the AI suggestion OR write their own message
  useEffect(() => {
    if (aiDraft && !editedDraft) {
      setEditedDraft(aiDraft.content);
    }
  }, [aiDraft, editedDraft]);

  // Reset when draft is dismissed
  useEffect(() => {
    if (!aiDraft) {
      setIsEditingDraft(false);
      setEditedDraft('');
      setIsDraftMinimized(false);
    } else {
      // New draft arrived — restore from minimized
      setIsDraftMinimized(false);
    }
  }, [aiDraft]);

  const handleMessageChange = (text: string) => {
    setMessage(text);
  };

  const handleClearSuggestion = () => {
    Keyboard.dismiss();
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
    Keyboard.dismiss();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onApproveAiDraft();
  };

  const handleEdit = () => {
    Keyboard.dismiss();
    setEditedDraft(aiDraft?.content || '');
    setIsEditingDraft(true);
  };

  const handleSaveEdit = () => {
    if (editedDraft.trim()) {
      Keyboard.dismiss();
      const contentToSend = editedDraft.trim();
      // Pass the edited content directly to approve — bypasses stale state
      // No need for onEditAiDraft or setTimeout workarounds
      setIsEditingDraft(false);
      onApproveAiDraft(contentToSend);
    }
  };

  const handleCancelEdit = () => {
    Keyboard.dismiss();
    setIsEditingDraft(false);
    setEditedDraft('');
  };





  const confidenceDetails = aiDraft?.confidenceDetails;
  const sentiment = aiDraft?.sentiment;

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

      {/* Rate Limit Banner */}
      {rateLimitError && (
        <Animated.View
          entering={FadeInDown.duration(300)}
          exiting={FadeOut.duration(200)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.bg.elevated,
            paddingHorizontal: spacing['4'],
            paddingVertical: spacing['3'],
            gap: spacing['3'],
            borderBottomWidth: 1,
            borderBottomColor: colors.border.subtle,
          }}
        >
          <View style={{
            width: 32,
            height: 32,
            borderRadius: radius.full,
            backgroundColor: colors.warning.muted,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 14 }}>⚡</Text>
          </View>
          <Text style={{
            flex: 1,
            fontSize: 13,
            lineHeight: 18,
            color: colors.text.secondary,
            fontFamily: typography.fontFamily.medium,
          }}>
            {rateLimitError}
          </Text>
          <Pressable
            onPress={onDismissRateLimitError}
            hitSlop={12}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Dismiss rate limit warning"
            style={{
              paddingHorizontal: spacing['3'],
              paddingVertical: spacing['1'],
              borderRadius: radius.md,
              backgroundColor: colors.primary.muted,
            }}
          >
            <Text style={{
              fontSize: 12,
              color: colors.primary.DEFAULT,
              fontFamily: typography.fontFamily.semibold,
            }}>OK</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* AI Draft Preview — V2 Premium Mockup */}
      {(aiDraft || isGenerating) && !isEditingDraft && !isDraftMinimized && (
        <Animated.View
          entering={SlideInDown.duration(300)}
          exiting={FadeOut.duration(200)}
          style={[mcStyles.v2GlassPanel, { maxHeight: isKeyboardVisible && !isEditingDraft ? 100 : 280 }]}
        >
          <ScrollView
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
          {isGenerating ? (
            <View style={mcStyles.rowCenter}>
              <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
              <Text style={mcStyles.tealLabel}>Drafting a response...</Text>
            </View>
          ) : (
            <>
              {/* 1. Header Row — "AI Draft Ready" + confidence + sentiment */}
              <View style={mcStyles.v2HeaderRow}>
                <View style={mcStyles.rowCenter}>
                  <Sparkles size={18} color={colors.primary.DEFAULT} />
                  <Text style={mcStyles.v2HeaderTitle}>AI Draft Ready</Text>
                </View>
                <View style={mcStyles.rowCenter}>
                  <Gauge size={14} color={colors.primary.light} />
                  <Text style={mcStyles.v2ConfidenceText}>{aiDraft?.confidence}%</Text>
                  {sentiment && (
                    <View style={mcStyles.v2SentimentBadge}>
                      <Text style={mcStyles.v2SentimentText}>{sentiment.primary}</Text>
                    </View>
                  )}
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleClearSuggestion(); }}
                    hitSlop={12}
                    style={{ marginLeft: 8, padding: 4 }}
                    accessibilityLabel="Dismiss AI draft"
                  >
                    <X size={16} color={colors.text.disabled} />
                  </Pressable>
                </View>
              </View>

              {/* 2. Draft Text Card — white card, pure black text, subtle teal border */}
              <View style={mcStyles.v2DraftCard}>
                <Text style={mcStyles.v2DraftText}>
                  {aiDraft?.content}
                </Text>
              </View>

              {/* 3. Action Row — Big Send + icon buttons */}
              <View style={mcStyles.v2ActionRow}>
                <Pressable
                  onPress={handleApprove}
                  disabled={isBlocked}
                  style={mcStyles.v2SendBtn}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel="Send AI draft to guest"
                  accessibilityState={{ disabled: !!isBlocked }}
                >
                  <Send size={16} color="#FFFFFF" />
                  <Text style={mcStyles.v2SendBtnText}>Send Draft</Text>
                </Pressable>

                <Pressable onPress={handleEdit} hitSlop={12} style={mcStyles.v2IconBtn} accessible accessibilityRole="button" accessibilityLabel="Edit AI draft">
                  <Edit3 size={20} color={colors.text.secondary} />
                </Pressable>

                <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onRegenerateAiDraft(); }} hitSlop={12} style={mcStyles.v2IconBtn} accessible accessibilityRole="button" accessibilityLabel="Regenerate AI draft">
                  <RefreshCw size={20} color={colors.text.secondary} />
                </Pressable>

                {onOpenActionsSheet && (
                  <Pressable onPress={onOpenActionsSheet} style={mcStyles.v2MoreBtn} accessible accessibilityRole="button" accessibilityLabel="More draft actions">
                    <MoreHorizontal size={20} color={colors.text.disabled} />
                  </Pressable>
                )}
              </View>

              {/* 4. Show Reasoning toggle */}
              <PremiumPressable
                hapticFeedback="light"
                onPress={() => setShowReasoning(!showReasoning)}
                style={mcStyles.v2ReasoningToggle}
              >
                <Sparkles size={14} color={colors.text.disabled} />
                <Text style={mcStyles.v2ReasoningText}>
                  {showReasoning ? 'Hide reasoning & limits' : 'Show reasoning & limits'}
                </Text>
                <ChevronDown size={14} color={colors.text.disabled} style={{ transform: [{ rotate: showReasoning ? '180deg' : '0deg' }] }} />
              </PremiumPressable>

              {showReasoning && (
                <View style={{ marginTop: spacing['2'] }}>
                  <AIReasoningSection
                    response={{
                      content: aiDraft?.content || '',
                      sentiment: aiDraft?.sentiment || { primary: 'neutral', intensity: 50, emotions: [], requiresEscalation: false },
                      topics: [],
                      confidence: aiDraft?.confidenceDetails || {
                        overall: aiDraft?.confidence || 0,
                        factors: { sentimentMatch: 80, knowledgeAvailable: 70, topicCoverage: 85, styleMatch: 75, safetyCheck: 90 },
                        warnings: [],
                        blockedForAutoSend: false,
                      },
                      actionItems: aiDraft?.actionItems || [],
                      knowledgeConflicts: aiDraft?.knowledgeConflicts || [],
                      detectedLanguage: 'en',
                      regenerationOptions: aiDraft?.regenerationOptions || [],
                      historicalMatches: aiDraft?.historicalMatches,
                    }}
                    onFixConflict={onFixConflict ? (_conflict, field, newValue) => {
                      onFixConflict(field, newValue);
                    } : undefined}
                  />
                </View>
              )}
            </>
          )}
          </ScrollView>
        </Animated.View>
      )}


      {/* Edit Draft Mode — visible in ALL modes */}
      {isEditingDraft && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={{ backgroundColor: colors.bg.card, flex: 0 }}
        >
          <ScrollView
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="on-drag"
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
                <PremiumPressable
                  hapticFeedback="light"
                  onPress={handleClearSuggestion}
                  style={{ padding: spacing['1.5'] }}
                >
                  <X size={16} color={colors.text.disabled} />
                </PremiumPressable>
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
            </View>
          </ScrollView>
          {/* Keyboard Done bar — only on iOS */}
          {Platform.OS === 'ios' && (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing['4'], paddingVertical: spacing['2'], backgroundColor: colors.bg.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.subtle }}>
              <Pressable onPress={() => Keyboard.dismiss()}>
                <Text style={{ fontSize: 16, fontFamily: typography.fontFamily.semibold, color: colors.accent.DEFAULT }}>Done</Text>
              </Pressable>
            </View>
          )}
          {/* Action buttons pinned outside ScrollView — always visible above keyboard */}
          <View style={mcStyles.editActionBar}>
            <PremiumPressable
              hapticFeedback="medium"
              onPress={handleSaveEdit}
            >
              <View style={[mcStyles.actionBtnActive, { backgroundColor: colors.accent.DEFAULT, flex: 0, paddingHorizontal: spacing['5'] }]}>
                <Check size={16} color="#FFFFFF" />
                <Text style={[mcStyles.actionBtnText, { fontSize: 14 }]}>Save & Send</Text>
              </View>
            </PremiumPressable>

            <PremiumPressable
              hapticFeedback="light"
              onPress={() => {
                // Clear the text but stay in edit mode so user can type from scratch
                setEditedDraft('');
                draftInputRef.current?.focus();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <View style={[mcStyles.secondaryBtn, { backgroundColor: `${colors.bg.hover}B3` }]}>
                <Trash2 size={14} color={colors.danger.DEFAULT} />
                <Text style={[mcStyles.secondaryBtnText, { color: colors.danger.DEFAULT }]}>Clear</Text>
              </View>
            </PremiumPressable>

            <PremiumPressable
              hapticFeedback="light"
              onPress={handleCancelEdit}
            >
              <View style={mcStyles.secondaryBtn}>
                <Text style={mcStyles.secondaryBtnText}>Cancel</Text>
              </View>
            </PremiumPressable>
          </View>
        </Animated.View>
      )}


      {/* Minimized Draft Bar — tap to restore */}
      {aiDraft && isDraftMinimized && !isEditingDraft && (
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsDraftMinimized(false); }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing['4'],
            paddingVertical: spacing['2.5'],
            backgroundColor: `${colors.primary.DEFAULT}10`,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border.subtle,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['2'] }}>
            <Sparkles size={14} color={colors.primary.DEFAULT} />
            <Text style={{ fontSize: 13, fontFamily: typography.fontFamily.medium, color: colors.primary.DEFAULT }}>
              AI Draft Ready
            </Text>
            <Text style={{ fontSize: 12, color: colors.text.muted }}>
              Tap to view
            </Text>
          </View>
          <ChevronDown size={14} color={colors.primary.DEFAULT} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
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
              <PremiumPressable
              hapticFeedback="light"
              onPress={onAttachMedia}
              style={mcStyles.attachBtn}
              accessibilityLabel="Attach media"
            >
              <Paperclip size={18} color={colors.text.disabled} />
            </PremiumPressable>
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
          <PremiumPressable
            hapticFeedback="medium"
            springReleaseConfig="bouncy"
            onPress={handleSend}
            disabled={!message.trim() || disabled || isGenerating}
            style={[mcStyles.sendBtn, { backgroundColor: message.trim() && !isGenerating ? colors.accent.DEFAULT : colors.bg.hover }]}
          >
            <Send
              size={20}
              color={message.trim() && !isGenerating ? '#FFFFFF' : colors.text.disabled}
              style={{ marginLeft: 2 }}
            />
          </PremiumPressable>
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
    paddingBottom: spacing['2'],
  },
  tealPanel: {
    backgroundColor: colors.bg.elevated,
    marginHorizontal: spacing['3'],
    marginBottom: spacing['2'],
    borderRadius: radius['2xl'],
    ...elevation.shadows.premium.md,
  },
  panelInner: {
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
  },
  messageContainer: {
    paddingVertical: spacing['2'],
    marginBottom: spacing['2'],
  },
  warningContainer: {
    backgroundColor: '#FFFBEB', // amber-50
    padding: spacing['2'],
    borderRadius: radius.md,
    marginBottom: spacing['3'],
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B', // amber-500
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
  editActionBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing['2'],
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    backgroundColor: colors.bg.card,
  },
  actionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing['2'],
  },
  actionBtnActive: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing['4'],
    paddingVertical: 12,
    borderRadius: radius.full,
    flex: 1,
    backgroundColor: colors.primary.DEFAULT,
  },
  actionBtnDisabled: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing['4'],
    paddingVertical: 12,
    borderRadius: radius.full,
    flex: 1,
    backgroundColor: colors.bg.hover,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontFamily: typography.fontFamily.bold,
    marginLeft: spacing['2'],
    fontSize: 15,
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
  },
  iconBtnAlt: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: `${colors.primary.DEFAULT}10`,
    alignItems: 'center',
    justifyContent: 'center',
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

  // ── V2 Premium AI Draft Styles (matching chat-premium-draft.html) ──
  v2GlassPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    overflow: 'hidden' as const,
  },
  v2HeaderRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  v2HeaderTitle: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    color: '#0F766E', // teal-700
    marginLeft: 8,
    letterSpacing: -0.3,
  },
  v2ConfidenceText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary.DEFAULT,
    marginLeft: 4,
  },
  v2SentimentBadge: {
    backgroundColor: '#ECFDF5', // emerald-50
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#D1FAE5', // emerald-100
    marginLeft: 8,
  },
  v2SentimentText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semibold,
    color: '#047857', // emerald-700
    textTransform: 'capitalize' as const,
  },
  v2DraftCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.15)', // teal-100/40
    shadowColor: 'rgba(20, 184, 166, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 12,
  },
  v2DraftText: {
    color: '#000000',
    fontSize: 16,
    lineHeight: 23,
    letterSpacing: -0.16,
    fontFamily: typography.fontFamily.medium,
  },
  v2ActionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 8,
    marginTop: 4,
  },
  v2SendBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
    shadowColor: colors.primary.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  v2SendBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
  },
  v2IconBtn: {
    backgroundColor: '#F1F5F9', // slate-100
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  v2MoreBtn: {
    backgroundColor: '#F8FAFC', // slate-50
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  v2ReasoningToggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingLeft: 4,
    paddingTop: 4,
    marginTop: 4,
  },
  v2ReasoningText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    color: colors.text.disabled,
  },
});
