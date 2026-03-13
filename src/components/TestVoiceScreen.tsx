import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, ChevronDown, Mic, Send, CheckCircle2,
  XCircle, Sparkles, MessageSquare, RotateCcw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppStore, type Property, type Conversation, type Message } from '@/lib/store';
import { generateEnhancedAIResponse, learnFromSentMessage, type EnhancedAIResponse } from '@/lib/ai-enhanced';
import { colors, typography, spacing, radius } from '@/lib/design-tokens';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ──────────────────────────────────────────

interface TestVoiceScreenProps {
  onBack: () => void;
}

type SandboxPhase = 'input' | 'generating' | 'draft_ready' | 'comparing' | 'comparison_done';

interface ComparisonResult {
  matchPercent: number;
  greeting: boolean;
  tone: boolean;
  signOff: boolean;
  length: boolean;
  emoji: boolean;
}

interface SandboxEntry {
  id: string;
  guestMessage: string;
  aiDraft: string;
  aiConfidence: number;
  userResponse?: string;
  comparison?: ComparisonResult;
  saveAsTraining: boolean;
}

// ── Quick Scenario Chips ───────────────────────────

const QUICK_SCENARIOS = [
  { label: 'Check-in', message: 'Hi! What time can we check in tomorrow?' },
  { label: 'WiFi', message: "What's the WiFi password?" },
  { label: 'Early arrival', message: 'Is it possible to arrive a couple hours early?' },
  { label: 'Complaint', message: "The air conditioning isn't working and it's really hot." },
  { label: 'Parking', message: 'Where should we park when we arrive?' },
  { label: 'House rules', message: 'Are pets allowed at the property?' },
];

// ── Daily Limit ────────────────────────────────────

const DAILY_SANDBOX_LIMIT = 10;
const SANDBOX_COUNT_KEY = 'rv_sandbox_count';

async function getSandboxUsageToday(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(SANDBOX_COUNT_KEY);
    if (!raw) return 0;
    const { count, date } = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    return date === today ? count : 0;
  } catch { return 0; }
}

async function incrementSandboxUsage(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const current = await getSandboxUsageToday();
  const next = current + 1;
  await AsyncStorage.setItem(SANDBOX_COUNT_KEY, JSON.stringify({ count: next, date: today }));
  return next;
}

// ── Voice Comparison (client-side) ─────────────────

function compareVoice(aiDraft: string, userResponse: string): ComparisonResult {
  const ai = aiDraft.trim();
  const user = userResponse.trim();

  // Greeting detection: starts with Hi/Hey/Hello/Good morning etc.
  const greetingPattern = /^(hi|hey|hello|good\s+(morning|afternoon|evening)|welcome|greetings)/i;
  const aiHasGreeting = greetingPattern.test(ai);
  const userHasGreeting = greetingPattern.test(user);
  const greeting = aiHasGreeting === userHasGreeting;

  // Sign-off detection: ends with Thanks/Best/Cheers etc.
  const signOffPattern = /(thanks|thank you|best|cheers|regards|take care|see you|looking forward|warm regards|sincerely)[!.\s]*$/i;
  const aiHasSignOff = signOffPattern.test(ai);
  const userHasSignOff = signOffPattern.test(user);
  const signOff = aiHasSignOff === userHasSignOff;

  // Emoji detection
  const emojiPattern = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  const aiEmojis = (ai.match(emojiPattern) || []).length;
  const userEmojis = (user.match(emojiPattern) || []).length;
  const emoji = (aiEmojis > 0) === (userEmojis > 0);

  // Length similarity (within 40% is a match)
  const aiLen = ai.length;
  const userLen = user.length;
  const lengthRatio = Math.min(aiLen, userLen) / Math.max(aiLen, userLen);
  const length = lengthRatio >= 0.6;

  // Tone: simple warmth check (exclamation marks, casual words)
  const warmthWords = /(!|\bawesome\b|\bgreat\b|\blove\b|\bwonderful\b|\bamazing\b|\bhappy\b|\bglad\b|\bsure\b|\babsolutely\b)/gi;
  const aiWarmth = (ai.match(warmthWords) || []).length;
  const userWarmth = (user.match(warmthWords) || []).length;
  const tone = Math.abs(aiWarmth - userWarmth) <= 2;

  // Overall match
  const checks = [greeting, tone, signOff, length, emoji];
  const passed = checks.filter(Boolean).length;
  const matchPercent = Math.round((passed / checks.length) * 100);

  return { matchPercent, greeting, tone, signOff, length, emoji };
}

