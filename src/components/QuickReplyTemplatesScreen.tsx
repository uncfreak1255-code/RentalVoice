import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Modal, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore, type QuickReplyTemplate } from '@/lib/store';
import { ArrowLeft, Plus, FileText, Upload, Star, Trash2, Edit3, X, Check, ChevronRight, Tag, MessageSquare, Search, Filter, Copy } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { analyzeTemplate, parseTemplatesFromCSV, parseTemplatesFromText } from '@/lib/ai-learning';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

interface QuickReplyTemplatesScreenProps { onBack: () => void; }

const CATEGORY_LABELS: Record<QuickReplyTemplate['category'], string> = {
  wifi: 'WiFi', check_in: 'Check-in', check_out: 'Check-out', parking: 'Parking',
  amenities: 'Amenities', issue: 'Issues', thanks: 'Thank You', booking: 'Booking', general: 'General',
};

const CATEGORY_COLORS: Record<QuickReplyTemplate['category'], string> = {
  wifi: '#3B82F6', check_in: '#22C55E', check_out: '#F59E0B', parking: '#8B5CF6',
  amenities: '#EC4899', issue: '#EF4444', thanks: '#14B8A6', booking: '#6366F1', general: '#64748B',
};

export function QuickReplyTemplatesScreen({ onBack }: QuickReplyTemplatesScreenProps) {
  const templates = useAppStore((s) => s.quickReplyTemplates);
  const favoriteMessages = useAppStore((s) => s.favoriteMessages);
  const properties = useAppStore((s) => s.properties);
  const addTemplate = useAppStore((s) => s.addQuickReplyTemplate);
  const updateTemplate = useAppStore((s) => s.updateQuickReplyTemplate);
  const deleteTemplate = useAppStore((s) => s.deleteQuickReplyTemplate);
  const importTemplatesFromCSV = useAppStore((s) => s.importTemplatesFromCSV);
  const convertFavoriteToTemplate = useAppStore((s) => s.convertFavoriteToTemplate);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<QuickReplyTemplate['category'] | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QuickReplyTemplate | null>(null);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<QuickReplyTemplate['category']>('general');
  const [newKeywords, setNewKeywords] = useState('');
  const [newPropertyId, setNewPropertyId] = useState<string | null>(null);
  const [importText, setImportText] = useState('');

  const filteredTemplates = useMemo(() => {
    let result = templates;
    if (selectedCategory !== 'all') result = result.filter((t) => t.category === selectedCategory);
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(query) || t.content.toLowerCase().includes(query) || t.keywords.some((k) => k.toLowerCase().includes(query)));
    }
    return result.sort((a, b) => b.usageCount - a.usageCount);
  }, [templates, selectedCategory, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: templates.length };
    for (const t of templates) { counts[t.category] = (counts[t.category] || 0) + 1; }
    return counts;
  }, [templates]);

  const handleSaveTemplate = useCallback(() => {
    if (!newName.trim() || !newContent.trim()) { Alert.alert('Missing Information', 'Please enter a name and content for the template.'); return; }
    const analysis = analyzeTemplate(newContent);
    const keywords = newKeywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
    if (editingTemplate) {
      updateTemplate(editingTemplate.id, { name: newName.trim(), content: newContent.trim(), category: newCategory, keywords: [...keywords, ...analysis.suggestedKeywords], propertyId: newPropertyId, analyzedTone: analysis.tone, analyzedLength: analysis.length });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      const template: QuickReplyTemplate = { id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, name: newName.trim(), content: newContent.trim(), category: newCategory, keywords: [...keywords, ...analysis.suggestedKeywords], propertyId: newPropertyId, priority: 5, source: 'manual', usageCount: 0, lastUsed: null, analyzedTone: analysis.tone, analyzedLength: analysis.length, createdAt: new Date(), updatedAt: new Date() };
      addTemplate(template);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    resetForm(); setShowAddModal(false); setEditingTemplate(null);
  }, [newName, newContent, newCategory, newKeywords, newPropertyId, editingTemplate, addTemplate, updateTemplate]);

  const handleImport = useCallback(() => {
    if (!importText.trim()) { Alert.alert('No Content', 'Please paste your templates content.'); return; }
    let parsed = parseTemplatesFromCSV(importText);
    if (parsed.length === 0) parsed = parseTemplatesFromText(importText);
    if (parsed.length === 0) { Alert.alert('No Templates Found', 'Could not parse any templates from the provided content. Try using CSV format (name,content) or separate templates with blank lines.'); return; }
    importTemplatesFromCSV(parsed.map((p) => ({ ...p, propertyId: null, priority: 5, source: 'csv_import' as const })));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Import Successful', `Imported ${parsed.length} templates.`);
    setImportText(''); setShowImportModal(false);
  }, [importText, importTemplatesFromCSV]);

  const handleDeleteTemplate = useCallback((template: QuickReplyTemplate) => {
    Alert.alert('Delete Template', `Are you sure you want to delete "${template.name}"?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { deleteTemplate(template.id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } }]);
  }, [deleteTemplate]);

  const handleEditTemplate = useCallback((template: QuickReplyTemplate) => {
    setEditingTemplate(template); setNewName(template.name); setNewContent(template.content); setNewCategory(template.category); setNewKeywords(template.keywords.join(', ')); setNewPropertyId(template.propertyId); setShowAddModal(true);
  }, []);

  const resetForm = useCallback(() => { setNewName(''); setNewContent(''); setNewCategory('general'); setNewKeywords(''); setNewPropertyId(null); setEditingTemplate(null); }, []);

  const handleConvertFavorite = useCallback((favoriteId: string, content: string) => {
    const analysis = analyzeTemplate(content);
    convertFavoriteToTemplate(favoriteId, { category: (analysis.detectedIntents[0] as QuickReplyTemplate['category']) || 'general', keywords: analysis.suggestedKeywords });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [convertFavoriteToTemplate]);

  return (
    <View style={st.root}>
      <LinearGradient colors={[colors.bg.subtle, colors.bg.base]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 150 }} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={[st.row, { paddingHorizontal: spacing['4'], paddingVertical: spacing['3'] }]}>
          <Pressable onPress={onBack} style={({ pressed }) => [st.backBtn, { opacity: pressed ? 0.7 : 1 }]}><ArrowLeft size={20} color="#FFFFFF" /></Pressable>
          <View style={{ flex: 1 }}><Text style={st.title}>Quick Reply Templates</Text><Text style={{ color: colors.text.muted, fontSize: 14 }}>{templates.length} templates</Text></View>
        </Animated.View>

        {/* Actions */}
        <View style={[st.row, { paddingHorizontal: spacing['4'], marginBottom: spacing['4'] }]}>
          <Pressable onPress={() => { resetForm(); setShowAddModal(true); }} style={({ pressed }) => [st.addBtn, { opacity: pressed ? 0.8 : 1 }]}>
            <Plus size={18} color="#FFFFFF" /><Text style={{ color: '#FFFFFF', fontFamily: typography.fontFamily.semibold, marginLeft: spacing['2'] }}>Add Template</Text>
          </Pressable>
          <Pressable onPress={() => setShowImportModal(true)} style={({ pressed }) => [st.importBtn, { opacity: pressed ? 0.8 : 1 }]}>
            <Upload size={18} color="#94A3B8" /><Text style={{ color: colors.text.secondary, fontFamily: typography.fontFamily.medium, marginLeft: spacing['2'] }}>Import</Text>
          </Pressable>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: spacing['4'], marginBottom: spacing['4'] }}>
          <View style={[st.row, st.searchBox]}>
            <Search size={18} color="#64748B" />
            <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search templates..." placeholderTextColor="#64748B" style={{ flex: 1, color: colors.text.primary, marginLeft: spacing['3'] }} />
          </View>
        </View>

        {/* Category Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: spacing['4'], marginBottom: spacing['4'], flexGrow: 0 }}>
          <Pressable onPress={() => setSelectedCategory('all')} style={[st.catPill, { backgroundColor: selectedCategory === 'all' ? '#14B8A6' : colors.bg.card }]}>
            <Text style={{ color: selectedCategory === 'all' ? '#FFFFFF' : colors.text.muted, fontFamily: selectedCategory === 'all' ? typography.fontFamily.medium : undefined }}>All ({categoryCounts.all || 0})</Text>
          </Pressable>
          {(Object.keys(CATEGORY_LABELS) as QuickReplyTemplate['category'][]).map((cat) => (
            <Pressable key={cat} onPress={() => setSelectedCategory(cat)} style={[st.catPill, { backgroundColor: selectedCategory === cat ? '#14B8A6' : colors.bg.card }]}>
              <Text style={{ color: selectedCategory === cat ? '#FFFFFF' : colors.text.muted, fontFamily: selectedCategory === cat ? typography.fontFamily.medium : undefined }}>{CATEGORY_LABELS[cat]} ({categoryCounts[cat] || 0})</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView style={{ flex: 1, paddingHorizontal: spacing['4'] }} showsVerticalScrollIndicator={false}>
          {/* Favorite Messages Section */}
          {favoriteMessages.length > 0 && (
            <Animated.View entering={FadeInDown.delay(100).duration(400)} style={{ marginBottom: spacing['6'] }}>
              <Text style={st.sectionLabel}>Saved Favorites ({favoriteMessages.length})</Text>
              <View style={st.card}>
                {favoriteMessages.slice(0, 3).map((fav, index) => (
                  <Pressable key={fav.id} onPress={() => handleConvertFavorite(fav.id, fav.content)} style={({ pressed }) => [{ padding: spacing['4'], opacity: pressed ? 0.7 : 1 }, index < Math.min(favoriteMessages.length, 3) - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <View style={[st.favIcon]}><Star size={16} color="#F59E0B" /></View>
                      <View style={{ flex: 1 }}><Text style={{ color: colors.text.primary, fontSize: 14 }} numberOfLines={2}>{fav.content}</Text><Text style={{ color: colors.text.disabled, fontSize: 12, marginTop: 4 }}>Tap to convert to template</Text></View>
                      <ChevronRight size={16} color="#64748B" />
                    </View>
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Templates List */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <Text style={st.sectionLabel}>Templates</Text>
            {filteredTemplates.length === 0 ? (
              <View style={[st.card, { padding: spacing['8'], alignItems: 'center' }]}>
                <FileText size={48} color="#64748B" />
                <Text style={{ color: colors.text.muted, textAlign: 'center', marginTop: spacing['4'] }}>{searchQuery || selectedCategory !== 'all' ? 'No templates match your search' : 'No templates yet. Add your first template or import from Hostaway/Airbnb.'}</Text>
              </View>
            ) : (
              <View style={{ gap: spacing['3'] }}>
                {filteredTemplates.map((template) => (
                  <View key={template.id} style={st.card}>
                    <View style={[st.row, { alignItems: 'flex-start', marginBottom: spacing['2'] }]}>
                      <View style={{ paddingHorizontal: spacing['2'], paddingVertical: 4, borderRadius: radius.full, marginRight: spacing['2'], backgroundColor: `${CATEGORY_COLORS[template.category]}20` }}>
                        <Text style={{ color: CATEGORY_COLORS[template.category], fontSize: 10, fontWeight: '600' }}>{CATEGORY_LABELS[template.category]}</Text>
                      </View>
                      {template.source === 'favorite' && (
                        <View style={{ backgroundColor: '#F59E0B20', paddingHorizontal: spacing['2'], paddingVertical: 4, borderRadius: radius.full, marginRight: spacing['2'] }}>
                          <Text style={{ color: '#F59E0B', fontSize: 10, fontFamily: typography.fontFamily.semibold }}>Favorite</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }} />
                      <Pressable onPress={() => handleEditTemplate(template)} style={st.iconBtn}><Edit3 size={14} color="#94A3B8" /></Pressable>
                      <Pressable onPress={() => handleDeleteTemplate(template)} style={[st.iconBtn, { backgroundColor: '#EF444420', marginLeft: spacing['2'] }]}><Trash2 size={14} color="#EF4444" /></Pressable>
                    </View>
                    <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.medium, marginBottom: 4 }}>{template.name}</Text>
                    <Text style={{ color: colors.text.muted, fontSize: 14, marginBottom: spacing['3'] }} numberOfLines={3}>{template.content}</Text>
                    <View style={[st.row, { flexWrap: 'wrap' }]}>
                      {template.keywords.slice(0, 4).map((keyword, i) => (
                        <View key={i} style={{ backgroundColor: colors.border.DEFAULT, borderRadius: radius.full, paddingHorizontal: spacing['2'], paddingVertical: 4, marginRight: 4, marginBottom: 4 }}>
                          <Text style={{ color: colors.text.muted, fontSize: 12 }}>{keyword}</Text>
                        </View>
                      ))}
                      {template.usageCount > 0 && <Text style={{ color: colors.text.disabled, fontSize: 12, marginLeft: 'auto' }}>Used {template.usageCount}x</Text>}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>

          {/* Info */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={[st.infoCard, { marginTop: spacing['6'], marginBottom: spacing['8'] }]}>
            <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.medium, marginBottom: spacing['2'] }}>How Templates Work</Text>
            <Text style={{ color: colors.text.muted, fontSize: 14, lineHeight: 20 }}>Quick reply templates are used as high-priority training data for AI responses. When a guest asks a question that matches a template, the AI will base its response on your preferred template while personalizing it with reservation details.</Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {/* Add/Edit Template Modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={st.modalOverlay}>
            <View style={st.modalContent}>
              <SafeAreaView edges={['bottom']}>
                <View style={st.modalHeader}>
                  <Text style={{ color: colors.text.primary, fontSize: 18, fontFamily: typography.fontFamily.semibold, flex: 1 }}>{editingTemplate ? 'Edit Template' : 'Add Template'}</Text>
                  <Pressable onPress={() => { setShowAddModal(false); resetForm(); }} style={st.closeBtn}><X size={16} color="#94A3B8" /></Pressable>
                </View>
                <ScrollView style={{ padding: spacing['4'] }} keyboardShouldPersistTaps="handled">
                  <Text style={st.label}>Template Name</Text>
                  <TextInput value={newName} onChangeText={setNewName} placeholder="e.g., WiFi Instructions" placeholderTextColor="#64748B" style={st.input} />

                  <Text style={st.label}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing['4'], flexGrow: 0 }}>
                    {(Object.keys(CATEGORY_LABELS) as QuickReplyTemplate['category'][]).map((cat) => (
                      <Pressable key={cat} onPress={() => setNewCategory(cat)} style={[st.catPill, { backgroundColor: newCategory === cat ? '#14B8A6' : colors.border.DEFAULT }]}>
                        <Text style={{ color: newCategory === cat ? '#FFFFFF' : colors.text.muted, fontFamily: newCategory === cat ? typography.fontFamily.medium : undefined }}>{CATEGORY_LABELS[cat]}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Text style={st.label}>Template Content</Text>
                  <TextInput value={newContent} onChangeText={setNewContent} placeholder="Enter your template text here... Use {guest_name}, {property_name}, {wifi_password} for variables." placeholderTextColor="#64748B" multiline numberOfLines={6} textAlignVertical="top" style={[st.input, { minHeight: 120 }]} />

                  <Text style={st.label}>Keywords (comma separated)</Text>
                  <TextInput value={newKeywords} onChangeText={setNewKeywords} placeholder="e.g., wifi, password, internet" placeholderTextColor="#64748B" style={st.input} />

                  {properties.length > 0 && (
                    <>
                      <Text style={st.label}>Property (optional)</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing['4'], flexGrow: 0 }}>
                        <Pressable onPress={() => setNewPropertyId(null)} style={[st.catPill, { backgroundColor: newPropertyId === null ? '#14B8A6' : colors.border.DEFAULT }]}>
                          <Text style={{ color: newPropertyId === null ? '#FFFFFF' : colors.text.muted, fontFamily: newPropertyId === null ? typography.fontFamily.medium : undefined }}>All Properties</Text>
                        </Pressable>
                        {properties.map((prop) => (
                          <Pressable key={prop.id} onPress={() => setNewPropertyId(prop.id)} style={[st.catPill, { backgroundColor: newPropertyId === prop.id ? '#14B8A6' : colors.border.DEFAULT }]}>
                            <Text style={{ color: newPropertyId === prop.id ? '#FFFFFF' : colors.text.muted, fontFamily: newPropertyId === prop.id ? typography.fontFamily.medium : undefined }}>{prop.name}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </>
                  )}

                  <Pressable onPress={handleSaveTemplate} style={({ pressed }) => [st.saveBtn, { opacity: pressed ? 0.8 : 1 }]}>
                    <View style={st.row}><Check size={18} color="#FFFFFF" /><Text style={{ color: '#FFFFFF', fontFamily: typography.fontFamily.semibold, marginLeft: spacing['2'] }}>{editingTemplate ? 'Save Changes' : 'Add Template'}</Text></View>
                  </Pressable>
                </ScrollView>
              </SafeAreaView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Import Modal */}
      <Modal visible={showImportModal} transparent animationType="slide" onRequestClose={() => setShowImportModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={st.modalOverlay}>
            <View style={st.modalContent}>
              <SafeAreaView edges={['bottom']}>
                <View style={st.modalHeader}>
                  <Text style={{ color: colors.text.primary, fontSize: 18, fontFamily: typography.fontFamily.semibold, flex: 1 }}>Import Templates</Text>
                  <Pressable onPress={() => { setShowImportModal(false); setImportText(''); }} style={st.closeBtn}><X size={16} color="#94A3B8" /></Pressable>
                </View>
                <ScrollView style={{ padding: spacing['4'] }} keyboardShouldPersistTaps="handled">
                  <Text style={{ color: colors.text.muted, fontSize: 14, marginBottom: spacing['4'] }}>Paste your templates below. Supported formats:</Text>
                  <View style={st.codeBlock}>
                    <Text style={{ color: colors.text.secondary, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: spacing['2'] }}>CSV Format:</Text>
                    <Text style={{ color: colors.text.muted, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>name,content{'\n'}"WiFi Info","The WiFi password is..."</Text>
                  </View>
                  <View style={st.codeBlock}>
                    <Text style={{ color: colors.text.secondary, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: spacing['2'] }}>Plain Text (separate by blank lines):</Text>
                    <Text style={{ color: colors.text.muted, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>Hi! The WiFi password is...{'\n\n'}Thanks for your message...</Text>
                  </View>
                  <TextInput value={importText} onChangeText={setImportText} placeholder="Paste your templates here..." placeholderTextColor="#64748B" multiline numberOfLines={10} textAlignVertical="top" style={[st.input, { minHeight: 200 }]} />
                  <Pressable onPress={handleImport} style={({ pressed }) => [st.saveBtn, { opacity: pressed ? 0.8 : 1, marginBottom: spacing['4'] }]}>
                    <View style={st.row}><Upload size={18} color="#FFFFFF" /><Text style={{ color: '#FFFFFF', fontFamily: typography.fontFamily.semibold, marginLeft: spacing['2'] }}>Import Templates</Text></View>
                  </Pressable>
                </ScrollView>
              </SafeAreaView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 20, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  addBtn: { flex: 1, backgroundColor: '#14B8A6', borderRadius: radius.xl, paddingVertical: spacing['3'], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginRight: spacing['2'] },
  importBtn: { backgroundColor: colors.border.DEFAULT, borderRadius: radius.xl, paddingVertical: spacing['3'], paddingHorizontal: spacing['4'], flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  searchBox: { backgroundColor: colors.bg.card, borderRadius: radius.xl, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'] },
  catPill: { paddingHorizontal: spacing['4'], paddingVertical: spacing['2'], borderRadius: radius.full, marginRight: spacing['2'] },
  sectionLabel: { color: colors.text.disabled, fontSize: 12, fontFamily: typography.fontFamily.semibold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing['2'], marginLeft: 4 },
  card: { backgroundColor: colors.bg.card, borderRadius: radius['2xl'], overflow: 'hidden', padding: spacing['4'] },
  favIcon: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: '#F59E0B20', alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  iconBtn: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.border.DEFAULT, alignItems: 'center', justifyContent: 'center' },
  infoCard: { backgroundColor: colors.bg.elevated, borderRadius: radius.xl, padding: spacing['4'] },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.bg.card, borderTopLeftRadius: radius['3xl'], borderTopRightRadius: radius['3xl'], maxHeight: '90%' },
  modalHeader: { padding: spacing['4'], borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT, flexDirection: 'row', alignItems: 'center' },
  closeBtn: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.border.DEFAULT, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.text.muted, fontSize: 14, marginBottom: spacing['2'] },
  input: { backgroundColor: colors.bg.elevated, borderRadius: radius.xl, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], color: colors.text.primary, marginBottom: spacing['4'] },
  saveBtn: { backgroundColor: '#14B8A6', borderRadius: radius.xl, paddingVertical: spacing['4'], alignItems: 'center', marginTop: spacing['4'], marginBottom: spacing['4'] },
  codeBlock: { backgroundColor: colors.border.DEFAULT, borderRadius: radius.xl, padding: spacing['3'], marginBottom: spacing['4'] },
});
