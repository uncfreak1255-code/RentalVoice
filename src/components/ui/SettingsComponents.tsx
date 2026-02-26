import * as React from 'react';
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, typography } from '@/lib/design-tokens';

export function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionHeader}>{title}</Text>;
}

export function SectionFooter({ text }: { text: string }) {
  return <Text style={s.sectionFooter}>{text}</Text>;
}

export function Row({ icon, iconBg, label, right, onPress, isLast = false }: {
  icon: React.ReactNode; iconBg?: string; label: string;
  right?: React.ReactNode; onPress?: () => void; isLast?: boolean;
}) {
  const content = (
    <View style={[s.row, !isLast && s.rowBorder]}>
      <View style={[s.iconBox, iconBg ? { backgroundColor: iconBg } : undefined]}>{icon}</View>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={s.rowRight}>
        {right}
        {onPress && <ChevronRight size={16} color="#C7C7CC" style={{ marginLeft: 4 }} />}
      </View>
    </View>
  );
  if (onPress) {
    return <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>{content}</Pressable>;
  }
  return content;
}

export function ToggleRow({ icon, iconBg, trackColor: customTrackColor, label, value, onValueChange, isLast = false }: {
  icon: React.ReactNode; iconBg?: string; trackColor?: string; label: string;
  value: boolean; onValueChange: (v: boolean) => void; isLast?: boolean;
}) {
  return (
    <View style={[s.row, !isLast && s.rowBorder]}>
      <View style={[s.iconBox, iconBg ? { backgroundColor: iconBg } : undefined]}>{icon}</View>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={{ height: 31, justifyContent: 'center' }}>
        <Switch
          value={value}
          onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onValueChange(v); }}
          trackColor={{ false: '#E5E5EA', true: customTrackColor || colors.primary.DEFAULT }}
          thumbColor="#FFFFFF"
          ios_backgroundColor="#E5E5EA"
        />
      </View>
    </View>
  );
}

export function ValueRow({ icon, iconBg, label, value, valueColor, isLast = false }: {
  icon: React.ReactNode; iconBg?: string; label: string;
  value: string | React.ReactNode; valueColor?: string; isLast?: boolean;
}) {
  return (
    <View style={[s.row, !isLast && s.rowBorder]}>
      <View style={[s.iconBox, iconBg ? { backgroundColor: iconBg } : undefined]}>{icon}</View>
      <Text style={s.rowLabel}>{label}</Text>
      {typeof value === 'string' ? (
        <Text style={[s.rowValue, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

export function LinkRow({ icon, iconBg, label, onPress, isLast = false }: {
  icon: React.ReactNode; iconBg?: string; label: string;
  onPress: () => void; isLast?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <View style={[s.row, !isLast && s.rowBorder]}>
        <View style={[s.iconBox, iconBg ? { backgroundColor: iconBg } : undefined]}>{icon}</View>
        <Text style={s.linkLabel}>{label}</Text>
      </View>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  // Section headers & footers
  sectionHeader: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: '#6B7280',
    marginTop: 24,
    marginBottom: 6,
    marginLeft: 32,
    letterSpacing: 0.1,
  },
  sectionFooter: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: '#9CA3AF',
    marginTop: 6,
    marginLeft: 32,
    marginRight: 16,
    lineHeight: 16,
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 16,
    height: 50,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: typography.fontFamily.regular,
    color: '#000000',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValue: {
    fontSize: 15,
    fontFamily: typography.fontFamily.regular,
    color: '#9CA3AF',
  },
  tealValue: {
    fontSize: 15,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary.DEFAULT,
  },
  linkLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: typography.fontFamily.regular,
    color: colors.primary.DEFAULT,
  },

  // Icon container (subtle teal circle like Rork)
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary.DEFAULT + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
});
