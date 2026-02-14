import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, SlideInRight, useAnimatedStyle, useSharedValue, withSpring, withTiming, interpolateColor } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { PieChart, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, HelpCircle, ChevronRight, X, Plus, Sparkles, Database, FileText, MessageSquare, Bell, Target, Layers, RefreshCw, ArrowUpRight } from 'lucide-react-native';
import { useAppStore } from '@/lib/store';
import type { QuickReplyTemplate, PropertyKnowledge } from '@/lib/store';
import { analyzeKnowledgeCoverage, generateCoverageAlerts, generateTemplateFromGap, getCoverageColor, getCoverageLabel, formatCoverageDisplay, QUESTION_CATEGORIES, type CoverageReport, type CoverageGap, type CoverageAlert, type AnalyzedQuestion, type CategoryCoverageStats } from '@/lib/knowledge-coverage';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

interface KnowledgeCoverageDashboardProps { onClose?: () => void; propertyId?: string | null; }

export function KnowledgeCoverageDashboard({ onClose, propertyId = null }: KnowledgeCoverageDashboardProps) {
  const conversations = useAppStore(s => s.conversations);
  const templates = useAppStore(s => s.quickReplyTemplates);
  const propertyKnowledge = useAppStore(s => s.propertyKnowledge);
  const addQuickReplyTemplate = useAppStore(s => s.addQuickReplyTemplate);

  const [selectedTab, setSelectedTab] = useState<'overview' | 'gaps' | 'alerts'>('overview');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedGap, setSelectedGap] = useState<CoverageGap | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  const report = useMemo(() => analyzeKnowledgeCoverage(conversations, templates, propertyKnowledge, propertyId), [conversations, templates, propertyKnowledge, propertyId]);
  const alerts = useMemo(() => generateCoverageAlerts(report).filter(a => !dismissedAlerts.has(a.id)), [report, dismissedAlerts]);
  const { headline, summary, actionRequired } = formatCoverageDisplay(report);

  const handleCreateTemplate = (gap: CoverageGap) => {
    const category = QUESTION_CATEGORIES.find(c => c.id === gap.category);
    const suggested = generateTemplateFromGap(gap, category || null);
    setSelectedGap(gap); setNewTemplateName(suggested.name || ''); setNewTemplateContent(''); setShowTemplateModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleSaveTemplate = () => {
    if (!selectedGap || !newTemplateName || !newTemplateContent) return;
    const category = QUESTION_CATEGORIES.find(c => c.id === selectedGap.category);
    const suggested = generateTemplateFromGap(selectedGap, category || null);
    const newTemplate: QuickReplyTemplate = {
      id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, name: newTemplateName, content: newTemplateContent,
      category: suggested.category || 'general', keywords: suggested.keywords || [], propertyId, priority: suggested.priority || 5,
      source: 'manual', usageCount: 0, lastUsed: null, createdAt: new Date(), updatedAt: new Date(),
    };
    addQuickReplyTemplate(newTemplate); setShowTemplateModal(false); setSelectedGap(null); setNewTemplateName(''); setNewTemplateContent('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDismissAlert = (alertId: string) => { setDismissedAlerts(prev => new Set([...prev, alertId])); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  return (
    <View style={k.root}>
      {/* Header */}
      <LinearGradient colors={['#0F172A', '#1E293B']} style={{ paddingTop: 12, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={[k.row, { justifyContent: 'space-between', marginBottom: spacing['4'] }]}>
          <View style={k.row}>
            <View style={[k.iconBox, { backgroundColor: '#10B98120' }]}><Target size={22} color="#10B981" /></View>
            <View>
              <Text style={k.headerTitle}>Knowledge Coverage</Text>
              <Text style={{ color: colors.text.muted, fontSize: 12 }}>{report.totalQuestions} question patterns analyzed</Text>
            </View>
          </View>
          {onClose && (
            <Pressable onPress={onClose} style={({ pressed }) => [k.closeBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <X size={18} color={colors.text.muted} />
            </Pressable>
          )}
        </View>
        <CoverageScoreCard percentage={report.coveragePercentage} headline={headline} summary={summary} actionRequired={actionRequired} />
      </LinearGradient>

      {/* Tab Selector */}
      <View style={k.tabBar}>
        <TabButton label="Overview" icon={<PieChart size={16} color={selectedTab === 'overview' ? '#10B981' : '#64748B'} />} isSelected={selectedTab === 'overview'} onPress={() => setSelectedTab('overview')} />
        <TabButton label={`Gaps (${report.gaps.length})`} icon={<HelpCircle size={16} color={selectedTab === 'gaps' ? '#F59E0B' : '#64748B'} />} isSelected={selectedTab === 'gaps'} onPress={() => setSelectedTab('gaps')} badge={report.gaps.filter(g => g.impact === 'high').length} />
        <TabButton label={`Alerts (${alerts.length})`} icon={<Bell size={16} color={selectedTab === 'alerts' ? '#EF4444' : '#64748B'} />} isSelected={selectedTab === 'alerts'} onPress={() => setSelectedTab('alerts')} badge={alerts.filter(a => a.severity === 'high').length} />
      </View>

      {/* Content */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {selectedTab === 'overview' && <OverviewTab report={report} />}
        {selectedTab === 'gaps' && <GapsTab gaps={report.gaps} onCreateTemplate={handleCreateTemplate} />}
        {selectedTab === 'alerts' && <AlertsTab alerts={alerts} onDismiss={handleDismissAlert} />}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Template Creation Modal */}
      <Modal visible={showTemplateModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTemplateModal(false)}>
        <SafeAreaView style={[k.root]}>
          <View style={k.modalHeader}>
            <Pressable onPress={() => setShowTemplateModal(false)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text style={{ color: colors.text.muted, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.semibold, fontSize: 16 }}>New Template</Text>
            <Pressable onPress={handleSaveTemplate} disabled={!newTemplateName || !newTemplateContent} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text style={{ fontSize: 16, fontFamily: typography.fontFamily.medium, color: newTemplateName && newTemplateContent ? '#10B981' : colors.text.disabled }}>Save</Text>
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1, padding: spacing['4'] }}>
            {selectedGap && (
              <View style={k.gapInfo}>
                <View style={[k.row, { marginBottom: spacing['2'] }]}><Sparkles size={16} color="#F59E0B" /><Text style={{ color: '#F59E0B', fontFamily: typography.fontFamily.medium, fontSize: 14, marginLeft: spacing['2'] }}>Creating template for gap</Text></View>
                <Text style={{ color: colors.text.secondary, fontSize: 14 }}>{selectedGap.description}</Text>
                {selectedGap.exampleQuestions.length > 0 && <Text style={{ color: colors.text.disabled, fontSize: 12, marginTop: spacing['2'], fontStyle: 'italic' }}>Example: "{selectedGap.exampleQuestions[0].substring(0, 80)}..."</Text>}
              </View>
            )}

            <Text style={k.inputLabel}>Template Name</Text>
            <TextInput value={newTemplateName} onChangeText={setNewTemplateName} placeholder="e.g., Parking Response" placeholderTextColor={colors.text.disabled} style={k.input} />

            <Text style={k.inputLabel}>Response Content</Text>
            <TextInput value={newTemplateContent} onChangeText={setNewTemplateContent} placeholder="Write your template response here..." placeholderTextColor={colors.text.disabled} multiline numberOfLines={6} textAlignVertical="top" style={[k.input, { minHeight: 150 }]} />

            <Text style={{ color: colors.text.disabled, fontSize: 12, marginTop: spacing['2'] }}>Tip: Use placeholders like [guest_name] or [property_name] for personalization.</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// Coverage Score Card
function CoverageScoreCard({ percentage, headline, summary, actionRequired }: { percentage: number; headline: string; summary: string; actionRequired: boolean; }) {
  const color = getCoverageColor(percentage);
  const label = getCoverageLabel(percentage);
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={k.scoreCard}>
      <View style={k.row}>
        <View style={{ marginRight: spacing['4'] }}>
          <View style={[k.circleOuter, { borderColor: `${color}30` }]}>
            <View style={[k.circleInner, { backgroundColor: `${color}15` }]}>
              <Text style={{ fontSize: 24, fontFamily: typography.fontFamily.bold, color }}>{percentage}</Text>
              <Text style={{ fontSize: 12, color }}>%</Text>
            </View>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <View style={[k.row, { marginBottom: 4 }]}>
            <View style={[k.labelBadge, { backgroundColor: `${color}20` }]}><Text style={{ fontSize: 12, fontFamily: typography.fontFamily.medium, color }}>{label}</Text></View>
            {actionRequired && <AlertTriangle size={14} color="#F59E0B" />}
          </View>
          <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 16 }}>{headline}</Text>
          <Text style={{ color: colors.text.muted, fontSize: 12, marginTop: 4 }}>{summary}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// Tab Button
function TabButton({ label, icon, isSelected, onPress, badge }: { label: string; icon: React.ReactNode; isSelected: boolean; onPress: () => void; badge?: number; }) {
  return (
    <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} style={({ pressed }) => [k.tabBtn, isSelected && k.tabBtnActive, { opacity: pressed ? 0.7 : 1 }]}>
      {icon}
      <Text style={[k.tabBtnLabel, isSelected && k.tabBtnLabelActive]}>{label}</Text>
      {badge !== undefined && badge > 0 && <View style={k.badge}><Text style={k.badgeText}>{badge}</Text></View>}
    </Pressable>
  );
}

// Overview Tab
function OverviewTab({ report }: { report: CoverageReport }) {
  return (
    <View style={{ paddingHorizontal: spacing['4'], paddingVertical: spacing['4'] }}>
      <View style={{ flexDirection: 'row', marginBottom: spacing['4'] }}>
        <StatCard icon={<Database size={18} color="#3B82F6" />} label="Knowledge" value={`${report.knowledgeCoveragePercentage}%`} color="#3B82F6" delay={0} />
        <View style={{ width: spacing['3'] }} />
        <StatCard icon={<FileText size={18} color="#8B5CF6" />} label="Templates" value={`${report.templateCoveragePercentage}%`} color="#8B5CF6" delay={100} />
      </View>

      <Animated.View entering={FadeInDown.delay(200).duration(300)} style={{ marginBottom: spacing['4'] }}>
        <Text style={k.sectionTitle}>Coverage by Category</Text>
        {report.categoryBreakdown.map((cat, idx) => <CategoryRow key={cat.category.id} stats={cat} index={idx} />)}
        {report.categoryBreakdown.length === 0 && (
          <View style={[k.card, { alignItems: 'center' }]}><MessageSquare size={24} color="#64748B" /><Text style={{ color: colors.text.disabled, fontSize: 14, marginTop: spacing['2'] }}>No questions analyzed yet</Text></View>
        )}
      </Animated.View>

      {report.topRepeatedQuestions.length > 0 && (
        <Animated.View entering={FadeInDown.delay(300).duration(300)}>
          <Text style={k.sectionTitle}>Frequently Asked</Text>
          {report.topRepeatedQuestions.slice(0, 5).map((q, idx) => <QuestionRow key={q.id} question={q} index={idx} />)}
        </Animated.View>
      )}
    </View>
  );
}

// Stat Card
function StatCard({ icon, label, value, color, delay }: { icon: React.ReactNode; label: string; value: string; color: string; delay: number; }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)} style={[k.statCard, { borderWidth: 1, borderColor: colors.border.subtle }]}>
      <View style={[k.row, { marginBottom: spacing['2'] }]}>
        <View style={[k.smallIconBox, { backgroundColor: `${color}20` }]}>{icon}</View>
        <Text style={{ color: colors.text.muted, fontSize: 14 }}>{label}</Text>
      </View>
      <Text style={{ color: colors.text.primary, fontSize: 24, fontFamily: typography.fontFamily.bold }}>{value}</Text>
    </Animated.View>
  );
}

// Category Row
function CategoryRow({ stats, index }: { stats: CategoryCoverageStats; index: number }) {
  const color = getCoverageColor(stats.coveragePercentage);
  return (
    <Animated.View entering={SlideInRight.delay(index * 50).duration(300)} style={k.catRow}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text.secondary, fontSize: 14, fontFamily: typography.fontFamily.medium }}>{stats.category.name}</Text>
        <Text style={{ color: colors.text.disabled, fontSize: 12, marginTop: 2 }}>{stats.totalQuestions} question{stats.totalQuestions !== 1 ? 's' : ''}</Text>
      </View>
      <View style={k.progressTrack}><View style={[k.progressBar, { width: `${stats.coveragePercentage}%`, backgroundColor: color }]} /></View>
      <Text style={{ fontSize: 14, fontFamily: typography.fontFamily.medium, width: 40, textAlign: 'right', color }}>{stats.coveragePercentage}%</Text>
    </Animated.View>
  );
}

