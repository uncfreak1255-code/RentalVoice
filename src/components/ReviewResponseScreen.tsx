import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Star,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { generateReviewResponse, type ReviewResponseResult } from '@/lib/api-client';
import { useAppStore } from '@/lib/store';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

const PLATFORMS = ['Airbnb', 'Booking.com', 'VRBO', 'Google', 'TripAdvisor', 'Other'];

interface ReviewResponseScreenProps {
  onBack: () => void;
}

export function ReviewResponseScreen({ onBack }: ReviewResponseScreenProps) {
  const properties = useAppStore((s) => s.properties);
  const selectedPropertyId = useAppStore((s) => s.settings.selectedPropertyId);

  const [reviewText, setReviewText] = useState('');
  const [rating, setRating] = useState(5);
  const [guestName, setGuestName] = useState('');
  const [platform, setPlatform] = useState('Airbnb');
  const [propertyId, setPropertyId] = useState(selectedPropertyId || '');

  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ReviewResponseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!reviewText.trim()) {
      setError('Please paste the guest review first.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await generateReviewResponse({
        review: reviewText.trim(),
        rating,
        guestName: guestName.trim() || undefined,
        platform,
        propertyId: propertyId || undefined,
      });
      setResult(res);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('[ReviewResponse]', err);
      setError('Failed to generate response. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsGenerating(false);
    }
  }, [reviewText, rating, guestName, platform, propertyId]);

  const handleCopy = useCallback(async () => {
    if (!result?.response) return;
    await Clipboard.setStringAsync(result.response);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const handleRegenerate = useCallback(() => {
    handleGenerate();
  }, [handleGenerate]);

  return (
    <View style={s.root}>
      <LinearGradient
        colors={[colors.bg.elevated, colors.bg.subtle]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 150 }}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Animated.View entering={FadeIn.duration(300)} style={s.header}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [s.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <ArrowLeft size={20} color={colors.text.primary} />
          </Pressable>
          <Text style={s.headerTitle}>Review Response</Text>
        </Animated.View>

        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Star Rating */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Guest Rating</Text>
            <View style={s.starRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => {
                    setRating(n);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  hitSlop={6}
                >
                  <Star
                    size={32}
                    color={n <= rating ? '#FBBF24' : colors.text.disabled}
                    fill={n <= rating ? '#FBBF24' : 'transparent'}
                  />
                </Pressable>
              ))}
              <Text style={s.ratingText}>{rating}/5</Text>
            </View>
          </Animated.View>

          {/* Review Text */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Guest Review</Text>
            <TextInput
              value={reviewText}
              onChangeText={(t) => {
                setReviewText(t);
                setError(null);
              }}
              placeholder="Paste the guest review here..."
              placeholderTextColor={colors.text.disabled}
              style={s.textArea}
              multiline
              textAlignVertical="top"
              numberOfLines={5}
            />
          </Animated.View>

          {/* Platform Picker */}
          <Animated.View entering={FadeInDown.delay(250).duration(400)} style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Platform</Text>
            <View style={s.pillRow}>
              {PLATFORMS.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => {
                    setPlatform(p);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[
                    s.pill,
                    {
                      backgroundColor:
                        platform === p ? colors.accent.DEFAULT + '20' : colors.bg.elevated + '80',
                      borderColor:
                        platform === p ? colors.accent.DEFAULT : colors.border.subtle,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.pillText,
                      { color: platform === p ? colors.accent.DEFAULT : colors.text.muted },
                    ]}
                  >
                    {p}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Guest Name (optional) */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={s.fieldWrap}>
            <Text style={s.fieldLabel}>
              Guest Name <Text style={s.optional}>(optional)</Text>
            </Text>
            <View style={s.inputWrap}>
              <TextInput
                value={guestName}
                onChangeText={setGuestName}
                placeholder="e.g. John"
                placeholderTextColor={colors.text.disabled}
                style={s.input}
                autoCapitalize="words"
              />
            </View>
          </Animated.View>

          {/* Property Picker */}
          {properties.length > 0 && (
            <Animated.View entering={FadeInDown.delay(350).duration(400)} style={s.fieldWrap}>
              <Text style={s.fieldLabel}>
                Property <Text style={s.optional}>(optional)</Text>
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.pillRow}>
                  <Pressable
                    onPress={() => setPropertyId('')}
                    style={[
                      s.pill,
                      {
                        backgroundColor:
                          !propertyId ? colors.accent.DEFAULT + '20' : colors.bg.elevated + '80',
                        borderColor:
                          !propertyId ? colors.accent.DEFAULT : colors.border.subtle,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.pillText,
                        { color: !propertyId ? colors.accent.DEFAULT : colors.text.muted },
                      ]}
                    >
                      Any
                    </Text>
                  </Pressable>
                  {properties.slice(0, 8).map((prop) => (
                    <Pressable
                      key={prop.id}
                      onPress={() => setPropertyId(prop.id)}
                      style={[
                        s.pill,
                        {
                          backgroundColor:
                            propertyId === prop.id
                              ? colors.accent.DEFAULT + '20'
                              : colors.bg.elevated + '80',
                          borderColor:
                            propertyId === prop.id
                              ? colors.accent.DEFAULT
                              : colors.border.subtle,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.pillText,
                          {
                            color:
                              propertyId === prop.id
                                ? colors.accent.DEFAULT
                                : colors.text.muted,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {prop.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </Animated.View>
          )}

          {/* Error */}
          {error && (
            <Animated.View entering={FadeIn.duration(200)} style={s.fieldWrap}>
              <View style={s.errorCard}>
                <AlertCircle size={18} color={colors.danger.DEFAULT} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            </Animated.View>
          )}

          {/* Generate Button */}
          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={s.fieldWrap}>
            <Pressable
              onPress={handleGenerate}
              disabled={isGenerating}
              style={({ pressed }) => [
                s.generateBtn,
                {
                  backgroundColor: isGenerating
                    ? colors.bg.hover
                    : colors.accent.DEFAULT,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {isGenerating ? (
                <>
                  <ActivityIndicator size="small" color={colors.text.primary} />
                  <Text style={[s.generateText, { marginLeft: spacing['2'] }]}>
                    Generating...
                  </Text>
                </>
              ) : (
                <>
                  <Sparkles size={18} color="#FFF" />
                  <Text style={[s.generateText, { marginLeft: spacing['2'] }]}>
                    Generate Response
                  </Text>
                </>
              )}
            </Pressable>
          </Animated.View>

          {/* Result */}
          {result && (
            <Animated.View entering={FadeInDown.duration(400)} style={s.resultWrap}>
              <View style={s.resultHeader}>
                <View style={s.resultBadge}>
                  <Sparkles size={14} color={colors.accent.DEFAULT} />
                  <Text style={s.resultBadgeText}>AI Response</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing['2'] }}>
                  <Pressable
                    onPress={handleRegenerate}
                    style={({ pressed }) => [s.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
                    hitSlop={8}
                  >
                    <RefreshCw size={16} color={colors.text.muted} />
                  </Pressable>
                  <Pressable
                    onPress={handleCopy}
                    style={({ pressed }) => [s.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
                    hitSlop={8}
                  >
                    {copied ? (
                      <Check size={16} color={colors.primary.DEFAULT} />
                    ) : (
                      <Copy size={16} color={colors.text.muted} />
                    )}
                  </Pressable>
                </View>
              </View>

              <Text style={s.resultText} selectable>
                {result.response}
              </Text>

              <View style={s.resultMeta}>
                <Text style={s.metaText}>
                  {result.provider} · {result.model} · {result.confidence}% conf
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Spacer */}
          <View style={{ height: spacing['8'] }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.bg.elevated + '80',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing['3'],
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: typography.fontFamily.bold,
    color: colors.text.primary,
  },
  scroll: { flex: 1, paddingHorizontal: spacing['4'] },
  fieldWrap: { marginBottom: spacing['4'] },
  fieldLabel: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing['2'],
    marginLeft: spacing['1'],
  },
  optional: { color: colors.text.disabled, fontWeight: '400' },

  // Star rating
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2'],
    paddingVertical: spacing['2'],
  },
  ratingText: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: typography.fontFamily.medium,
    marginLeft: spacing['3'],
  },

  // Text area
  textArea: {
    backgroundColor: colors.bg.elevated + '80',
    borderRadius: radius.md,
    color: colors.text.primary,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    minHeight: 120,
    fontSize: 15,
    lineHeight: 22,
  },

  // Pills
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['2'] },
  pill: {
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['2'],
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  pillText: { fontSize: 13, fontFamily: typography.fontFamily.medium },

  // Input
  inputWrap: { backgroundColor: colors.bg.elevated + '80', borderRadius: radius.md },
  input: {
    color: colors.text.primary,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
  },

  // Error
  errorCard: {
    backgroundColor: colors.danger.muted,
    borderRadius: radius.md,
    padding: spacing['3'],
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    color: colors.danger.light,
    fontSize: 14,
    marginLeft: spacing['2'],
    flex: 1,
  },

  // Generate button
  generateBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing['4'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateText: {
    color: '#FFF',
    fontFamily: typography.fontFamily.semibold,
    fontSize: 16,
  },

  // Result
  resultWrap: {
    backgroundColor: colors.bg.elevated + 'E6',
    borderRadius: radius.xl,
    padding: spacing['4'],
    marginBottom: spacing['4'],
    borderWidth: 1,
    borderColor: colors.accent.DEFAULT + '30',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing['3'],
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.DEFAULT + '15',
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['1'],
    borderRadius: radius.sm,
    gap: spacing['1'],
  },
  resultBadgeText: {
    color: colors.accent.DEFAULT,
    fontSize: 12,
    fontFamily: typography.fontFamily.semibold,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.bg.hover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultText: {
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: spacing['3'],
  },
  resultMeta: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing['2'],
  },
  metaText: { color: colors.text.disabled, fontSize: 11 },
});
