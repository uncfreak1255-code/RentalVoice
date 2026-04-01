import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Modal, Switch, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useAppStore, ScheduledMessage } from '@/lib/store';
import { ArrowLeft, Plus, Clock, Calendar, MessageSquare, Check, X, ChevronDown, Play, Pause, Trash2, Edit2, DoorOpen, DoorClosed, Sparkles, Wand2, Star, Home, Mail, AlertCircle, TrendingUp } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

interface AutomationsScreenProps {
  onBack: () => void;
  /** When true, strips SafeAreaView for use inside a bottom sheet. */
  embedded?: boolean;
}
type TriggerType = ScheduledMessage['triggerType'];
type CategoryType = NonNullable<ScheduledMessage['category']>;

const triggerLabels: Record<TriggerType, string> = { before_checkin: 'Before Check-in', after_checkin: 'After Check-in', before_checkout: 'Before Check-out', after_checkout: 'After Check-out', rent_reminder: 'Rent Reminder', late_rent: 'Late Rent', lease_renewal: 'Lease Renewal', inspection: 'Inspection', seasonal: 'Seasonal', custom: 'Custom Schedule' };
const triggerIcons: Record<TriggerType, React.ReactNode> = { before_checkin: <DoorOpen size={18} color="#14B8A6" />, after_checkin: <DoorOpen size={18} color="#22C55E" />, before_checkout: <DoorClosed size={18} color="#F97316" />, after_checkout: <DoorClosed size={18} color="#EF4444" />, rent_reminder: <Calendar size={18} color="#F59E0B" />, late_rent: <AlertCircle size={18} color="#EF4444" />, lease_renewal: <Calendar size={18} color="#14B8A6" />, inspection: <Home size={18} color="#3B82F6" />, seasonal: <Star size={18} color="#F59E0B" />, custom: <Calendar size={18} color="#8B5CF6" /> };
const categoryLabels: Record<CategoryType, string> = { check_in: 'Check-in', check_out: 'Check-out', welcome: 'Welcome', review_request: 'Review Request', issue_response: 'Issue Response', upsell: 'Upsell', rent: 'Rent', lease: 'Lease', maintenance: 'Maintenance', custom: 'Custom' };
const categoryIcons: Record<CategoryType, React.ReactNode> = { check_in: <DoorOpen size={16} color="#14B8A6" />, check_out: <DoorClosed size={16} color="#F97316" />, welcome: <Home size={16} color="#22C55E" />, review_request: <Star size={16} color="#F59E0B" />, issue_response: <AlertCircle size={16} color="#EF4444" />, upsell: <TrendingUp size={16} color="#8B5CF6" />, rent: <Calendar size={16} color="#22C55E" />, lease: <Mail size={16} color="#3B82F6" />, maintenance: <AlertCircle size={16} color="#F97316" />, custom: <Mail size={16} color="#64748B" /> };

interface SmartTemplatePreset { name: string; trigger: TriggerType; hours: number; template: string; category: CategoryType; aiPersonalization: boolean; personalizationInstructions?: string; }

const defaultTemplates: SmartTemplatePreset[] = [
  { name: 'Pre-Arrival Welcome', trigger: 'before_checkin', hours: 24, template: 'Hi {{guest_name}}!\n\nWe\'re excited to welcome you to {{property_name}} tomorrow!\n\nHere\'s what you need to know:\n• Check-in time: {{checkin_time}}\n• WiFi: {{wifi_name}} / {{wifi_password}}\n• Parking: {{parking_info}}\n\nPlease let me know if you have any questions before your arrival. Safe travels!\n\n{{host_name}}', category: 'check_in', aiPersonalization: true, personalizationInstructions: 'Adjust warmth based on if this is a returning guest.' },
  { name: 'Welcome Message', trigger: 'after_checkin', hours: 2, template: 'Hi {{guest_name}}! I hope you\'ve settled in nicely at {{property_name}}.\n\nJust checking in to make sure everything is to your liking.', category: 'welcome', aiPersonalization: true, personalizationInstructions: 'Be warm and available.' },
  { name: 'Check-out Reminder', trigger: 'before_checkout', hours: 14, template: 'Hi {{guest_name}}! Just a friendly reminder that check-out is tomorrow at {{checkout_time}}.\n\nBefore you leave:\n{{checkout_instructions}}', category: 'check_out', aiPersonalization: true, personalizationInstructions: 'Thank them for their stay.' },
  { name: 'Review Request', trigger: 'after_checkout', hours: 24, template: 'Hi {{guest_name}}!\n\nThank you for staying at {{property_name}}! We truly hope you had a wonderful experience.\n\nIf you have a moment, we\'d be incredibly grateful for a review.', category: 'review_request', aiPersonalization: true, personalizationInstructions: 'Reference any positive interactions.' },
  { name: 'Mid-Stay Check-in', trigger: 'custom', hours: 48, template: 'Hi {{guest_name}}! Just checking in to see how your stay is going at {{property_name}}.', category: 'welcome', aiPersonalization: true, personalizationInstructions: 'Keep it brief.' },
];