// Question Row
function QuestionRow({ question, index }: { question: AnalyzedQuestion; index: number }) {
  const hasGoodCoverage = question.hasKnowledgeCoverage || question.hasTemplateCoverage;
  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)} style={k.questionRow}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text.secondary, fontSize: 14 }} numberOfLines={2}>"{question.content.substring(0, 80)}{question.content.length > 80 ? '...' : ''}"</Text>
          <View style={[k.row, { marginTop: spacing['2'] }]}>
            <View style={[k.row, k.miniPill]}><MessageSquare size={10} color={colors.text.muted} /><Text style={{ color: colors.text.muted, fontSize: 12, marginLeft: 4 }}>{question.occurrences}x</Text></View>
            {hasGoodCoverage ? (
              <View style={k.row}><CheckCircle size={12} color="#10B981" /><Text style={{ color: '#10B981', fontSize: 12, marginLeft: 4 }}>Covered</Text></View>
            ) : (
              <View style={k.row}><AlertTriangle size={12} color="#F59E0B" /><Text style={{ color: '#F59E0B', fontSize: 12, marginLeft: 4 }}>Needs template</Text></View>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// Gaps Tab
function GapsTab({ gaps, onCreateTemplate }: { gaps: CoverageGap[]; onCreateTemplate: (gap: CoverageGap) => void; }) {
  const highImpact = gaps.filter(g => g.impact === 'high');
  const mediumImpact = gaps.filter(g => g.impact === 'medium');
  const lowImpact = gaps.filter(g => g.impact === 'low');
  if (gaps.length === 0) {
    return (
      <View style={{ paddingHorizontal: spacing['4'], paddingVertical: spacing['8'], alignItems: 'center' }}>
        <View style={[k.emptyIcon, { backgroundColor: '#10B98120' }]}><CheckCircle size={32} color="#10B981" /></View>
        <Text style={k.emptyTitle}>No Coverage Gaps</Text>
        <Text style={k.emptySubtitle}>Your knowledge base and templates cover all common questions.</Text>
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: spacing['4'], paddingVertical: spacing['4'] }}>
      {highImpact.length > 0 && <GapSection title="High Priority" gaps={highImpact} color="#EF4444" onCreateTemplate={onCreateTemplate} />}
      {mediumImpact.length > 0 && <GapSection title="Medium Priority" gaps={mediumImpact} color="#F59E0B" onCreateTemplate={onCreateTemplate} />}
      {lowImpact.length > 0 && <GapSection title="Low Priority" gaps={lowImpact} color="#64748B" onCreateTemplate={onCreateTemplate} />}
    </View>
  );
}

// Gap Section
function GapSection({ title, gaps, color, onCreateTemplate }: { title: string; gaps: CoverageGap[]; color: string; onCreateTemplate: (gap: CoverageGap) => void; }) {
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={{ marginBottom: spacing['4'] }}>
      <View style={[k.row, { marginBottom: spacing['3'] }]}>
        <View style={{ width: 12, height: 12, borderRadius: radius.full, backgroundColor: color, marginRight: spacing['2'] }} />
        <Text style={k.sectionTitle}>{title}</Text>
        <Text style={{ color: colors.text.disabled, fontSize: 14, marginLeft: spacing['2'] }}>({gaps.length})</Text>
      </View>
      {gaps.map((gap, idx) => <GapCard key={gap.id} gap={gap} index={idx} onCreateTemplate={onCreateTemplate} />)}
    </Animated.View>
  );
}

