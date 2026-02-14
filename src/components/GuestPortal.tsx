import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Share, Linking, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useAppStore, Property, PropertyKnowledge } from '@/lib/store';
import { ArrowLeft, Wifi, DoorOpen, DoorClosed, Car, ScrollText, MapPin, Phone, Share2, ChevronRight, Home, Clock, Key, Coffee, Utensils, Mountain, ShoppingBag, AlertCircle, CheckCircle } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

interface GuestPortalProps { propertyId: string; guestName?: string; checkInDate?: Date; checkOutDate?: Date; onBack: () => void; }
interface GuideSection { id: string; title: string; icon: React.ReactNode; content?: string; isAvailable: boolean; }

export function GuestPortal({ propertyId, guestName, checkInDate, checkOutDate, onBack }: GuestPortalProps) {
  const properties = useAppStore((s) => s.properties);
  const propertyKnowledge = useAppStore((s) => s.propertyKnowledge);
  const property = properties.find((p) => p.id === propertyId);
  const knowledge = propertyKnowledge[propertyId];
  const [expandedSection, setExpandedSection] = useState<string | null>('wifi');

  const handleShare = async () => {
    try { await Share.share({ message: `Check out ${property?.name} - Your Digital Guidebook`, title: 'Property Guidebook' }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
    catch (error) { console.error('Share error:', error); }
  };

  const sections: GuideSection[] = useMemo(() => [
    { id: 'wifi', title: 'WiFi Access', icon: <Wifi size={20} color="#14B8A6" />, content: knowledge?.wifiName && knowledge?.wifiPassword ? `Network: ${knowledge.wifiName}\nPassword: ${knowledge.wifiPassword}` : undefined, isAvailable: !!(knowledge?.wifiName && knowledge?.wifiPassword) },
    { id: 'checkin', title: 'Check-in Instructions', icon: <DoorOpen size={20} color="#22C55E" />, content: knowledge?.checkInInstructions, isAvailable: !!knowledge?.checkInInstructions },
    { id: 'checkout', title: 'Check-out Instructions', icon: <DoorClosed size={20} color="#F97316" />, content: knowledge?.checkOutInstructions, isAvailable: !!knowledge?.checkOutInstructions },
    { id: 'parking', title: 'Parking', icon: <Car size={20} color="#8B5CF6" />, content: knowledge?.parkingInfo, isAvailable: !!knowledge?.parkingInfo },
    { id: 'rules', title: 'House Rules', icon: <ScrollText size={20} color="#EAB308" />, content: knowledge?.houseRules, isAvailable: !!knowledge?.houseRules },
    { id: 'appliances', title: 'Appliances & Amenities', icon: <Coffee size={20} color="#EC4899" />, content: knowledge?.applianceGuide, isAvailable: !!knowledge?.applianceGuide },
    { id: 'local', title: 'Local Recommendations', icon: <MapPin size={20} color="#06B6D4" />, content: knowledge?.localRecommendations, isAvailable: !!knowledge?.localRecommendations },
    { id: 'emergency', title: 'Emergency Contacts', icon: <Phone size={20} color="#EF4444" />, content: knowledge?.emergencyContacts, isAvailable: !!knowledge?.emergencyContacts },
  ], [knowledge]);

  const availableSections = sections.filter((s) => s.isAvailable);
  const stayDays = checkInDate && checkOutDate ? Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)) : undefined;

  if (!property) {
    return <View style={[gp.root, { alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: colors.text.primary }}>Property not found</Text></View>;
  }

  return (
    <View style={gp.root}>
      {/* Hero Image */}
      {property.image && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 256 }}>
          <Image source={{ uri: property.image }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          <LinearGradient colors={['transparent', colors.bg.base]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 }} />
        </View>
      )}
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={gp.header}>
          <Pressable onPress={onBack} style={({ pressed }) => [gp.headerBtn, { opacity: pressed ? 0.7 : 1 }]}><ArrowLeft size={20} color="#FFFFFF" /></Pressable>
          <Pressable onPress={handleShare} style={({ pressed }) => [gp.headerBtn, { opacity: pressed ? 0.7 : 1 }]}><Share2 size={20} color="#FFFFFF" /></Pressable>
        </Animated.View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: spacing['4'], marginTop: property.image ? 112 : spacing['4'] }}>
            <Animated.View entering={FadeInDown.duration(300).delay(100)}>
              {guestName && <Text style={{ color: colors.accent.DEFAULT, fontSize: 14, fontFamily: typography.fontFamily.medium, marginBottom: 4 }}>Welcome, {guestName}!</Text>}
              <Text style={{ color: colors.text.primary, fontSize: 30, fontFamily: typography.fontFamily.bold, marginBottom: spacing['2'] }}>{property.name}</Text>
              <View style={[gp.rowCenter, { marginBottom: spacing['4'] }]}><Home size={16} color={colors.text.disabled} /><Text style={[gp.muted, { marginLeft: spacing['2'] }]}>{property.address}</Text></View>
            </Animated.View>

            {/* Stay Info */}
            {(checkInDate || checkOutDate) && (
              <Animated.View entering={FadeInDown.duration(300).delay(200)} style={gp.stayCard}>
                <View style={[gp.rowCenter, { marginBottom: spacing['3'] }]}><Key size={18} color={colors.accent.DEFAULT} /><Text style={{ color: colors.accent.DEFAULT, fontFamily: typography.fontFamily.semibold, marginLeft: spacing['2'] }}>Your Stay</Text></View>
                <View style={gp.rowBetween}>
                  <View><Text style={gp.hint}>Check-in</Text><Text style={gp.white}>{checkInDate ? format(checkInDate, 'MMM d, yyyy') : 'TBD'}</Text>{knowledge?.checkInTime && <Text style={{ color: colors.accent.DEFAULT, fontSize: 14 }}>{knowledge.checkInTime}</Text>}</View>
                  <View style={{ alignItems: 'center', paddingHorizontal: spacing['4'] }}><Clock size={16} color={colors.text.disabled} />{stayDays && <Text style={[gp.hint, { marginTop: 4 }]}>{stayDays} nights</Text>}</View>
                  <View style={{ alignItems: 'flex-end' }}><Text style={gp.hint}>Check-out</Text><Text style={gp.white}>{checkOutDate ? format(checkOutDate, 'MMM d, yyyy') : 'TBD'}</Text>{knowledge?.checkOutTime && <Text style={{ color: '#F97316', fontSize: 14 }}>{knowledge.checkOutTime}</Text>}</View>
                </View>
              </Animated.View>
            )}

            {/* Quick Access */}
            <Animated.View entering={FadeInDown.duration(300).delay(300)} style={{ marginBottom: spacing['6'] }}>
              <Text style={gp.sectionTitle}>Quick Access</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                <View style={[gp.rowCenter, { gap: spacing['3'] }]}>
                  {knowledge?.wifiPassword && (
                    <Pressable onPress={() => setExpandedSection('wifi')} style={gp.quickBtn}><View style={[gp.quickIcon, { backgroundColor: '#14B8A620' }]}><Wifi size={24} color="#14B8A6" /></View><Text style={gp.quickLabel}>WiFi</Text></Pressable>
                  )}
                  {knowledge?.checkInInstructions && (
                    <Pressable onPress={() => setExpandedSection('checkin')} style={gp.quickBtn}><View style={[gp.quickIcon, { backgroundColor: '#22C55E20' }]}><DoorOpen size={24} color="#22C55E" /></View><Text style={gp.quickLabel}>Check-in</Text></Pressable>
                  )}
                  {knowledge?.parkingInfo && (
                    <Pressable onPress={() => setExpandedSection('parking')} style={gp.quickBtn}><View style={[gp.quickIcon, { backgroundColor: '#8B5CF620' }]}><Car size={24} color="#8B5CF6" /></View><Text style={gp.quickLabel}>Parking</Text></Pressable>
                  )}
                  {knowledge?.localRecommendations && (
                    <Pressable onPress={() => setExpandedSection('local')} style={gp.quickBtn}><View style={[gp.quickIcon, { backgroundColor: '#06B6D420' }]}><MapPin size={24} color="#06B6D4" /></View><Text style={gp.quickLabel}>Local Tips</Text></Pressable>
                  )}
                </View>
              </ScrollView>
            </Animated.View>

            {/* Guidebook Sections */}
            <Animated.View entering={FadeInDown.duration(300).delay(400)}>
              <Text style={gp.sectionTitle}>Property Guide</Text>
              {availableSections.length === 0 ? (
                <View style={[gp.card, { alignItems: 'center', padding: spacing['6'] }]}>
                  <AlertCircle size={32} color={colors.text.disabled} />
                  <Text style={[gp.muted, { marginTop: spacing['3'], textAlign: 'center' }]}>No guidebook information available yet.</Text>
                </View>
              ) : (
                availableSections.map((section) => (
                  <Pressable key={section.id} onPress={() => { setExpandedSection(expandedSection === section.id ? null : section.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} style={[gp.card, { marginBottom: spacing['3'], overflow: 'hidden' }]}>
                    <View style={[gp.rowBetween, { padding: spacing['4'] }]}>
                      <View style={[gp.rowCenter, { flex: 1 }]}>
                        <View style={gp.sectionIcon}>{section.icon}</View>
                        <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.medium, flex: 1 }}>{section.title}</Text>
                      </View>
                      <ChevronRight size={20} color={colors.text.disabled} style={{ transform: [{ rotate: expandedSection === section.id ? '90deg' : '0deg' }] }} />
                    </View>
                    {expandedSection === section.id && section.content && (
                      <Animated.View entering={FadeIn.duration(200)} style={{ paddingHorizontal: spacing['4'], paddingBottom: spacing['4'] }}>
                        <View style={gp.contentBox}><Text style={{ color: colors.text.secondary, lineHeight: 24 }}>{section.content}</Text></View>
                      </Animated.View>
                    )}
                  </Pressable>
                ))
              )}
            </Animated.View>

            {/* Need Help */}
            <Animated.View entering={FadeInDown.duration(300).delay(500)} style={{ marginTop: spacing['6'], marginBottom: spacing['8'] }}>
              <View style={gp.helpCard}>
                <View style={[gp.rowCenter, { marginBottom: spacing['2'] }]}><Phone size={18} color="#F97316" /><Text style={{ color: '#F97316', fontFamily: typography.fontFamily.semibold, marginLeft: spacing['2'] }}>Need Help?</Text></View>
                <Text style={[gp.muted, { marginBottom: spacing['3'] }]}>Have questions or issues? We're here to help 24/7.</Text>
                {knowledge?.emergencyContacts ? <Text style={{ color: colors.text.secondary, fontSize: 14 }}>{knowledge.emergencyContacts}</Text> : <Text style={gp.muted}>Contact your host through the messaging feature.</Text>}
              </View>
            </Animated.View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const gp = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: { paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  white: { color: colors.text.primary, fontFamily: typography.fontFamily.semibold },
  muted: { color: colors.text.muted, fontSize: 14 },
  hint: { color: colors.text.disabled, fontSize: 12 },
  sectionTitle: { color: colors.text.primary, fontFamily: typography.fontFamily.semibold, fontSize: 18, marginBottom: spacing['3'] },
  card: { backgroundColor: colors.bg.card, borderRadius: radius.xl },
  stayCard: { backgroundColor: colors.bg.card, borderRadius: radius['2xl'], padding: spacing['4'], marginBottom: spacing['6'], borderWidth: 1, borderColor: colors.accent.DEFAULT + '30' },
  quickBtn: { backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing['4'], minWidth: 100, alignItems: 'center' },
  quickIcon: { width: 48, height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginBottom: spacing['2'] },
  quickLabel: { color: colors.text.primary, fontFamily: typography.fontFamily.medium },
  sectionIcon: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.border.DEFAULT, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  contentBox: { backgroundColor: colors.bg.elevated, borderRadius: radius.md, padding: spacing['3'] },
  helpCard: { backgroundColor: '#F9731620', borderRadius: radius.xl, padding: spacing['4'], borderWidth: 1, borderColor: '#F9731630' },
});
