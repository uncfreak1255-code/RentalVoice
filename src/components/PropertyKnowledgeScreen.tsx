import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useAppStore, PropertyKnowledge, PropertyType } from '@/lib/store';
import { ArrowLeft, Wifi, DoorOpen, DoorClosed, Car, ScrollText, Wrench, MapPin, Phone, FileText, MessageSquare, ChevronDown, ChevronUp, Check, Clock, DollarSign, Download, CreditCard, Shield, Home } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';
import { extractKnowledgeFromListing, countImportableFields } from '@/lib/listing-import';

interface PropertyKnowledgeScreenProps { onBack: () => void; }
type TonePreference = 'friendly' | 'professional' | 'casual';
interface SectionProps { title: string; icon: React.ReactNode; children: React.ReactNode; isExpanded: boolean; onToggle: () => void; }

function CollapsibleSection({ title, icon, children, isExpanded, onToggle }: SectionProps) {
  return (
    <Animated.View entering={FadeInDown.duration(300).delay(100)} style={{ marginBottom: spacing['4'] }}>
      <Pressable onPress={onToggle} style={({ pressed }) => [pk.sectionHeader, { opacity: pressed ? 0.8 : 1 }]}>
        <View style={pk.row}>{icon}<Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.semibold, marginLeft: spacing['3'] }}>{title}</Text></View>
        {isExpanded ? <ChevronUp size={20} color="#64748B" /> : <ChevronDown size={20} color="#64748B" />}
      </Pressable>
      {isExpanded && <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: spacing['2'], paddingHorizontal: spacing['2'] }}>{children}</Animated.View>}
    </Animated.View>
  );
}

