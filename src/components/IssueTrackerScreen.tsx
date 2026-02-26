import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Modal, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useAppStore, Issue } from '@/lib/store';
import { ArrowLeft, AlertTriangle, Wrench, Sparkles, Volume2, Key, HelpCircle, Plus, AlertCircle, X, ChevronDown, Bug, Zap, FileWarning, DollarSign } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

interface IssueTrackerScreenProps { onBack: () => void; }

type IssueCategory = Issue['category'];
type IssuePriority = Issue['priority'];
type IssueStatus = Issue['status'];

const categoryIcons: Record<IssueCategory, React.ReactNode> = {
  maintenance: <Wrench size={18} color="#F97316" />,
  cleanliness: <Sparkles size={18} color="#14B8A6" />,
  amenity: <AlertTriangle size={18} color="#EAB308" />,
  noise: <Volume2 size={18} color="#8B5CF6" />,
  access: <Key size={18} color="#EC4899" />,
  lease_violation: <FileWarning size={18} color="#EF4444" />,
  rent_delinquency: <DollarSign size={18} color="#F97316" />,
  pest: <Bug size={18} color="#A855F7" />,
  utility: <Zap size={18} color="#06B6D4" />,
  other: <HelpCircle size={18} color="#64748B" />,
};

const categoryLabels: Record<IssueCategory, string> = {
  maintenance: 'Maintenance', cleanliness: 'Cleanliness', amenity: 'Amenity',
  noise: 'Noise', access: 'Access', lease_violation: 'Lease Violation',
  rent_delinquency: 'Late Rent', pest: 'Pest', utility: 'Utility', other: 'Other',
};

const priorityColors: Record<IssuePriority, string> = { low: '#22C55E', medium: '#EAB308', high: '#F97316', urgent: '#EF4444' };

const statusStyles: Record<IssueStatus, { bg: string; text: string }> = {
  open: { bg: '#EF444420', text: '#F87171' },
  in_progress: { bg: '#EAB30820', text: '#FACC15' },
  resolved: { bg: '#22C55E20', text: '#4ADE80' },
};

