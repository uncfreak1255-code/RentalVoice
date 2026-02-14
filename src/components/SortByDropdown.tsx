import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { ArrowUpDown, Clock, Bell, AlertTriangle, Check } from 'lucide-react-native';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';
import type { InboxSortPreference } from '@/lib/store';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

interface SortByDropdownProps {
  value: InboxSortPreference;
  onChange: (value: InboxSortPreference) => void;
}

interface SortOption {
  id: InboxSortPreference;
  label: string;
  description: string;
  icon: React.ComponentType<{ size: number; color: string }>;
}

const sortOptions: SortOption[] = [
  {
    id: 'recent',
    label: 'Most Recent',
    description: 'Sort by latest activity',
    icon: Clock,
  },
  {
    id: 'unread_first',
    label: 'Unread First',
    description: 'Show unread messages at top',
    icon: Bell,
  },
  {
    id: 'urgent_first',
    label: 'Urgent First',
    description: 'Prioritize urgent conversations',
    icon: AlertTriangle,
  },
];

export function SortByDropdown({ value, onChange }: SortByDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = sortOptions.find((opt) => opt.id === value) ?? sortOptions[0];

  const handleSelect = (optionId: InboxSortPreference) => {
    Haptics.selectionAsync();
    onChange(optionId);
    setIsOpen(false);
  };

  const handleOpen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsOpen(true);
  };

  return (
    <>
      {/* Trigger Button */}
      <Pressable
        onPress={handleOpen}
        style={({ pressed }) => [sd.triggerBtn, { opacity: pressed ? 0.7 : 1 }]}
      >
        <ArrowUpDown size={14} color={colors.text.muted} />
        <Text style={sd.triggerText}>
          {selectedOption.label}
        </Text>
      </Pressable>

      {/* Modal Dropdown */}
      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          style={sd.modalOverlayPressable}
          onPress={() => setIsOpen(false)}
        >
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={sd.dimOverlay}
          />
          <Animated.View
            entering={SlideInDown.duration(300).springify().damping(20)}
            exiting={SlideOutDown.duration(200)}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={sd.sheetContainer}>
                {/* Handle Bar */}
                <View style={sd.handleBar} />

                {/* Header */}
                <Text style={sd.sheetTitle}>
                  Sort Conversations
                </Text>

                {/* Options */}
                <View>
                  {sortOptions.map((option) => {
                    const isSelected = option.id === value;
                    const IconComponent = option.icon;

                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => handleSelect(option.id)}
                        style={({ pressed }) => [
                          sd.optionRow,
                          {
                            backgroundColor: isSelected ? colors.accent.muted : `${colors.bg.hover}80`,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <View
                          style={[sd.optionIcon, {
                            backgroundColor: isSelected ? colors.accent.soft : `${colors.bg.hover}80`,
                          }]}
                        >
                          <IconComponent
                            size={20}
                            color={isSelected ? colors.accent.DEFAULT : colors.text.muted}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[sd.optionLabel, {
                              color: isSelected ? colors.accent.light : colors.text.primary,
                            }]}
                          >
                            {option.label}
                          </Text>
                          <Text style={sd.optionDesc}>
                            {option.description}
                          </Text>
                        </View>
                        {isSelected && (
                          <View style={sd.checkCircle}>
                            <Check size={14} color="#FFFFFF" />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const sd = StyleSheet.create({
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.bg.card}B3`,
    borderRadius: radius.lg,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['2'],
  },
  triggerText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    marginLeft: spacing['1.5'],
  },
  modalOverlayPressable: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetContainer: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing['4'],
    paddingTop: spacing['4'],
    paddingBottom: spacing['8'],
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.border.strong,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginBottom: spacing['4'],
  },
  sheetTitle: {
    color: colors.text.primary,
    fontSize: 18,
    fontFamily: typography.fontFamily.semibold,
    marginBottom: spacing['4'],
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing['4'],
    borderRadius: radius.xl,
    marginBottom: spacing['2'],
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing['3'],
  },
  optionLabel: {
    fontFamily: typography.fontFamily.semibold,
  },
  optionDesc: {
    color: colors.text.muted,
    fontSize: 14,
    marginTop: 2,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.accent.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
