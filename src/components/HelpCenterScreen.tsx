import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Linking, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronDown, ChevronUp, HelpCircle, MessageCircle, Mail, BookOpen, Zap, Shield, Search, X, ExternalLink } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

interface HelpCenterScreenProps { onBack: () => void; }

interface FAQItem { question: string; answer: string; }
interface FAQCategory { title: string; icon: any; faqs: FAQItem[]; }

const faqCategories: FAQCategory[] = [
  {
    title: 'Getting Started',
    icon: Zap,
    faqs: [
      { question: 'How do I connect my Hostaway account?', answer: 'Go to Settings → Manage PMS Connection and enter your Hostaway Account ID and API Secret Key. You can find both in your Hostaway dashboard under Settings → API.' },
      { question: 'What is Demo Mode?', answer: 'Demo Mode lets you explore the app with sample data without connecting your Hostaway account. Great for testing features before going live.' },
      { question: 'Do I need to manage AI provider keys?', answer: 'No in the current product flow. Rental Voice is moving toward managed AI routing for commercial workspaces, while personal mode keeps your existing draft workflow without exposing the old provider-management screen.' },
      { question: 'How does CoPilot mode work?', answer: 'In CoPilot mode, the AI generates draft responses for each guest message. You review, edit if needed, and send. Your edits help the AI learn your style.' },
      { question: 'How does AutoPilot work?', answer: 'When enabled, AutoPilot automatically sends AI-generated responses that meet your confidence threshold. Configure it in Settings → AI Automation.' },
    ],
  },
  {
    title: 'AI Responses',
    icon: MessageCircle,
    faqs: [
      { question: 'How accurate are AI responses?', answer: 'AI responses are based on your property knowledge base, past conversation history, and guest context. The more information you provide and the more edits you make, the more accurate responses become over time.' },
      { question: 'Can I edit AI responses before sending?', answer: 'Yes! Every AI draft can be reviewed and edited before sending. Your edits are tracked as learning data and help the AI improve over time.' },
      { question: 'What languages does the AI support?', answer: 'The AI can detect and respond in multiple languages including English, Spanish, French, German, Italian, Portuguese, Arabic, Chinese, Japanese, Korean, and more.' },
      { question: 'How do I train the AI to match my style?', answer: 'Go to Settings → AI Learning. The training system analyzes your past responses and edits to learn your communication style, preferred vocabulary, and tone.' },
    ],
  },
  {
    title: 'Property Knowledge',
    icon: BookOpen,
    faqs: [
      { question: 'What should I add to my property knowledge?', answer: 'Include WiFi details, check-in/out instructions, parking info, house rules, appliance guides, local recommendations, emergency contacts, and any property-specific information guests commonly ask about.' },
      { question: 'How does the AI use this information?', answer: 'The AI references your property knowledge when generating responses, ensuring accurate and helpful information for guests. More detailed knowledge = better responses.' },
      { question: 'Can I have different knowledge per property?', answer: 'Yes! Property knowledge is stored per-property. Select the property in the Property Knowledge screen to edit its specific information.' },
    ],
  },
  {
    title: 'Privacy & Security',
    icon: Shield,
    faqs: [
      { question: 'Is my data secure?', answer: 'Yes. Rental Voice uses secure connections (HTTPS) for all data transfers. Your PMS credentials are stored using platform-native secure storage. In commercial mode, data is managed through secure server infrastructure.' },
      { question: 'Can I export or delete my data?', answer: 'Go to Settings → Privacy & Security → Data Management. You can export a summary of your data or reset local app data. Stored credentials can be cleared by disconnecting your PMS account.' },
      { question: 'What does the privacy scanner do?', answer: 'The privacy scanner flags potential sensitive data like card numbers and personal identifiers in messages, helping you catch accidental data exposure before sending.' },
    ],
  },
];