export function AutomationsScreen({ onBack, embedded }: AutomationsScreenProps) {
  const Container = embedded ? View : SafeAreaView;
  const properties = useAppStore((s) => s.properties);
  const scheduledMessages = useAppStore((s) => s.scheduledMessages);
  const addScheduledMessage = useAppStore((s) => s.addScheduledMessage);
  const updateScheduledMessage = useAppStore((s) => s.updateScheduledMessage);
  const deleteScheduledMessage = useAppStore((s) => s.deleteScheduledMessage);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showPropertySelector, setShowPropertySelector] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<TriggerType>('before_checkin');
  const [hours, setHours] = useState('24');
  const [template, setTemplate] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [aiPersonalization, setAiPersonalization] = useState(true);
  const [personalizationInstructions, setPersonalizationInstructions] = useState('');
  const [category, setCategory] = useState<CategoryType>('custom');

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);
  const resetForm = () => { setEditingId(null); setName(''); setTrigger('before_checkin'); setHours('24'); setTemplate(''); setSelectedPropertyId(null); setAiPersonalization(true); setPersonalizationInstructions(''); setCategory('custom'); };

  const handleSave = () => {
    if (!name.trim() || !template.trim() || !selectedPropertyId) return;
    const message: ScheduledMessage = { id: editingId || `sched-${Date.now()}`, propertyId: selectedPropertyId, name, triggerType: trigger, triggerHours: parseInt(hours) || 24, template, isActive: true, aiPersonalization, personalizationInstructions: aiPersonalization ? personalizationInstructions : undefined, category };
    if (editingId) updateScheduledMessage(editingId, message); else addScheduledMessage(message);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); resetForm(); setShowCreateModal(false);
  };

  const handleEdit = (message: ScheduledMessage) => { setEditingId(message.id); setName(message.name); setTrigger(message.triggerType); setHours(message.triggerHours.toString()); setTemplate(message.template); setSelectedPropertyId(message.propertyId); setAiPersonalization(message.aiPersonalization ?? false); setPersonalizationInstructions(message.personalizationInstructions || ''); setCategory(message.category || 'custom'); setShowCreateModal(true); };
  const handleDelete = (id: string) => { deleteScheduledMessage(id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); };
  const handleToggleActive = (id: string, currentActive: boolean) => { updateScheduledMessage(id, { isActive: !currentActive }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };
  const handleUseTemplate = (t: SmartTemplatePreset) => { setName(t.name); setTrigger(t.trigger); setHours(t.hours.toString()); setTemplate(t.template); setAiPersonalization(t.aiPersonalization); setPersonalizationInstructions(t.personalizationInstructions || ''); setCategory(t.category); setShowTemplatesModal(false); };

  const renderMessage = ({ item }: { item: ScheduledMessage }) => {
    const property = properties.find((p) => p.id === item.propertyId);
    const itemCategory = item.category || 'custom';
    return (
      <Animated.View entering={FadeInDown.duration(300)} style={au.msgCard}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <View style={[au.row, { marginBottom: spacing['2'] }]}>
              {triggerIcons[item.triggerType]}
              <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.semibold, marginLeft: spacing['2'], flex: 1 }} numberOfLines={1}>{item.name}</Text>
              {item.aiPersonalization && <View style={[au.row, au.aiBadge]}><Wand2 size={10} color="#A855F7" /><Text style={{ color: '#A855F7', fontSize: 12, marginLeft: 4 }}>AI</Text></View>}
            </View>
            <View style={[au.row, { marginBottom: spacing['2'] }]}>
              <View style={[au.row, au.catBadge]}>{categoryIcons[itemCategory]}<Text style={{ color: colors.text.muted, fontSize: 12, marginLeft: 4 }}>{categoryLabels[itemCategory]}</Text></View>
            </View>
            <Text style={{ color: colors.text.muted, fontSize: 14, marginBottom: spacing['2'] }} numberOfLines={2}>{item.template}</Text>
            <View style={au.row}>
              <Clock size={14} color="#64748B" /><Text style={{ color: colors.text.disabled, fontSize: 12, marginLeft: 4 }}>{item.triggerHours}h {item.triggerType.includes('before') ? 'before' : 'after'}</Text>
              {property && <><Text style={{ color: colors.border.DEFAULT, marginHorizontal: spacing['2'] }}>•</Text><Text style={{ color: colors.text.disabled, fontSize: 12 }} numberOfLines={1}>{property.name}</Text></>}
            </View>
          </View>
          <View style={[au.row, { marginLeft: spacing['2'] }]}>
            <Pressable onPress={() => handleToggleActive(item.id, item.isActive)} style={[au.circBtn, { backgroundColor: item.isActive ? '#22C55E20' : colors.border.DEFAULT, marginRight: spacing['2'] }]}>{item.isActive ? <Play size={18} color="#22C55E" /> : <Pause size={18} color="#64748B" />}</Pressable>
            <Pressable onPress={() => handleEdit(item)} style={[au.circBtn, { backgroundColor: colors.border.DEFAULT, marginRight: spacing['2'] }]}><Edit2 size={16} color="#64748B" /></Pressable>
            <Pressable onPress={() => handleDelete(item.id)} style={[au.circBtn, { backgroundColor: '#EF444420' }]}><Trash2 size={16} color="#EF4444" /></Pressable>
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={au.root}>
      <LinearGradient colors={[colors.bg.subtle, colors.bg.base]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 200 }} />
      <Container style={{ flex: 1 }}>
        <Animated.View entering={FadeIn.duration(300)} style={{ paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT }}>
          <View style={[au.row, { justifyContent: 'space-between' }]}>
            <View style={au.row}>
              <Pressable onPress={onBack} style={({ pressed }) => [au.backBtn, { opacity: pressed ? 0.7 : 1 }]}><ArrowLeft size={20} color={colors.text.primary} /></Pressable>
              <Text style={au.title}>Smart Automations</Text>
            </View>
            <Pressable onPress={() => { resetForm(); setShowCreateModal(true); }} style={({ pressed }) => ({ backgroundColor: '#F97316', width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}><Plus size={22} color="#FFF" /></Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(300).delay(100)} style={{ marginHorizontal: spacing['4'], marginTop: spacing['4'] }}>
          <View style={au.infoBanner}>
            <Wand2 size={20} color="#A855F7" />
            <View style={{ marginLeft: spacing['3'], flex: 1 }}>
              <Text style={{ color: '#A855F7', fontFamily: typography.fontFamily.semibold, marginBottom: 4 }}>AI-Powered Messages</Text>
              <Text style={{ color: '#A855F770', fontSize: 14 }}>Smart templates automatically personalize messages based on guest details, conversation history, and your communication style.</Text>
            </View>
          </View>
        </Animated.View>

        <View style={{ flex: 1, paddingHorizontal: spacing['4'], paddingTop: spacing['4'] }}>
          {scheduledMessages.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={48} color="#64748B" />
              <Text style={{ color: colors.text.muted, fontSize: 18, marginTop: spacing['4'] }}>No automations yet</Text>
              <Text style={{ color: colors.text.disabled, fontSize: 14, marginTop: 4, textAlign: 'center', paddingHorizontal: spacing['8'] }}>Create smart automated messages for check-in reminders, welcome notes, and review requests.</Text>
              <Pressable onPress={() => setShowTemplatesModal(true)} style={{ marginTop: spacing['6'], backgroundColor: '#A855F7', paddingHorizontal: spacing['6'], paddingVertical: spacing['3'], borderRadius: radius.full, flexDirection: 'row', alignItems: 'center' }}>
                <Sparkles size={18} color="#FFF" /><Text style={{ color: '#FFF', fontFamily: typography.fontFamily.semibold, marginLeft: spacing['2'] }}>Use Smart Template</Text>
              </Pressable>
            </View>
          ) : (
            <FlashList data={scheduledMessages} renderItem={renderMessage} keyExtractor={(item) => item.id} showsVerticalScrollIndicator={false} />
          )}
        </View>
      </Container>

      {/* Create/Edit Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={au.modalOverlay}><View style={au.modalSheet}><SafeAreaView edges={['bottom']}>
          <View style={au.modalHeader}>
            <View style={[au.row, { justifyContent: 'space-between' }]}>
              <Text style={au.modalTitle}>{editingId ? 'Edit Automation' : 'New Smart Automation'}</Text>
              <Pressable onPress={() => { resetForm(); setShowCreateModal(false); }}><X size={24} color="#64748B" /></Pressable>
            </View>
          </View>
          <ScrollView style={{ padding: spacing['4'] }} showsVerticalScrollIndicator={false}>
            {!editingId && <Pressable onPress={() => setShowTemplatesModal(true)} style={au.tmplBtn}><Sparkles size={18} color="#A855F7" /><Text style={{ color: '#A855F7', fontFamily: typography.fontFamily.medium, marginLeft: spacing['2'] }}>Use a Smart Template</Text></Pressable>}
            <Text style={au.label}>Automation Name</Text>
            <TextInput value={name} onChangeText={setName} placeholder="e.g., Check-in Reminder" placeholderTextColor="#64748B" style={au.input} />
            <Text style={au.label}>Category</Text>
            <Pressable onPress={() => setShowCategorySelector(!showCategorySelector)} style={[au.input, au.row, { justifyContent: 'space-between', marginBottom: spacing['2'] }]}>
              <View style={au.row}>{categoryIcons[category]}<Text style={{ color: colors.text.primary, marginLeft: spacing['2'] }}>{categoryLabels[category]}</Text></View>
              <ChevronDown size={18} color="#64748B" />
            </Pressable>
            {showCategorySelector && <View style={au.dropdown}>{(Object.keys(categoryLabels) as CategoryType[]).map((cat) => (
              <Pressable key={cat} onPress={() => { setCategory(cat); setShowCategorySelector(false); }} style={[au.row, au.dropItem, cat === category && { backgroundColor: '#A855F720' }]}>
                {categoryIcons[cat]}<Text style={{ color: colors.text.primary, marginLeft: spacing['3'], flex: 1 }}>{categoryLabels[cat]}</Text>{cat === category && <Check size={18} color="#A855F7" />}
              </Pressable>
            ))}</View>}
            <Text style={au.label}>Property</Text>
            <Pressable onPress={() => setShowPropertySelector(!showPropertySelector)} style={[au.input, au.row, { justifyContent: 'space-between', marginBottom: spacing['2'] }]}>
              <Text style={{ color: selectedProperty ? colors.text.primary : colors.text.disabled }}>{selectedProperty?.name || 'Select a property...'}</Text>
              <ChevronDown size={18} color="#64748B" />
            </Pressable>
            {showPropertySelector && <View style={au.dropdown}>{properties.map((property) => (
              <Pressable key={property.id} onPress={() => { setSelectedPropertyId(property.id); setShowPropertySelector(false); }} style={[au.row, au.dropItem, property.id === selectedPropertyId && { backgroundColor: '#F9731620' }]}>
                {property.image && <Image source={{ uri: property.image }} style={{ width: 36, height: 36, borderRadius: 6 }} contentFit="cover" />}
                <Text style={{ color: colors.text.primary, marginLeft: spacing['3'], flex: 1 }}>{property.name}</Text>{property.id === selectedPropertyId && <Check size={18} color="#F97316" />}
              </Pressable>
            ))}</View>}
            <Text style={au.label}>Trigger</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['2'], marginBottom: spacing['4'] }}>
              {(Object.keys(triggerLabels) as TriggerType[]).map((t) => (
                <Pressable key={t} onPress={() => setTrigger(t)} style={[au.row, au.triggerPill, trigger === t ? { backgroundColor: '#F9731620', borderColor: '#F97316' } : { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}>
                  {triggerIcons[t]}<Text style={{ marginLeft: spacing['2'], fontSize: 14, color: trigger === t ? '#FB923C' : colors.text.secondary }}>{triggerLabels[t]}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={au.label}>Hours {trigger.includes('before') ? 'before' : 'after'} event</Text>
            <TextInput value={hours} onChangeText={setHours} placeholder="24" placeholderTextColor="#64748B" keyboardType="numeric" style={au.input} />
            <View style={au.aiBox}>
              <View style={[au.row, { justifyContent: 'space-between', marginBottom: spacing['2'] }]}>
                <View style={au.row}><Wand2 size={18} color="#A855F7" /><Text style={{ color: '#A855F7', fontFamily: typography.fontFamily.medium, marginLeft: spacing['2'] }}>AI Personalization</Text></View>
                <Switch value={aiPersonalization} onValueChange={setAiPersonalization} trackColor={{ false: '#475569', true: '#A855F7' }} thumbColor={aiPersonalization ? '#FFF' : '#6B7280'} />
              </View>
              <Text style={{ color: '#A855F770', fontSize: 14 }}>AI will personalize this template based on guest details and conversation history</Text>
            </View>
            {aiPersonalization && <><Text style={au.label}>Personalization Instructions (Optional)</Text><TextInput value={personalizationInstructions} onChangeText={setPersonalizationInstructions} placeholder="e.g., Be extra warm for returning guests..." placeholderTextColor="#64748B" multiline numberOfLines={3} style={[au.input, { minHeight: 80, textAlignVertical: 'top' }]} /></>}
            <Text style={au.label}>Message Template</Text>
            <TextInput value={template} onChangeText={setTemplate} placeholder="Use {{guest_name}}, {{property_name}}, {{checkin_time}}, etc." placeholderTextColor="#64748B" multiline numberOfLines={6} style={[au.input, { minHeight: 150, textAlignVertical: 'top' }]} />
            <View style={au.varsBox}><Text style={{ color: colors.text.muted, fontSize: 12, marginBottom: spacing['2'] }}>Available variables:</Text><Text style={{ color: colors.text.disabled, fontSize: 12 }}>{'{{guest_name}}, {{property_name}}, {{checkin_time}}, {{checkout_time}}, {{wifi_name}}, {{wifi_password}}, {{parking_info}}, {{checkout_instructions}}, {{host_name}}'}</Text></View>
            <Pressable onPress={handleSave} disabled={!name || !template || !selectedPropertyId} style={({ pressed }) => [au.saveBtn, { backgroundColor: name && template && selectedPropertyId ? '#F97316' : colors.border.DEFAULT, opacity: pressed ? 0.8 : 1 }]}>
              {aiPersonalization && <Wand2 size={18} color="#FFF" style={{ marginRight: 8 }} />}<Text style={{ color: '#FFF', fontFamily: typography.fontFamily.bold, fontSize: 18 }}>{editingId ? 'Save Changes' : 'Create Automation'}</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView></View></View>
      </Modal>

      {/* Templates Modal */}
      <Modal visible={showTemplatesModal} animationType="slide" transparent>
        <View style={au.modalOverlay}><View style={[au.modalSheet, { maxHeight: '70%' }]}><SafeAreaView edges={['bottom']}>
          <View style={au.modalHeader}>
            <View style={[au.row, { justifyContent: 'space-between' }]}>
              <View style={au.row}><Sparkles size={20} color="#A855F7" /><Text style={[au.modalTitle, { marginLeft: spacing['2'] }]}>Smart Templates</Text></View>
              <Pressable onPress={() => setShowTemplatesModal(false)}><X size={24} color="#64748B" /></Pressable>
            </View>
          </View>
          <ScrollView style={{ padding: spacing['4'] }}>
            {defaultTemplates.map((tmpl, index) => (
              <Pressable key={index} onPress={() => handleUseTemplate(tmpl)} style={({ pressed }) => [au.msgCard, { opacity: pressed ? 0.8 : 1 }]}>
                <View style={[au.row, { marginBottom: spacing['2'] }]}>
                  {triggerIcons[tmpl.trigger]}<Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.semibold, marginLeft: spacing['2'], flex: 1 }}>{tmpl.name}</Text>
                  {tmpl.aiPersonalization && <View style={[au.row, au.aiBadge]}><Wand2 size={10} color="#A855F7" /><Text style={{ color: '#A855F7', fontSize: 12, marginLeft: 4 }}>AI</Text></View>}
                </View>
                <View style={[au.row, { marginBottom: spacing['2'] }]}><View style={[au.row, au.catBadge]}>{categoryIcons[tmpl.category]}<Text style={{ color: colors.text.muted, fontSize: 12, marginLeft: 4 }}>{categoryLabels[tmpl.category]}</Text></View></View>
                <Text style={{ color: colors.text.muted, fontSize: 14, marginBottom: spacing['2'] }} numberOfLines={2}>{tmpl.template}</Text>
                <View style={au.row}><Clock size={14} color="#64748B" /><Text style={{ color: colors.text.disabled, fontSize: 12, marginLeft: 4 }}>{tmpl.hours}h {tmpl.trigger.includes('before') ? 'before' : 'after'} {triggerLabels[tmpl.trigger].toLowerCase()}</Text></View>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView></View></View>
      </Modal>
    </View>
  );
}