export function IssueTrackerScreen({ onBack }: IssueTrackerScreenProps) {
  const issues = useAppStore((s) => s.issues);
  const conversations = useAppStore((s) => s.conversations);
  const addIssue = useAppStore((s) => s.addIssue);
  const updateIssue = useAppStore((s) => s.updateIssue);
  const resolveIssue = useAppStore((s) => s.resolveIssue);
  const incrementAnalytic = useAppStore((s) => s.incrementAnalytic);

  const [filterStatus, setFilterStatus] = useState<IssueStatus | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [newCategory, setNewCategory] = useState<IssueCategory>('maintenance');
  const [newPriority, setNewPriority] = useState<IssuePriority>('medium');
  const [newDescription, setNewDescription] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const filteredIssues = useMemo(() => filterStatus === 'all' ? issues : issues.filter((i) => i.status === filterStatus), [issues, filterStatus]);

  const stats = useMemo(() => ({
    open: issues.filter((i) => i.status === 'open').length,
    inProgress: issues.filter((i) => i.status === 'in_progress').length,
    resolved: issues.filter((i) => i.status === 'resolved').length,
    urgent: issues.filter((i) => i.priority === 'urgent' && i.status !== 'resolved').length,
  }), [issues]);

  const handleCreateIssue = () => {
    if (!newDescription.trim()) return;
    addIssue({ id: `issue-${Date.now()}`, conversationId: selectedConversationId || '', category: newCategory, description: newDescription, status: 'open', priority: newPriority, createdAt: new Date() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewDescription(''); setNewCategory('maintenance'); setNewPriority('medium'); setSelectedConversationId(null); setShowCreateModal(false);
  };

  const handleResolveIssue = (issueId: string) => { resolveIssue(issueId); incrementAnalytic('issuesResolved'); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setShowDetailModal(false); };
  const handleUpdateStatus = (issueId: string, status: IssueStatus) => { updateIssue(issueId, { status }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); };

  const renderIssueItem = ({ item }: { item: Issue }) => {
    const conversation = conversations.find((c) => c.id === item.conversationId);
    return (
      <Pressable onPress={() => { setSelectedIssue(item); setShowDetailModal(true); }} style={({ pressed }) => [it.card, { opacity: pressed ? 0.8 : 1 }]}>
        <View style={it.rowBetween}>
          <View style={[it.rowCenter, { flex: 1 }]}>
            <View style={it.catIcon}>{categoryIcons[item.category]}</View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.semibold }} numberOfLines={1}>{categoryLabels[item.category]}</Text>
              <Text style={{ color: colors.text.muted, fontSize: 14 }} numberOfLines={2}>{item.description}</Text>
            </View>
          </View>
          <View style={{ width: 12, height: 12, borderRadius: 6, marginLeft: spacing['2'], backgroundColor: priorityColors[item.priority] }} />
        </View>
        <View style={[it.rowBetween, { marginTop: spacing['3'], paddingTop: spacing['3'], borderTopWidth: 1, borderTopColor: colors.border.DEFAULT }]}>
          <View style={it.rowCenter}>
            <View style={{ backgroundColor: statusStyles[item.status].bg, paddingHorizontal: spacing['2'], paddingVertical: 4, borderRadius: radius.full }}>
              <Text style={{ color: statusStyles[item.status].text, fontSize: 12, fontFamily: typography.fontFamily.medium }}>{item.status === 'in_progress' ? 'In Progress' : item.status.charAt(0).toUpperCase() + item.status.slice(1)}</Text>
            </View>
            {conversation && <Text style={{ color: colors.text.disabled, fontSize: 12, marginLeft: spacing['2'] }}>{conversation.guest.name}</Text>}
          </View>
          <Text style={{ color: colors.text.disabled, fontSize: 12 }}>{format(new Date(item.createdAt), 'MMM d, h:mm a')}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={it.root}>
      <LinearGradient colors={[colors.bg.subtle, colors.bg.base]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 200 }} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={{ paddingHorizontal: spacing['4'], paddingVertical: spacing['3'] }}>
          <View style={it.rowBetween}>
            <View style={it.rowCenter}>
              <Pressable onPress={onBack} style={({ pressed }) => [it.backBtn, { opacity: pressed ? 0.7 : 1 }]}><ArrowLeft size={20} color={colors.text.primary} /></Pressable>
              <Text style={it.title}>Issue Tracker</Text>
            </View>
            <Pressable onPress={() => setShowCreateModal(true)} style={({ pressed }) => [it.addBtn, { opacity: pressed ? 0.8 : 1 }]}><Plus size={22} color="#FFFFFF" /></Pressable>
          </View>
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInDown.duration(300).delay(100)} style={{ paddingHorizontal: spacing['4'], paddingBottom: spacing['4'] }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[it.rowCenter, { gap: spacing['3'] }]}>
              <View style={[it.statBadge, { backgroundColor: '#EF444420' }]}><Text style={{ color: '#F87171', fontSize: 24, fontFamily: typography.fontFamily.bold }}>{stats.open}</Text><Text style={{ color: '#F87171', fontSize: 12 }}>Open</Text></View>
              <View style={[it.statBadge, { backgroundColor: '#EAB30820' }]}><Text style={{ color: '#FACC15', fontSize: 24, fontFamily: typography.fontFamily.bold }}>{stats.inProgress}</Text><Text style={{ color: '#FACC15', fontSize: 12 }}>In Progress</Text></View>
              <View style={[it.statBadge, { backgroundColor: '#22C55E20' }]}><Text style={{ color: '#4ADE80', fontSize: 24, fontFamily: typography.fontFamily.bold }}>{stats.resolved}</Text><Text style={{ color: '#4ADE80', fontSize: 12 }}>Resolved</Text></View>
              {stats.urgent > 0 && <View style={[it.statBadge, { backgroundColor: '#EF444430', borderWidth: 1, borderColor: '#EF4444' }]}><Text style={{ color: '#F87171', fontSize: 24, fontFamily: typography.fontFamily.bold }}>{stats.urgent}</Text><Text style={{ color: '#F87171', fontSize: 12 }}>Urgent</Text></View>}
            </View>
          </ScrollView>
        </Animated.View>

        {/* Filter Tabs */}
        <View style={{ paddingHorizontal: spacing['4'], paddingBottom: spacing['4'] }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[it.rowCenter, { gap: spacing['2'] }]}>
              {(['all', 'open', 'in_progress', 'resolved'] as const).map((status) => (
                <Pressable key={status} onPress={() => { setFilterStatus(status); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} style={[it.filterTab, { backgroundColor: filterStatus === status ? colors.primary.DEFAULT : colors.bg.card }]}>
                  <Text style={{ fontFamily: typography.fontFamily.medium, color: filterStatus === status ? '#FFFFFF' : colors.text.muted }}>{status === 'all' ? 'All' : status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Issues List */}
        <View style={{ flex: 1, paddingHorizontal: spacing['4'] }}>
          {filteredIssues.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={48} color="#64748B" />
              <Text style={{ color: colors.text.muted, fontSize: 18, marginTop: spacing['4'] }}>No issues found</Text>
              <Text style={{ color: colors.text.disabled, fontSize: 14, marginTop: 4 }}>{filterStatus === 'all' ? 'Create an issue to get started' : `No ${filterStatus} issues`}</Text>
            </View>
          ) : (
            <FlashList data={filteredIssues} renderItem={renderIssueItem} keyExtractor={(item) => item.id} showsVerticalScrollIndicator={false} />
          )}
        </View>
      </SafeAreaView>

      {/* Create Issue Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={it.modalOverlay}>
          <View style={it.modalContent}>
            <SafeAreaView edges={['bottom']}>
              <View style={it.modalHeader}>
                <View style={it.rowBetween}><Text style={it.title}>Create Issue</Text><Pressable onPress={() => setShowCreateModal(false)}><X size={24} color="#64748B" /></Pressable></View>
              </View>
              <ScrollView style={{ padding: spacing['4'] }}>
                <Text style={it.label}>Category</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['2'], marginBottom: spacing['4'] }}>
                  {(Object.keys(categoryLabels) as IssueCategory[]).map((cat) => (
                    <Pressable key={cat} onPress={() => setNewCategory(cat)} style={[it.catChip, { backgroundColor: newCategory === cat ? '#F9731620' : colors.bg.card, borderColor: newCategory === cat ? '#F97316' : colors.border.DEFAULT }]}>
                      {categoryIcons[cat]}<Text style={{ marginLeft: spacing['2'], color: newCategory === cat ? '#F97316' : colors.text.secondary }}>{categoryLabels[cat]}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={it.label}>Priority</Text>
                <View style={[it.rowCenter, { gap: spacing['2'], marginBottom: spacing['4'] }]}>
                  {(['low', 'medium', 'high', 'urgent'] as IssuePriority[]).map((priority) => (
                    <Pressable key={priority} onPress={() => setNewPriority(priority)} style={[it.priorityChip, { backgroundColor: newPriority === priority ? `${priorityColors[priority]}20` : colors.bg.card, borderColor: newPriority === priority ? priorityColors[priority] : colors.border.DEFAULT, borderWidth: newPriority === priority ? 2 : 1 }]}>
                      <Text style={{ color: priorityColors[priority], fontFamily: typography.fontFamily.medium, textTransform: 'capitalize' }}>{priority}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={it.label}>Description</Text>
                <TextInput value={newDescription} onChangeText={setNewDescription} placeholder="Describe the issue..." placeholderTextColor="#64748B" multiline numberOfLines={4} style={it.textArea} />

                <Text style={it.label}>Link to Conversation (optional)</Text>
                <Pressable style={[it.selectRow, { marginBottom: spacing['6'] }]}>
                  <Text style={{ color: colors.text.muted }}>{selectedConversationId ? conversations.find((c) => c.id === selectedConversationId)?.guest.name || 'Selected' : 'Select conversation...'}</Text>
                  <ChevronDown size={18} color="#64748B" />
                </Pressable>

                <Pressable onPress={handleCreateIssue} style={({ pressed }) => [it.createBtn, { opacity: pressed ? 0.8 : 1 }]}><Text style={{ color: '#FFFFFF', fontFamily: typography.fontFamily.bold, fontSize: 18 }}>Create Issue</Text></Pressable>
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>

      {/* Issue Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" transparent>
        <View style={it.modalOverlay}>
          <View style={[it.modalContent, { maxHeight: '70%' }]}>
            <SafeAreaView edges={['bottom']}>
              <View style={it.modalHeader}>
                <View style={it.rowBetween}>
                  <View style={it.rowCenter}>{selectedIssue && categoryIcons[selectedIssue.category]}<Text style={[it.title, { marginLeft: spacing['2'] }]}>{selectedIssue && categoryLabels[selectedIssue.category]}</Text></View>
                  <Pressable onPress={() => setShowDetailModal(false)}><X size={24} color="#64748B" /></Pressable>
                </View>
              </View>
              {selectedIssue && (
                <ScrollView style={{ padding: spacing['4'] }}>
                  <View style={[it.rowCenter, { marginBottom: spacing['4'] }]}>
                    <View style={{ backgroundColor: statusStyles[selectedIssue.status].bg, paddingHorizontal: spacing['3'], paddingVertical: 4, borderRadius: radius.full, marginRight: spacing['2'] }}>
                      <Text style={{ color: statusStyles[selectedIssue.status].text, fontFamily: typography.fontFamily.medium }}>{selectedIssue.status === 'in_progress' ? 'In Progress' : selectedIssue.status.charAt(0).toUpperCase() + selectedIssue.status.slice(1)}</Text>
                    </View>
                    <View style={{ backgroundColor: `${priorityColors[selectedIssue.priority]}20`, paddingHorizontal: spacing['3'], paddingVertical: 4, borderRadius: radius.full }}>
                      <Text style={{ color: priorityColors[selectedIssue.priority], fontFamily: typography.fontFamily.medium, textTransform: 'capitalize' }}>{selectedIssue.priority}</Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.text.primary, fontSize: 16, marginBottom: spacing['4'] }}>{selectedIssue.description}</Text>
                  <Text style={{ color: colors.text.disabled, fontSize: 14, marginBottom: spacing['6'] }}>Created {format(new Date(selectedIssue.createdAt), 'MMMM d, yyyy at h:mm a')}</Text>

                  <Text style={it.label}>Update Status</Text>
                  <View style={[it.rowCenter, { gap: spacing['2'], marginBottom: spacing['6'] }]}>
                    {selectedIssue.status !== 'open' && <Pressable onPress={() => handleUpdateStatus(selectedIssue.id, 'open')} style={[it.statusBtn, { backgroundColor: '#EF444420' }]}><Text style={{ color: '#F87171', fontFamily: typography.fontFamily.medium }}>Open</Text></Pressable>}
                    {selectedIssue.status !== 'in_progress' && <Pressable onPress={() => handleUpdateStatus(selectedIssue.id, 'in_progress')} style={[it.statusBtn, { backgroundColor: '#EAB30820' }]}><Text style={{ color: '#FACC15', fontFamily: typography.fontFamily.medium }}>In Progress</Text></Pressable>}
                    {selectedIssue.status !== 'resolved' && <Pressable onPress={() => handleResolveIssue(selectedIssue.id)} style={[it.statusBtn, { backgroundColor: '#22C55E20' }]}><Text style={{ color: '#4ADE80', fontFamily: typography.fontFamily.medium }}>Resolved</Text></Pressable>}
                  </View>
                </ScrollView>
              )}
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const it = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text.primary, fontSize: 20, fontFamily: typography.fontFamily.bold },
  label: { color: colors.text.muted, fontSize: 14, marginBottom: spacing['2'] },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  addBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.primary.DEFAULT, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing['4'], marginBottom: spacing['3'] },
  catIcon: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.border.DEFAULT, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  statBadge: { borderRadius: radius.xl, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], minWidth: 80 },
  filterTab: { paddingHorizontal: spacing['4'], paddingVertical: spacing['2'], borderRadius: radius.full },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.bg.base, borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'], maxHeight: '80%' },
  modalHeader: { padding: spacing['4'], borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT },
  catChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing['3'], paddingVertical: spacing['2'], borderRadius: radius.lg, borderWidth: 1 },
  priorityChip: { flex: 1, paddingVertical: spacing['2'], borderRadius: radius.lg, alignItems: 'center' },
  textArea: { backgroundColor: colors.bg.card, borderRadius: radius.lg, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], color: colors.text.primary, minHeight: 100, marginBottom: spacing['4'], textAlignVertical: 'top' },
  selectRow: { backgroundColor: colors.bg.card, borderRadius: radius.lg, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  createBtn: { backgroundColor: colors.primary.DEFAULT, paddingVertical: spacing['4'], borderRadius: radius.xl, alignItems: 'center', marginBottom: spacing['4'] },
  statusBtn: { flex: 1, paddingVertical: spacing['3'], borderRadius: radius.xl, alignItems: 'center' },
});
