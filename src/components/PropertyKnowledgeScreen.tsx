import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useAppStore, PropertyKnowledge } from '@/lib/store';
import { ArrowLeft, Wifi, DoorOpen, DoorClosed, Car, ScrollText, Wrench, MapPin, Phone, FileText, MessageSquare, ChevronDown, ChevronUp, Check, Clock, DollarSign, Download, Home, CheckCircle2 } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';
import { extractKnowledgeFromListing, countImportableFields } from '@/lib/listing-import';
import { fetchListingDetail } from '@/lib/hostaway';

interface PropertyKnowledgeScreenProps { onBack: () => void; }
type TonePreference = 'friendly' | 'professional' | 'casual';
interface SectionProps { title: string; icon: React.ReactNode; children: React.ReactNode; isExpanded: boolean; onToggle: () => void; isFilled?: boolean; }

function CollapsibleSection({ title, icon, children, isExpanded, onToggle, isFilled }: SectionProps) {
  return (
    <Animated.View entering={FadeInDown.duration(300).delay(100)} style={{ marginBottom: spacing['4'] }}>
      <Pressable onPress={onToggle} style={({ pressed }) => [pk.sectionHeader, { opacity: pressed ? 0.8 : 1 }]}>
        <View style={pk.row}>{icon}<Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.semibold, marginLeft: spacing['3'], flex: 1 }}>{title}</Text></View>
        <View style={pk.row}>
          {isFilled && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 10 }} />}
          {!isFilled && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#D1D5DB', marginRight: 10 }} />}
          {isExpanded ? <ChevronUp size={20} color="#64748B" /> : <ChevronDown size={20} color="#64748B" />}
        </View>
      </Pressable>
      {isExpanded && <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: spacing['2'], paddingHorizontal: spacing['2'] }}>{children}</Animated.View>}
    </Animated.View>
  );
}

