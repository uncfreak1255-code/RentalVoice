import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sparkles, Users, Clock3, ChevronDown, ChevronUp } from 'lucide-react-native';
import type { GuestMemory } from '@/lib/advanced-training';

type GuestMemoryCardProps = {
  memory: GuestMemory;
  stayCount: number;
  collapsed?: boolean;
  onToggle?: () => void;
};

function buildHighlights(memory: GuestMemory): string[] {
  const highlights: string[] = [];

  if (memory.preferences.typicalQuestions.length > 0) {
    highlights.push(`Usually asks about ${memory.preferences.typicalQuestions[0]}`);
  }

  const lastConversation = memory.conversationHistory[memory.conversationHistory.length - 1];
  if (lastConversation?.specialRequests && lastConversation.specialRequests.length > 0) {
    highlights.push(`Prior request: ${lastConversation.specialRequests[0]}`);
  }

  if (memory.preferences.preferredTone) {
    highlights.push(`Tone cue: ${memory.preferences.preferredTone}`);
  }

  if (memory.preferences.hasChildren) {
    highlights.push('Often travels with children');
  } else if (memory.preferences.hasPets) {
    highlights.push('Often travels with pets');
  }

  if (lastConversation?.topics && lastConversation.topics.length > 0 && highlights.length < 3) {
    highlights.push(`Prior topic: ${lastConversation.topics[0]}`);
  }

  return highlights.slice(0, 3);
}

export default function GuestMemoryCard({
  memory,
  stayCount,
  collapsed = false,
  onToggle,
}: GuestMemoryCardProps) {
  const highlights = buildHighlights(memory);

  if (collapsed) {
    return (
      <Pressable style={styles.collapsedChip} onPress={onToggle} accessibilityRole="button">
        <Users size={13} color="#0f766e" strokeWidth={2.25} />
        <Text style={styles.collapsedLabel}>Guest memory</Text>
        <Text style={styles.collapsedMeta}>{stayCount} stays</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <View style={styles.iconBadge}>
            <Sparkles size={14} color="#0f766e" strokeWidth={2.2} />
          </View>
          <Text style={styles.title}>Guest memory</Text>
          <View style={styles.stayPill}>
            <Users size={12} color="#0f172a" strokeWidth={2} />
            <Text style={styles.stayPillText}>{stayCount} stays</Text>
          </View>
        </View>
        <Pressable onPress={onToggle} accessibilityRole="button" style={styles.collapseButton}>
          <ChevronUp size={16} color="#64748b" strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={styles.list}>
        {highlights.map((highlight) => (
          <View key={highlight} style={styles.itemRow}>
            <Clock3 size={12} color="#94a3b8" strokeWidth={2.1} />
            <Text style={styles.itemText}>{highlight}</Text>
          </View>
        ))}
      </View>

      <Pressable onPress={onToggle} style={styles.footerChip} accessibilityRole="button">
        <ChevronDown size={14} color="#64748b" strokeWidth={2.2} />
        <Text style={styles.footerText}>Collapse guest memory</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 18,
    backgroundColor: '#f7fbfb',
    borderWidth: 1,
    borderColor: '#e5f0ef',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  stayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  stayPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  collapseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    marginTop: 10,
    gap: 7,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#475569',
    flex: 1,
  },
  footerChip: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  collapsedChip: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#f7fbfb',
    borderWidth: 1,
    borderColor: '#e5f0ef',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  collapsedLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  collapsedMeta: {
    fontSize: 12,
    color: '#64748b',
  },
});
