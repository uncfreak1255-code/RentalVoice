import React, { useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
  Check,
  RefreshCw,
  Edit3,
  X,
  Wand2,
  Heart,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Briefcase,
  Coffee,
  AlertTriangle,
  Gauge,
} from 'lucide-react-native';
import type { RegenerationOption, SentimentAnalysis } from '@/lib/ai-enhanced';

interface AIDraftActionsSheetProps {
  bottomSheetRef: React.RefObject<BottomSheet | null>;
  onApprove: () => void;
  onEdit: () => void;
  onDismiss: () => void;
  onRegenerate: (modifier?: RegenerationOption['modifier']) => void;
  confidence: number;
  sentiment?: SentimentAnalysis;
}

// Regeneration options with icons
const REGENERATION_OPTIONS = [
  { id: 'warmer', label: 'Warmer', icon: Heart, color: '#F97316' },
  { id: 'cooler', label: 'More Formal', icon: Briefcase, color: '#3B82F6' },
  { id: 'shorter', label: 'Shorter', icon: ArrowDownNarrowWide, color: '#8B5CF6' },
  { id: 'longer', label: 'More Detail', icon: ArrowUpNarrowWide, color: '#10B981' },
  { id: 'casual', label: 'Casual', icon: Coffee, color: '#EC4899' },
  { id: 'urgent', label: 'Add Urgency', icon: AlertTriangle, color: '#EF4444' },
  { id: 'direct', label: 'More Direct', icon: Gauge, color: '#06B6D4' },
  { id: 'neutral', label: 'Neutral Tone', icon: Wand2, color: '#6366F1' },
] as const;

export function AIDraftActionsSheet({
  bottomSheetRef,
  onApprove,
  onEdit,
  onDismiss,
  onRegenerate,
  confidence,
  sentiment,
}: AIDraftActionsSheetProps) {
  const snapPoints = useMemo(() => ['55%'], []);

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      // Sheet closed
    }
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
      />
    ),
    []
  );

  const handleAction = useCallback((action: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    action();
    bottomSheetRef.current?.close();
  }, [bottomSheetRef]);

  const handleRegenerate = useCallback((modifier?: RegenerationOption['modifier']) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRegenerate(modifier);
    bottomSheetRef.current?.close();
  }, [bottomSheetRef, onRegenerate]);

  // Get confidence color
  const confidenceColor = confidence >= 0.8 ? '#10B981' : confidence >= 0.6 ? '#F59E0B' : '#EF4444';
  const confidenceLabel = confidence >= 0.8 ? 'High' : confidence >= 0.6 ? 'Medium' : 'Low';

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetView style={styles.contentContainer}>
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>AI Draft Actions</Text>
          <View style={styles.confidenceBadge}>
            <View style={[styles.confidenceDot, { backgroundColor: confidenceColor }]} />
            <Text style={[styles.confidenceText, { color: confidenceColor }]}>
              {confidenceLabel} Confidence ({Math.round(confidence * 100)}%)
            </Text>
          </View>
        </View>

        {/* Primary Actions */}
        <View style={styles.primaryActions}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              styles.approveButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => handleAction(onApprove)}
          >
            <Check size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Send as Reply</Text>
          </Pressable>

          <View style={styles.secondaryRow}>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => handleAction(onEdit)}
            >
              <Edit3 size={18} color="#94A3B8" />
              <Text style={styles.secondaryButtonText}>Edit</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => handleRegenerate()}
            >
              <RefreshCw size={18} color="#94A3B8" />
              <Text style={styles.secondaryButtonText}>Regenerate</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => handleAction(onDismiss)}
            >
              <X size={18} color="#EF4444" />
              <Text style={[styles.secondaryButtonText, { color: '#EF4444' }]}>Dismiss</Text>
            </Pressable>
          </View>
        </View>

        {/* Regeneration Options */}
        <View style={styles.regenerateSection}>
          <Text style={styles.sectionTitle}>Adjust Tone</Text>
          <View style={styles.optionsGrid}>
            {REGENERATION_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <Pressable
                  key={option.id}
                  style={({ pressed }) => [
                    styles.optionButton,
                    pressed && styles.optionButtonPressed,
                  ]}
                  onPress={() => handleRegenerate(option.id as RegenerationOption['modifier'])}
                >
                  <View style={[styles.optionIcon, { backgroundColor: `${option.color}20` }]}>
                    <Icon size={16} color={option.color} />
                  </View>
                  <Text style={styles.optionText}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: '#475569',
    width: 40,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  header: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.3)',
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  confidenceText: {
    fontSize: 13,
    fontWeight: '500',
  },
  primaryActions: {
    marginBottom: 24,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
    marginBottom: 12,
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(71, 85, 105, 0.3)',
    borderRadius: 10,
    gap: 6,
  },
  secondaryButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  regenerateSection: {
    flex: 1,
  },
  sectionTitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 8,
  },
  optionButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  optionIcon: {
    padding: 4,
    borderRadius: 6,
  },
  optionText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default AIDraftActionsSheet;
