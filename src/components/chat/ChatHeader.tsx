import React from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { ReservationSummaryBar } from '../ReservationSummaryBar';
import GuestMemoryCard from '../GuestMemoryCard';
import IssueTriageCard from '../IssueTriageCard';
import { ConversationSummaryDisplay } from '../ConversationSummaryDisplay';
import type { Conversation, Issue } from '@/lib/store';
import type { IssueTriageResult } from '@/lib/issue-triage';
import type { GuestMemory } from '@/lib/advanced-training';
import type { LearningToastType } from './types';
import {
  Phone,
  Home,
  Calendar,
  User,
  Brain,
  Search,
  X,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { colors, typography, spacing, radius } from '@/lib/design-tokens';

export interface ChatHeaderProps {
  conversation: Conversation;
  onBack: () => void;
  onShowGuestProfile: () => void;

  // Search
  isSearchOpen: boolean;
  searchQuery: string;
  onToggleSearch: () => void;
  onSearchQueryChange: (query: string) => void;

  // Guest info
  showGuestInfo: boolean;
  onToggleGuestInfo: () => void;

  // Learning toast
  editLearningSummary: string | null;
  learningToastType: LearningToastType;

  // Issue triage
  triagedIssue: IssueTriageResult | null;
  latestConversationIssue: Issue | null;
  issueTriageCollapsed: boolean;
  savedHandoffDraft: string | null;
  onToggleIssueTriageCollapsed: () => void;
  onIssueNeedsFollowUp: () => void;
  onIssueCreateHandoff: () => void;
  onIssueResumeHandoff: () => void;
  onIssueMarkResolved: () => void;

  // Guest memory
  guestMemory: GuestMemory | null;
  guestStayCount: number;
  guestMemoryCollapsed: boolean;
  onToggleGuestMemoryCollapsed: () => void;
}

export function ChatHeader({
  conversation,
  onBack,
  onShowGuestProfile,
  isSearchOpen,
  searchQuery,
  onToggleSearch,
  onSearchQueryChange,
  showGuestInfo,
  onToggleGuestInfo,
  editLearningSummary,
  learningToastType,
  triagedIssue,
  latestConversationIssue,
  issueTriageCollapsed,
  savedHandoffDraft,
  onToggleIssueTriageCollapsed,
  onIssueNeedsFollowUp,
  onIssueCreateHandoff,
  onIssueResumeHandoff,
  onIssueMarkResolved,
  guestMemory,
  guestStayCount,
  guestMemoryCollapsed,
  onToggleGuestMemoryCollapsed,
}: ChatHeaderProps) {
  const { guest, property, checkInDate, checkOutDate } = conversation;

  return (
    <>
      {/* Learning Toast */}
      {editLearningSummary && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={styles.learnToast}
        >
          <View style={styles.learnToastInner}>
            <Brain size={18} color={colors.text.inverse} />
            <View style={styles.learnToastText}>
              <Text style={styles.learnToastTitle}>
                {learningToastType === 'approval' && 'Draft approved'}
                {learningToastType === 'edit' && 'Learned from your edit'}
                {learningToastType === 'independent' && 'Style recorded'}
                {learningToastType === 'rejection' && 'Preference noted'}
              </Text>
              <Text style={styles.learnToastBody}>{editLearningSummary}</Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <View style={styles.headerInner}>
          {/* Back / Done button */}
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back to inbox"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, minWidth: 44 })}
            testID="chat-back"
          >
            <Text style={styles.doneButton}>Done</Text>
          </Pressable>

          {/* Centered guest name */}
          <Pressable
            onPress={onShowGuestProfile}
            accessibilityRole="button"
            accessibilityLabel={`View ${guest.name || 'Guest'} profile`}
            accessibilityHint="Opens guest profile details"
            style={{ flex: 1, alignItems: 'center', marginHorizontal: 8 }}
          >
            <Text style={styles.guestName} numberOfLines={1}>
              {guest.name || 'Guest'}
            </Text>
          </Pressable>

          {/* Search toggle */}
          <Pressable
            onPress={onToggleSearch}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={isSearchOpen ? 'Close search' : 'Search messages'}
            style={({ pressed }) => ({
              opacity: pressed ? 0.8 : 1,
              minWidth: 44,
              alignItems: 'flex-end' as const,
            })}
          >
            {isSearchOpen ? (
              <X size={20} color={colors.text.muted} />
            ) : (
              <Search size={20} color={colors.text.muted} />
            )}
          </Pressable>
        </View>

        {/* Search Bar */}
        {isSearchOpen && (
          <Animated.View
            entering={FadeInDown.duration(200)}
            style={{ paddingHorizontal: spacing['4'], paddingBottom: spacing['2'] }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.bg.hover,
                borderRadius: radius.md,
                paddingHorizontal: spacing['3'],
                height: 36,
              }}
            >
              <Search size={14} color={colors.text.muted} />
              <TextInput
                value={searchQuery}
                onChangeText={onSearchQueryChange}
                placeholder="Search messages..."
                placeholderTextColor={colors.text.disabled}
                autoFocus
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
                <Pressable
                  onPress={() => onSearchQueryChange('')}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <X size={14} color={colors.text.muted} />
                </Pressable>
              )}
            </View>
          </Animated.View>
        )}

        {/* Reservation Summary Bar */}
        <ReservationSummaryBar
          conversation={conversation}
          onSeeDetails={onToggleGuestInfo}
        />

        {/* Issue Triage Card */}
        {triagedIssue && latestConversationIssue?.status !== 'resolved' ? (
          <IssueTriageCard
            triage={triagedIssue}
            collapsed={issueTriageCollapsed}
            hasSavedHandoff={Boolean(savedHandoffDraft)}
            onToggleCollapsed={onToggleIssueTriageCollapsed}
            onNeedsFollowUp={onIssueNeedsFollowUp}
            onCreateHandoff={onIssueCreateHandoff}
            onResumeHandoff={onIssueResumeHandoff}
            onMarkResolved={onIssueMarkResolved}
          />
        ) : null}

        {/* Guest Memory Card */}
        {guestMemory?.preferences.isReturning && guestStayCount > 0 ? (
          <GuestMemoryCard
            memory={guestMemory}
            stayCount={guestStayCount}
            collapsed={guestMemoryCollapsed}
            onToggle={onToggleGuestMemoryCollapsed}
          />
        ) : null}

        {/* Guest Info Panel */}
        {showGuestInfo && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.guestInfoPanel}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <User size={14} color={colors.text.muted} />
                <Text style={styles.infoText}>{guest.email}</Text>
              </View>
              {guest.phone && (
                <View style={styles.infoItem}>
                  <Phone size={14} color={colors.text.muted} />
                  <Text style={styles.infoText}>{guest.phone}</Text>
                </View>
              )}
            </View>
            <View style={[styles.infoRow, { marginTop: spacing['1'] }]}>
              <View style={styles.infoItem}>
                <Home size={14} color={colors.text.muted} />
                <Text style={styles.infoText}>{property.name}</Text>
              </View>
              {checkInDate && checkOutDate && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Calendar size={14} color={colors.text.muted} />
                  <Text style={styles.infoText}>
                    {format(new Date(checkInDate), 'MMM d')} -{' '}
                    {format(new Date(checkOutDate), 'MMM d')}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* Conversation Summary */}
        <ConversationSummaryDisplay conversation={conversation} variant="compact" />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  learnToast: {
    position: 'absolute',
    top: 64,
    left: spacing['4'],
    right: spacing['4'],
    zIndex: 40,
  },
  learnToastInner: {
    backgroundColor: `${colors.primary.DEFAULT}F2`,
    borderRadius: radius.md,
    padding: spacing['3'],
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  learnToastText: {
    marginLeft: spacing['2.5'],
    flex: 1,
  },
  learnToastTitle: {
    color: colors.text.inverse,
    fontFamily: typography.fontFamily.semibold,
    fontSize: 13,
  },
  learnToastBody: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    marginTop: spacing['0.5'],
  },
  header: {
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    backgroundColor: colors.bg.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.DEFAULT,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doneButton: {
    color: colors.primary.DEFAULT,
    fontSize: 17,
    fontFamily: typography.fontFamily.regular,
  },
  guestName: {
    color: colors.text.primary,
    fontFamily: typography.fontFamily.semibold,
    fontSize: 17,
  },
  guestInfoPanel: {
    marginTop: spacing['4'],
    backgroundColor: `${colors.bg.elevated}80`,
    borderRadius: radius.xl,
    padding: spacing['4'],
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing['6'],
    marginBottom: spacing['2'],
  },
  infoText: {
    color: colors.text.muted,
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    marginLeft: spacing['2'],
  },
});