// ── Synthetic Conversation Builder ─────────────────

function buildSyntheticConversation(
  guestMessage: string,
  property: Property,
): Conversation {
  const now = new Date();
  const guestMsg: Message = {
    id: `sandbox-guest-${Date.now()}`,
    conversationId: `sandbox-conv-${Date.now()}`,
    content: guestMessage,
    sender: 'guest',
    timestamp: now,
    isRead: true,
  };

  return {
    id: `sandbox-conv-${Date.now()}`,
    guest: {
      id: `sandbox-guest`,
      name: 'Test Guest',
    },
    property: {
      id: property.id,
      name: property.name,
      address: property.address,
    },
    messages: [guestMsg],
    lastMessage: guestMsg,
    unreadCount: 0,
    status: 'active',
    platform: 'direct',
    hasAiDraft: false,
  };
}

// ── Main Component ─────────────────────────────────

export function TestVoiceScreen({ onBack }: TestVoiceScreenProps) {
  const properties = useAppStore((s) => s.properties);
  const propertyKnowledge = useAppStore((s) => s.propertyKnowledge);
  const hostStyleProfiles = useAppStore((s) => s.hostStyleProfiles);

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    properties.length > 0 ? properties[0].id : null,
  );
  const [phase, setPhase] = useState<SandboxPhase>('input');
  const [guestInput, setGuestInput] = useState('');
  const [userResponseInput, setUserResponseInput] = useState('');
  const [currentEntry, setCurrentEntry] = useState<SandboxEntry | null>(null);
  const [usageToday, setUsageToday] = useState(0);
  const [saveAsTraining, setSaveAsTraining] = useState(true);

  const scrollRef = useRef<ScrollView>(null);
  const userInputRef = useRef<TextInput>(null);

  // Load usage on mount
  useEffect(() => {
    getSandboxUsageToday().then(setUsageToday);
  }, []);

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId) || properties[0];
  const knowledge = selectedProperty ? propertyKnowledge[selectedProperty.id] : undefined;
  const remainingTests = Math.max(0, DAILY_SANDBOX_LIMIT - usageToday);

  // ── Generate AI Draft ──

  const handleSendGuestMessage = useCallback(async (message: string) => {
    if (!message.trim() || !selectedProperty) return;
    if (remainingTests <= 0) {
      Alert.alert('Daily Limit Reached', `You've used all ${DAILY_SANDBOX_LIMIT} sandbox tests for today. Try again tomorrow!`);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('generating');
    setGuestInput('');

    const syntheticConv = buildSyntheticConversation(message, selectedProperty);

    // Find host style profile for this property
    const profileKey = Object.keys(hostStyleProfiles || {}).find(
      (k) => k.includes(selectedProperty.id) || k === 'default',
    ) || Object.keys(hostStyleProfiles || {})[0];
    const hostProfile = profileKey ? hostStyleProfiles?.[profileKey] : undefined;

    try {
      const response: EnhancedAIResponse = await generateEnhancedAIResponse({
        conversation: syntheticConv,
        propertyKnowledge: knowledge,
        hostStyleProfile: hostProfile,
      });

      const entry: SandboxEntry = {
        id: `sandbox-${Date.now()}`,
        guestMessage: message,
        aiDraft: response.content,
        aiConfidence: response.confidence?.overall ?? 0,
        saveAsTraining: true,
      };

      setCurrentEntry(entry);
      setPhase('draft_ready');

      const newCount = await incrementSandboxUsage();
      setUsageToday(newCount);

      // Scroll to bottom after a tick
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (error) {
      console.error('[TestVoice] Draft generation failed:', error);
      Alert.alert('Error', 'Failed to generate AI draft. Please try again.');
      setPhase('input');
    }
  }, [selectedProperty, knowledge, hostStyleProfiles, remainingTests]);

  // ── Compare Responses ──

  const handleCompare = useCallback(() => {
    if (!userResponseInput.trim() || !currentEntry) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const comparison = compareVoice(currentEntry.aiDraft, userResponseInput.trim());

    setCurrentEntry({
      ...currentEntry,
      userResponse: userResponseInput.trim(),
      comparison,
      saveAsTraining,
    });
    setPhase('comparison_done');
    setUserResponseInput('');

    // Save as training example if opted in
    if (saveAsTraining) {
      saveSandboxTrainingExample(userResponseInput.trim(), currentEntry.guestMessage);
    }

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
  }, [userResponseInput, currentEntry, saveAsTraining]);

  // ── Save Training Example ──

  const saveSandboxTrainingExample = useCallback(async (hostResponse: string, guestMessage: string) => {
    try {
      // Save to store for persistence
      const addLearningEntry = useAppStore.getState().addLearningEntry;
      if (addLearningEntry) {
        addLearningEntry({
          id: `sandbox-training-${Date.now()}`,
          originalResponse: hostResponse,
          wasApproved: false,
          wasEdited: false,
          guestIntent: guestMessage.slice(0, 100),
          propertyId: selectedPropertyId || '',
          timestamp: new Date(),
          originType: 'host_written',
        });
      }

      // CRITICAL: Also feed into the actual learning pipeline (few-shot indexer + incremental trainer)
      // Without this, Test My Voice examples are stored but never used for draft generation
      await learnFromSentMessage(
        hostResponse,
        guestMessage,
        selectedPropertyId || undefined,
        false,  // wasEdited
        true,   // wasApproved
        'host_written'
      );
      console.log('[TestVoice] Saved training example to store AND few-shot indexer');
    } catch (error) {
      console.error('[TestVoice] Failed to save training example:', error);
    }
  }, [selectedPropertyId]);

  // ── Reset for New Test ──

  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentEntry(null);
    setPhase('input');
    setUserResponseInput('');
    setSaveAsTraining(true);
  }, []);

  // ── Render Helpers ──

  const renderCheckItem = (label: string, passed: boolean) => (
    <View style={styles.checkItem} key={label}>
      {passed ? (
        <CheckCircle2 size={16} color={colors.success?.DEFAULT || '#22C55E'} />
      ) : (
        <XCircle size={16} color={colors.danger?.DEFAULT || '#EF4444'} />
      )}
      <Text style={[styles.checkLabel, !passed && styles.checkLabelFail]}>{label}</Text>
    </View>
  );

  // ── Main Render ──

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backButton}>
          <ArrowLeft size={22} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Test My Voice</Text>
        <View style={styles.headerRight}>
          <Text style={styles.usageBadge}>{remainingTests}/{DAILY_SANDBOX_LIMIT}</Text>
        </View>
      </View>

      {/* Property Selector */}
      {properties.length > 1 && (
        <Pressable
          style={styles.propertyPill}
          onPress={() => {
            // Cycle through properties for now (simple)
            const currentIdx = properties.findIndex((p) => p.id === selectedPropertyId);
            const nextIdx = (currentIdx + 1) % properties.length;
            setSelectedPropertyId(properties[nextIdx].id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Text style={styles.propertyPillText} numberOfLines={1}>
            {selectedProperty?.name || 'Select Property'}
          </Text>
          <ChevronDown size={14} color={colors.text.secondary} />
        </Pressable>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Chat Area */}
        <ScrollView
          ref={scrollRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Empty State */}
          {phase === 'input' && !currentEntry && (
            <View style={styles.emptyState}>
              <Mic size={40} color={colors.primary.DEFAULT} />
              <Text style={styles.emptyTitle}>Test Your AI Voice</Text>
              <Text style={styles.emptySubtitle}>
                Type a guest message below to see how your AI would respond.
                Then compare it to what you'd actually say.
              </Text>
            </View>
          )}

          {/* Guest Message Bubble */}
          {currentEntry && (
            <View style={styles.guestBubbleRow}>
              <View style={styles.guestBubble}>
                <Text style={styles.guestLabel}>Guest</Text>
                <Text style={styles.guestText}>{currentEntry.guestMessage}</Text>
              </View>
            </View>
          )}

          {/* Generating Indicator */}
          {phase === 'generating' && (
            <View style={styles.generatingRow}>
              <View style={styles.generatingCard}>
                <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
                <Text style={styles.generatingText}>Generating AI draft...</Text>
              </View>
            </View>
          )}

          {/* AI Draft Card */}
          {currentEntry && (phase === 'draft_ready' || phase === 'comparing' || phase === 'comparison_done') && (
            <View style={styles.draftRow}>
              <View style={styles.draftCard}>
                <View style={styles.draftHeader}>
                  <Sparkles size={14} color={colors.primary.DEFAULT} />
                  <Text style={styles.draftHeaderText}>AI Draft</Text>
                  <View style={styles.confidenceBadge}>
                    <Text style={styles.confidenceText}>
                      {Math.round(currentEntry.aiConfidence * 100)}%
                    </Text>
                  </View>
                </View>
                <Text style={styles.draftText}>{currentEntry.aiDraft}</Text>
              </View>
            </View>
          )}

          {/* "How would you reply?" prompt */}
          {phase === 'draft_ready' && (
            <View style={styles.promptRow}>
              <Text style={styles.promptText}>How would you actually reply?</Text>
              <View style={styles.userInputContainer}>
                <TextInput
                  ref={userInputRef}
                  style={styles.userInput}
                  placeholder="Type your real response..."
                  placeholderTextColor={colors.text.muted}
                  value={userResponseInput}
                  onChangeText={setUserResponseInput}
                  multiline
                  textAlignVertical="top"
                />
                <Pressable
                  style={[styles.compareButton, !userResponseInput.trim() && styles.compareButtonDisabled]}
                  onPress={handleCompare}
                  disabled={!userResponseInput.trim()}
                >
                  <Text style={styles.compareButtonText}>Compare</Text>
                </Pressable>
              </View>

              {/* Save toggle */}
              <Pressable
                style={styles.saveToggle}
                onPress={() => setSaveAsTraining(!saveAsTraining)}
              >
                <View style={[styles.checkbox, saveAsTraining && styles.checkboxChecked]}>
                  {saveAsTraining && <CheckCircle2 size={14} color="#FFF" />}
                </View>
                <Text style={styles.saveToggleText}>Save as training example</Text>
              </Pressable>
            </View>
          )}

          {/* User Response Bubble */}
          {currentEntry?.userResponse && (
            <View style={styles.userBubbleRow}>
              <View style={styles.userBubble}>
                <Text style={styles.userBubbleLabel}>Your Response</Text>
                <Text style={styles.userBubbleText}>{currentEntry.userResponse}</Text>
              </View>
            </View>
          )}

          {/* Comparison Card */}
          {currentEntry?.comparison && phase === 'comparison_done' && (
            <View style={styles.comparisonCard}>
              <Text style={styles.comparisonTitle}>Voice Match</Text>

              {/* Match percentage bar */}
              <View style={styles.matchBarContainer}>
                <View style={styles.matchBarBg}>
                  <View
                    style={[
                      styles.matchBarFill,
                      { width: `${currentEntry.comparison.matchPercent}%` },
                      currentEntry.comparison.matchPercent >= 80 && styles.matchBarGood,
                      currentEntry.comparison.matchPercent >= 60 && currentEntry.comparison.matchPercent < 80 && styles.matchBarOk,
                      currentEntry.comparison.matchPercent < 60 && styles.matchBarLow,
                    ]}
                  />
                </View>
                <Text style={styles.matchPercent}>{currentEntry.comparison.matchPercent}%</Text>
              </View>

              {/* Checklist */}
              <View style={styles.checkList}>
                {renderCheckItem('Greeting', currentEntry.comparison.greeting)}
                {renderCheckItem('Tone', currentEntry.comparison.tone)}
                {renderCheckItem('Sign-off', currentEntry.comparison.signOff)}
                {renderCheckItem('Length', currentEntry.comparison.length)}
                {renderCheckItem('Emoji use', currentEntry.comparison.emoji)}
              </View>

              {saveAsTraining && (
                <View style={styles.savedIndicator}>
                  <CheckCircle2 size={12} color={colors.primary.DEFAULT} />
                  <Text style={styles.savedText}>Saved as training example</Text>
                </View>
              )}

              {/* Try Again */}
              <Pressable style={styles.tryAgainButton} onPress={handleReset}>
                <RotateCcw size={16} color={colors.primary.DEFAULT} />
                <Text style={styles.tryAgainText}>Try Another</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        {/* Bottom Composer */}
        {(phase === 'input' || phase === 'comparison_done') && (
          <View style={styles.composerContainer}>
            {/* Quick Scenario Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={styles.chipContent}
            >
              {QUICK_SCENARIOS.map((scenario) => (
                <Pressable
                  key={scenario.label}
                  style={styles.chip}
                  onPress={() => {
                    handleReset();
                    handleSendGuestMessage(scenario.message);
                  }}
                >
                  <Text style={styles.chipText}>{scenario.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Text Input */}
            <View style={styles.composerRow}>
              <TextInput
                style={styles.composerInput}
                placeholder="Type a guest message..."
                placeholderTextColor={colors.text.muted}
                value={guestInput}
                onChangeText={setGuestInput}
                onSubmitEditing={() => handleSendGuestMessage(guestInput)}
                returnKeyType="send"
              />
              <Pressable
                style={[styles.sendButton, !guestInput.trim() && styles.sendButtonDisabled]}
                onPress={() => handleSendGuestMessage(guestInput)}
                disabled={!guestInput.trim()}
              >
                <Send size={18} color="#FFF" />
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    ...typography.styles.h3,
    flex: 1,
    marginLeft: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  usageBadge: {
    ...typography.styles.caption,
    color: colors.text.muted,
    backgroundColor: colors.bg.elevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },

  // Property pill
  propertyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.bg.elevated,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
    gap: 6,
  },
  propertyPillText: {
    ...typography.styles.bodySm,
    color: colors.text.primary,
    maxWidth: 200,
  },

  // Chat area
  chatArea: { flex: 1 },
  chatContent: {
    padding: 16,
    paddingBottom: 24,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    ...typography.styles.h2,
    color: colors.text.primary,
    marginTop: 8,
  },
  emptySubtitle: {
    ...typography.styles.body,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
  },

  // Guest bubble
  guestBubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  guestBubble: {
    backgroundColor: colors.bg.elevated,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 14,
    maxWidth: '80%',
  },
  guestLabel: {
    ...typography.styles.caption,
    color: colors.text.muted,
    marginBottom: 4,
  },
  guestText: {
    ...typography.styles.body,
    color: colors.text.primary,
  },

  // Generating state
  generatingRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  generatingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.soft || colors.primary.muted,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  generatingText: {
    ...typography.styles.bodySm,
    color: colors.primary.DEFAULT,
  },

  // AI Draft card
  draftRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  draftCard: {
    backgroundColor: colors.bg.base,
    borderRadius: 16,
    borderTopRightRadius: 4,
    padding: 14,
    maxWidth: '85%',
    borderWidth: 1.5,
    borderColor: colors.primary.DEFAULT,
  },
  draftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  draftHeaderText: {
    ...typography.styles.label,
    color: colors.primary.DEFAULT,
    flex: 1,
  },
  confidenceBadge: {
    backgroundColor: colors.primary.DEFAULT,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  confidenceText: {
    ...typography.styles.caption,
    color: '#FFF',
    fontFamily: typography.fontFamily.semibold,
  },
  draftText: {
    ...typography.styles.body,
    color: colors.text.primary,
    lineHeight: 22,
  },

  // "How would you reply?" prompt
  promptRow: {
    marginTop: 8,
    marginBottom: 12,
  },
  promptText: {
    ...typography.styles.label,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  userInputContainer: {
    backgroundColor: colors.bg.elevated,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
  },
  userInput: {
    ...typography.styles.body,
    color: colors.text.primary,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  compareButton: {
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  compareButtonDisabled: {
    opacity: 0.4,
  },
  compareButtonText: {
    ...typography.styles.label,
    color: '#FFF',
  },

  // Save toggle
  saveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary.DEFAULT,
    borderColor: colors.primary.DEFAULT,
  },
  saveToggleText: {
    ...typography.styles.bodySm,
    color: colors.text.secondary,
  },

  // User response bubble
  userBubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  userBubble: {
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 16,
    borderTopRightRadius: 4,
    padding: 14,
    maxWidth: '80%',
  },
  userBubbleLabel: {
    ...typography.styles.caption,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  userBubbleText: {
    ...typography.styles.body,
    color: '#FFF',
  },

  // Comparison card
  comparisonCard: {
    backgroundColor: colors.bg.elevated,
    borderRadius: 16,
    padding: 20,
    marginTop: 4,
  },
  comparisonTitle: {
    ...typography.styles.h3,
    color: colors.text.primary,
    marginBottom: 12,
  },
  matchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  matchBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border.subtle,
    borderRadius: 4,
    overflow: 'hidden',
  },
  matchBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  matchBarGood: { backgroundColor: colors.success?.DEFAULT || '#22C55E' },
  matchBarOk: { backgroundColor: colors.warning?.DEFAULT || '#F59E0B' },
  matchBarLow: { backgroundColor: colors.danger?.DEFAULT || '#EF4444' },
  matchPercent: {
    ...typography.styles.h3,
    color: colors.text.primary,
    minWidth: 44,
    textAlign: 'right',
  },

  // Checklist
  checkList: {
    gap: 8,
    marginBottom: 16,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkLabel: {
    ...typography.styles.body,
    color: colors.text.primary,
  },
  checkLabelFail: {
    color: colors.text.secondary,
  },

  // Saved indicator
  savedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    marginBottom: 12,
  },
  savedText: {
    ...typography.styles.caption,
    color: colors.primary.DEFAULT,
  },

  // Try again
  tryAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary.DEFAULT,
  },
  tryAgainText: {
    ...typography.styles.label,
    color: colors.primary.DEFAULT,
  },

  // Bottom composer
  composerContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    backgroundColor: colors.bg.base,
    paddingBottom: 8,
  },
  chipScroll: {
    flexGrow: 0,
  },
  chipContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
    flexDirection: 'row',
  },
  chip: {
    backgroundColor: colors.bg.elevated,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  chipText: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.medium,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  composerInput: {
    flex: 1,
    ...typography.styles.body,
    backgroundColor: colors.bg.elevated,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.text.primary,
  },
  sendButton: {
    backgroundColor: colors.primary.DEFAULT,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
