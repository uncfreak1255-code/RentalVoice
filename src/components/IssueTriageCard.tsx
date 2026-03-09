import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, CheckCircle2, ChevronDown, Wrench, X } from 'lucide-react-native';
import type { IssueTriageResult } from '@/lib/issue-triage';

type IssueTriageCardProps = {
  triage: IssueTriageResult;
  collapsed: boolean;
  hasSavedHandoff?: boolean;
  onToggleCollapsed: () => void;
  onNeedsFollowUp: () => void;
  onCreateHandoff: () => void;
  onResumeHandoff?: () => void;
  onMarkResolved: () => void;
};

export default function IssueTriageCard({
  triage,
  collapsed,
  hasSavedHandoff = false,
  onToggleCollapsed,
  onNeedsFollowUp,
  onCreateHandoff,
  onResumeHandoff,
  onMarkResolved,
}: IssueTriageCardProps) {
  if (collapsed) {
    return (
      <Pressable style={styles.collapsedChip} onPress={onToggleCollapsed} accessibilityRole="button" accessibilityLabel="Show issue details">
        <View style={styles.collapsedChipInner}>
          <AlertTriangle size={13} color="#b45309" strokeWidth={2.1} />
          <Text style={styles.collapsedChipText}>Issue detected</Text>
          <Text style={styles.collapsedChipPriority}>{triage.priority}</Text>
        </View>
        <ChevronDown size={14} color="#9a3412" strokeWidth={2.2} />
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <View style={styles.iconBadge}>
            <AlertTriangle size={15} color="#b45309" strokeWidth={2.1} />
          </View>
          <Text style={styles.title}>Issue detected</Text>
          <View style={styles.priorityPill}>
            <Text style={styles.priorityPillText}>{triage.priority}</Text>
          </View>
        </View>
        <Pressable onPress={onToggleCollapsed} accessibilityRole="button" accessibilityLabel="Hide issue details" style={styles.hideButton}>
          <X size={14} color="#9a3412" strokeWidth={2.1} />
        </Pressable>
      </View>

      <Text style={styles.summary}>{triage.summary}</Text>
      <Text style={styles.detail} numberOfLines={2}>{triage.guestImpact}</Text>

      <View style={styles.actions}>
        <Pressable style={styles.secondaryAction} onPress={onNeedsFollowUp}>
          <Text style={styles.secondaryActionText}>Needs follow-up</Text>
        </Pressable>
        <Pressable style={styles.primaryAction} onPress={hasSavedHandoff && onResumeHandoff ? onResumeHandoff : onCreateHandoff}>
          <Wrench size={14} color="#ffffff" strokeWidth={2.1} />
          <Text style={styles.primaryActionText}>{hasSavedHandoff ? 'Resume handoff' : 'Create handoff'}</Text>
        </Pressable>
        <Pressable style={styles.ghostAction} onPress={onMarkResolved}>
          <CheckCircle2 size={14} color="#0f766e" strokeWidth={2.1} />
          <Text style={styles.ghostActionText}>Mark resolved</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  collapsedChip: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 999,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#f4dfbf',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapsedChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsedChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#7c2d12',
  },
  collapsedChipPriority: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
    textTransform: 'capitalize',
  },
  card: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 18,
    backgroundColor: '#fffaf3',
    borderWidth: 1,
    borderColor: '#f4dfbf',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  iconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hideButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  priorityPill: {
    borderRadius: 999,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priorityPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
    textTransform: 'capitalize',
  },
  summary: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
  },
  detail: {
    fontSize: 12,
    lineHeight: 16,
    color: '#6b7280',
    marginBottom: 2,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  secondaryAction: {
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ead4b2',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#c2410c',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  primaryActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  ghostAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  ghostActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f766e',
  },
});