export function PropertyKnowledgeScreen({ onBack }: PropertyKnowledgeScreenProps) {
  const properties = useAppStore((s) => s.properties);
  const propertyKnowledge = useAppStore((s) => s.propertyKnowledge);
  const setPropertyKnowledge = useAppStore((s) => s.setPropertyKnowledge);
  const accountId = useAppStore((s) => s.settings.accountId);
  const apiKey = useAppStore((s) => s.settings.apiKey);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(properties[0]?.id || null);
  const [showPropertySelector, setShowPropertySelector] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ wifi: true, checkin: false, checkout: false, parking: false, rules: false, appliances: false, local: false, emergency: false, custom: false, tone: false, upsells: false });
  const [formData, setFormData] = useState<Partial<PropertyKnowledge>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);
  const currentKnowledge = selectedPropertyId ? propertyKnowledge[selectedPropertyId] : undefined;
  useEffect(() => { if (currentKnowledge) setFormData(currentKnowledge); else setFormData({}); }, [selectedPropertyId, currentKnowledge]);

  const toggleSection = (section: string) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] })); };
  const handleSave = () => { if (!selectedPropertyId) return; setPropertyKnowledge(selectedPropertyId, { propertyId: selectedPropertyId, propertyType: 'vacation_rental', ...formData }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); };
  const updateField = (field: keyof PropertyKnowledge, value: string | number | boolean | undefined) => { setFormData((prev) => ({ ...prev, [field]: value })); };

  // Check which sections have data filled
  const isSectionFilled = useCallback((fields: (keyof PropertyKnowledge)[]) => {
    return fields.some((f) => {
      const val = formData[f];
      return val !== undefined && val !== null && val !== '';
    });
  }, [formData]);

  // Calculate completion percentage
  const totalSections = 8;
  const filledSections = [
    isSectionFilled(['wifiName', 'wifiPassword']),
    isSectionFilled(['checkInTime', 'checkInInstructions']),
    isSectionFilled(['checkOutTime', 'checkOutInstructions']),
    isSectionFilled(['parkingInfo']),
    isSectionFilled(['houseRules']),
    isSectionFilled(['applianceGuide']),
    isSectionFilled(['localRecommendations']),
    isSectionFilled(['emergencyContacts']),
  ].filter(Boolean).length;
  const completionPercent = Math.round((filledSections / totalSections) * 100);

  // Auto-import from Hostaway with actual API call
  const handleAutoImport = useCallback(async () => {
    if (!selectedProperty || !selectedPropertyId || !accountId || !apiKey) {
      Alert.alert('Not Connected', 'Please connect your Hostaway account first.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsImporting(true);

    try {
      // Actually fetch the listing detail from Hostaway API
      const listingId = parseInt(selectedPropertyId, 10);
      const listingDetail = await fetchListingDetail(accountId, apiKey, listingId);

      const { extracted, details } = extractKnowledgeFromListing(selectedProperty, currentKnowledge, listingDetail);

      if (details.length === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Nothing to Import', 'All available fields are already filled.');
        setIsImporting(false);
        return;
      }

      // Merge into form data (only fill empty fields)
      const mergedData = { ...formData };
      for (const detail of details) {
        const key = detail.field;
        if (!mergedData[key]) {
          (mergedData as Record<string, unknown>)[key] = extracted[key];
        }
      }
      setFormData(mergedData);

      // Auto-save after import
      setPropertyKnowledge(selectedPropertyId, { propertyId: selectedPropertyId, propertyType: 'vacation_rental', ...mergedData });

      setImportSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setImportSuccess(false), 3000);
    } catch (error) {
      console.error('[PropertyKnowledge] Auto-import error:', error);
      Alert.alert('Import Error', 'Failed to fetch listing data. Please try again.');
    } finally {
      setIsImporting(false);
    }
  }, [selectedProperty, selectedPropertyId, accountId, apiKey, currentKnowledge, formData, setPropertyKnowledge]);

  const renderInput = (label: string, field: keyof PropertyKnowledge, placeholder: string, multiline = false) => (
    <View style={{ marginBottom: spacing['4'] }}>
      <Text style={{ color: colors.text.muted, fontSize: 14, marginBottom: spacing['2'] }}>{label}</Text>
      <TextInput value={(formData[field] as string) || ''} onChangeText={(text) => updateField(field, text)} placeholder={placeholder} placeholderTextColor="#94A3B8" multiline={multiline} numberOfLines={multiline ? 4 : 1} style={[pk.input, multiline && { minHeight: 100, textAlignVertical: 'top' }]} />
    </View>
  );

  const renderToneSelector = () => {
    const tones = [
      { value: 'friendly' as TonePreference, label: 'Friendly', description: 'Warm, personable' },
      { value: 'professional' as TonePreference, label: 'Professional', description: 'Polite, efficient' },
      { value: 'casual' as TonePreference, label: 'Casual', description: 'Relaxed, informal' },
    ];
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['2'] }}>
        {tones.map((tone) => (
          <Pressable key={tone.value} onPress={() => { updateField('tonePreference', tone.value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            style={[pk.toneCard, formData.tonePreference === tone.value ? { backgroundColor: colors.primary.muted, borderColor: colors.primary.DEFAULT } : { backgroundColor: colors.bg.elevated, borderColor: colors.border.DEFAULT }]}>
            <View style={[pk.row, { justifyContent: 'space-between', marginBottom: 4 }]}>
              <Text style={{ fontFamily: typography.fontFamily.semibold, color: formData.tonePreference === tone.value ? colors.primary.DEFAULT : colors.text.primary }}>{tone.label}</Text>
              {formData.tonePreference === tone.value && <Check size={16} color={colors.primary.DEFAULT} />}
            </View>
            <Text style={{ color: colors.text.muted, fontSize: 12 }}>{tone.description}</Text>
          </Pressable>
        ))}
      </View>
    );
  };

  if (properties.length === 0) {
    return (
      <View style={[pk.root, { alignItems: 'center', justifyContent: 'center', padding: spacing['6'] }]}>
        <Text style={{ color: colors.text.primary, fontSize: 18, textAlign: 'center', marginBottom: spacing['4'] }}>No Properties Found</Text>
        <Text style={{ color: colors.text.muted, textAlign: 'center' }}>Connect your Hostaway account to manage property knowledge.</Text>
        <Pressable onPress={onBack} style={{ marginTop: spacing['6'], backgroundColor: colors.primary.DEFAULT, paddingHorizontal: spacing['6'], paddingVertical: spacing['3'], borderRadius: radius.full }}>
          <Text style={{ color: '#FFF', fontFamily: typography.fontFamily.semibold }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={pk.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Animated.View entering={FadeIn.duration(300)} style={{ paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT }}>
          <View style={[pk.row, { justifyContent: 'space-between' }]}>
            <View style={pk.row}>
              <Pressable onPress={onBack} style={({ pressed }) => [pk.backBtn, { opacity: pressed ? 0.7 : 1 }]}><ArrowLeft size={20} color={colors.text.primary} /></Pressable>
              <View>
                <Text style={pk.title}>Property Knowledge</Text>
                <Text style={{ color: colors.text.muted, fontSize: 12, marginTop: 2 }}>{completionPercent}% configured</Text>
              </View>
            </View>
            <Pressable onPress={handleSave} style={({ pressed }) => ({ backgroundColor: colors.primary.DEFAULT, paddingHorizontal: spacing['4'], paddingVertical: spacing['2'], borderRadius: radius.full, opacity: pressed ? 0.8 : 1 })}>
              <Text style={{ color: '#FFF', fontFamily: typography.fontFamily.semibold }}>Save</Text>
            </Pressable>
          </View>
          {/* Completion bar */}
          <View style={{ height: 3, backgroundColor: colors.border.DEFAULT, borderRadius: 2, marginTop: spacing['3'] }}>
            <View style={{ height: 3, backgroundColor: colors.primary.DEFAULT, borderRadius: 2, width: `${completionPercent}%` }} />
          </View>
          {/* Property selector */}
          <Pressable onPress={() => { setShowPropertySelector(!showPropertySelector); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} style={({ pressed }) => [pk.propSelector, { opacity: pressed ? 0.8 : 1 }]}>
            {selectedProperty?.image && <Image source={{ uri: selectedProperty.image }} style={{ width: 48, height: 48, borderRadius: 8 }} contentFit="cover" />}
            <View style={{ marginLeft: spacing['3'], flex: 1 }}>
              <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.semibold }}>{selectedProperty?.name || 'Select Property'}</Text>
              <Text style={{ color: colors.text.muted, fontSize: 12 }} numberOfLines={1}>{selectedProperty?.address || 'Choose a property'}</Text>
            </View>
            {showPropertySelector ? <ChevronUp size={20} color="#64748B" /> : <ChevronDown size={20} color="#64748B" />}
          </Pressable>
          {showPropertySelector && (
            <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: spacing['2'] }}>
              {properties.map((property) => (
                <Pressable key={property.id} onPress={() => { setSelectedPropertyId(property.id); setShowPropertySelector(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={[pk.row, { padding: spacing['3'], borderRadius: radius.xl, marginBottom: 4, backgroundColor: property.id === selectedPropertyId ? colors.primary.muted : colors.bg.elevated }]}>
                  {property.image && <Image source={{ uri: property.image }} style={{ width: 40, height: 40, borderRadius: 6 }} contentFit="cover" />}
                  <View style={{ marginLeft: spacing['3'], flex: 1 }}>
                    <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.medium }}>{property.name}</Text>
                    <Text style={{ color: colors.text.muted, fontSize: 12 }} numberOfLines={1}>{property.address}</Text>
                  </View>
                  {property.id === selectedPropertyId && <Check size={18} color={colors.primary.DEFAULT} />}
                </Pressable>
              ))}
            </Animated.View>
          )}
        </Animated.View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView style={{ flex: 1, paddingHorizontal: spacing['4'], paddingTop: spacing['4'] }} showsVerticalScrollIndicator={false}>
            {/* Auto-Import Button — Option A: Solid Teal Banner */}
            {selectedProperty && (
              <Animated.View entering={FadeInDown.duration(300)} style={{ marginBottom: spacing['4'] }}>
                <Pressable
                  onPress={handleAutoImport}
                  disabled={isImporting}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: importSuccess ? '#22C55E' : colors.primary.DEFAULT,
                    borderRadius: 14,
                    paddingVertical: 14, paddingHorizontal: spacing['4'],
                    opacity: pressed ? 0.85 : isImporting ? 0.7 : 1,
                    shadowColor: importSuccess ? '#22C55E' : colors.primary.DEFAULT,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    elevation: 4,
                    gap: spacing['2'],
                  })}
                >
                  {isImporting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : importSuccess ? (
                    <CheckCircle2 size={20} color="#FFFFFF" />
                  ) : (
                    <Download size={20} color="#FFFFFF" />
                  )}
                  <Text style={{ color: '#FFFFFF', fontFamily: typography.fontFamily.bold, fontSize: 15 }}>
                    {isImporting ? 'Importing...' : importSuccess ? 'Imported Successfully' : 'Auto-Import from Hostaway'}
                  </Text>
                </Pressable>
              </Animated.View>
            )}

            {/* Sections — vacation rental only */}
            <CollapsibleSection title="WiFi Information" icon={<Wifi size={20} color={colors.primary.DEFAULT} />} isExpanded={expandedSections.wifi} onToggle={() => toggleSection('wifi')} isFilled={isSectionFilled(['wifiName', 'wifiPassword'])}>
              {renderInput('Network Name', 'wifiName', 'e.g., PropertyGuest')}{renderInput('Password', 'wifiPassword', 'e.g., welcome2024')}
            </CollapsibleSection>
            <CollapsibleSection title="Check-in Instructions" icon={<DoorOpen size={20} color={colors.primary.DEFAULT} />} isExpanded={expandedSections.checkin} onToggle={() => toggleSection('checkin')} isFilled={isSectionFilled(['checkInTime', 'checkInInstructions'])}>
              {renderInput('Check-in Time', 'checkInTime', 'e.g., 3:00 PM')}{renderInput('Check-in Instructions', 'checkInInstructions', 'Describe how guests access the property...', true)}
            </CollapsibleSection>
            <CollapsibleSection title="Check-out Instructions" icon={<DoorClosed size={20} color="#8B5CF6" />} isExpanded={expandedSections.checkout} onToggle={() => toggleSection('checkout')} isFilled={isSectionFilled(['checkOutTime', 'checkOutInstructions'])}>
              {renderInput('Check-out Time', 'checkOutTime', 'e.g., 11:00 AM')}{renderInput('Check-out Instructions', 'checkOutInstructions', 'What should guests do before leaving?', true)}
            </CollapsibleSection>
            <CollapsibleSection title="Parking Information" icon={<Car size={20} color="#EC4899" />} isExpanded={expandedSections.parking} onToggle={() => toggleSection('parking')} isFilled={isSectionFilled(['parkingInfo'])}>
              {renderInput('Parking Details', 'parkingInfo', 'Where can guests park?', true)}
            </CollapsibleSection>
            <CollapsibleSection title="House Rules" icon={<ScrollText size={20} color="#EAB308" />} isExpanded={expandedSections.rules} onToggle={() => toggleSection('rules')} isFilled={isSectionFilled(['houseRules'])}>
              {renderInput('House Rules', 'houseRules', 'Key rules: quiet hours, smoking, pets...', true)}
            </CollapsibleSection>
            <CollapsibleSection title="Appliances & Amenities" icon={<Wrench size={20} color="#06B6D4" />} isExpanded={expandedSections.appliances} onToggle={() => toggleSection('appliances')} isFilled={isSectionFilled(['applianceGuide'])}>
              {renderInput('Appliance Guide', 'applianceGuide', 'Instructions for TV, thermostat...', true)}
            </CollapsibleSection>
            <CollapsibleSection title="Local Recommendations" icon={<MapPin size={20} color="#22C55E" />} isExpanded={expandedSections.local} onToggle={() => toggleSection('local')} isFilled={isSectionFilled(['localRecommendations'])}>
              {renderInput('Local Tips', 'localRecommendations', 'Nearby restaurants, attractions...', true)}
            </CollapsibleSection>
            <CollapsibleSection title="Emergency Contacts" icon={<Phone size={20} color="#EF4444" />} isExpanded={expandedSections.emergency} onToggle={() => toggleSection('emergency')} isFilled={isSectionFilled(['emergencyContacts'])}>
              {renderInput('Emergency Contacts', 'emergencyContacts', 'Property manager, maintenance...', true)}
            </CollapsibleSection>
            <CollapsibleSection title="Additional Notes" icon={<FileText size={20} color="#A855F7" />} isExpanded={expandedSections.custom} onToggle={() => toggleSection('custom')} isFilled={isSectionFilled(['customNotes'])}>
              {renderInput('Custom Notes', 'customNotes', 'Any other property-specific info...', true)}
            </CollapsibleSection>
            <CollapsibleSection title="Communication Style" icon={<MessageSquare size={20} color={colors.primary.DEFAULT} />} isExpanded={expandedSections.tone} onToggle={() => toggleSection('tone')} isFilled={!!formData.tonePreference}>
              <Text style={{ color: colors.text.muted, fontSize: 14, marginBottom: spacing['4'] }}>Choose how the AI should communicate with guests:</Text>
              {renderToneSelector()}
            </CollapsibleSection>
            {/* Upsell Options */}
            <CollapsibleSection title="Upsell Options" icon={<DollarSign size={20} color="#22C55E" />} isExpanded={expandedSections.upsells} onToggle={() => toggleSection('upsells')} isFilled={isSectionFilled(['earlyCheckInAvailable', 'lateCheckOutAvailable'] as any)}>
              <View style={[pk.row, { justifyContent: 'space-between', marginBottom: spacing['4'], backgroundColor: colors.bg.elevated, borderRadius: radius.lg, padding: spacing['4'] }]}>
                <View style={pk.row}><Clock size={18} color={colors.primary.DEFAULT} /><Text style={{ color: colors.text.primary, marginLeft: spacing['3'] }}>Early Check-in</Text></View>
                <Pressable onPress={() => { updateField('earlyCheckInAvailable', !formData.earlyCheckInAvailable); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={[pk.toggle, { backgroundColor: formData.earlyCheckInAvailable ? colors.primary.DEFAULT : colors.border.DEFAULT }]}>
                  <View style={[pk.toggleThumb, { marginLeft: formData.earlyCheckInAvailable ? 'auto' : 0 }]} />
                </Pressable>
              </View>
              {formData.earlyCheckInAvailable && renderInput('Early Check-in Fee ($)', 'earlyCheckInFee' as any, 'e.g., 25')}
              <View style={[pk.row, { justifyContent: 'space-between', marginBottom: spacing['4'], backgroundColor: colors.bg.elevated, borderRadius: radius.lg, padding: spacing['4'] }]}>
                <View style={pk.row}><Clock size={18} color="#8B5CF6" /><Text style={{ color: colors.text.primary, marginLeft: spacing['3'] }}>Late Check-out</Text></View>
                <Pressable onPress={() => { updateField('lateCheckOutAvailable', !formData.lateCheckOutAvailable); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={[pk.toggle, { backgroundColor: formData.lateCheckOutAvailable ? '#8B5CF6' : colors.border.DEFAULT }]}>
                  <View style={[pk.toggleThumb, { marginLeft: formData.lateCheckOutAvailable ? 'auto' : 0 }]} />
                </Pressable>
              </View>
              {formData.lateCheckOutAvailable && renderInput('Late Check-out Fee ($)', 'lateCheckOutFee' as any, 'e.g., 30')}
            </CollapsibleSection>
            <View style={{ height: 128 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const pk = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { color: colors.text.primary, fontSize: 20, fontFamily: typography.fontFamily.bold },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  propSelector: { marginTop: spacing['4'], backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing['3'], flexDirection: 'row', alignItems: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing['4'] },
  input: { backgroundColor: colors.bg.elevated, borderRadius: radius.lg, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], color: colors.text.primary },
  toneCard: { flex: 1, minWidth: 100, padding: spacing['3'], borderRadius: radius.xl, borderWidth: 1 },
  toggle: { width: 48, height: 28, borderRadius: radius.full, padding: 4, flexDirection: 'row' },
  toggleThumb: { width: 20, height: 20, borderRadius: radius.full, backgroundColor: '#FFFFFF' },
});