export function PropertyKnowledgeScreen({ onBack }: PropertyKnowledgeScreenProps) {
  const properties = useAppStore((s) => s.properties);
  const propertyKnowledge = useAppStore((s) => s.propertyKnowledge);
  const setPropertyKnowledge = useAppStore((s) => s.setPropertyKnowledge);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(properties[0]?.id || null);
  const [showPropertySelector, setShowPropertySelector] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ wifi: true, checkin: false, checkout: false, parking: false, rules: false, appliances: false, local: false, emergency: false, custom: false, tone: false, upsells: false, leaseRent: false, maintenance: false, policies: false });
  const [formData, setFormData] = useState<Partial<PropertyKnowledge>>({});

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);
  const currentKnowledge = selectedPropertyId ? propertyKnowledge[selectedPropertyId] : undefined;
  useEffect(() => { if (currentKnowledge) setFormData(currentKnowledge); else setFormData({}); }, [selectedPropertyId, currentKnowledge]);

  const toggleSection = (section: string) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] })); };
  const handleSave = () => { if (!selectedPropertyId) return; setPropertyKnowledge(selectedPropertyId, { propertyId: selectedPropertyId, propertyType: (formData.propertyType as PropertyType) || 'vacation_rental', ...formData }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); };
  const updateField = (field: keyof PropertyKnowledge, value: string | number | boolean | undefined) => { setFormData((prev) => ({ ...prev, [field]: value })); };
  const [importSuccess, setImportSuccess] = useState(false);

  const handleAutoImport = () => {
    if (!selectedProperty || !selectedPropertyId) return;
    const { extracted, details } = extractKnowledgeFromListing(selectedProperty, currentKnowledge);
    if (details.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    // Only fill empty fields in formData
    const mergedData = { ...formData };
    for (const detail of details) {
      const key = detail.field;
      if (!mergedData[key]) {
        (mergedData as Record<string, unknown>)[key] = extracted[key];
      }
    }
    setFormData(mergedData);
    setImportSuccess(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setImportSuccess(false), 3000);
  };

  const importableCount = selectedProperty ? countImportableFields(selectedProperty, currentKnowledge) : 0;

  const renderInput = (label: string, field: keyof PropertyKnowledge, placeholder: string, multiline = false) => (
    <View style={{ marginBottom: spacing['4'] }}>
      <Text style={{ color: colors.text.muted, fontSize: 14, marginBottom: spacing['2'] }}>{label}</Text>
      <TextInput value={(formData[field] as string) || ''} onChangeText={(text) => updateField(field, text)} placeholder={placeholder} placeholderTextColor="#64748B" multiline={multiline} numberOfLines={multiline ? 4 : 1} style={[pk.input, multiline && { minHeight: 100, textAlignVertical: 'top' }]} />
    </View>
  );

  const renderToneSelector = () => {
    const tones = [
      { value: 'friendly' as TonePreference, label: 'Friendly', description: 'Warm, personable, conversational' },
      { value: 'professional' as TonePreference, label: 'Professional', description: 'Polite, efficient, business-like' },
      { value: 'casual' as TonePreference, label: 'Casual', description: 'Relaxed, informal, approachable' },
    ];
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['2'] }}>
        {tones.map((tone) => (
          <Pressable key={tone.value} onPress={() => { updateField('tonePreference', tone.value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            style={[pk.toneCard, formData.tonePreference === tone.value ? { backgroundColor: '#F9731620', borderColor: '#F97316' } : { backgroundColor: colors.bg.elevated, borderColor: colors.border.DEFAULT }]}>
            <View style={[pk.row, { justifyContent: 'space-between', marginBottom: 4 }]}>
              <Text style={{ fontFamily: typography.fontFamily.semibold, color: formData.tonePreference === tone.value ? '#FB923C' : colors.text.primary }}>{tone.label}</Text>
              {formData.tonePreference === tone.value && <Check size={16} color="#F97316" />}
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
        <Pressable onPress={onBack} style={{ marginTop: spacing['6'], backgroundColor: '#F97316', paddingHorizontal: spacing['6'], paddingVertical: spacing['3'], borderRadius: radius.full }}>
          <Text style={{ color: '#FFF', fontFamily: typography.fontFamily.semibold }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={pk.root}>
      <LinearGradient colors={[colors.bg.subtle, colors.bg.base]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 200 }} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Animated.View entering={FadeIn.duration(300)} style={{ paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT }}>
          <View style={[pk.row, { justifyContent: 'space-between' }]}>
            <View style={pk.row}>
              <Pressable onPress={onBack} style={({ pressed }) => [pk.backBtn, { opacity: pressed ? 0.7 : 1 }]}><ArrowLeft size={20} color={colors.text.primary} /></Pressable>
              <Text style={pk.title}>Property Knowledge</Text>
            </View>
            <Pressable onPress={handleSave} style={({ pressed }) => ({ backgroundColor: '#F97316', paddingHorizontal: spacing['4'], paddingVertical: spacing['2'], borderRadius: radius.full, opacity: pressed ? 0.8 : 1 })}>
              <Text style={{ color: '#FFF', fontFamily: typography.fontFamily.semibold }}>Save</Text>
            </Pressable>
          </View>
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
                  style={[pk.row, { padding: spacing['3'], borderRadius: radius.xl, marginBottom: 4, backgroundColor: property.id === selectedPropertyId ? '#F9731620' : colors.bg.elevated }]}>
                  {property.image && <Image source={{ uri: property.image }} style={{ width: 40, height: 40, borderRadius: 6 }} contentFit="cover" />}
                  <View style={{ marginLeft: spacing['3'], flex: 1 }}>
                    <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.medium }}>{property.name}</Text>
                    <Text style={{ color: colors.text.muted, fontSize: 12 }} numberOfLines={1}>{property.address}</Text>
                  </View>
                  {property.id === selectedPropertyId && <Check size={18} color="#F97316" />}
                </Pressable>
              ))}
            </Animated.View>
          )}
        </Animated.View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView style={{ flex: 1, paddingHorizontal: spacing['4'], paddingTop: spacing['4'] }} showsVerticalScrollIndicator={false}>
            {/* Auto-Import Button */}
            {selectedProperty && importableCount > 0 && (
              <Animated.View entering={FadeInDown.duration(300)} style={{ marginBottom: spacing['4'] }}>
                <Pressable
                  onPress={handleAutoImport}
                  style={({ pressed }) => [{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: importSuccess ? '#22C55E20' : '#F9731620',
                    borderWidth: 1, borderColor: importSuccess ? '#22C55E' : '#F97316',
                    borderStyle: 'dashed' as const, borderRadius: radius.xl,
                    paddingVertical: spacing['3'], paddingHorizontal: spacing['4'],
                    opacity: pressed ? 0.7 : 1, gap: spacing['2'],
                  }]}
                >
                  {importSuccess ? <Check size={18} color="#22C55E" /> : <Download size={18} color="#F97316" />}
                  <Text style={{ color: importSuccess ? '#22C55E' : '#F97316', fontFamily: typography.fontFamily.semibold, fontSize: 15 }}>
                    {importSuccess ? `Imported — ${importableCount} fields populated` : `Auto-Import from Hostaway (${importableCount} fields)`}
                  </Text>
                </Pressable>
              </Animated.View>
            )}
            {/* Property Type Selector */}
            <Animated.View entering={FadeInDown.duration(300).delay(50)} style={{ marginBottom: spacing['4'] }}>
              <View style={[pk.sectionHeader, { flexDirection: 'column', alignItems: 'stretch' }]}>
                <View style={[pk.row, { marginBottom: spacing['3'] }]}>
                  <Home size={20} color="#F97316" />
                  <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.semibold, marginLeft: spacing['3'] }}>Property Type</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing['2'] }}>
                  {([{ value: 'vacation_rental' as PropertyType, label: 'Vacation', icon: '🏖️' },
                     { value: 'long_term' as PropertyType, label: 'Long-Term', icon: '🏢' },
                     { value: 'hybrid' as PropertyType, label: 'Hybrid', icon: '🔄' }] as const).map((type) => (
                    <Pressable key={type.value}
                      onPress={() => { updateField('propertyType', type.value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                      style={[pk.toneCard, { flex: 1, alignItems: 'center' },
                        (formData.propertyType || 'vacation_rental') === type.value
                          ? { backgroundColor: '#F9731620', borderColor: '#F97316' }
                          : { backgroundColor: colors.bg.elevated, borderColor: colors.border.DEFAULT }]}>
                      <Text style={{ fontSize: 20, marginBottom: 4 }}>{type.icon}</Text>
                      <Text style={{ fontFamily: typography.fontFamily.semibold, fontSize: 12,
                        color: (formData.propertyType || 'vacation_rental') === type.value ? '#FB923C' : colors.text.primary }}>
                        {type.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </Animated.View>
            {/* Shared Sections */}
            <CollapsibleSection title="WiFi Information" icon={<Wifi size={20} color="#F97316" />} isExpanded={expandedSections.wifi} onToggle={() => toggleSection('wifi')}>
              {renderInput('Network Name', 'wifiName', 'e.g., PropertyGuest')}{renderInput('Password', 'wifiPassword', 'e.g., welcome2024')}
            </CollapsibleSection>
            {/* STR-only Sections */}
            {(formData.propertyType || 'vacation_rental') !== 'long_term' && (<>
            <CollapsibleSection title="Check-in Instructions" icon={<DoorOpen size={20} color="#14B8A6" />} isExpanded={expandedSections.checkin} onToggle={() => toggleSection('checkin')}>
              {renderInput('Check-in Time', 'checkInTime', 'e.g., 3:00 PM')}{renderInput('Check-in Instructions', 'checkInInstructions', 'Describe how guests access the property...', true)}
            </CollapsibleSection>
            <CollapsibleSection title="Check-out Instructions" icon={<DoorClosed size={20} color="#8B5CF6" />} isExpanded={expandedSections.checkout} onToggle={() => toggleSection('checkout')}>
              {renderInput('Check-out Time', 'checkOutTime', 'e.g., 11:00 AM')}{renderInput('Check-out Instructions', 'checkOutInstructions', 'What should guests do before leaving?', true)}
            </CollapsibleSection>
            </>)}
            <CollapsibleSection title="Parking Information" icon={<Car size={20} color="#EC4899" />} isExpanded={expandedSections.parking} onToggle={() => toggleSection('parking')}>
              {renderInput('Parking Details', 'parkingInfo', 'Where can guests park?', true)}
            </CollapsibleSection>
            <CollapsibleSection title="House Rules" icon={<ScrollText size={20} color="#EAB308" />} isExpanded={expandedSections.rules} onToggle={() => toggleSection('rules')}>
              {renderInput('House Rules', 'houseRules', 'Key rules: quiet hours, smoking, pets...', true)}
            </CollapsibleSection>
            <CollapsibleSection title="Appliances & Amenities" icon={<Wrench size={20} color="#06B6D4" />} isExpanded={expandedSections.appliances} onToggle={() => toggleSection('appliances')}>
              {renderInput('Appliance Guide', 'applianceGuide', 'Instructions for TV, thermostat...', true)}
            </CollapsibleSection>
            {/* STR-only: Local Recommendations */}
            {(formData.propertyType || 'vacation_rental') !== 'long_term' && (
            <CollapsibleSection title="Local Recommendations" icon={<MapPin size={20} color="#22C55E" />} isExpanded={expandedSections.local} onToggle={() => toggleSection('local')}>
              {renderInput('Local Tips', 'localRecommendations', 'Nearby restaurants, attractions...', true)}
            </CollapsibleSection>
            )}
            {/* LTR-only Sections */}
            {(formData.propertyType || 'vacation_rental') !== 'vacation_rental' && (<>
            <CollapsibleSection title="Lease & Rent Details" icon={<CreditCard size={20} color="#22C55E" />} isExpanded={expandedSections.leaseRent} onToggle={() => toggleSection('leaseRent')}>
              {renderInput('Monthly Rent ($)', 'monthlyRent' as any, 'e.g., 2500')}
              {renderInput('Rent Due Day (1-31)', 'rentDueDay' as any, 'e.g., 1')}
              {renderInput('Late Fee Amount ($)', 'lateFeeAmount' as any, 'e.g., 50')}
              {renderInput('Grace Period (days)', 'lateFeeGracePeriod' as any, 'e.g., 5')}
              {renderInput('Payment Methods', 'paymentMethods', 'e.g., Venmo, Zelle, portal')}
              {renderInput('Tenant Portal URL', 'tenantPortalUrl', 'e.g., https://portal.example.com')}
              {renderInput('Lease Start Date', 'leaseStartDate', 'e.g., 2025-01-01')}
              {renderInput('Lease End Date', 'leaseEndDate', 'e.g., 2026-01-01')}
            </CollapsibleSection>
            <CollapsibleSection title="Maintenance Contacts" icon={<Wrench size={20} color="#EF4444" />} isExpanded={expandedSections.maintenance} onToggle={() => toggleSection('maintenance')}>
              {renderInput('Contact Name', 'maintenanceContactName', 'e.g., Mike Rodriguez')}
              {renderInput('Contact Phone', 'maintenanceContactPhone', 'e.g., (555) 123-4567')}
              {renderInput('Emergency Phone', 'maintenanceEmergencyPhone', 'e.g., (555) 999-0000')}
              {renderInput('Business Hours', 'maintenanceHours', 'e.g., M-F 9am-5pm')}
            </CollapsibleSection>
            <CollapsibleSection title="Building Policies" icon={<Shield size={20} color="#8B5CF6" />} isExpanded={expandedSections.policies} onToggle={() => toggleSection('policies')}>
              {renderInput('Quiet Hours', 'quietHoursPolicy', 'e.g., 10pm - 8am')}
              {renderInput('Parking Policy', 'parkingPolicy', 'Assigned spots, visitor rules...')}
              {renderInput('Pet Policy', 'petPolicy', 'Allowed breeds, deposits, limits...')}
              {renderInput('Guest Policy', 'guestPolicy', 'Overnight guest rules...')}
              {renderInput('Smoking Policy', 'smokingPolicy', 'Designated areas, restrictions...')}
              {renderInput('Trash & Recycling', 'trashPolicy', 'Pickup days, recycling rules...')}
              {renderInput('Utilities', 'utilityResponsibility', 'What is included vs tenant-paid...')}
            </CollapsibleSection>
            </>)}
            <CollapsibleSection title="Emergency Contacts" icon={<Phone size={20} color="#EF4444" />} isExpanded={expandedSections.emergency} onToggle={() => toggleSection('emergency')}>
              {renderInput('Emergency Contacts', 'emergencyContacts', 'Property manager, maintenance...', true)}
            </CollapsibleSection>
            <CollapsibleSection title="Additional Notes" icon={<FileText size={20} color="#A855F7" />} isExpanded={expandedSections.custom} onToggle={() => toggleSection('custom')}>
              {renderInput('Custom Notes', 'customNotes', 'Any other property-specific info...', true)}
            </CollapsibleSection>
            <CollapsibleSection title="Communication Style" icon={<MessageSquare size={20} color="#F97316" />} isExpanded={expandedSections.tone} onToggle={() => toggleSection('tone')}>
              <Text style={{ color: colors.text.muted, fontSize: 14, marginBottom: spacing['4'] }}>Choose how the AI should communicate{(formData.propertyType || 'vacation_rental') === 'long_term' ? ' with tenants:' : ' with guests:'}</Text>
              {renderToneSelector()}
            </CollapsibleSection>
            {/* STR-only: Upsells */}
            {(formData.propertyType || 'vacation_rental') !== 'long_term' && (
            <CollapsibleSection title="Upsell Options" icon={<DollarSign size={20} color="#22C55E" />} isExpanded={expandedSections.upsells} onToggle={() => toggleSection('upsells')}>
              <View style={[pk.row, { justifyContent: 'space-between', marginBottom: spacing['4'], backgroundColor: colors.bg.elevated, borderRadius: radius.lg, padding: spacing['4'] }]}>
                <View style={pk.row}><Clock size={18} color="#14B8A6" /><Text style={{ color: colors.text.primary, marginLeft: spacing['3'] }}>Early Check-in</Text></View>
                <Pressable onPress={() => { updateField('earlyCheckInAvailable', !formData.earlyCheckInAvailable); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={[pk.toggle, { backgroundColor: formData.earlyCheckInAvailable ? '#14B8A6' : colors.border.DEFAULT }]}>
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
            )}
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