// Gap Card
function GapCard({ gap, index, onCreateTemplate }: { gap: CoverageGap; index: number; onCreateTemplate: (gap: CoverageGap) => void; }) {
  const impactColor = gap.impact === 'high' ? '#EF4444' : gap.impact === 'medium' ? '#F59E0B' : '#64748B';
  return (
    <Animated.View entering={SlideInRight.delay(index * 50).duration(300)} style={[k.gapCard, { borderLeftColor: impactColor }]}>
      <View style={[k.row, { justifyContent: 'space-between', marginBottom: spacing['2'] }]}>
        <View style={k.row}>
          <View style={[k.labelBadge, { backgroundColor: `${impactColor}20` }]}><Text style={{ fontSize: 12, fontFamily: typography.fontFamily.medium, color: impactColor, textTransform: 'capitalize' }}>{gap.category}</Text></View>
          <Text style={{ color: colors.text.disabled, fontSize: 12, marginLeft: spacing['2'] }}>{gap.frequency}x asked</Text>
        </View>
      </View>
      <Text style={{ color: colors.text.secondary, fontSize: 14, marginBottom: spacing['2'] }}>{gap.description}</Text>
      <View style={[k.row, { justifyContent: 'space-between', marginTop: spacing['2'] }]}>
        <Text style={{ color: colors.text.disabled, fontSize: 12, flex: 1 }}>{gap.suggestedFix}</Text>
        {gap.canAutoFix && (
          <Pressable onPress={() => onCreateTemplate(gap)} style={({ pressed }) => [k.templateBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <Plus size={14} color="#10B981" /><Text style={{ color: '#10B981', fontSize: 12, fontFamily: typography.fontFamily.medium, marginLeft: 4 }}>Template</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

// Alerts Tab
function AlertsTab({ alerts, onDismiss }: { alerts: CoverageAlert[]; onDismiss: (id: string) => void; }) {
  if (alerts.length === 0) {
    return (
      <View style={{ paddingHorizontal: spacing['4'], paddingVertical: spacing['8'], alignItems: 'center' }}>
        <View style={[k.emptyIcon, { backgroundColor: '#10B98120' }]}><Bell size={32} color="#10B981" /></View>
        <Text style={k.emptyTitle}>All Clear</Text>
        <Text style={k.emptySubtitle}>No coverage alerts at this time.</Text>
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: spacing['4'], paddingVertical: spacing['4'] }}>
      {alerts.map((alert, idx) => <AlertCard key={alert.id} alert={alert} index={idx} onDismiss={onDismiss} />)}
    </View>
  );
}

// Alert Card
function AlertCard({ alert, index, onDismiss }: { alert: CoverageAlert; index: number; onDismiss: (id: string) => void; }) {
  const severityColor = alert.severity === 'high' ? '#EF4444' : alert.severity === 'medium' ? '#F59E0B' : '#64748B';
  const severityBg = `${severityColor}20`;
  const getAlertIcon = () => {
    switch (alert.type) {
      case 'new_question_type': return <HelpCircle size={18} color={severityColor} />;
      case 'coverage_drop': return <TrendingDown size={18} color={severityColor} />;
      case 'repeated_gap': return <RefreshCw size={18} color={severityColor} />;
      case 'slow_response': return <AlertTriangle size={18} color={severityColor} />;
      default: return <Bell size={18} color={severityColor} />;
    }
  };
  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)} style={k.alertCard}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={[k.iconBox, { backgroundColor: severityBg }]}>{getAlertIcon()}</View>
        <View style={{ flex: 1 }}>
          <View style={[k.row, { justifyContent: 'space-between', marginBottom: 4 }]}>
            <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 14, flex: 1 }}>{alert.title}</Text>
            <Pressable onPress={() => onDismiss(alert.id)} style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.5 : 1 })}><X size={16} color="#64748B" /></Pressable>
          </View>
          <Text style={{ color: colors.text.muted, fontSize: 12 }}>{alert.description}</Text>
          <View style={[k.row, { marginTop: spacing['2'] }]}>
            <View style={[k.labelBadge, { backgroundColor: severityBg }]}><Text style={{ fontSize: 12, fontFamily: typography.fontFamily.medium, color: severityColor, textTransform: 'capitalize' }}>{alert.severity}</Text></View>
            {alert.category && <Text style={{ color: colors.text.disabled, fontSize: 12, marginLeft: spacing['2'] }}>{alert.category}</Text>}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// Compact Badge for use in other screens