export function HelpCenterScreen({ onBack }: HelpCenterScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Getting Started');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const isSearching = searchQuery.trim().length > 0;

  const filteredResults = useMemo(() => {
    if (!isSearching) return [];
    const query = searchQuery.toLowerCase();
    const results: (FAQItem & { category: string })[] = [];
    faqCategories.forEach((cat) => {
      cat.faqs.forEach((faq) => {
        if (faq.question.toLowerCase().includes(query) || faq.answer.toLowerCase().includes(query)) {
          results.push({ ...faq, category: cat.title });
        }
      });
    });
    return results;
  }, [searchQuery, isSearching]);

  const handleCategoryPress = (title: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedCategory(expandedCategory === title ? null : title);
  };

  const handleFAQPress = (question: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedFAQ(expandedFAQ === question ? null : question);
  };

  const clearSearch = () => { setSearchQuery(''); };

  return (
    <View style={s.root}>
      <LinearGradient colors={[colors.bg.elevated, colors.bg.subtle]} style={s.gradient} />
      <SafeAreaView style={s.flex} edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={s.header}>
          <Pressable onPress={onBack} style={({ pressed }) => [s.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <ArrowLeft size={20} color={colors.text.primary} />
          </Pressable>
          <Text style={s.headerTitle}>Help Center</Text>
        </Animated.View>

        <ScrollView style={s.flex} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing['4'] }} keyboardShouldPersistTaps="handled">
          {/* Search Bar */}
          <Animated.View entering={FadeInDown.delay(50).duration(400)} style={s.searchWrap}>
            <Search size={18} color={isSearching ? colors.primary.DEFAULT : colors.text.disabled} />
            <TextInput
              style={s.searchInput}
              placeholder="Search help articles..."
              placeholderTextColor={colors.text.disabled}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {isSearching && (
              <Pressable onPress={clearSearch} style={s.clearBtn}>
                <X size={16} color={colors.text.muted} />
              </Pressable>
            )}
          </Animated.View>

          {/* Search Results */}
          {isSearching ? (
            <View>
              <Text style={s.resultCount}>
                {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} for "{searchQuery}"
              </Text>
              {filteredResults.length === 0 ? (
                <View style={s.emptyState}>
                  <HelpCircle size={32} color={colors.text.disabled} />
                  <Text style={s.emptyTitle}>No results found</Text>
                  <Text style={s.emptyDesc}>Try different keywords or browse the categories below.</Text>
                  <Pressable onPress={clearSearch} style={({ pressed }) => [s.clearSearchBtn, { opacity: pressed ? 0.8 : 1 }]}>
                    <Text style={s.clearSearchText}>Clear Search</Text>
                  </Pressable>
                </View>
              ) : (
                filteredResults.map((result, i) => (
                  <Pressable
                    key={`${result.category}-${result.question}`}
                    onPress={() => handleFAQPress(result.question)}
                    style={[s.searchResultCard, i < filteredResults.length - 1 && { marginBottom: spacing['3'] }]}
                  >
                    <Text style={s.searchResultCategory}>{result.category}</Text>
                    <View style={s.faqHeader}>
                      <Text style={s.faqQuestion}>{result.question}</Text>
                      {expandedFAQ === result.question
                        ? <ChevronUp size={16} color={colors.text.disabled} />
                        : <ChevronDown size={16} color={colors.text.disabled} />}
                    </View>
                    {expandedFAQ === result.question && (
                      <Text style={s.faqAnswer}>{result.answer}</Text>
                    )}
                  </Pressable>
                ))
              )}
            </View>
          ) : (
            <>
              {/* Welcome Card */}
              <Animated.View entering={FadeInDown.delay(100).duration(400)} style={s.welcomeCard}>
                <View style={s.welcomeRow}>
                  <View style={s.welcomeIcon}>
                    <HelpCircle size={22} color={colors.primary.DEFAULT} />
                  </View>
                  <View style={s.flex}>
                    <Text style={s.welcomeTitle}>How can we help?</Text>
                    <Text style={s.welcomeDesc}>Browse FAQs or search for specific topics.</Text>
                  </View>
                </View>
              </Animated.View>

              {/* FAQ Categories */}
              {faqCategories.map((category, categoryIndex) => (
                <Animated.View
                  key={category.title}
                  entering={FadeInDown.delay(150 + categoryIndex * 50).duration(400)}
                  style={s.categoryWrap}
                >
                  <Pressable
                    onPress={() => handleCategoryPress(category.title)}
                    style={({ pressed }) => [s.categoryCard, { opacity: pressed ? 0.9 : 1 }]}
                  >
                    <View style={s.categoryHeader}>
                      <View style={s.categoryLeft}>
                        <View style={s.categoryIcon}>
                          <category.icon size={20} color={colors.text.muted} />
                        </View>
                        <View>
                          <Text style={s.categoryTitle}>{category.title}</Text>
                          <Text style={s.categoryCount}>{category.faqs.length} articles</Text>
                        </View>
                      </View>
                      {expandedCategory === category.title
                        ? <ChevronUp size={20} color={colors.text.disabled} />
                        : <ChevronDown size={20} color={colors.text.disabled} />}
                    </View>

                    {expandedCategory === category.title && (
                      <View style={s.faqList}>
                        {category.faqs.map((faq, faqIndex) => (
                          <Pressable
                            key={faq.question}
                            onPress={() => handleFAQPress(faq.question)}
                            style={[s.faqItem, faqIndex < category.faqs.length - 1 && s.faqItemBorder]}
                          >
                            <View style={s.faqHeader}>
                              <Text style={s.faqQuestion}>{faq.question}</Text>
                              {expandedFAQ === faq.question
                                ? <ChevronUp size={16} color={colors.text.disabled} />
                                : <ChevronDown size={16} color={colors.text.disabled} />}
                            </View>
                            {expandedFAQ === faq.question && (
                              <Text style={s.faqAnswer}>{faq.answer}</Text>
                            )}
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              ))}
            </>
          )}

          {/* Contact Support */}
          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={s.contactWrap}>
            <Text style={s.contactLabel}>NEED MORE HELP?</Text>
            <View style={s.contactCard}>
              <Pressable
                onPress={() => Linking.openURL('mailto:support@rentalvoice.app')}
                style={({ pressed }) => [s.contactRow, s.contactRowBorder, { opacity: pressed ? 0.7 : 1 }]}
              >
                <View style={s.contactIcon}><Mail size={20} color={colors.text.muted} /></View>
                <View style={s.flex}>
                  <Text style={s.contactTitle}>Email Support</Text>
                  <Text style={s.contactSub}>support@rentalvoice.app</Text>
                </View>
                <ExternalLink size={14} color={colors.text.disabled} />
              </Pressable>
              <View style={s.contactRow}>
                <View style={s.contactIcon}><MessageCircle size={20} color={colors.text.muted} /></View>
                <View style={s.flex}>
                  <Text style={s.contactTitle}>Response Time</Text>
                  <Text style={s.contactSub}>We aim to respond within 24 hours</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  flex: { flex: 1 },
  gradient: { position: 'absolute', left: 0, right: 0, top: 0, height: 150 },
  header: { paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], flexDirection: 'row', alignItems: 'center' },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: `${colors.bg.elevated}E6`,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'],
  },
  headerTitle: { fontSize: 20, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: `${colors.bg.elevated}E6`,
    borderRadius: radius.xl, paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'], marginBottom: spacing['4'],
    borderWidth: 1, borderColor: `${colors.border.DEFAULT}30`,
  },
  searchInput: {
    flex: 1, color: colors.text.primary, fontSize: 15,
    fontFamily: typography.fontFamily.regular,
    marginLeft: spacing['3'], paddingVertical: 0,
  },
  clearBtn: {
    width: 28, height: 28, borderRadius: radius.full,
    backgroundColor: `${colors.bg.elevated}CC`,
    alignItems: 'center', justifyContent: 'center',
  },
  resultCount: {
    color: colors.text.disabled, fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing['3'], marginLeft: spacing['1'],
  },
  searchResultCard: {
    backgroundColor: `${colors.bg.elevated}E6`,
    borderRadius: radius.xl, padding: spacing['4'],
  },
  searchResultCategory: {
    color: colors.primary.DEFAULT, fontSize: 11,
    fontFamily: typography.fontFamily.semibold,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: spacing['2'],
  },
  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: spacing['8'] },
  emptyTitle: { color: colors.text.primary, fontFamily: typography.fontFamily.semibold, fontSize: 16, marginTop: spacing['3'] },
  emptyDesc: { color: colors.text.muted, fontSize: 14, marginTop: spacing['1'], textAlign: 'center' },
  clearSearchBtn: {
    marginTop: spacing['4'], paddingHorizontal: spacing['5'],
    paddingVertical: spacing['2'], borderRadius: radius.full,
    backgroundColor: `${colors.primary.DEFAULT}15`,
  },
  clearSearchText: { color: colors.primary.DEFAULT, fontFamily: typography.fontFamily.medium, fontSize: 14 },
  // Welcome
  welcomeCard: {
    backgroundColor: `${colors.primary.DEFAULT}12`,
    borderRadius: radius.xl, padding: spacing['4'], marginBottom: spacing['6'],
    borderWidth: 1, borderColor: `${colors.primary.DEFAULT}25`,
  },
  welcomeRow: { flexDirection: 'row', alignItems: 'center' },
  welcomeIcon: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.primary.muted,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'],
  },
  welcomeTitle: { color: colors.text.primary, fontFamily: typography.fontFamily.semibold, fontSize: 16 },
  welcomeDesc: { color: colors.text.muted, fontSize: 13, marginTop: 2 },
  // Categories
  categoryWrap: { marginBottom: spacing['3'] },
  categoryCard: { backgroundColor: `${colors.bg.elevated}E6`, borderRadius: radius['2xl'], padding: spacing['4'] },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryLeft: { flexDirection: 'row', alignItems: 'center' },
  categoryIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: `${colors.bg.elevated}CC`,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'],
  },
  categoryTitle: { color: colors.text.primary, fontFamily: typography.fontFamily.medium },
  categoryCount: { color: colors.text.disabled, fontSize: 12, marginTop: 1 },
  faqList: { marginTop: spacing['4'], paddingTop: spacing['4'], borderTopWidth: 1, borderTopColor: `${colors.border.DEFAULT}40` },
  faqItem: { paddingVertical: spacing['3'] },
  faqItemBorder: { borderBottomWidth: 1, borderBottomColor: `${colors.border.DEFAULT}30` },
  faqHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  faqQuestion: { color: colors.text.secondary, flex: 1, marginRight: spacing['2'], fontFamily: typography.fontFamily.medium, fontSize: 14 },
  faqAnswer: { color: colors.text.muted, fontSize: 14, marginTop: spacing['2'], lineHeight: 20 },
  // Contact
  contactWrap: { marginBottom: spacing['8'], marginTop: spacing['4'] },
  contactLabel: {
    color: colors.text.disabled, fontSize: 12,
    fontFamily: typography.fontFamily.semibold,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: spacing['2'], marginLeft: spacing['1'],
  },
  contactCard: { backgroundColor: `${colors.bg.elevated}E6`, borderRadius: radius['2xl'], overflow: 'hidden' },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing['4'], paddingVertical: spacing['4'] },
  contactRowBorder: { borderBottomWidth: 1, borderBottomColor: `${colors.border.DEFAULT}40` },
  contactIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: `${colors.bg.elevated}CC`,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing['3'],
  },
  contactTitle: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 15 },
  contactSub: { color: colors.text.disabled, fontSize: 13, marginTop: 2 },
});
