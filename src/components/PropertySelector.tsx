import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, TouchableOpacity, ScrollView, Modal, Dimensions, StyleSheet, TextInput } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import type { Property } from '@/lib/store';
import { useAppStore } from '@/lib/store';
import { ChevronDown, Check, Building2, MapPin, Search, Star, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radius } from '@/lib/design-tokens';


const FALLBACK_COLORS = [
  '#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626',
  '#0891B2', '#4F46E5', '#0D9488', '#CA8A04', '#E11D48',
];

function getPropertyInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(w => w.length > 0)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

function getPropertyColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

interface PropertySelectorProps {
  properties: Property[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const EMPTY_FAVORITES: string[] = [];

export function PropertySelector({
  properties,
  selectedId,
  onSelect,
  isOpen,
  onToggle,
}: PropertySelectorProps) {
  const selectedProperty = properties.find((p) => p.id === selectedId);
  const [searchQuery, setSearchQuery] = useState('');

  const favoriteIds = useAppStore((s) => s.settings.favoritePropertyIds) ?? EMPTY_FAVORITES;
  const updateSettings = useAppStore((s) => s.updateSettings);

  const toggleFavorite = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const current = favoriteIds;
    const updated = current.includes(id)
      ? current.filter((fid) => fid !== id)
      : [...current, id];
    updateSettings({ favoritePropertyIds: updated });
  };

  // Sort: favorites first, then alphabetical. Filter by search.
  const sortedProperties = useMemo(() => {
    let filtered = properties;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = properties.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.address ?? '').toLowerCase().includes(q),
      );
    }
    return [...filtered].sort((a, b) => {
      const aFav = favoriteIds.includes(a.id) ? 0 : 1;
      const bFav = favoriteIds.includes(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return a.name.localeCompare(b.name);
    });
  }, [properties, searchQuery, favoriteIds]);

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isOpen) setSearchQuery('');
    onToggle();
  };

  const handleSelect = (id: string | null) => {
    Haptics.selectionAsync();
    onSelect(id);
    setSearchQuery('');
    onToggle();
  };

  return (
    <View>
      {/* Trigger Button */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handleToggle}
        style={{
          backgroundColor: colors.bg.elevated,
          borderRadius: radius.md,
          paddingHorizontal: spacing['4'],
          paddingVertical: spacing['3'],
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: isOpen ? colors.primary.DEFAULT : colors.border.DEFAULT,
        }}
      >
        {selectedProperty ? (
          <>
            {selectedProperty.image ? (
              <Image
                source={{ uri: selectedProperty.image }}
                style={{ width: 40, height: 40, borderRadius: radius.sm }}
                contentFit="cover"
              />
            ) : (
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.sm,
                  backgroundColor: `${colors.bg.elevated}CC`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Building2 size={18} color={colors.text.muted} />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: spacing['3'] }}>
              <Text
                style={{
                  color: colors.text.primary,
                  fontFamily: typography.fontFamily.semibold,
                  fontSize: 16,
                }}
                numberOfLines={1}
              >
                {selectedProperty.name}
              </Text>
              {selectedProperty.address && (
                <Text
                  style={{
                    color: colors.text.muted,
                    fontFamily: typography.fontFamily.regular,
                    fontSize: 12,
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {selectedProperty.address}
                </Text>
              )}
            </View>
          </>
        ) : (
          <>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.sm,
                backgroundColor: colors.primary.muted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={18} color={colors.primary.DEFAULT} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing['3'] }}>
              <Text
                style={{
                  color: colors.text.primary,
                  fontFamily: typography.fontFamily.semibold,
                  fontSize: 16,
                }}
              >
                All Properties
              </Text>
              <Text
                style={{
                  color: colors.text.muted,
                  fontFamily: typography.fontFamily.regular,
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                {properties.length} properties
              </Text>
            </View>
          </>
        )}
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: radius.sm,
            backgroundColor: colors.bg.hover,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronDown
            size={16}
            color={colors.text.muted}
            style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
          />
        </View>
      </TouchableOpacity>

      {/* Bottom Sheet Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        onRequestClose={onToggle}
      >
        <Pressable
          style={{ flex: 1, justifyContent: 'flex-end' }}
          onPress={onToggle}
        >
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
            }}
          />
          <Animated.View
            entering={SlideInDown.duration(300).springify().damping(20)}
            exiting={SlideOutDown.duration(200)}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View
                style={{
                  backgroundColor: colors.bg.card,
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  maxHeight: Dimensions.get('window').height * 0.7,
                }}
              >
                {/* Handle Bar */}
                <View style={selectorStyles.handleBar} />

                {/* Header */}
                <View style={selectorStyles.header}>
                  <Text style={selectorStyles.headerTitle}>Select Property</Text>
                  <Text style={selectorStyles.headerSubtitle}>{properties.length} properties connected</Text>
                </View>

                {/* Search Bar */}
                {properties.length >= 4 && (
                  <View style={{ paddingHorizontal: spacing['4'], paddingBottom: spacing['2'] }}>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.bg.hover,
                      borderRadius: radius.md,
                      paddingHorizontal: spacing['3'],
                      height: 38,
                    }}>
                      <Search size={14} color={colors.text.muted} />
                      <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search properties..."
                        placeholderTextColor={colors.text.disabled}
                        autoFocus={false}
                        style={{
                          flex: 1,
                          color: colors.text.primary,
                          fontSize: 14,
                          fontFamily: typography.fontFamily.regular,
                          marginLeft: spacing['2'],
                          paddingVertical: 0,
                        }}
                      />
                      {searchQuery.length > 0 && (
                        <Pressable onPress={() => setSearchQuery('')}>
                          <X size={14} color={colors.text.muted} />
                        </Pressable>
                      )}
                    </View>
                  </View>
                )}

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ padding: spacing['4'], paddingTop: spacing['2'] }}
                >
                  {/* All Properties Option */}
                  {!searchQuery.trim() && (
                  <Pressable
                    onPress={() => handleSelect(null)}
                    style={({ pressed }) => [
                      selectorStyles.propertyRow,
                      {
                        backgroundColor: !selectedId ? `${colors.primary.DEFAULT}15` : `${colors.bg.elevated}E6`,
                        borderColor: !selectedId ? `${colors.primary.DEFAULT}40` : 'transparent',
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <View style={[selectorStyles.thumbFallback, { backgroundColor: !selectedId ? colors.primary.muted : `${colors.bg.elevated}CC` }]}>
                      <Building2 size={22} color={!selectedId ? colors.primary.DEFAULT : colors.text.muted} />
                    </View>
                    <View style={selectorStyles.propertyInfo}>
                      <Text style={[selectorStyles.propertyName, !selectedId && { color: colors.primary.DEFAULT }]}>
                        All Properties
                      </Text>
                      <Text style={selectorStyles.propertyAddress}>
                        View all {properties.length} properties
                      </Text>
                    </View>
                    {!selectedId && (
                      <View style={selectorStyles.checkCircle}>
                        <Check size={14} color="#FFFFFF" />
                      </View>
                    )}
                  </Pressable>
                  )}

                  {/* Divider */}
                  {!searchQuery.trim() && <View style={selectorStyles.divider} />}

                  {/* Property List */}
                  {sortedProperties.map((property, index) => {
                    const isSelected = selectedId === property.id;
                    const isFavorite = favoriteIds.includes(property.id);
                    const fallbackColor = getPropertyColor(property.name);
                    const initials = getPropertyInitials(property.name);
                    return (
                      <Pressable
                        key={property.id}
                        onPress={() => handleSelect(property.id)}
                        style={({ pressed }) => [
                          selectorStyles.propertyRow,
                          {
                            backgroundColor: isSelected ? `${colors.primary.DEFAULT}15` : `${colors.bg.elevated}E6`,
                            borderColor: isSelected ? `${colors.primary.DEFAULT}40` : 'transparent',
                            opacity: pressed ? 0.85 : 1,
                            marginBottom: index === sortedProperties.length - 1 ? 0 : spacing['2'],
                          },
                        ]}
                      >
                        {property.image ? (
                          <Image
                            source={{ uri: property.image }}
                            style={selectorStyles.thumbImage}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={[selectorStyles.thumbFallback, { backgroundColor: `${fallbackColor}20` }]}>
                            <Text style={[selectorStyles.thumbInitials, { color: fallbackColor }]}>{initials}</Text>
                          </View>
                        )}
                        <View style={selectorStyles.propertyInfo}>
                          <Text
                            style={[selectorStyles.propertyName, isSelected && { color: colors.primary.DEFAULT }]}
                            numberOfLines={2}
                          >
                            {property.name}
                          </Text>
                          {property.address && (
                            <View style={selectorStyles.addressRow}>
                              <MapPin size={11} color={colors.text.disabled} />
                              <Text style={selectorStyles.propertyAddress} numberOfLines={1}>
                                {property.address}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            toggleFavorite(property.id);
                          }}
                          hitSlop={8}
                          style={({ pressed }) => ({
                            padding: 4,
                            marginRight: 4,
                            opacity: pressed ? 0.6 : 1,
                          })}
                        >
                          <Star
                            size={16}
                            color={isFavorite ? '#EAB308' : colors.text.disabled}
                            fill={isFavorite ? '#EAB308' : 'transparent'}
                          />
                        </Pressable>
                        {isSelected && (
                          <View style={selectorStyles.checkCircle}>
                            <Check size={14} color="#FFFFFF" />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}

                  {/* Bottom padding for safe area */}
                  <View style={{ height: 24 }} />
                </ScrollView>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

const selectorStyles = StyleSheet.create({
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: colors.border.DEFAULT,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border.DEFAULT}30`,
  },
  headerTitle: {
    color: colors.text.primary,
    fontSize: 18,
    fontFamily: typography.fontFamily.bold,
  },
  headerSubtitle: {
    color: colors.text.disabled,
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    marginTop: 2,
  },
  propertyRow: {
    borderRadius: radius.lg,
    padding: spacing['3'],
    marginBottom: spacing['2'],
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  thumbImage: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
  },
  thumbFallback: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbInitials: {
    fontSize: 18,
    fontFamily: typography.fontFamily.bold,
  },
  propertyInfo: {
    flex: 1,
    marginLeft: spacing['3'],
  },
  propertyName: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 15,
    color: colors.text.primary,
  },
  propertyAddress: {
    color: colors.text.disabled,
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    marginLeft: 3,
    marginTop: 3,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: `${colors.border.DEFAULT}30`,
    marginVertical: spacing['2'],
    marginHorizontal: spacing['2'],
  },
});
