import * as React from 'react';
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, typography } from '@/lib/design-tokens';

export function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={s.sectionHeader} accessibilityRole="header">
      {title}
    </Text>
  );
}

export function SectionFooter({ text }: { text: string }) {
  return <Text style={s.sectionFooter}>{text}</Text>;
}

export function Row({ icon, iconBg, label, right, onPress, isLast = false }: {
  icon: React.ReactNode; iconBg?: string; label: string;
  right?: React.ReactNode; onPress?: () => void; isLast?: boolean;
}) {
  const content = (
    <View style={s.row}>
      <View style={[s.iconBox, iconBg ? { backgroundColor: iconBg } : undefined]}>{icon}</View>
      <View style={[s.rowContent, !isLast && s.rowBorder]}>
        <Text style={s.rowLabel}>{label}</Text>
        <View style={s.rowRight}>
          {right}
          {onPress && <ChevronRight size={14} color="#C7C7CC" style={{ marginLeft: 6 }} />}
        </View>
      </View>
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({ backgroundColor: pressed ? 'rgba(120,120,128,0.08)' : 'transparent' })}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

export function ToggleRow({ icon, iconBg, trackColor: customTrackColor, label, value, onValueChange, isLast = false }: {
  icon: React.ReactNode; iconBg?: string; trackColor?: string; label: string;
  value: boolean; onValueChange: (v: boolean) => void; isLast?: boolean;
}) {
  return (
    <View style={s.row}>
      <View style={[s.iconBox, iconBg ? { backgroundColor: iconBg } : undefined]}>{icon}</View>
      <View style={[s.rowContent, !isLast && s.rowBorder]}>
        <Text style={s.rowLabel}>{label}</Text>
        <View style={{ height: 31, justifyContent: 'center' }}>
          <Switch
            value={value}
            onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onValueChange(v); }}
            trackColor={{ false: '#E5E5EA', true: customTrackColor || colors.primary.DEFAULT }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#E5E5EA"
            accessibilityLabel={label}
            accessibilityRole="switch"
            accessibilityState={{ checked: value }}
          />
        </View>
      </View>
    </View>
  );
}

export function ValueRow({ icon, iconBg, label, value, valueColor, isLast = false }: {
  icon: React.ReactNode; iconBg?: string; label: string;
  value: string | React.ReactNode; valueColor?: string; isLast?: boolean;
}) {
  return (
    <View style={s.row}>
      <View style={[s.iconBox, iconBg ? { backgroundColor: iconBg } : undefined]}>{icon}</View>
      <View style={[s.rowContent, !isLast && s.rowBorder]}>
        <Text style={s.rowLabel}>{label}</Text>
        {typeof value === 'string' ? (
          <Text style={[s.rowValue, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
        ) : (
          value
        )}
      </View>
    </View>
  );
}

export function LinkRow({ icon, iconBg, label, onPress, isLast = false }: {
  icon: React.ReactNode; iconBg?: string; label: string;
  onPress: () => void; isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }) => ({ backgroundColor: pressed ? 'rgba(120,120,128,0.08)' : 'transparent' })}
    >
      <View style={s.row}>
        <View style={[s.iconBox, iconBg ? { backgroundColor: iconBg } : undefined]}>{icon}</View>
        <View style={[s.rowContent, !isLast && s.rowBorder]}>
          <Text style={s.rowLabel}>{label}</Text>
          <ChevronRight size={14} color="#C7C7CC" />
        </View>
      </View>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  // Section headers & footers — iOS grouped table style
  sectionHeader: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: '#6D6D72',
    textTransform: 'uppercase',
    marginTop: 28,
    marginBottom: 7,
    marginLeft: 36,
    letterSpacing: -0.08,
  },
  sectionFooter: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: '#6D6D72',
    marginTop: 7,
    marginLeft: 36,
    marginRight: 20,
    lineHeight: 18,
  },

  // Card — iOS grouped inset style
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginHorizontal: 16,
    overflow: 'hidden',
  },

  // Rows — inset separator starts after icon
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    minHeight: 44,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    minHeight: 44,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  rowLabel: {
    flex: 1,
    fontSize: 17,
    fontFamily: typography.fontFamily.regular,
    color: '#000000',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValue: {
    fontSize: 17,
    fontFamily: typography.fontFamily.regular,
    color: '#8E8E93',
  },
  tealValue: {
    fontSize: 17,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary.DEFAULT,
  },

  // Icon container — iOS-style rounded square
  iconBox: {
    width: 29,
    height: 29,
    borderRadius: 7,
    backgroundColor: colors.primary.DEFAULT + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
});
