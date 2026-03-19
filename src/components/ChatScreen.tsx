import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, Alert, FlatList, StyleSheet, TextInput, ScrollView, Keyboard, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { format } from 'date-fns';
import { useAppStore } from '@/lib/store';
import type { Message, LearningEntry } from '@/lib/store';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { ConversationSummaryDisplay } from './ConversationSummaryDisplay';
import { AIDraftActionsSheet } from './AIDraftActionsSheet';
import type BottomSheet from '@gorhom/bottom-sheet';
import { ReservationSummaryBar } from './ReservationSummaryBar';
import GuestMemoryCard from './GuestMemoryCard';
import IssueTriageCard from './IssueTriageCard';
import { GuestProfileScreen } from './GuestProfileScreen';
import { generateDemoResponse } from '@/lib/ai-service';
import {
  generateEnhancedAIResponse,
  analyzeSentimentAdvanced,
  detectTopics,
  calculateConfidence,

  getRegenerationOptions,
  learnFromSentMessage,
  type RegenerationOption,
  type EnhancedAIResponse,
  type ActionItem,
  type KnowledgeConflict,
  type HistoricalMatchInfo,
} from '@/lib/ai-enhanced';
import { sendMessage as sendHostawayMessage } from '@/lib/hostaway';
import { features } from '@/lib/config';
import {
  generateAIDraftViaServer,
  getCurrentEntitlements,
  recordDraftOutcomeViaServer,
  sendHostawayMessageViaServer,
} from '@/lib/api-client';
import { aiTrainingService } from '@/lib/ai-training-service';
import { guestMemoryManager } from '@/lib/advanced-training';
import { buildIssueHandoffDraft, triageIssueFromMessage } from '@/lib/issue-triage';
import { generateSmartReplies, type SmartReply } from '@/lib/smart-replies';
import { notifyAutoPilotSent } from '@/lib/push-notifications';
import {
  analyzeEdit,
  storeEditPattern,
  getEditSummary,
  analyzeRejection,
  storeRejectionPattern,
  getRejectionSummary,
  analyzeIndependentReply,
  storeIndependentReplyPattern,
  getIndependentReplySummary,
} from '@/lib/edit-diff-analysis';
import {
  createCalibrationEntry,
  analyzeReplyDelta,
} from '@/lib/ai-intelligence';
import {

  Phone,
  Home,
  Calendar,
  User,


  AlertTriangle,
  Brain,
  Search,
  X,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { colors, typography, spacing, radius } from '@/lib/design-tokens';

interface ChatScreenProps {
  conversationId: string;
  onBack: () => void;
  onOpenUpsells?: () => void;
}

// Enhanced AI draft with all new features
interface EnhancedAiDraft {
  content: string;
  confidence: number;
  sentiment?: EnhancedAIResponse['sentiment'];
  confidenceDetails?: EnhancedAIResponse['confidence'];
  actionItems?: ActionItem[];
  regenerationOptions?: RegenerationOption[];
  topics?: EnhancedAIResponse['topics'];
  historicalMatches?: HistoricalMatchInfo;
  knowledgeConflicts?: KnowledgeConflict[];
  isEdited?: boolean;
  originalContent?: string;
}

// ── Smart Reply Bar Component ──
function SmartReplyBar({ guestMessage, propertyKnowledge, onSelect }: {
  guestMessage: string;
  propertyKnowledge?: any;
  onSelect: (reply: SmartReply) => void;
}) {
  const replies = useMemo(() => generateSmartReplies(guestMessage, propertyKnowledge), [guestMessage, propertyKnowledge]);
  if (replies.length === 0) return null;

  return (
    <Animated.View entering={FadeInDown.duration(200)} style={{ paddingHorizontal: spacing['4'], paddingVertical: spacing['2'] }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {replies.map((reply) => (
          <Pressable
            key={reply.id}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(reply);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Quick reply: ${reply.label}`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: pressed ? colors.primary.DEFAULT + '20' : colors.primary.DEFAULT + '10',
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.primary.DEFAULT + '30',
            })}
          >
            <Text style={{ fontSize: 13, marginRight: 4 }}>{reply.icon}</Text>
            <Text style={{ fontSize: 13, fontFamily: typography.fontFamily.medium, color: colors.primary.DEFAULT }}>
              {reply.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

export function ChatScreen({ conversationId, onBack, onOpenUpsells }: ChatScreenProps) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Message>>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const hasScrolledToBottom = useRef(false);
  const lastGeneratedForMessageId = useRef<string | null>(null);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [rateLimitActionLabel, setRateLimitActionLabel] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showGuestInfo, setShowGuestInfo] = useState(false);
  const [currentEnhancedDraft, setCurrentEnhancedDraft] = useState<EnhancedAiDraft | null>(null);
  const [showEscalationAlert, setShowEscalationAlert] = useState(false);
  const [, setCurrentModifier] = useState<RegenerationOption['modifier'] | undefined>();
  const [editLearningSummary, setEditLearningSummary] = useState<string | null>(null);
  const [learningToastType, setLearningToastType] = useState<'approval' | 'edit' | 'independent' | 'rejection'>('edit');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showGuestProfile, setShowGuestProfile] = useState(false);

  const conversations = useAppStore((s) => s.conversations);
  const addMessage = useAppStore((s) => s.addMessage);
  const markAsRead = useAppStore((s) => s.markAsRead);
  const updateConversation = useAppStore((s) => s.updateConversation);
  const autoPilotEnabled = useAppStore((s) => s.settings.autoPilotEnabled);
  const autoPilotThreshold = useAppStore((s) => s.settings.autoPilotConfidenceThreshold);

  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const accountId = useAppStore((s) => s.settings.accountId);
  const apiKey = useAppStore((s) => s.settings.apiKey);
  const propertyKnowledge = useAppStore((s) => s.propertyKnowledge);
  const updatePropertyKnowledge = useAppStore((s) => s.updatePropertyKnowledge);
  const hostName = useAppStore((s) => s.settings.hostName);
  const incrementAnalytic = useAppStore((s) => s.incrementAnalytic);
  const addLearningEntry = useAppStore((s) => s.addLearningEntry);
  const hostStyleProfiles = useAppStore((s) => s.hostStyleProfiles);
  const issues = useAppStore((s) => s.issues);
  const addIssue = useAppStore((s) => s.addIssue);
  const updateIssue = useAppStore((s) => s.updateIssue);
  const resolveIssue = useAppStore((s) => s.resolveIssue);
  const addAutoPilotLog = useAppStore((s) => s.addAutoPilotLog);
  const notificationSettings = useAppStore((s) => s.settings);
  const responseLanguageMode = useAppStore((s) => s.settings.responseLanguageMode ?? 'match_guest');
  const defaultLanguage = useAppStore((s) => s.settings.defaultLanguage ?? 'en');
  const updateAILearningProgress = useAppStore((s) => s.updateAILearningProgress);
  const aiLearningProgress = useAppStore((s) => s.aiLearningProgress);
  const addDraftOutcome = useAppStore((s) => s.addDraftOutcome);
  const addCalibrationEntry = useAppStore((s) => s.addCalibrationEntry);
  const addReplyDelta = useAppStore((s) => s.addReplyDelta);

  const dismissComposerNotice = useCallback(() => {
    setRateLimitError(null);
    setRateLimitActionLabel(null);
  }, []);

  const showComposerNotice = useCallback((message: string, actionLabel: string | null = null) => {
    setRateLimitError(message);
    setRateLimitActionLabel(actionLabel);
    setTimeout(() => {
      setRateLimitError((current) => {
        if (current === message) {
          setRateLimitActionLabel(null);
          return null;
        }
        return current;
      });
    }, 8000);
  }, []);

  // Track keyboard visibility to hide SmartReplyBar when typing
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

  // Intent detection for the last guest message
  const lastGuestMessage = useMemo(() => {
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return null;
    return [...(conv.messages || [])].reverse().find(m => m.sender === 'guest') || null;
  }, [conversations, conversationId]);

  const triagedIssue = useMemo(() => {
    if (!lastGuestMessage) return null;
    const triage = triageIssueFromMessage(lastGuestMessage.content);
    return triage.isIssue ? triage : null;
  }, [lastGuestMessage]);

  // Helper: centralized outcome tracking (fixes 5A DRY + 6A calibration guard)
  const trackDraftOutcome = useCallback((
    outcomeType: 'approved' | 'edited' | 'rejected' | 'independent',
    opts: {
      propertyId?: string;
      guestIntent?: string;
      confidence?: number;
      aiDraft?: string;
      hostReply?: string;
      guestMessage?: string;
    } = {}
  ) => {
    const outcome = {
      id: `outcome_${Date.now()}`,
      timestamp: new Date(),
      outcomeType,
      propertyId: opts.propertyId,
      guestIntent: opts.guestIntent,
      confidence: opts.confidence,
    };
    addDraftOutcome(outcome);

    // Only calibrate when we have a confidence prediction to evaluate (fix 6A)
    if (opts.confidence !== undefined) {
      addCalibrationEntry(createCalibrationEntry(outcome));
    }

    // Reply delta analysis when both draft and reply are available
    if (opts.aiDraft && opts.hostReply && opts.guestMessage) {
      const delta = analyzeReplyDelta(
        opts.aiDraft,
        opts.hostReply,
        opts.guestMessage,
        opts.propertyId,
        opts.guestIntent
      );
      addReplyDelta(delta);
      console.log(`[ChatScreen] ${outcomeType} delta:`, delta.learningSummary);
    }

    if (features.serverProxiedAI) {
      recordDraftOutcomeViaServer({
        outcomeType,
        propertyId: opts.propertyId,
        guestIntent: opts.guestIntent,
        confidence: opts.confidence,
        aiDraft: opts.aiDraft,
        hostReply: opts.hostReply,
        guestMessage: opts.guestMessage,
      }).catch((error) => {
        console.error('[ChatScreen] Failed to record server draft outcome:', error);
      });
    }
  }, [addDraftOutcome, addCalibrationEntry, addReplyDelta]);

  const conversation = useMemo(
    () => conversations.find((c) => c.id === conversationId),
    [conversations, conversationId]
  );
  const guestMemory = useMemo(() => {
    if (!conversation?.guest?.email && !conversation?.guest?.phone) return null;
    return guestMemoryManager.getGuestMemory(conversation?.guest?.email, conversation?.guest?.phone);
  }, [conversation?.guest?.email, conversation?.guest?.phone]);
  const guestStayCount = guestMemory?.conversationHistory.length ?? 0;
  const guestMemoryStorageKey = conversation?.id ? `guest-memory-collapsed:${conversation.id}` : null;
  const [guestMemoryCollapsed, setGuestMemoryCollapsed] = useState(false);

  const latestConversationIssue = useMemo(() => {
    const matching = issues.filter((issue) => issue.conversationId === conversationId);
    return matching.length > 0 ? matching[matching.length - 1] : null;
  }, [issues, conversationId]);

  const activeConversationIssue = latestConversationIssue?.status !== 'resolved' ? latestConversationIssue : null;
  const savedHandoffDraft = useMemo(() => {
    if (!activeConversationIssue?.notes) return null;
    return activeConversationIssue.notes.startsWith('Handoff:') ? activeConversationIssue.notes : null;
  }, [activeConversationIssue?.notes]);
  const issueTriageStorageKey = conversation?.id ? `issue-triage-collapsed:${conversation.id}` : null;
  const [issueTriageCollapsed, setIssueTriageCollapsed] = useState(false);

  const messages = conversation?.messages ?? [];

  // Get property knowledge for this conversation
  const currentPropertyKnowledge = conversation?.property?.id
    ? propertyKnowledge[conversation.property.id]
    : undefined;

  // Get host style profile (property-specific or global)
  const currentHostStyleProfile = useMemo(() => {
    if (!conversation?.property?.id) return hostStyleProfiles['global'];
    return hostStyleProfiles[conversation.property.id] || hostStyleProfiles['global'];
  }, [conversation?.property?.id, hostStyleProfiles]);

  // Mark as read on mount
  useEffect(() => {
    if (conversation && conversation.unreadCount > 0) {
      markAsRead(conversationId);
    }
  }, [conversationId, conversation, markAsRead]);

  // Scroll to bottom when messages change (inverted list: bottom = offset 0)
  useEffect(() => {
    if (messages.length > 0 && listRef.current) {
      if (!hasScrolledToBottom.current) {
        hasScrolledToBottom.current = true;
      } else {
        // For new messages, scroll to top of inverted list (= bottom of chat)
        setTimeout(() => {
          try {
            listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
          } catch {}
        }, 150);
      }
    }
  }, [messages.length]);

  useEffect(() => {
    let cancelled = false;

    async function loadGuestMemoryPreference() {
      if (!guestMemoryStorageKey || !guestMemory?.preferences.isReturning || guestStayCount === 0) {
        if (!cancelled) setGuestMemoryCollapsed(false);
        return;
      }

      const stored = await AsyncStorage.getItem(guestMemoryStorageKey);
      if (!cancelled) {
        setGuestMemoryCollapsed(stored === '1');
      }
    }

    loadGuestMemoryPreference();

    return () => {
      cancelled = true;
    };
  }, [guestMemory?.preferences.isReturning, guestMemoryStorageKey, guestStayCount]);

  const toggleGuestMemoryCollapsed = useCallback(async () => {
    const next = !guestMemoryCollapsed;
    setGuestMemoryCollapsed(next);
    if (guestMemoryStorageKey) {
      await AsyncStorage.setItem(guestMemoryStorageKey, next ? '1' : '0');
    }
  }, [guestMemoryCollapsed, guestMemoryStorageKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadIssueTriagePreference() {
      if (!issueTriageStorageKey || !triagedIssue || latestConversationIssue?.status === 'resolved') {
        if (!cancelled) setIssueTriageCollapsed(false);
        return;
      }

      const stored = await AsyncStorage.getItem(issueTriageStorageKey);
      if (!cancelled) {
        if (stored === '1') {
          setIssueTriageCollapsed(true);
        } else if (stored === '0') {
          setIssueTriageCollapsed(false);
        } else {
          setIssueTriageCollapsed(!!currentEnhancedDraft);
        }
      }
    }

    loadIssueTriagePreference();

    return () => {
      cancelled = true;
    };
  }, [issueTriageStorageKey, triagedIssue, latestConversationIssue?.status, currentEnhancedDraft]);

  const toggleIssueTriageCollapsed = useCallback(async () => {
    const next = !issueTriageCollapsed;
    setIssueTriageCollapsed(next);
    if (issueTriageStorageKey) {
      await AsyncStorage.setItem(issueTriageStorageKey, next ? '1' : '0');
    }
  }, [issueTriageCollapsed, issueTriageStorageKey]);

  const ensureConversationIssue = useCallback(() => {
    if (!triagedIssue) return null;

    if (activeConversationIssue) {
      return activeConversationIssue;
    }

    const now = new Date();
    const nextIssue = {
      id: `issue-${conversationId}-${now.getTime()}`,
      conversationId,
      category: triagedIssue.category,
      description: triagedIssue.summary,
      status: 'open' as const,
      priority: triagedIssue.priority,
      createdAt: now,
      notes: lastGuestMessage?.content || '',
    };

    addIssue(nextIssue);
    return nextIssue;
  }, [triagedIssue, activeConversationIssue, conversationId, addIssue, lastGuestMessage]);

  const handleIssueNeedsFollowUp = useCallback(() => {
    const issue = ensureConversationIssue();
    if (!issue) return;

    updateIssue(issue.id, {
      status: 'in_progress',
      notes: issue.notes || lastGuestMessage?.content || '',
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [ensureConversationIssue, updateIssue, lastGuestMessage]);

  const handleIssueCreateHandoff = useCallback(async () => {
    if (!triagedIssue) return;

    const issue = ensureConversationIssue();
    if (!issue) return;

    const handoffDraft = buildIssueHandoffDraft({
      propertyName: conversation?.property?.name || 'the property',
      issue: triagedIssue,
      guestName: conversation?.guest?.name || 'Guest',
      guestMessage: lastGuestMessage?.content || '',
      stayWindow:
        conversation?.checkInDate && conversation?.checkOutDate
          ? `${format(new Date(conversation.checkInDate), 'MMM d')} - ${format(new Date(conversation.checkOutDate), 'MMM d')}`
          : null,
    });

    updateIssue(issue.id, {
      status: 'in_progress',
      notes: handoffDraft,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Alert.alert('Issue handoff ready', 'Choose how you want to use this handoff draft.', [
      {
        text: 'Copy',
        onPress: async () => {
          await Clipboard.setStringAsync(handoffDraft);
        },
      },
      {
        text: 'Share',
        onPress: async () => {
          await Share.share({ message: handoffDraft });
        },
      },
      {
        text: 'Save for later',
        style: 'cancel',
      },
    ]);
  }, [
    triagedIssue,
    ensureConversationIssue,
    conversation?.property?.name,
    conversation?.guest?.name,
    conversation?.checkInDate,
    conversation?.checkOutDate,
    lastGuestMessage,
    updateIssue,
  ]);

  const handleIssueResumeHandoff = useCallback(async () => {
    if (!savedHandoffDraft) return;

    Alert.alert('Saved handoff draft', savedHandoffDraft, [
      {
        text: 'Copy',
        onPress: async () => {
          await Clipboard.setStringAsync(savedHandoffDraft);
        },
      },
      {
        text: 'Share',
        onPress: async () => {
          await Share.share({ message: savedHandoffDraft });
        },
      },
      {
        text: 'Close',
        style: 'cancel',
      },
    ]);
  }, [savedHandoffDraft]);

  const handleIssueMarkResolved = useCallback(() => {
    if (!activeConversationIssue) return;
    resolveIssue(activeConversationIssue.id);
    incrementAnalytic('issuesResolved');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [activeConversationIssue, resolveIssue, incrementAnalytic]);

  // Scroll to bottom when AI draft appears (inverted: offset 0 = bottom)
  useEffect(() => {
    if (currentEnhancedDraft && listRef.current) {
      setTimeout(() => {
        try {
          listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
        } catch {}
      }, 300);
    }
  }, [currentEnhancedDraft]);

  // Handlers for FlatList auto-scroll
  const handleContentSizeChange = useCallback(() => {
    // No-op for inverted list — it stays at bottom naturally
  }, []);

  const handleListLayout = useCallback(() => {
    // No-op for inverted list — it starts at bottom
    hasScrolledToBottom.current = true;
  }, []);

  // Auto-generate AI draft when new guest message arrives
  useEffect(() => {
    if (!conversation) return;

    const lastMessage = messages[messages.length - 1];
    const existingDraft = messages.find(m => m.sender === 'ai_draft');

    console.log('[ChatScreen] Checking for AI draft generation:', {
      lastMessageSender: lastMessage?.sender,
      lastMessageContent: lastMessage?.content?.substring(0, 50),
      hasAiDraft: conversation.hasAiDraft,
      existingDraftInMessages: !!existingDraft,
      currentEnhancedDraft: !!currentEnhancedDraft,
      aiDraftContent: !!conversation.aiDraftContent,
      autoPilotEnabled,
    });

    // If hasAiDraft is true and we have stored draft content, pre-load it
    if (conversation.hasAiDraft && conversation.aiDraftContent && !currentEnhancedDraft && !isGeneratingDraft) {
      console.log('[ChatScreen] Pre-loading AI draft from conversation storage...');
      setCurrentEnhancedDraft({
        content: conversation.aiDraftContent,
        confidence: conversation.aiDraftConfidence || 75,
      });
      return;
    }

    // If hasAiDraft is true but no draft content exists, try from messages
    if (conversation.hasAiDraft && !conversation.aiDraftContent && existingDraft && !currentEnhancedDraft && !isGeneratingDraft) {
      console.log('[ChatScreen] Restoring draft from messages...');
      setCurrentEnhancedDraft({
        content: existingDraft.content,
        confidence: existingDraft.aiConfidence || 75,
      });
      return;
    }

    // If hasAiDraft is true but no draft exists anywhere, reset it
    if (conversation.hasAiDraft && !existingDraft && !currentEnhancedDraft && !conversation.aiDraftContent) {
      console.log('[ChatScreen] Resetting stale hasAiDraft flag...');
      updateConversation(conversationId, { hasAiDraft: false });
      return;
    }

    if (lastMessage?.sender === 'guest' && !conversation.hasAiDraft && !isGeneratingDraft) {
      // Prevent re-triggering for the same guest message
      if (lastGeneratedForMessageId.current === lastMessage.id) {
        console.log('[ChatScreen] Already generated draft for this message, skipping...');
        return;
      }
      console.log('[ChatScreen] Triggering AI draft generation...');
      lastGeneratedForMessageId.current = lastMessage.id;
      generateDraftForConversation();
    }
  }, [messages.length, conversation?.hasAiDraft, conversation?.aiDraftContent, currentEnhancedDraft, isGeneratingDraft]);

  // Create action items in store when detected
  const handleActionItems = useCallback((actionItems: ActionItem[]) => {
    if (!conversation) return;

    for (const item of actionItems) {
      // Convert to store format and add
      if (item.type === 'maintenance') {
        addIssue({
          id: item.id,
          conversationId: item.conversationId,
          category: 'maintenance',
          description: item.description,
          status: 'open',
          priority: item.priority,
          createdAt: item.createdAt,
        });
      }

      // Escalation banner disabled — too aggressive for current UX
      // TODO: re-enable with better inline treatment (not a fullscreen overlay)
      // if (item.type === 'escalation' || item.type === 'emergency') {
      //   setShowEscalationAlert(true);
      //   Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      // }
    }
  }, [conversation, addIssue]);

  const generateDraftForConversation = useCallback(async (modifier?: RegenerationOption['modifier']) => {
    if (!conversation || isGeneratingDraft) return;

    setIsGeneratingDraft(true);
    setCurrentModifier(modifier);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      let enhancedResponse: EnhancedAIResponse | null = null;

      if (isDemoMode) {
        // Enhanced demo response
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const demoResponse = generateDemoResponse(conversation);

        // Add enhanced features to demo
        const lastGuestMessage = [...conversation.messages].reverse().find((m) => m.sender === 'guest');
        const sentiment = lastGuestMessage
          ? analyzeSentimentAdvanced(lastGuestMessage.content)
          : { primary: 'neutral' as const, intensity: 50, emotions: [], requiresEscalation: false };
        const topics = lastGuestMessage
          ? detectTopics(lastGuestMessage.content, currentPropertyKnowledge)
          : [];
        const confidence = calculateConfidence(sentiment, topics, currentPropertyKnowledge, currentHostStyleProfile);

        enhancedResponse = {
          content: demoResponse.content,
          sentiment,
          topics,
          confidence,
          actionItems: [],
          knowledgeConflicts: [],
          detectedLanguage: 'en',
          regenerationOptions: getRegenerationOptions(sentiment),
        };
      } else if (features.serverProxiedAI) {
        // Commercial mode: call server proxy
        let supermemoryMode: 'off' | 'full' | 'degraded' = 'full';
        try {
          const entitlementState = await getCurrentEntitlements();
          supermemoryMode = entitlementState.entitlements.supermemoryMode;
        } catch (entitlementsError) {
          console.warn('[ChatScreen] Failed to fetch entitlements before draft generation:', entitlementsError);
        }

        if (supermemoryMode === 'degraded') {
          showComposerNotice(
            'Memory limit reached for this month. Drafting continues with reduced personalization.',
            onOpenUpsells ? 'Upgrade' : null
          );
        } else if (supermemoryMode === 'off') {
          showComposerNotice(
            'Advanced memory is unavailable on your current plan. Drafting continues without memory context.',
            onOpenUpsells ? 'Upgrade' : null
          );
        }

        const lastGuest = [...conversation.messages].reverse().find((m) => m.sender === 'guest');
        const serverResponse = await generateAIDraftViaServer({
          message: lastGuest?.content || '',
          conversationHistory: conversation.messages.map(m => ({
            role: m.sender === 'host' ? 'assistant' : 'user',
            content: m.content,
          })),
          propertyId: conversation.property?.id,
          guestName: conversation.guest?.name,
          responseLanguageMode,
          hostDefaultLanguage: defaultLanguage,
        });

        enhancedResponse = {
          content: serverResponse.draft,
          sentiment: { primary: 'neutral' as const, intensity: 50, emotions: [], requiresEscalation: false },
          topics: [],
          confidence: {
            overall: serverResponse.confidence,
            factors: { sentimentMatch: 80, knowledgeAvailable: 80, topicCoverage: 80, styleMatch: 80, safetyCheck: 100 },
            warnings: [],
            blockedForAutoSend: false,
          },
          actionItems: [],
          knowledgeConflicts: [],
          detectedLanguage: serverResponse.detectedLanguage,
          regenerationOptions: [],
        };
      } else {
        // Personal mode: use enhanced AI service directly (current behavior)
        enhancedResponse = await generateEnhancedAIResponse({
          conversation,
          propertyKnowledge: currentPropertyKnowledge,
          hostName,
          hostStyleProfile: currentHostStyleProfile,
          regenerationModifier: modifier,
          responseLanguageMode,
          hostDefaultLanguage: defaultLanguage,
        });
      }

      // Store enhanced draft
      console.log('[ChatScreen] Setting enhanced draft:', {
        content: enhancedResponse.content.substring(0, 50),
        confidence: enhancedResponse.confidence.overall,
        autoPilotEnabled,
      });

      setCurrentEnhancedDraft({
        content: enhancedResponse.content,
        confidence: enhancedResponse.confidence.overall,
        sentiment: enhancedResponse.sentiment,
        confidenceDetails: enhancedResponse.confidence,
        actionItems: enhancedResponse.actionItems,
        regenerationOptions: enhancedResponse.regenerationOptions,
        topics: enhancedResponse.topics,
        historicalMatches: enhancedResponse.historicalMatches,
        knowledgeConflicts: enhancedResponse.knowledgeConflicts,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Handle action items
      if (enhancedResponse.actionItems.length > 0) {
        handleActionItems(enhancedResponse.actionItems);
      }

      const newDraft: Message = {
        id: `draft-${Date.now()}`,
        conversationId,
        content: enhancedResponse.content,
        sender: 'ai_draft',
        timestamp: new Date(),
        isRead: true,
        aiConfidence: enhancedResponse.confidence.overall,
        detectedIntent: enhancedResponse.topics[0]?.intent || 'general_inquiry',
        sentiment: enhancedResponse.sentiment.primary,
      };

      addMessage(conversationId, newDraft);
      updateConversation(conversationId, {
        hasAiDraft: true,
        aiDraftSentAt: new Date(),
        aiDraftContent: enhancedResponse.content,
        aiDraftConfidence: enhancedResponse.confidence.overall,
      });

      // Auto-send if auto-pilot is enabled and confidence meets threshold AND not blocked
      if (
        autoPilotEnabled &&
        enhancedResponse.confidence.overall >= autoPilotThreshold &&
        !enhancedResponse.confidence.blockedForAutoSend
      ) {
        console.log('[ChatScreen] Auto-pilot: Confidence meets threshold, auto-sending...');
        await handleAutoSend(enhancedResponse.content);
      } else if (autoPilotEnabled && enhancedResponse.confidence.blockedForAutoSend) {
        console.log('[ChatScreen] Auto-pilot: Blocked for review -', enhancedResponse.confidence.blockReason);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.startsWith('RATE_LIMIT:')) {
        const reason = errMsg.replace('RATE_LIMIT: ', '');
        showComposerNotice(reason, null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      console.error('[ChatScreen] Error generating AI draft:', error);
    } finally {
      setIsGeneratingDraft(false);
      setCurrentModifier(undefined);
    }
  }, [conversation, isGeneratingDraft, isDemoMode, currentPropertyKnowledge, hostName, autoPilotEnabled, autoPilotThreshold, currentHostStyleProfile, handleActionItems, showComposerNotice, onOpenUpsells]);

  const handleAutoSend = async (content: string) => {
    if (!conversation) return;
    if (!isDemoMode && !features.serverProxiedAI && (!accountId || !apiKey)) return;

    try {
      if (!isDemoMode) {
        if (features.serverProxiedAI) {
          await sendHostawayMessageViaServer(parseInt(conversationId), content);
        } else {
          await sendHostawayMessage(accountId!, apiKey!, parseInt(conversationId), content);
        }
      }

      const messagesWithoutDraft = messages.filter((m) => m.sender !== 'ai_draft');
      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        conversationId,
        content,
        sender: 'host',
        timestamp: new Date(),
        isRead: false,
        isApproved: true,
      };

      updateConversation(conversationId, {
        messages: [...messagesWithoutDraft, newMessage],
        lastMessage: newMessage,
        hasAiDraft: false,
        aiDraftContent: undefined,
        aiDraftConfidence: undefined,
      });

      setCurrentEnhancedDraft(null);
      incrementAnalytic('totalMessagesHandled');
      incrementAnalytic('aiResponsesApproved');

      // Fire push notification for auto-send
      const guestName = conversation.guest?.name || 'Guest';
      const confidence = currentEnhancedDraft?.confidence ?? autoPilotThreshold;
      notifyAutoPilotSent(guestName, confidence, {
        quietHoursStart: notificationSettings.autoPilotScheduleStart,
        quietHoursEnd: notificationSettings.autoPilotScheduleEnd,
      }).catch(err => console.error('[ChatScreen] Push notification error:', err));

      // Log to autopilot audit log
      addAutoPilotLog({
        id: `ap-${Date.now()}`,
        timestamp: new Date(),
        conversationId,
        guestName,
        action: 'auto_sent',
        reason: `Confidence ${confidence}% met threshold ${autoPilotThreshold}%`,
        confidence,
        messagePreview: content.substring(0, 100),
        propertyId: conversation.property?.id || '',
        propertyName: conversation.property?.name || '',
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('[ChatScreen] Auto-send failed:', error);
    }
  };

  const handleSendMessage = useCallback(async (content: string) => {
    if (isSending || !content.trim()) return;
    setIsSending(true);

    // Capture context BEFORE updating UI (avoids stale references)
    const lastGuestMessage = [...messages].reverse().find(m => m.sender === 'guest');
    const aiDraftContent = currentEnhancedDraft?.content;
    const draftIntent = messages.find(m => m.sender === 'ai_draft')?.detectedIntent;

    // ── OPTIMISTIC UI: Update immediately so send feels instant ──
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      conversationId,
      content,
      sender: 'host',
      timestamp: new Date(),
      isRead: false,
      isApproved: true,
    };
    const messagesWithoutDraft = messages.filter(m => m.sender !== 'ai_draft');
    updateConversation(conversationId, {
      messages: [...messagesWithoutDraft, newMessage],
      lastMessage: newMessage,
      hasAiDraft: false,
      aiDraftContent: undefined,
      aiDraftConfidence: undefined,
    });
    incrementAnalytic('totalMessagesHandled');
    setCurrentEnhancedDraft(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // ── ASYNC: Send to Hostaway + learning in background ──
    try {
      if (!isDemoMode) {
        if (features.serverProxiedAI) {
          await sendHostawayMessageViaServer(parseInt(conversationId), content);
        } else if (accountId && apiKey) {
          await sendHostawayMessage(accountId, apiKey, parseInt(conversationId), content);
        }
      }
    } catch (error) {
      console.error('[ChatScreen] Error sending message:', error);
      Alert.alert('Send Failed', 'Message could not be delivered. It may need to be resent.');
    }

    // Learning & analytics (fire-and-forget, non-blocking)
    try {
      if (aiDraftContent && lastGuestMessage) {
        const pattern = analyzeIndependentReply(
          aiDraftContent,
          content,
          lastGuestMessage.content,
          conversation?.property?.id,
          draftIntent
        );
        storeIndependentReplyPattern(pattern).catch(err =>
          console.error('[ChatScreen] Failed to store independent reply pattern:', err)
        );
        const summary = getIndependentReplySummary(pattern);
        setLearningToastType('independent');
        setEditLearningSummary(`${summary}`);
        setTimeout(() => setEditLearningSummary(null), 4000);
      }

      if (lastGuestMessage) {
        learnFromSentMessage(
          content,
          lastGuestMessage.content,
          conversation?.property?.id,
          false,  // wasEdited
          true,   // wasApproved
          'host_written'
        ).catch(err => console.error('[ChatScreen] Incremental learning error:', err));

        updateAILearningProgress({
          realTimeIndependentRepliesCount: aiLearningProgress.realTimeIndependentRepliesCount + 1,
          patternsIndexed: aiLearningProgress.patternsIndexed + 1,
        });

        trackDraftOutcome('independent', {
          propertyId: conversation?.property?.id,
          guestIntent: draftIntent,
          aiDraft: currentEnhancedDraft?.content,
          hostReply: content,
          guestMessage: lastGuestMessage.content,
        });
      }
    } catch (learningErr) {
      console.error('[ChatScreen] Learning error (non-fatal):', learningErr);
    }

    setIsSending(false);
  }, [messages, conversationId, updateConversation, isDemoMode, accountId, apiKey, isSending, currentEnhancedDraft, conversation, incrementAnalytic]);

  const handleApproveAiDraft = useCallback(async (contentOverride?: string) => {
    if (!currentEnhancedDraft || isSending) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSending(true);

    // Capture context BEFORE updating UI
    const contentToSend = contentOverride || currentEnhancedDraft.content;
    const wasEditedByUser = (contentOverride != null && contentOverride !== currentEnhancedDraft.content) || currentEnhancedDraft.isEdited === true;
    const lastGuestMessage = [...messages].reverse().find(m => m.sender === 'guest');
    const draftMessage = messages.find((m) => m.sender === 'ai_draft');
    const savedDraft = { ...currentEnhancedDraft }; // Snapshot before clearing

    // ── OPTIMISTIC UI: Update immediately ──
    const messagesWithoutDraft = messages.filter((m) => m.sender !== 'ai_draft');
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      conversationId,
      content: contentToSend,
      sender: 'host',
      timestamp: new Date(),
      isRead: false,
      isApproved: true,
    };
    updateConversation(conversationId, {
      messages: [...messagesWithoutDraft, newMessage],
      lastMessage: newMessage,
      hasAiDraft: false,
      aiDraftContent: undefined,
      aiDraftConfidence: undefined,
    });
    incrementAnalytic('totalMessagesHandled');
    if (wasEditedByUser) {
      incrementAnalytic('aiResponsesEdited');
    } else {
      incrementAnalytic('aiResponsesApproved');
    }
    setCurrentEnhancedDraft(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // ── ASYNC: Send to Hostaway in background ──
    try {
      if (!isDemoMode) {
        if (features.serverProxiedAI) {
          await sendHostawayMessageViaServer(parseInt(conversationId), contentToSend);
        } else if (accountId && apiKey) {
          await sendHostawayMessage(accountId, apiKey, parseInt(conversationId), contentToSend);
        }
      }
    } catch (error) {
      console.error('[ChatScreen] Error sending approved draft:', error);
      Alert.alert('Send Failed', 'Message could not be delivered. It may need to be resent.');
    }

    // Learning & analytics (fire-and-forget)
    try {
      if (draftMessage) {
        const originalContent = savedDraft.originalContent || savedDraft.content;
        const learningEntry: LearningEntry = {
          id: `learn-${Date.now()}`,
          originalResponse: originalContent,
          editedResponse: wasEditedByUser ? contentToSend : undefined,
          wasApproved: true,
          wasEdited: wasEditedByUser,
          guestIntent: draftMessage.detectedIntent || 'unknown',
          propertyId: conversation?.property?.id || '',
          timestamp: new Date(),
          originType: wasEditedByUser ? 'ai_edited' : 'ai_approved',
        };
        addLearningEntry(learningEntry);

        if (wasEditedByUser && savedDraft.originalContent) {
          const editPattern = analyzeEdit(
            savedDraft.originalContent,
            contentToSend,
            conversation?.property?.id,
            draftMessage.detectedIntent
          );
          storeEditPattern(editPattern).catch(err =>
            console.error('[ChatScreen] Failed to store edit pattern:', err)
          );
          const summary = getEditSummary(editPattern);
          setLearningToastType('edit');
          setEditLearningSummary(summary);
          setTimeout(() => setEditLearningSummary(null), 4000);
        } else if (!wasEditedByUser) {
          setLearningToastType('approval');
          setEditLearningSummary('Response style reinforced — AI will match this tone');
          setTimeout(() => setEditLearningSummary(null), 3000);
        }

        if (lastGuestMessage) {
          learnFromSentMessage(
            contentToSend,
            lastGuestMessage.content,
            conversation?.property?.id,
            wasEditedByUser,
            true,  // wasApproved
            wasEditedByUser ? 'ai_edited' : 'ai_approved'
          ).catch(err => console.error('[ChatScreen] Incremental learning error:', err));

          updateAILearningProgress({
            ...(wasEditedByUser
              ? { realTimeEditsCount: aiLearningProgress.realTimeEditsCount + 1 }
              : { realTimeApprovalsCount: aiLearningProgress.realTimeApprovalsCount + 1 }),
            patternsIndexed: aiLearningProgress.patternsIndexed + 1,
          });

          trackDraftOutcome(wasEditedByUser ? 'edited' : 'approved', {
            propertyId: conversation?.property?.id,
            guestIntent: draftMessage?.detectedIntent,
            confidence: savedDraft.confidence,
            aiDraft: wasEditedByUser ? savedDraft.originalContent : undefined,
            hostReply: wasEditedByUser ? contentToSend : undefined,
            guestMessage: lastGuestMessage.content,
          });
        }
      }
    } catch (learningErr) {
      console.error('[ChatScreen] Learning error (non-fatal):', learningErr);
    }

    setIsSending(false);
  }, [currentEnhancedDraft, messages, conversationId, updateConversation, isDemoMode, accountId, apiKey, isSending, conversation, incrementAnalytic]);

  const handleRegenerateAiDraft = useCallback(async (modifier?: RegenerationOption['modifier']) => {
    if (isGeneratingDraft) return;

    incrementAnalytic('aiResponsesRejected');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Remove old draft first
    const messagesWithoutDraft = messages.filter((m) => m.sender !== 'ai_draft');
    updateConversation(conversationId, {
      messages: messagesWithoutDraft,
      hasAiDraft: false,
      aiDraftContent: undefined,
      aiDraftConfidence: undefined,
    });

    setCurrentEnhancedDraft(null);

    // Generate new draft with modifier
    await generateDraftForConversation(modifier);
  }, [messages, conversationId, updateConversation, isGeneratingDraft, generateDraftForConversation, incrementAnalytic]);

  const handleEditAiDraft = useCallback((newContent: string) => {
    // Only update local draft state — sending happens via handleApproveAiDraft
    setCurrentEnhancedDraft(prev => prev ? {
      ...prev,
      content: newContent,
      isEdited: true,
      originalContent: prev.originalContent || prev.content,
    } : null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleDismissAiDraft = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const messagesWithoutDraft = messages.filter((m) => m.sender !== 'ai_draft');
    const lastNonDraft = messagesWithoutDraft[messagesWithoutDraft.length - 1];

    // REJECTION LEARNING: Analyze why the draft was dismissed
    if (currentEnhancedDraft) {
      const lastGuestMessage = [...messages].reverse().find(m => m.sender === 'guest');
      const draftMessage = messages.find(m => m.sender === 'ai_draft');

      if (lastGuestMessage) {
        const rejectionPattern = analyzeRejection(
          currentEnhancedDraft.content,
          lastGuestMessage.content,
          conversation?.property?.id,
          draftMessage?.detectedIntent,
          currentEnhancedDraft.sentiment?.primary,
          currentEnhancedDraft.confidence
        );

        storeRejectionPattern(rejectionPattern).catch(err =>
          console.error('[ChatScreen] Failed to store rejection pattern:', err)
        );

        // Increment rejection counter
        updateAILearningProgress({
          realTimeRejectionsCount: aiLearningProgress.realTimeRejectionsCount + 1,
        });

        // Track outcome (with confidence for calibration)
        trackDraftOutcome('rejected', {
          propertyId: conversation?.property?.id,
          guestIntent: draftMessage?.detectedIntent,
          confidence: currentEnhancedDraft?.confidence,
        });

        // Show richer rejection feedback
        const summary = getRejectionSummary(rejectionPattern);
        setLearningToastType('rejection');
        setEditLearningSummary(`${summary}`);
        console.log('[ChatScreen] Rejection analysis:', summary);
        setTimeout(() => setEditLearningSummary(null), 3000);
      }
    }

    updateConversation(conversationId, {
      messages: messagesWithoutDraft,
      lastMessage: lastNonDraft,
      hasAiDraft: false,
      aiDraftContent: undefined,
      aiDraftConfidence: undefined,
    });

    setCurrentEnhancedDraft(null);
    incrementAnalytic('aiResponsesRejected');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [messages, conversationId, updateConversation, incrementAnalytic, currentEnhancedDraft, conversation]);



  // Handle fixing knowledge base conflicts
  const handleFixConflict = useCallback((field: string, newValue: string) => {
    if (!conversation?.property?.id) return;

    const propertyId = conversation.property.id;
    const updates: Record<string, string> = { [field]: newValue };

    updatePropertyKnowledge(propertyId, updates);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Remove the fixed conflict from the current draft
    if (currentEnhancedDraft?.knowledgeConflicts) {
      setCurrentEnhancedDraft({
        ...currentEnhancedDraft,
        knowledgeConflicts: currentEnhancedDraft.knowledgeConflicts.filter(
          c => c.field !== field
        ),
      });
    }
  }, [conversation?.property?.id, updatePropertyKnowledge, currentEnhancedDraft]);


  const dismissEscalationAlert = () => {
    setShowEscalationAlert(false);
  };

  // Filter out AI drafts for display (shown in composer)
  // NOTE: Must be above the !conversation guard to satisfy React's rules of hooks
  const displayMessages = useMemo(() => {
    if (!conversation) return [];
    const nonDraft = messages.filter((m) => m.sender !== 'ai_draft');
    if (!searchQuery.trim()) return nonDraft;
    const q = searchQuery.toLowerCase();
    return nonDraft.filter((m) => m.content.toLowerCase().includes(q));
  }, [conversation, messages, searchQuery]);

  if (!conversation) {
    return (
      <View style={chatStyles.emptyContainer}>
        <Text style={chatStyles.emptyText}>Conversation not found</Text>
      </View>
    );
  }

  const { guest, property, checkInDate, checkOutDate } = conversation;

  if (showGuestProfile) {
    return (
      <GuestProfileScreen
        conversation={conversation}
        onBack={() => setShowGuestProfile(false)}
      />
    );
  }

  return (
    <View style={chatStyles.root}>
      <LinearGradient
        colors={[colors.bg.elevated, colors.bg.subtle]}
        style={chatStyles.headerGradient}
      />

      <SafeAreaView style={chatStyles.flex1} edges={['top']}>
        {/* Escalation Alert */}
        {showEscalationAlert && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={chatStyles.escalationBanner}
          >
            <SafeAreaView edges={['top']}>
              <View style={chatStyles.escalationRow}>
                <View style={chatStyles.escalationContent}>
                  <AlertTriangle size={20} color="#FFFFFF" />
                  <View style={chatStyles.escalationTextWrap}>
                    <Text style={chatStyles.escalationTitle}>Escalation Required</Text>
                    <Text style={chatStyles.escalationSubtitle}>This message requires immediate attention</Text>
                  </View>
                </View>
                <Pressable onPress={dismissEscalationAlert} accessibilityRole="button" accessibilityLabel="Dismiss escalation alert" style={{ padding: spacing['2'] }}>
                  <Text style={chatStyles.escalationDismiss}>Dismiss</Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </Animated.View>
        )}

        {/* Learning Toast — contextual feedback per interaction type */}
        {editLearningSummary && (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={chatStyles.learnToast}
          >
            <View style={chatStyles.learnToastInner}>
              <Brain size={18} color="#FFFFFF" />
              <View style={chatStyles.learnToastText}>
                <Text style={chatStyles.learnToastTitle}>
                  {learningToastType === 'approval' && 'Draft approved'}
                  {learningToastType === 'edit' && 'Learned from your edit'}
                  {learningToastType === 'independent' && 'Style recorded'}
                  {learningToastType === 'rejection' && 'Preference noted'}
                </Text>
                <Text style={chatStyles.learnToastBody}>
                  {editLearningSummary}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Header — Done | Name | search */}
        <Animated.View entering={FadeIn.duration(300)} style={chatStyles.header}>
          <View style={chatStyles.headerInner}>
            {/* Back / Done button */}
            <Pressable
              onPress={onBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back to inbox"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, minWidth: 44 })}
              testID="chat-back"
            >
              <Text style={chatStyles.doneButton}>Done</Text>
            </Pressable>

            {/* Centered guest name */}
            <Pressable
              onPress={() => setShowGuestProfile(true)}
              accessibilityRole="button"
              accessibilityLabel={`View ${guest.name || 'Guest'} profile`}
              accessibilityHint="Opens guest profile details"
              style={{ flex: 1, alignItems: 'center', marginHorizontal: 8 }}
            >
              <Text style={chatStyles.guestName} numberOfLines={1}>
                {guest.name || 'Guest'}
              </Text>
            </Pressable>

            {/* Search toggle */}
            <Pressable
              onPress={() => {
                setIsSearchOpen(!isSearchOpen);
                if (isSearchOpen) setSearchQuery('');
              }}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={isSearchOpen ? 'Close search' : 'Search messages'}
              style={({ pressed }) => ({
                opacity: pressed ? 0.8 : 1,
                minWidth: 44,
                alignItems: 'flex-end',
              })}
            >
              {isSearchOpen ? (
                <X size={20} color={colors.text.muted} />
              ) : (
                <Search size={20} color={colors.text.muted} />
              )}
            </Pressable>
          </View>

          {/* Search Bar */}
          {isSearchOpen && (
            <Animated.View entering={FadeInDown.duration(200)} style={{ paddingHorizontal: spacing['4'], paddingBottom: spacing['2'] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.hover, borderRadius: radius.md, paddingHorizontal: spacing['3'], height: 36 }}>
                <Search size={14} color={colors.text.muted} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search messages..."
                  placeholderTextColor={colors.text.disabled}
                  autoFocus
                  style={{ flex: 1, color: colors.text.primary, fontSize: 14, fontFamily: typography.fontFamily.regular, marginLeft: spacing['2'], paddingVertical: 0 }}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} accessibilityRole="button" accessibilityLabel="Clear search">
                    <X size={14} color={colors.text.muted} />
                  </Pressable>
                )}
              </View>
            </Animated.View>
          )}

          {/* Hostaway-style Reservation Summary Bar */}
          <ReservationSummaryBar
            conversation={conversation}
            onSeeDetails={() => setShowGuestInfo(!showGuestInfo)}
          />
          {triagedIssue && latestConversationIssue?.status !== 'resolved' ? (
            <IssueTriageCard
              triage={triagedIssue}
              collapsed={issueTriageCollapsed}
              hasSavedHandoff={Boolean(savedHandoffDraft)}
              onToggleCollapsed={toggleIssueTriageCollapsed}
              onNeedsFollowUp={handleIssueNeedsFollowUp}
              onCreateHandoff={handleIssueCreateHandoff}
              onResumeHandoff={handleIssueResumeHandoff}
              onMarkResolved={handleIssueMarkResolved}
            />
          ) : null}
          {guestMemory?.preferences.isReturning && guestStayCount > 0 ? (
            <GuestMemoryCard
              memory={guestMemory}
              stayCount={guestStayCount}
              collapsed={guestMemoryCollapsed}
              onToggle={toggleGuestMemoryCollapsed}
            />
          ) : null}

          {/* Guest Info Panel */}
          {showGuestInfo && (
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={chatStyles.guestInfoPanel}
            >
              <View style={chatStyles.infoRow}>
                <View style={chatStyles.infoItem}>
                  <User size={14} color={colors.text.muted} />
                  <Text style={chatStyles.infoText}>{guest.email}</Text>
                </View>
                {guest.phone && (
                  <View style={chatStyles.infoItem}>
                    <Phone size={14} color={colors.text.muted} />
                    <Text style={chatStyles.infoText}>{guest.phone}</Text>
                  </View>
                )}
              </View>
              <View style={[chatStyles.infoRow, { marginTop: spacing['1'] }]}>
                <View style={chatStyles.infoItem}>
                  <Home size={14} color={colors.text.muted} />
                  <Text style={chatStyles.infoText}>{property.name}</Text>
                </View>
                {checkInDate && checkOutDate && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Calendar size={14} color={colors.text.muted} />
                    <Text style={chatStyles.infoText}>
                      {format(new Date(checkInDate), 'MMM d')} - {format(new Date(checkOutDate), 'MMM d')}
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>
          )}

          {/* Conversation Summary */}
          <View style={{ marginTop: spacing['3'] }}>
          <ConversationSummaryDisplay
            conversation={conversation}
            variant="full"
          />
          </View>
        </Animated.View>

        {/* Messages */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={chatStyles.flex1}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
        >
          <View style={chatStyles.flex1}>
            <FlatList
              ref={listRef}
              data={[...displayMessages].reverse()}
              testID="chat-message-list"
              renderItem={({ item, index }) => {
                const reversedMessages = [...displayMessages].reverse();
                const prevMessage = index > 0 ? reversedMessages[index - 1] : null;
                const showAvatar = !prevMessage || prevMessage.sender !== item.sender;

                // Date separator: show when day changes from next message (inverted list)
                const nextMessage = index < reversedMessages.length - 1 ? reversedMessages[index + 1] : null;
                const itemDate = item.timestamp ? new Date(item.timestamp) : null;
                const nextDate = nextMessage?.timestamp ? new Date(nextMessage.timestamp) : null;
                const showDateSeparator = itemDate && (
                  !nextDate ||
                  itemDate.toDateString() !== nextDate.toDateString()
                );

                const formatDateLabel = (d: Date) => {
                  const now = new Date();
                  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                  const diff = (today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24);
                  if (diff < 1) return 'Today';
                  if (diff < 2) return 'Yesterday';
                  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                };

                return (
                  <View>
                    <MessageBubble
                      message={item}
                      guestAvatar={guest.avatar}
                      guestName={guest.name}
                      showAvatar={showAvatar}
                      conversationId={conversationId}
                      propertyId={property?.id}
                    />
                    {showDateSeparator && itemDate && (
                      <View style={chatStyles.dateSeparator} accessibilityRole="header">
                        <View style={chatStyles.dateSeparatorLine} />
                        <Text style={chatStyles.dateSeparatorText}>{formatDateLabel(itemDate)}</Text>
                        <View style={chatStyles.dateSeparatorLine} />
                      </View>
                    )}
                  </View>
                );
              }}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingTop: spacing['2'], paddingBottom: spacing['4'] }}
              inverted={true}
              initialNumToRender={20}
              onContentSizeChange={handleContentSizeChange}
              onLayout={handleListLayout}
              keyboardDismissMode="on-drag"
            />
          </View>

          {/* Smart Reply Bar — disabled, reclaiming space for composer */}

          {/* Composer with enhanced draft */}
          <MessageComposer
            onSend={handleSendMessage}
            onApproveAiDraft={handleApproveAiDraft}
            onRegenerateAiDraft={handleRegenerateAiDraft}
            onEditAiDraft={handleEditAiDraft}
            onDismissAiDraft={handleDismissAiDraft}
  
            aiDraft={currentEnhancedDraft}
            isGenerating={isGeneratingDraft}
            autoPilotEnabled={autoPilotEnabled}
            onFixConflict={handleFixConflict}
            onOpenActionsSheet={() => bottomSheetRef.current?.snapToIndex(0)}
            rateLimitError={rateLimitError}
            onDismissRateLimitError={dismissComposerNotice}
            rateLimitActionLabel={rateLimitActionLabel}
            onRateLimitAction={rateLimitActionLabel && onOpenUpsells ? onOpenUpsells : undefined}
          />
        </KeyboardAvoidingView>

        {/* AI Draft Actions Bottom Sheet */}
        {currentEnhancedDraft && (
          <AIDraftActionsSheet
            bottomSheetRef={bottomSheetRef}
            onApprove={handleApproveAiDraft}
            onEdit={() => {}}
            onDismiss={handleDismissAiDraft}
            onRegenerate={handleRegenerateAiDraft}
            confidence={currentEnhancedDraft.confidence}
            sentiment={currentEnhancedDraft.sentiment}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const chatStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  flex1: {
    flex: 1,
  },
  headerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 150,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.bg.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.text.primary,
    fontFamily: typography.fontFamily.regular,
  },
  // Escalation banner
  escalationBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    backgroundColor: `${colors.danger.DEFAULT}E6`,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
  },
  escalationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  escalationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  escalationTextWrap: {
    marginLeft: spacing['3'],
    flex: 1,
  },
  escalationTitle: {
    color: '#FFFFFF',
    fontFamily: typography.fontFamily.semibold,
    fontSize: 14,
  },
  escalationSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
  },
  escalationDismiss: {
    color: '#FFFFFF',
    fontFamily: typography.fontFamily.medium,
    fontSize: 14,
  },
  // Learn toast
  learnToast: {
    position: 'absolute',
    top: 64,
    left: spacing['4'],
    right: spacing['4'],
    zIndex: 40,
  },
  learnToastInner: {
    backgroundColor: `${colors.primary.DEFAULT}F2`,
    borderRadius: radius.md,
    padding: spacing['3'],
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  learnToastText: {
    marginLeft: spacing['2.5'],
    flex: 1,
  },
  learnToastTitle: {
    color: '#FFFFFF',
    fontFamily: typography.fontFamily.semibold,
    fontSize: 13,
  },
  learnToastBody: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    marginTop: 2,
  },
  // Header
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doneButton: {
    color: colors.primary.DEFAULT,
    fontSize: 17,
    fontFamily: typography.fontFamily.regular,
  },
  backButton: {
    marginRight: 12,
  },
  guestPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  guestInfo: {
    marginLeft: spacing['3'],
    flex: 1,
  },
  guestName: {
    color: colors.text.primary,
    fontFamily: typography.fontFamily.semibold,
    fontSize: 17,
  },
  guestSubtitle: {
    color: colors.text.muted,
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
  },
  autoPilotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['2'],
    borderRadius: radius.full,
    marginRight: spacing['2'],
  },
  // Guest info panel
  guestInfoPanel: {
    marginTop: spacing['4'],
    backgroundColor: `${colors.bg.elevated}80`,
    borderRadius: radius.xl,
    padding: spacing['4'],
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing['6'],
    marginBottom: spacing['2'],
  },
  infoText: {
    color: colors.text.muted,
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    marginLeft: spacing['2'],
  },
  autoPilotDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.DEFAULT,
    marginRight: 6,
  },

  // ── Date separators ──
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing['6'],
    paddingVertical: spacing['3'],
    marginVertical: spacing['1'],
  },
  dateSeparatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.subtle,
  },
  dateSeparatorText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.text.muted,
    paddingHorizontal: spacing['3'],
    letterSpacing: 0.3,
  },
});