const au = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { color: colors.text.primary, fontSize: 20, fontFamily: typography.fontFamily.bold },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  msgCard: { backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing['4'], marginBottom: spacing['3'] },
  aiBadge: { backgroundColor: '#A855F720', paddingHorizontal: spacing['2'], paddingVertical: 2, borderRadius: radius.full, marginLeft: spacing['2'] },
  catBadge: { backgroundColor: colors.border.DEFAULT, paddingHorizontal: spacing['2'], paddingVertical: 4, borderRadius: radius.sm },
  circBtn: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  infoBanner: { backgroundColor: '#A855F720', borderRadius: radius.xl, padding: spacing['4'], flexDirection: 'row', alignItems: 'flex-start' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.bg.base, borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'], maxHeight: '90%' },
  modalHeader: { padding: spacing['4'], borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT },
  modalTitle: { color: colors.text.primary, fontSize: 20, fontFamily: typography.fontFamily.bold },
  label: { color: colors.text.muted, fontSize: 14, marginBottom: spacing['2'] },
  input: { backgroundColor: colors.bg.card, borderRadius: radius.lg, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], color: colors.text.primary, marginBottom: spacing['4'] },
  dropdown: { backgroundColor: colors.bg.card, borderRadius: radius.lg, marginBottom: spacing['4'], overflow: 'hidden' },
  dropItem: { padding: spacing['3'], borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT },
  triggerPill: { paddingHorizontal: spacing['3'], paddingVertical: spacing['2'], borderRadius: radius.lg, borderWidth: 1 },
  tmplBtn: { backgroundColor: '#A855F720', borderWidth: 1, borderColor: '#A855F750', borderRadius: radius.xl, padding: spacing['4'], marginBottom: spacing['4'], flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  aiBox: { backgroundColor: '#A855F710', borderRadius: radius.xl, padding: spacing['4'], marginBottom: spacing['4'] },
  varsBox: { backgroundColor: colors.bg.card, borderRadius: radius.lg, padding: spacing['3'], marginBottom: spacing['6'] },
  saveBtn: { paddingVertical: spacing['4'], borderRadius: radius.xl, alignItems: 'center', marginBottom: spacing['4'], flexDirection: 'row', justifyContent: 'center' },
});
