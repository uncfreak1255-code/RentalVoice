import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, Alert, FlatList, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { format } from 'date-fns';
import { useAppStore } from '@/lib/store';
import type { Message, LearningEntry } from '@/lib/store';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { ConversationSummaryDisplay } from './ConversationSummaryDisplay';
import { AIDraftActionsSheet } from './AIDraftActionsSheet';
import type BottomSheet from '@gorhom/bottom-sheet';
import { ReservationSummaryBar } from './ReservationSummaryBar';
import { generateAIResponse, generateDemoResponse } from '@/lib/ai-service';
import {
  generateEnhancedAIResponse,
  analyzeSentimentAdvanced,
  detectTopics,
  calculateConfidence,
  detectActionItems,
  getRegenerationOptions,
  type RegenerationOption,
  type EnhancedAIResponse,
  type ActionItem,
  type KnowledgeConflict,
  type HistoricalMatchInfo,
} from '@/lib/ai-enhanced';
import { sendMessage as sendHostawayMessage } from '@/lib/hostaway';
import { features } from '@/lib/config';
import { generateAIDraftViaServer } from '@/lib/api-client';
import { aiTrainingService } from '@/lib/ai-training-service';
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
  ArrowLeft,
  Phone,
  Home,
  Calendar,
  User,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Bell,
  AlertTriangle,
  Brain,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Avatar } from '@/components/ui/Avatar';
import { colors, typography, spacing, radius } from '@/lib/design-tokens';

interface ChatScreenProps {
  conversationId: string;
  onBack: () => void;
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

export function ChatScreen({ conversationId, onBack }: ChatScreenProps) {
  const listRef = useRef<FlatList<Message>>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showGuestInfo, setShowGuestInfo] = useState(false);
  const [currentEnhancedDraft, setCurrentEnhancedDraft] = useState<EnhancedAiDraft | null>(null);
  const [showEscalationAlert, setShowEscalationAlert] = useState(false);
  const [currentModifier, setCurrentModifier] = useState<RegenerationOption['modifier'] | undefined>();
  const [editLearningSummary, setEditLearningSummary] = useState<string | null>(null);

  const conversations = useAppStore((s) => s.conversations);
  const addMessage = useAppStore((s) => s.addMessage);
  const markAsRead = useAppStore((s) => s.markAsRead);
  const updateConversation = useAppStore((s) => s.updateConversation);
  const autoPilotEnabled = useAppStore((s) => s.settings.autoPilotEnabled);
  const autoPilotThreshold = useAppStore((s) => s.settings.autoPilotConfidenceThreshold);
  const setAutoPilot = useAppStore((s) => s.setAutoPilot);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const accountId = useAppStore((s) => s.settings.accountId);
  const apiKey = useAppStore((s) => s.settings.apiKey);
  const propertyKnowledge = useAppStore((s) => s.propertyKnowledge);
  const updatePropertyKnowledge = useAppStore((s) => s.updatePropertyKnowledge);
  const hostName = useAppStore((s) => s.settings.hostName);
  const incrementAnalytic = useAppStore((s) => s.incrementAnalytic);
  const addLearningEntry = useAppStore((s) => s.addLearningEntry);
  const hostStyleProfiles = useAppStore((s) => s.hostStyleProfiles);
  const addIssue = useAppStore((s) => s.addIssue);
  const responseLanguageMode = useAppStore((s) => s.settings.responseLanguageMode ?? 'match_guest');
  const defaultLanguage = useAppStore((s) => s.settings.defaultLanguage ?? 'en');

