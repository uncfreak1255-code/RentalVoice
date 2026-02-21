import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput, Alert, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore, TrackedUpsellOffer, UpsellOfferStatus } from '@/lib/store';
import { ArrowLeft, Clock, DollarSign, CalendarPlus, CalendarMinus, Sparkles, Check, X, Send, TrendingUp, Gift, CheckCircle, XCircle, CreditCard, ChevronRight } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { differenceInHours } from 'date-fns';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

interface UpsellsScreenProps { conversationId?: string; onBack: () => void; }
interface UpsellOffer { id: string; type: 'early_checkin' | 'late_checkout' | 'gap_night' | 'custom'; title: string; description: string; price: number; available: boolean; icon: React.ReactNode; }

const STATUS_CONFIG: Record<UpsellOfferStatus, { color: string; label: string; icon: React.ComponentType<any> }> = {
  sent: { color: '#3B82F6', label: 'Sent', icon: Send },
  accepted: { color: '#F59E0B', label: 'Accepted', icon: CheckCircle },
  paid: { color: '#22C55E', label: 'Paid', icon: CreditCard },
  declined: { color: '#EF4444', label: 'Declined', icon: XCircle },
  expired: { color: '#64748B', label: 'Expired', icon: Clock },
};

function formatTimeAgo(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function UpsellsScreen({ conversationId, onBack }: UpsellsScreenProps) {
  const conversations = useAppStore((s) => s.conversations);
  const propertyKnowledge = useAppStore((s) => s.propertyKnowledge);
  const analytics = useAppStore((s) => s.analytics);
  const addUpsellRevenue = useAppStore((s) => s.addUpsellRevenue);
  const addMessage = useAppStore((s) => s.addMessage);
  const trackedOffers = useAppStore((s) => s.trackedUpsellOffers);
  const addTrackedUpsellOffer = useAppStore((s) => s.addTrackedUpsellOffer);
  const updateUpsellOfferStatus = useAppStore((s) => s.updateUpsellOfferStatus);

  const [showOfferModal, setShowOfferModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<UpsellOffer | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const conversation = conversationId ? conversations.find((c) => c.id === conversationId) : undefined;
  const knowledge = conversation?.property?.id ? propertyKnowledge[conversation.property.id] : undefined;

  const availableOffers = useMemo((): UpsellOffer[] => {
    const offers: UpsellOffer[] = [];
    if (knowledge?.earlyCheckInAvailable) {
      const hoursUntilCheckIn = conversation?.checkInDate ? differenceInHours(new Date(conversation.checkInDate), new Date()) : 0;
      offers.push({ id: 'early_checkin', type: 'early_checkin', title: 'Early Check-in', description: 'Arrive earlier and start your vacation sooner', price: knowledge.earlyCheckInFee || 25, available: hoursUntilCheckIn > 24, icon: <CalendarPlus size={24} color="#14B8A6" /> });
    }
    if (knowledge?.lateCheckOutAvailable) {
      const hoursUntilCheckOut = conversation?.checkOutDate ? differenceInHours(new Date(conversation.checkOutDate), new Date()) : 0;
      offers.push({ id: 'late_checkout', type: 'late_checkout', title: 'Late Check-out', description: 'Extend your stay and enjoy a relaxed departure', price: knowledge.lateCheckOutFee || 30, available: hoursUntilCheckOut > 24, icon: <CalendarMinus size={24} color="#8B5CF6" /> });
    }
    return offers;
  }, [conversation, knowledge]);

  const pipelineStats = useMemo(() => {
    const sent = trackedOffers.filter(o => o.status === 'sent').length;
    const accepted = trackedOffers.filter(o => o.status === 'accepted').length;
    const paid = trackedOffers.filter(o => o.status === 'paid').length;
    const declined = trackedOffers.filter(o => o.status === 'declined').length;
    const conversionRate = trackedOffers.length > 0
      ? Math.round(((accepted + paid) / trackedOffers.length) * 100) : 0;
    return { sent, accepted, paid, declined, total: trackedOffers.length, conversionRate };
  }, [trackedOffers]);

  const getOfferMessage = (offer: UpsellOffer): string => {
    switch (offer.type) {
      case 'early_checkin': return `Hi ${conversation?.guest.name || 'there'}! I noticed you might be interested in arriving early. We can offer early check-in at 1:00 PM for just $${offer.price}. This is subject to availability - would you like me to check if it's available for your dates?`;
      case 'late_checkout': return `Hi ${conversation?.guest.name || 'there'}! Enjoying your stay? We offer late check-out until 2:00 PM for just $${offer.price}, subject to availability. Would you be interested?`;
      default: return customMessage;
    }
  };

  const handleSendOffer = async () => {
    if (!selectedOffer || !conversation || isSending) return;
    setIsSending(true);
    try {
      const message = customMessage || getOfferMessage(selectedOffer);
      addMessage(conversation.id, { id: `msg-${Date.now()}`, conversationId: conversation.id, content: message, sender: 'host', timestamp: new Date(), isRead: false });
      addUpsellRevenue(0);
      // Track the offer
      addTrackedUpsellOffer({
        id: `upsell-${Date.now()}`,
        conversationId: conversation.id,
        guestName: conversation.guest.name,
        propertyId: conversation.property?.id || '',
        propertyName: conversation.property?.name || '',
        offerType: selectedOffer.type,
        title: selectedOffer.title,
        price: selectedOffer.price,
        status: 'sent',
        sentAt: new Date(),
        updatedAt: new Date(),
        messagePreview: message.substring(0, 120),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowOfferModal(false); setSelectedOffer(null); setCustomMessage('');
    } catch (error) { console.error('Error sending offer:', error); }
    finally { setIsSending(false); }
  };

  const handleStatusUpdate = (offer: TrackedUpsellOffer, newStatus: UpsellOfferStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateUpsellOfferStatus(offer.id, newStatus);
    if (newStatus === 'paid') {
      addUpsellRevenue(offer.price);
      Alert.alert('Revenue Recorded', `$${offer.price} added to upsell revenue!`);
    }
  };

  const openOfferModal = (offer: UpsellOffer) => { setSelectedOffer(offer); setCustomMessage(getOfferMessage(offer)); setShowOfferModal(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  return (
    <View style={us.root}>
      <LinearGradient colors={[colors.bg.subtle, colors.bg.base]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 200 }} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={us.header}>
          <View style={us.rowCenter}>
            <Pressable onPress={onBack} style={({ pressed }) => [us.backBtn, { opacity: pressed ? 0.7 : 1 }]}><ArrowLeft size={20} color={colors.text.primary} /></Pressable>
            <View><Text style={us.title}>Upsells</Text><Text style={{ color: colors.text.disabled, fontSize: 12 }}>Increase revenue with smart offers</Text></View>
          </View>
        </Animated.View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Revenue Stats */}
          <Animated.View entering={FadeInDown.duration(300).delay(100)} style={{ paddingHorizontal: spacing['4'], paddingTop: spacing['4'] }}>
            <View style={us.heroCard}>
              <View style={[us.rowCenter, { marginBottom: spacing['4'] }]}><TrendingUp size={24} color="#22C55E" /><Text style={[us.white, { fontSize: 18, marginLeft: spacing['2'] }]}>Upsell Revenue</Text></View>
              <View style={[us.rowBetween, { alignItems: 'flex-end' }]}>
                <View><Text style={{ fontSize: 36, fontFamily: typography.fontFamily.bold, color: '#22C55E' }}>${analytics.upsellRevenue}</Text><Text style={us.muted}>Total revenue</Text></View>
                <View style={{ alignItems: 'flex-end' }}><Text style={{ fontSize: 24, fontFamily: typography.fontFamily.bold, color: colors.text.primary }}>{analytics.upsellsGenerated}</Text><Text style={us.muted}>Offers sent</Text></View>
              </View>
            </View>
          </Animated.View>

          {/* Pipeline Stats */}
          {trackedOffers.length > 0 && (
            <Animated.View entering={FadeInDown.duration(300).delay(150)} style={{ paddingHorizontal: spacing['4'], paddingTop: spacing['4'] }}>
              <Text style={us.sectionTitle}>Offer Pipeline</Text>
              <View style={us.pipelineRow}>
                <View style={us.pipelineCard}>
                  <Send size={16} color="#3B82F6" />
                  <Text style={[us.pipelineNum, { color: '#3B82F6' }]}>{pipelineStats.sent}</Text>
                  <Text style={us.pipelineLabel}>Sent</Text>
                </View>
                <ChevronRight size={14} color={colors.text.disabled} />
                <View style={us.pipelineCard}>
                  <CheckCircle size={16} color="#F59E0B" />
                  <Text style={[us.pipelineNum, { color: '#F59E0B' }]}>{pipelineStats.accepted}</Text>
                  <Text style={us.pipelineLabel}>Accepted</Text>
                </View>
                <ChevronRight size={14} color={colors.text.disabled} />
                <View style={us.pipelineCard}>
                  <CreditCard size={16} color="#22C55E" />
                  <Text style={[us.pipelineNum, { color: '#22C55E' }]}>{pipelineStats.paid}</Text>
                  <Text style={us.pipelineLabel}>Paid</Text>
                </View>
              </View>
              <View style={us.conversionBar}>
                <Text style={{ color: colors.text.muted, fontSize: 12 }}>Conversion Rate</Text>
                <Text style={{ color: pipelineStats.conversionRate > 50 ? '#22C55E' : '#F59E0B', fontFamily: typography.fontFamily.bold, fontSize: 14 }}>{pipelineStats.conversionRate}%</Text>
              </View>
            </Animated.View>
          )}

          {/* Tracked Offers */}
          {trackedOffers.length > 0 && (
            <Animated.View entering={FadeInDown.duration(300).delay(200)} style={{ paddingHorizontal: spacing['4'], paddingTop: spacing['6'] }}>
              <Text style={us.sectionTitle}>Tracked Offers</Text>
              {trackedOffers.slice(0, 10).map((tracked, idx) => {
                const statusCfg = STATUS_CONFIG[tracked.status];
                const StatusIcon = statusCfg.icon;
                const nextActions = getNextActions(tracked.status);
                return (
                  <Animated.View key={tracked.id} entering={FadeInDown.delay(idx * 50).duration(250)} style={us.trackedCard}>
                    <View style={us.rowBetween}>
                      <View style={us.rowCenter}>
                        <View style={[us.statusDot, { backgroundColor: `${statusCfg.color}20` }]}>
                          <StatusIcon size={14} color={statusCfg.color} />
                        </View>
                        <View style={{ marginLeft: spacing['2'] }}>
                          <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.semibold, fontSize: 15 }}>{tracked.title}</Text>
                          <Text style={{ color: colors.text.muted, fontSize: 12 }}>{tracked.guestName} · {tracked.propertyName}</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: '#22C55E', fontFamily: typography.fontFamily.bold }}>${tracked.price}</Text>
                        <Text style={{ color: colors.text.disabled, fontSize: 11 }}>{formatTimeAgo(tracked.sentAt)}</Text>
                      </View>
                    </View>
                    {/* Status Chip + Actions */}
                    <View style={[us.rowBetween, { marginTop: spacing['3'] }]}>
                      <View style={[us.statusChip, { backgroundColor: `${statusCfg.color}15` }]}>
                        <View style={[us.statusChipDot, { backgroundColor: statusCfg.color }]} />
                        <Text style={[us.statusChipText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                      </View>
                      <View style={us.rowCenter}>
                        {nextActions.map(action => (
                          <Pressable
                            key={action.status}
                            onPress={() => handleStatusUpdate(tracked, action.status)}
                            style={({ pressed }) => [us.actionBtn, { backgroundColor: `${action.color}15`, opacity: pressed ? 0.7 : 1 }]}
                          >
                            <Text style={{ color: action.color, fontSize: 12, fontFamily: typography.fontFamily.medium }}>{action.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </Animated.View>
                );
              })}
            </Animated.View>
          )}

          {/* Current Guest Offers */}
          {conversation && (
            <Animated.View entering={FadeInDown.duration(300).delay(250)} style={{ paddingHorizontal: spacing['4'], paddingTop: spacing['6'] }}>
              <Text style={us.sectionTitle}>Offers for {conversation.guest.name}</Text>
              {availableOffers.length === 0 ? (
                <View style={[us.card, { alignItems: 'center', padding: spacing['6'] }]}>
                  <Gift size={32} color={colors.text.disabled} />
                  <Text style={[us.muted, { marginTop: spacing['3'], textAlign: 'center' }]}>No upsell options configured for this property.</Text>
                  <Text style={{ color: colors.text.disabled, marginTop: 4, textAlign: 'center', fontSize: 14 }}>Configure early check-in and late checkout in Property Knowledge.</Text>
                </View>
              ) : (
                availableOffers.map((offer) => (
                  <Pressable key={offer.id} onPress={() => openOfferModal(offer)} disabled={!offer.available} style={({ pressed }) => [us.offerCard, !offer.available && { opacity: 0.5 }, { opacity: offer.available && pressed ? 0.8 : undefined }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <View style={us.offerIcon}>{offer.icon}</View>
                      <View style={{ flex: 1 }}>
                        <View style={us.rowBetween}>
                          <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.semibold, fontSize: 18 }}>{offer.title}</Text>
                          <View style={us.priceBadge}><Text style={{ color: '#22C55E', fontFamily: typography.fontFamily.bold }}>${offer.price}</Text></View>
                        </View>
                        <Text style={[us.muted, { marginTop: 4 }]}>{offer.description}</Text>
                        {!offer.available && (
                          <View style={[us.rowCenter, { marginTop: spacing['2'] }]}>
                            <Clock size={14} color="#EAB308" /><Text style={{ color: '#EAB308', fontSize: 12, marginLeft: 4 }}>Too close to offer - try earlier next time</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                ))
              )}
            </Animated.View>
          )}

          {/* Tips */}
          <Animated.View entering={FadeInDown.duration(300).delay(300)} style={{ paddingHorizontal: spacing['4'], paddingTop: spacing['6'], paddingBottom: spacing['8'] }}>
            <Text style={us.sectionTitle}>Upselling Tips</Text>
            {[
              { icon: <Sparkles size={18} color="#F97316" />, title: 'Best Time to Offer', desc: 'Send early check-in offers 24-48 hours before arrival. Send late checkout offers on the morning of departure day.' },
              { icon: <DollarSign size={18} color="#22C55E" />, title: 'Pricing Strategy', desc: 'Price early check-in at 10-15% of nightly rate. Late checkout at 15-20%. Consider offering discounts for repeat guests.' },
              { icon: <Check size={18} color="#14B8A6" />, title: 'Personalize Offers', desc: "Mention the guest's name and reference their stay details. Personalized offers have 3x higher conversion rates." },
            ].map((tip, i) => (
              <View key={i} style={[us.card, { marginBottom: spacing['3'] }]}>
                <View style={[us.rowCenter, { marginBottom: spacing['2'] }]}>{tip.icon}<Text style={[us.white, { marginLeft: spacing['2'] }]}>{tip.title}</Text></View>
                <Text style={us.muted}>{tip.desc}</Text>
              </View>
            ))}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {/* Offer Modal */}
      <Modal visible={showOfferModal} animationType="slide" transparent>
        <View style={us.modalOverlay}>
          <View style={us.modalContent}>
            <SafeAreaView edges={['bottom']}>
              <View style={us.modalHeader}>
                <View style={us.rowBetween}>
                  <View style={us.rowCenter}>{selectedOffer?.icon}<Text style={[us.white, { fontSize: 20, marginLeft: spacing['2'] }]}>{selectedOffer?.title}</Text></View>
                  <Pressable onPress={() => setShowOfferModal(false)}><X size={24} color={colors.text.disabled} /></Pressable>
                </View>
              </View>
              <View style={{ padding: spacing['4'] }}>
                <View style={us.priceRow}><Text style={{ color: '#22C55E' }}>Offer Price</Text><Text style={{ color: '#22C55E', fontFamily: typography.fontFamily.bold, fontSize: 20 }}>${selectedOffer?.price}</Text></View>
                <Text style={{ color: colors.text.muted, fontSize: 14, marginBottom: spacing['2'] }}>Message to Guest</Text>
                <TextInput value={customMessage} onChangeText={setCustomMessage} placeholder="Customize your offer message..." placeholderTextColor="#64748B" multiline numberOfLines={6} style={us.textArea} />
                <Pressable onPress={handleSendOffer} disabled={isSending || !customMessage.trim()} style={({ pressed }) => [us.sendBtn, { backgroundColor: customMessage.trim() ? colors.primary.DEFAULT : colors.bg.hover, opacity: pressed ? 0.8 : 1 }]}>
                  <Send size={20} color="#FFFFFF" /><Text style={{ color: '#FFF', fontFamily: typography.fontFamily.bold, fontSize: 18, marginLeft: spacing['2'] }}>{isSending ? 'Sending...' : 'Send & Track Offer'}</Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getNextActions(status: UpsellOfferStatus): { status: UpsellOfferStatus; label: string; color: string }[] {
  switch (status) {
    case 'sent': return [
      { status: 'accepted', label: 'Accepted', color: '#F59E0B' },
      { status: 'declined', label: 'Declined', color: '#EF4444' },
    ];
    case 'accepted': return [
      { status: 'paid', label: 'Mark Paid', color: '#22C55E' },
    ];
    default: return [];
  }
}

const us = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: { paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  title: { fontSize: 20, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  white: { color: colors.text.primary, fontFamily: typography.fontFamily.semibold },
  muted: { color: colors.text.muted, fontSize: 14 },
  sectionTitle: { color: colors.text.primary, fontFamily: typography.fontFamily.semibold, fontSize: 18, marginBottom: spacing['3'] },
  card: { backgroundColor: `${colors.bg.elevated}E6`, borderRadius: radius.xl, padding: spacing['4'] },
  heroCard: { backgroundColor: `${colors.bg.elevated}E6`, borderRadius: radius['2xl'], padding: spacing['6'], borderWidth: 1, borderColor: '#22C55E30' },
  offerCard: { backgroundColor: `${colors.bg.elevated}E6`, borderRadius: radius.xl, padding: spacing['4'], marginBottom: spacing['3'] },
  offerIcon: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.border.DEFAULT, alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'] },
  priceBadge: { backgroundColor: '#22C55E20', paddingHorizontal: spacing['3'], paddingVertical: 4, borderRadius: radius.full },
  // Pipeline
  pipelineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing['2'] },
  pipelineCard: { flex: 1, backgroundColor: `${colors.bg.elevated}E6`, borderRadius: radius.lg, padding: spacing['3'], alignItems: 'center' },
  pipelineNum: { fontSize: 20, fontFamily: typography.fontFamily.bold, marginTop: 4 },
  pipelineLabel: { color: colors.text.disabled, fontSize: 11, marginTop: 2 },
  conversionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: `${colors.bg.elevated}80`, borderRadius: radius.md, padding: spacing['3'], marginTop: spacing['2'] },
  // Tracked offers
  trackedCard: { backgroundColor: `${colors.bg.elevated}E6`, borderRadius: radius.xl, padding: spacing['4'], marginBottom: spacing['3'] },
  statusDot: { width: 32, height: 32, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  statusChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing['2'], paddingVertical: 4, borderRadius: radius.full },
  statusChipDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusChipText: { fontSize: 12, fontFamily: typography.fontFamily.medium },
  actionBtn: { paddingHorizontal: spacing['3'], paddingVertical: 6, borderRadius: radius.full, marginLeft: spacing['2'] },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.bg.base, borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'] },
  modalHeader: { padding: spacing['4'], borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['4'], backgroundColor: '#22C55E20', borderRadius: radius.xl, padding: spacing['3'] },
  textArea: { backgroundColor: colors.bg.card, borderRadius: radius.xl, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], color: colors.text.primary, minHeight: 150, marginBottom: spacing['4'], textAlignVertical: 'top' },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['4'], borderRadius: radius.xl },
});