export function CoverageBadge({ conversations, templates, propertyKnowledge, propertyId, onPress }: { conversations: any[]; templates: QuickReplyTemplate[]; propertyKnowledge: Record<string, PropertyKnowledge>; propertyId?: string | null; onPress?: () => void; }) {
  const report = useMemo(() => analyzeKnowledgeCoverage(conversations, templates, propertyKnowledge, propertyId || null), [conversations, templates, propertyKnowledge, propertyId]);
  const color = getCoverageColor(report.coveragePercentage);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [k.coverageBadge, { opacity: pressed ? 0.7 : 1 }]}>
      <Target size={14} color={color} />
      <Text style={{ fontSize: 14, fontFamily: typography.fontFamily.medium, marginLeft: spacing['1.5'], color }}>{report.coveragePercentage}%</Text>
      {report.gaps.filter(g => g.impact === 'high').length > 0 && <View style={k.redDot} />}
    </Pressable>
  );
}

const k = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  row: { flexDirection: 'row', alignItems: 'center' },
  card: { backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing['4'] },
  headerTitle: { color: colors.text.primary, fontSize: 18, fontFamily: typography.fontFamily.semibold },
  iconBox: { width: 40, height: 40, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  closeBtn: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center' },
  scoreCard: { backgroundColor: 'rgba(30,41,59,0.6)', borderRadius: radius['2xl'], padding: spacing['4'], borderWidth: 1, borderColor: 'rgba(51,65,85,0.5)' },
  circleOuter: { width: 80, height: 80, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 4 },
  circleInner: { width: 64, height: 64, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  labelBadge: { paddingHorizontal: spacing['2'], paddingVertical: 2, borderRadius: radius.full, marginRight: spacing['2'] },
  tabBar: { flexDirection: 'row', paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  tabBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing['4'], paddingVertical: spacing['2'], borderRadius: radius.full, marginRight: spacing['2'] },
  tabBtnActive: { backgroundColor: colors.bg.card },
  tabBtnLabel: { fontSize: 14, marginLeft: spacing['1.5'], color: colors.text.disabled },
  tabBtnLabelActive: { color: colors.text.primary, fontFamily: typography.fontFamily.medium },
  badge: { width: 20, height: 20, borderRadius: radius.full, backgroundColor: colors.danger.DEFAULT, alignItems: 'center', justifyContent: 'center', marginLeft: spacing['1.5'] },
  badgeText: { color: colors.text.primary, fontSize: 12, fontFamily: typography.fontFamily.bold },
  sectionTitle: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 16, marginBottom: spacing['3'] },
  statCard: { flex: 1, backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing['4'] },
  smallIconBox: { width: 32, height: 32, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginRight: spacing['2'] },
  catRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30,41,59,0.3)', borderRadius: radius.xl, padding: spacing['3'], marginBottom: spacing['2'] },
  progressTrack: { width: 96, height: 8, backgroundColor: colors.bg.hover, borderRadius: radius.full, marginRight: spacing['3'], overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: radius.full },
  questionRow: { backgroundColor: 'rgba(30,41,59,0.3)', borderRadius: radius.xl, padding: spacing['3'], marginBottom: spacing['2'] },
  miniPill: { backgroundColor: 'rgba(51,65,85,0.5)', borderRadius: radius.full, paddingHorizontal: spacing['2'], paddingVertical: 2, marginRight: spacing['2'] },
  emptyIcon: { width: 64, height: 64, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginBottom: spacing['4'] },
  emptyTitle: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 18 },
  emptySubtitle: { color: colors.text.muted, fontSize: 14, textAlign: 'center', marginTop: spacing['2'] },
  gapCard: { backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing['4'], marginBottom: spacing['2'], borderLeftWidth: 2 },
  templateBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B98120', borderRadius: radius.full, paddingHorizontal: spacing['3'], paddingVertical: spacing['1.5'], marginLeft: spacing['2'] },
  alertCard: { backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing['4'], marginBottom: spacing['3'], borderWidth: 1, borderColor: 'rgba(51,65,85,0.3)' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  inputLabel: { color: colors.text.muted, fontSize: 14, marginBottom: spacing['2'] },
  input: { backgroundColor: colors.bg.card, borderRadius: radius.xl, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], color: colors.text.primary, fontSize: 16, marginBottom: spacing['4'] },
  gapInfo: { backgroundColor: '#F59E0B10', borderRadius: radius.xl, padding: spacing['4'], marginBottom: spacing['4'], borderWidth: 1, borderColor: '#F59E0B20' },
  coverageBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.card, borderRadius: radius.full, paddingHorizontal: spacing['3'], paddingVertical: spacing['1.5'] },
  redDot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.danger.DEFAULT, marginLeft: spacing['1.5'] },
});