  const conversation = useMemo(
    () => conversations.find((c) => c.id === conversationId),
    [conversations, conversationId]
  );

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

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && listRef.current) {
      setTimeout(() => {
        try {
          listRef.current?.scrollToEnd?.({ animated: true });
        } catch (e) {
          // FlashList may not be ready yet, ignore
        }
      }, 150);
    }
  }, [messages.length]);

  // Scroll to bottom when AI draft appears (composer grows, pushing messages up)
  useEffect(() => {
    if (currentEnhancedDraft && listRef.current) {
      setTimeout(() => {
        try {
          listRef.current?.scrollToEnd?.({ animated: true });
        } catch (e) {
          // ignore
        }
      }, 300);
    }
  }, [currentEnhancedDraft]);

  // Handlers for FlatList auto-scroll
  const handleContentSizeChange = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToEnd({ animated: true });
    }
  }, []);

  const handleListLayout = useCallback(() => {
    if (messages.length > 0 && listRef.current) {
      setTimeout(() => {
        listRef.current?.scrollToEnd?.({ animated: false });
      }, 100);
    }
  }, [messages.length]);

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

    if (lastMessage?.sender === 'guest' && !conversation.hasAiDraft) {
      console.log('[ChatScreen] Triggering AI draft generation...');
      generateDraftForConversation();
    }
  }, [messages.length, conversation?.hasAiDraft, conversation?.aiDraftContent, currentEnhancedDraft]);

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

      // Show escalation alert for urgent items
      if (item.type === 'escalation' || item.type === 'emergency') {
        setShowEscalationAlert(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }
  }, [conversation, addIssue]);

  const generateDraftForConversation = useCallback(async (modifier?: RegenerationOption['modifier']) => {
    if (!conversation || isGeneratingDraft) return;

    setIsGeneratingDraft(true);
    setCurrentModifier(modifier);

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
      console.error('[ChatScreen] Error generating AI draft:', error);
    } finally {
      setIsGeneratingDraft(false);
      setCurrentModifier(undefined);
    }
  }, [conversation, isGeneratingDraft, isDemoMode, currentPropertyKnowledge, hostName, autoPilotEnabled, autoPilotThreshold, currentHostStyleProfile, handleActionItems]);

  const handleAutoSend = async (content: string) => {
    if (!conversation || !accountId || !apiKey) return;

    try {
      if (!isDemoMode) {
        await sendHostawayMessage(accountId, apiKey, parseInt(conversationId), content);
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('[ChatScreen] Auto-send failed:', error);
    }
  };

  const handleSendMessage = useCallback(async (content: string) => {
    if (isSending || !content.trim()) return;
    setIsSending(true);

    try {
      // Get context for learning
      const lastGuestMessage = [...messages].reverse().find(m => m.sender === 'guest');
      const aiDraftContent = currentEnhancedDraft?.content;
      const draftIntent = messages.find(m => m.sender === 'ai_draft')?.detectedIntent;

      // INDEPENDENT REPLY LEARNING: Analyze what the host preferred over the AI
      // Only runs if there was an AI draft that the host chose to ignore/override
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

        // Show brief feedback
        const summary = getIndependentReplySummary(pattern);
        setEditLearningSummary(`Learning: ${summary}`);
        console.log('[ChatScreen] Independent reply analysis:', summary);
        setTimeout(() => setEditLearningSummary(null), 4000);
      }

      // ALWAYS LEARN: Train the AI service with this manual reply
      if (lastGuestMessage) {
        aiTrainingService.learnFromReply(
          lastGuestMessage.content,
          content,
          true, // Treat as edited since host wrote their own
          conversation?.property?.id
        ).catch(err => console.error('[ChatScreen] Incremental learning error:', err));
      }

      // Send the message through Hostaway (if not demo mode)
      if (!isDemoMode && accountId && apiKey) {
        await sendHostawayMessage(accountId, apiKey, parseInt(conversationId), content);
      }

      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        conversationId,
        content,
        sender: 'host',
        timestamp: new Date(),
        isRead: false,
        isApproved: true,
      };

      // Remove AI draft from messages if present
      const messagesWithoutDraft = messages.filter(m => m.sender !== 'ai_draft');
      
      updateConversation(conversationId, {
        messages: [...messagesWithoutDraft, newMessage],
        lastMessage: newMessage,
        hasAiDraft: false,
        aiDraftContent: undefined,
        aiDraftConfidence: undefined,
      });

      addMessage(conversationId, newMessage);
      incrementAnalytic('totalMessagesHandled');
      setCurrentEnhancedDraft(null);
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('[ChatScreen] Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  }, [messages, conversationId, updateConversation, addMessage, isDemoMode, accountId, apiKey, isSending, currentEnhancedDraft, conversation, incrementAnalytic]);

  const handleApproveAiDraft = useCallback(async () => {
    if (!currentEnhancedDraft || isSending) return;
    setIsSending(true);

    try {
      if (!isDemoMode && accountId && apiKey) {
        await sendHostawayMessage(accountId, apiKey, parseInt(conversationId), currentEnhancedDraft.content);
      }

      const messagesWithoutDraft = messages.filter((m) => m.sender !== 'ai_draft');
      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        conversationId,
        content: currentEnhancedDraft.content,
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

      const wasEdited = currentEnhancedDraft.isEdited === true;
      if (wasEdited) {
        incrementAnalytic('aiResponsesEdited');
      } else {
        incrementAnalytic('aiResponsesApproved');
      }

      // Find the guest message this was responding to for incremental learning
      const lastGuestMessage = [...messages].reverse().find(m => m.sender === 'guest');

      const draftMessage = messages.find((m) => m.sender === 'ai_draft');
      if (draftMessage) {
        const originalContent = currentEnhancedDraft.originalContent || currentEnhancedDraft.content;

        const learningEntry: LearningEntry = {
          id: `learn-${Date.now()}`,
          originalResponse: originalContent,
          editedResponse: wasEdited ? currentEnhancedDraft.content : undefined,
          wasApproved: true,
          wasEdited,
          guestIntent: draftMessage.detectedIntent || 'unknown',
          propertyId: conversation?.property?.id || '',
          timestamp: new Date(),
        };
        addLearningEntry(learningEntry);

        // If edited, perform edit diff analysis for richer learning
        if (wasEdited && currentEnhancedDraft.originalContent) {
          const editPattern = analyzeEdit(
            currentEnhancedDraft.originalContent,
            currentEnhancedDraft.content,
            conversation?.property?.id,
            draftMessage.detectedIntent
          );
          storeEditPattern(editPattern).catch(err =>
            console.error('[ChatScreen] Failed to store edit pattern:', err)
          );
          const summary = getEditSummary(editPattern);
          setEditLearningSummary(summary);
          console.log('[ChatScreen] Edit analysis:', summary);
          setTimeout(() => setEditLearningSummary(null), 4000);
        }

        // INCREMENTAL LEARNING
        if (lastGuestMessage) {
          aiTrainingService.learnFromReply(
            lastGuestMessage.content,
            currentEnhancedDraft.content,
            wasEdited,
            conversation?.property?.id
          ).catch(err => console.error('[ChatScreen] Incremental learning error:', err));
        }
      }

      setCurrentEnhancedDraft(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('[ChatScreen] Error approving draft:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  }, [currentEnhancedDraft, messages, conversationId, updateConversation, isDemoMode, accountId, apiKey, isSending, conversation]);

  const handleRegenerateAiDraft = useCallback(async (modifier?: RegenerationOption['modifier']) => {
    if (isGeneratingDraft) return;

    incrementAnalytic('aiResponsesRejected');

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

        // Show brief feedback about what was learned
        const summary = getRejectionSummary(rejectionPattern);
        setEditLearningSummary(`Noted: ${summary}`);
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

  const toggleAutoPilot = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAutoPilot(!autoPilotEnabled);
  };

  const dismissEscalationAlert = () => {
    setShowEscalationAlert(false);
  };

  if (!conversation) {
    return (
      <View style={chatStyles.emptyContainer}>
        <Text style={chatStyles.emptyText}>Conversation not found</Text>
      </View>
    );
  }

  const { guest, property, checkInDate, checkOutDate, platform, numberOfGuests } = conversation;

  // Filter out AI drafts for display (shown in composer)
  const displayMessages = messages.filter((m) => m.sender !== 'ai_draft');

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
                <Pressable onPress={dismissEscalationAlert} style={{ padding: spacing['2'] }}>
                  <Text style={chatStyles.escalationDismiss}>Dismiss</Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </Animated.View>
        )}

        {/* Edit Learning Summary Toast */}
        {editLearningSummary && (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={chatStyles.learnToast}
          >
            <View style={chatStyles.learnToastInner}>
              <Brain size={18} color="#FFFFFF" />
              <View style={chatStyles.learnToastText}>
                <Text style={chatStyles.learnToastTitle}>
                  AI learned from your edit
                </Text>
                <Text style={chatStyles.learnToastBody}>
                  {editLearningSummary}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={chatStyles.header}>
          <View style={chatStyles.headerInner}>
            <Pressable
              onPress={onBack}
              style={({ pressed }) => [chatStyles.backButton, { opacity: pressed ? 0.7 : 1 }]}
            >
              <ArrowLeft size={20} color={colors.text.primary} />
            </Pressable>

            <Pressable
              onPress={() => setShowGuestInfo(!showGuestInfo)}
              style={({ pressed }) => [chatStyles.guestPressable, { opacity: pressed ? 0.8 : 1 }]}
            >
              <Avatar
                name={guest.name}
                imageUrl={guest.avatar}
                size="lg"
                platformIcon={platform}
              />
              <View style={chatStyles.guestInfo}>
                <Text style={chatStyles.guestName} numberOfLines={1}>
                  {guest.name}
                </Text>
                <Text style={chatStyles.guestSubtitle} numberOfLines={1}>
                  {property.name} • {platform.charAt(0).toUpperCase() + platform.slice(1)}
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={toggleAutoPilot}
              style={({ pressed }) => [
                chatStyles.autoPilotBtn,
                { backgroundColor: autoPilotEnabled ? colors.primary.muted : colors.bg.elevated },
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              {autoPilotEnabled ? (
                <ToggleRight size={18} color={colors.primary.DEFAULT} />
              ) : (
                <ToggleLeft size={18} color={colors.text.muted} />
              )}
              <Sparkles
                size={12}
                color={autoPilotEnabled ? colors.primary.DEFAULT : colors.text.muted}
                style={{ marginLeft: spacing['1'] }}
              />
            </Pressable>
          </View>

          {/* Hostaway-style Reservation Summary Bar */}
          <ReservationSummaryBar
            conversation={conversation}
            onSeeDetails={() => setShowGuestInfo(!showGuestInfo)}
          />

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
          keyboardVerticalOffset={0}
        >
          <View style={chatStyles.flex1}>
            <FlatList
              ref={listRef}
              data={displayMessages}
              renderItem={({ item, index }) => {
                const prevMessage = index > 0 ? displayMessages[index - 1] : null;
                const showAvatar = !prevMessage || prevMessage.sender !== item.sender;
                return (
                  <MessageBubble
                    message={item}
                    guestAvatar={guest.avatar}
                    guestName={guest.name}
                    showAvatar={showAvatar}
                    conversationId={conversationId}
                    propertyId={property?.id}
                  />
                );
              }}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingTop: spacing['4'], paddingBottom: spacing['2'] }}
              inverted={false}
              onContentSizeChange={handleContentSizeChange}
              onLayout={handleListLayout}
            />
          </View>

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
    backgroundColor: colors.bg.base,
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
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: `${colors.bg.elevated}80`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing['3'],
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
    fontSize: 16,
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
});
