import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Modal, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Brain, Zap, Target, TrendingUp, Clock, Users, AlertCircle, CheckCircle, ChevronRight, X, Sparkles, BookOpen, MessageSquare, RefreshCw, Award, BarChart3, Home } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { incrementalTrainer, multiPassTrainer, trainingQualityAnalyzer, propertyLexiconManager, temporalWeightManager, fewShotIndexer, conversationFlowLearner, guestMemoryManager, negativeExampleManager, type IncrementalTrainingState, type MultiPassState, type TrainingQuality, type TrainingPass } from '@/lib/advanced-training';
import { useAppStore } from '@/lib/store';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

interface AdvancedTrainingDashboardProps { onClose?: () => void; isModal?: boolean; }

export function AdvancedTrainingDashboard({ onClose, isModal = false }: AdvancedTrainingDashboardProps) {
  const [incrementalState, setIncrementalState] = useState<IncrementalTrainingState | null>(null);
  const [multiPassState, setMultiPassState] = useState<MultiPassState | null>(null);
  const [trainingQuality, setTrainingQuality] = useState<TrainingQuality | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [isRunningDeepTraining, setIsRunningDeepTraining] = useState(false);
  const [fewShotStats, setFewShotStats] = useState({ total: 0, byIntent: {} as Record<string, number> });
  const [flowStats, setFlowStats] = useState<{ total: number; common: number }>({ total: 0, common: 0 });
  const [guestMemoryStats, setGuestMemoryStats] = useState({ total: 0, returning: 0 });
  const [negativeStats, setNegativeStats] = useState({ total: 0, byIssue: {} as Record<string, number> });
  const [lexiconCount, setLexiconCount] = useState(0);

  useEffect(() => {
    const loadState = async () => {
      setIncrementalState(incrementalTrainer.getState());
      await multiPassTrainer.loadState(); setMultiPassState(multiPassTrainer.getState());
      await trainingQualityAnalyzer.loadQuality(); setTrainingQuality(trainingQualityAnalyzer.getQuality());
      setFewShotStats(fewShotIndexer.getStats());
      setFlowStats({ total: conversationFlowLearner.getFlows().length, common: conversationFlowLearner.getCommonFlows(5).length });
      setGuestMemoryStats({ total: guestMemoryManager.getAllMemories().length, returning: guestMemoryManager.getReturningGuestsCount() });
      setNegativeStats(negativeExampleManager.getStats());
      setLexiconCount(propertyLexiconManager.getAllLexicons().length);
    };
    loadState();
    const unsubIncremental = incrementalTrainer.onStateChange(setIncrementalState);
    const unsubMultiPass = multiPassTrainer.onStateChange(setMultiPassState);
    return () => { unsubIncremental(); unsubMultiPass(); };
  }, []);

  const handleRunDeepTraining = useCallback(async () => {
    if (isRunningDeepTraining) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRunningDeepTraining(true);
    try {
      // Pull real host messages from store conversations
      const conversations = useAppStore.getState().conversations;
      const hostMessages: { content: string; prevGuestContent?: string; propertyId?: string; timestamp: Date }[] = [];

      for (const conv of conversations) {
        const msgs = conv.messages || [];
        for (let i = 0; i < msgs.length; i++) {
          const msg = msgs[i];
          if (msg.sender === 'host' && msg.content && msg.content.trim().length > 10) {
            // Find the preceding guest message for context
            let prevGuestContent: string | undefined;
            for (let j = i - 1; j >= 0; j--) {
              if (msgs[j].sender === 'guest' && msgs[j].content) {
                prevGuestContent = msgs[j].content;
                break;
              }
            }
            hostMessages.push({
              content: msg.content,
              prevGuestContent,
              propertyId: conv.property?.id,
              timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
            });
          }
        }
      }

      console.log(`[AdvancedTraining] Running deep training on ${hostMessages.length} real host messages`);
      await multiPassTrainer.runDeepTraining(hostMessages, (pass, progress) => {
        console.log(`[AdvancedTraining] Pass ${pass}: ${progress}%`);
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) { console.error('[AdvancedTraining] Deep training failed:', error); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
    finally { setIsRunningDeepTraining(false); }
  }, [isRunningDeepTraining]);

  const overallScore = trainingQuality?.overallScore ?? 0;
  const scoreColor = overallScore >= 80 ? '#4ADE80' : overallScore >= 60 ? '#FACC15' : '#F97316';
  const Container = isModal ? View : ScrollView;
  const containerProps = isModal ? {} : { showsVerticalScrollIndicator: false };

  return (
    <Container style={at.root} {...containerProps}>
      {/* Header */}
      <LinearGradient colors={[colors.bg.subtle, colors.bg.base]} style={{ paddingTop: isModal ? 0 : 60, paddingBottom: 20, paddingHorizontal: spacing['4'] }}>
        <View style={[at.rowBetween, { marginBottom: spacing['4'] }]}>
          <View style={[at.rowCenter, { gap: spacing['3'] }]}>
            <View style={[at.icon40, { backgroundColor: '#A78BFA20' }]}><Brain size={24} color="#A78BFA" /></View>
            <View><Text style={at.title}>AI Training</Text><Text style={{ color: colors.text.muted, fontSize: 14 }}>Advanced Learning System</Text></View>
          </View>
          {onClose && <Pressable onPress={onClose} style={[at.icon40, { backgroundColor: colors.bg.card }]}><X size={20} color="#94A3B8" /></Pressable>}
        </View>

        {/* Overall Score Card */}
        <Animated.View entering={FadeInDown.delay(100)}>
          <LinearGradient colors={['rgba(139,92,246,0.15)', 'rgba(59,130,246,0.1)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius['2xl'], padding: spacing['4'], borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)' }}>
            <View style={at.rowBetween}>
              <View>
                <Text style={{ color: colors.text.muted, fontSize: 14, marginBottom: 4 }}>Training Quality Score</Text>
                <Text style={{ fontSize: 36, fontFamily: typography.fontFamily.bold, color: scoreColor }}>{overallScore}%</Text>
                <Text style={{ color: colors.text.disabled, fontSize: 12, marginTop: 4 }}>{overallScore >= 80 ? 'Excellent' : overallScore >= 60 ? 'Good' : 'Needs Improvement'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={[at.rowCenter, { gap: 4, marginBottom: spacing['2'] }]}><Sparkles size={14} color="#A78BFA" /><Text style={{ color: '#A78BFA', fontSize: 14 }}>{fewShotStats.total} examples</Text></View>
                <View style={[at.rowCenter, { gap: 4 }]}><MessageSquare size={14} color="#60A5FA" /><Text style={{ color: '#60A5FA', fontSize: 14 }}>{incrementalState?.pendingCount ?? 0} queued</Text></View>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </LinearGradient>

      <ScrollView style={{ flex: 1, paddingHorizontal: spacing['4'] }} showsVerticalScrollIndicator={false}>
        {/* Incremental Training */}
        <Animated.View entering={FadeInDown.delay(200)} style={{ marginTop: spacing['4'] }}>
          <Text style={at.sectionLabel}>Real-time Learning</Text>
          <Pressable onPress={() => setSelectedSection(selectedSection === 'incremental' ? null : 'incremental')} style={at.section}>
            <View style={at.rowBetween}>
              <View style={[at.rowCenter, { gap: spacing['3'] }]}>
                <View style={[at.icon40, { backgroundColor: '#34D39920' }]}><Zap size={20} color="#34D399" /></View>
                <View><Text style={at.white}>Incremental Training</Text><Text style={{ color: colors.text.muted, fontSize: 14 }}>{incrementalState?.pendingCount ?? 0}/10 messages queued</Text></View>
              </View>
              <View style={[at.rowCenter, { gap: spacing['2'] }]}>
                <View style={{ paddingHorizontal: spacing['2'], paddingVertical: 4, borderRadius: radius.full, backgroundColor: (incrementalState?.pendingCount ?? 0) >= 8 ? '#34D39920' : colors.border.DEFAULT }}>
                  <Text style={{ fontSize: 12, fontFamily: typography.fontFamily.medium, color: (incrementalState?.pendingCount ?? 0) >= 8 ? '#34D399' : colors.text.muted }}>{(incrementalState?.pendingCount ?? 0) >= 8 ? 'Training Soon' : 'Collecting'}</Text>
                </View>
                <ChevronRight size={16} color="#64748B" />
              </View>
            </View>
            {selectedSection === 'incremental' && (
              <View style={at.expandedContent}>
                <Text style={{ color: colors.text.muted, fontSize: 14, marginBottom: spacing['2'] }}>The AI automatically learns from every 10 messages you send. Edited responses are weighted higher for better accuracy.</Text>
                <View style={[at.rowCenter, { gap: 4, marginTop: spacing['2'] }]}><CheckCircle size={14} color="#34D399" /><Text style={{ color: colors.text.muted, fontSize: 12 }}>Auto-trains every 10 messages</Text></View>
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* Multi-Pass Deep Training */}
        <Animated.View entering={FadeInDown.delay(300)} style={{ marginTop: spacing['4'] }}>
          <Text style={at.sectionLabel}>Deep Training</Text>
          <Pressable onPress={() => setSelectedSection(selectedSection === 'multipass' ? null : 'multipass')} style={at.section}>
            <View style={at.rowBetween}>
              <View style={[at.rowCenter, { gap: spacing['3'] }]}>
                <View style={[at.icon40, { backgroundColor: '#A78BFA20' }]}><Target size={20} color="#A78BFA" /></View>
                <View><Text style={at.white}>5-Pass Deep Training</Text><Text style={{ color: colors.text.muted, fontSize: 14 }}>{multiPassState?.passesCompleted.length ?? 0}/5 passes complete</Text></View>
              </View>
              <View style={[at.rowCenter, { gap: spacing['2'] }]}>
                {multiPassState?.isRunning ? (
                  <View style={{ paddingHorizontal: spacing['2'], paddingVertical: 4, borderRadius: radius.full, backgroundColor: '#A78BFA20' }}><Text style={{ color: '#A78BFA', fontSize: 12, fontFamily: typography.fontFamily.medium }}>{Math.round(multiPassState.totalProgress)}%</Text></View>
                ) : (
                  <Pressable onPress={handleRunDeepTraining} style={{ paddingHorizontal: spacing['3'], paddingVertical: 6, borderRadius: radius.full, backgroundColor: '#A78BFA20' }}><Text style={{ color: '#A78BFA', fontSize: 12, fontFamily: typography.fontFamily.medium }}>Run</Text></Pressable>
                )}
                <ChevronRight size={16} color="#64748B" />
              </View>
            </View>
            {selectedSection === 'multipass' && (
              <View style={at.expandedContent}>
                <Text style={{ color: colors.text.muted, fontSize: 14, marginBottom: spacing['3'] }}>Deep training runs 5 specialized passes to extract patterns:</Text>
                {(['style_tone', 'intent_mapping', 'phrase_mining', 'contextual', 'edge_cases'] as TrainingPass[]).map((pass) => {
                  const isComplete = multiPassState?.passesCompleted.includes(pass);
                  const isCurrent = multiPassState?.currentPass === pass;
                  const progress = multiPassState?.passProgress[pass] ?? 0;
                  const passNames: Record<TrainingPass, string> = { style_tone: '1. Style & Tone', intent_mapping: '2. Intent Mapping', phrase_mining: '3. Phrase Mining', contextual: '4. Contextual Patterns', edge_cases: '5. Edge Cases' };
                  return (
                    <View key={pass} style={[at.rowBetween, { paddingVertical: spacing['2'] }]}>
                      <View style={[at.rowCenter, { gap: spacing['2'] }]}>
                        {isComplete ? <CheckCircle size={16} color="#34D399" /> : isCurrent ? <RefreshCw size={16} color="#A78BFA" /> : <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border.DEFAULT }} />}
                        <Text style={{ fontSize: 14, color: isComplete ? '#34D399' : isCurrent ? '#A78BFA' : colors.text.muted }}>{passNames[pass]}</Text>
                      </View>
                      {isCurrent && <Text style={{ color: '#A78BFA', fontSize: 12 }}>{progress}%</Text>}
                    </View>
                  );
                })}
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* Quality Insights */}
        <Animated.View entering={FadeInDown.delay(400)} style={{ marginTop: spacing['4'] }}>
          <Text style={at.sectionLabel}>Quality Insights</Text>
          {trainingQuality?.gaps && trainingQuality.gaps.length > 0 && (
            <View style={[at.section, { backgroundColor: '#FB923C10', borderColor: '#FB923C30', marginBottom: spacing['3'] }]}>
              <View style={[at.rowCenter, { gap: spacing['2'], marginBottom: spacing['2'] }]}><AlertCircle size={16} color="#FB923C" /><Text style={{ color: '#FB923C', fontFamily: typography.fontFamily.semibold }}>Training Gaps</Text></View>
              {trainingQuality.gaps.slice(0, 3).map((gap, index) => (
                <View key={index} style={[at.rowCenter, { alignItems: 'flex-start', gap: spacing['2'], marginTop: spacing['2'] }]}>
                  <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: gap.impact === 'high' ? '#EF444420' : gap.impact === 'medium' ? '#FB923C20' : '#EAB30820' }}>
                    <Text style={{ fontSize: 12, fontFamily: typography.fontFamily.medium, color: gap.impact === 'high' ? '#F87171' : gap.impact === 'medium' ? '#FB923C' : '#FACC15' }}>{gap.impact.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}><Text style={{ color: colors.text.secondary, fontSize: 14 }}>{gap.description}</Text><Text style={{ color: colors.text.disabled, fontSize: 12, marginTop: 2 }}>{gap.suggestion}</Text></View>
                </View>
              ))}
            </View>
          )}
          {trainingQuality?.strengths && trainingQuality.strengths.length > 0 && (
            <View style={[at.section, { backgroundColor: '#34D39910', borderColor: '#34D39930' }]}>
              <View style={[at.rowCenter, { gap: spacing['2'], marginBottom: spacing['2'] }]}><Award size={16} color="#34D399" /><Text style={{ color: '#34D399', fontFamily: typography.fontFamily.semibold }}>Strengths</Text></View>
              {trainingQuality.strengths.slice(0, 3).map((strength, index) => (
                <View key={index} style={[at.rowBetween, { paddingVertical: 6 }]}>
                  <Text style={{ color: colors.text.secondary, fontSize: 14 }}>{strength.topic}</Text>
                  <View style={[at.rowCenter, { gap: 4 }]}>
                    <View style={{ width: 80, height: 6, borderRadius: radius.full, backgroundColor: colors.border.DEFAULT, overflow: 'hidden' }}><View style={{ height: '100%', backgroundColor: '#34D399', borderRadius: radius.full, width: `${strength.confidence}%` }} /></View>
                    <Text style={{ color: '#34D399', fontSize: 12, width: 32 }}>{strength.confidence}%</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        {/* Learning Systems Grid */}
        <Animated.View entering={FadeInDown.delay(500)} style={{ marginTop: spacing['4'] }}>
          <Text style={at.sectionLabel}>Learning Systems</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['3'] }}>
            {[
              { icon: <Home size={16} color="#60A5FA" />, label: 'Property Lexicons', value: lexiconCount, color: '#60A5FA', sub: 'property vocabularies' },
              { icon: <BookOpen size={16} color="#A78BFA" />, label: 'Few-Shot Index', value: fewShotStats.total, color: '#A78BFA', sub: 'response examples' },
              { icon: <TrendingUp size={16} color="#34D399" />, label: 'Flow Patterns', value: flowStats.total, color: '#34D399', sub: 'conversation flows' },
              { icon: <Users size={16} color="#F472B6" />, label: 'Guest Memory', value: guestMemoryStats.returning, color: '#F472B6', sub: 'returning guests tracked' },
            ].map((item, i) => (
              <View key={i} style={at.gridCard}>
                <View style={[at.rowCenter, { gap: spacing['2'], marginBottom: spacing['2'] }]}>{item.icon}<Text style={{ color: colors.text.secondary, fontFamily: typography.fontFamily.medium }}>{item.label}</Text></View>
                <Text style={{ fontSize: 24, fontFamily: typography.fontFamily.bold, color: item.color }}>{item.value}</Text>
                <Text style={{ color: colors.text.disabled, fontSize: 12 }}>{item.sub}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Negative Examples */}
        {negativeStats.total > 0 && (
          <Animated.View entering={FadeInDown.delay(600)} style={{ marginTop: spacing['4'], marginBottom: spacing['6'] }}>
            <Text style={at.sectionLabel}>Learn from Feedback</Text>
            <View style={at.section}>
              <View style={[at.rowCenter, { gap: spacing['2'], marginBottom: spacing['3'] }]}>
                <AlertCircle size={16} color="#FBBF24" /><Text style={{ color: colors.text.secondary, fontFamily: typography.fontFamily.medium }}>Avoided Patterns</Text>
                <View style={{ marginLeft: 'auto', backgroundColor: '#EAB30820', paddingHorizontal: spacing['2'], paddingVertical: 2, borderRadius: radius.full }}><Text style={{ color: '#FACC15', fontSize: 12, fontFamily: typography.fontFamily.medium }}>{negativeStats.total} learned</Text></View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['2'] }}>
                {Object.entries(negativeStats.byIssue).map(([issue, count]) => (
                  <View key={issue} style={{ backgroundColor: colors.border.DEFAULT, paddingHorizontal: spacing['2'], paddingVertical: 4, borderRadius: radius.full }}><Text style={{ color: colors.text.muted, fontSize: 12 }}>{issue.replace('_', ' ')}: {count}</Text></View>
                ))}
              </View>
            </View>
          </Animated.View>
        )}

        {/* Temporal Weights Info */}
        <Animated.View entering={FadeInDown.delay(700)} style={{ marginTop: spacing['4'], marginBottom: spacing['8'] }}>
          <View style={[at.section, { backgroundColor: '#A78BFA10', borderColor: '#A78BFA20' }]}>
            <View style={[at.rowCenter, { gap: spacing['2'], marginBottom: spacing['2'] }]}><Clock size={16} color="#A78BFA" /><Text style={{ color: '#A78BFA', fontFamily: typography.fontFamily.medium }}>Temporal Weighting Active</Text></View>
            <Text style={{ color: colors.text.muted, fontSize: 14 }}>Recent messages (0-6 months) have 3x more influence on AI style than older messages. Your writing style naturally evolves, and the AI adapts.</Text>
          </View>
        </Animated.View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </Container>
  );
}

const at = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text.primary, fontSize: 20, fontFamily: typography.fontFamily.bold },
  white: { color: colors.text.primary, fontFamily: typography.fontFamily.semibold },
  sectionLabel: { color: colors.text.muted, fontSize: 12, fontFamily: typography.fontFamily.semibold, marginBottom: spacing['2'], textTransform: 'uppercase', letterSpacing: 1 },
  icon40: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  section: { backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing['4'], borderWidth: 1, borderColor: colors.border.DEFAULT },
  expandedContent: { marginTop: spacing['4'], paddingTop: spacing['4'], borderTopWidth: 1, borderTopColor: colors.border.DEFAULT },
  gridCard: { backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing['3'], borderWidth: 1, borderColor: colors.border.DEFAULT, flexGrow: 1, flexBasis: '45%', minWidth: '45%' },
});
