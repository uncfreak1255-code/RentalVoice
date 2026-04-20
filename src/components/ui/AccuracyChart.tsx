import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { colors, typography } from '@/lib/design-tokens';

interface AccuracyChartProps {
  points?: number[];
  width?: number;
  height?: number;
}

// Trajectory from "Day 1 · 40%" → "Week 2 · 88%" — the design honesty beat.
const DEFAULT_POINTS = [40, 48, 58, 65, 72, 78, 82, 85, 88];

export function AccuracyChart({
  points = DEFAULT_POINTS,
  width = 280,
  height = 80,
}: AccuracyChartProps) {
  const minPct = 30;
  const range = 70;

  const segments = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p - minPct) / range) * height;
    return { x, y };
  });

  const path = segments
    .map((s, i) => `${i === 0 ? 'M' : 'L'}${s.x.toFixed(1)} ${s.y.toFixed(1)}`)
    .join(' ');
  const area = `${path} L ${width} ${height} L 0 ${height} Z`;

  const last = segments[segments.length - 1];
  const firstY = segments[0].y;
  const startValue = points[0];
  const endValue = points[points.length - 1];

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Accuracy trajectory chart. Starts at ${startValue} percent and rises to ${endValue} percent by week two.`}
    >
    <Svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
      <Defs>
        <LinearGradient id="accG" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.success.DEFAULT} stopOpacity={0.25} />
          <Stop offset="1" stopColor={colors.success.DEFAULT} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#accG)" />
      <Path
        d={path}
        stroke={colors.success.DEFAULT}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={last.x} cy={last.y} r={4} fill={colors.success.DEFAULT} />
      <SvgText
        x={4}
        y={firstY - 6}
        fontSize={10}
        fill={colors.text.muted}
        fontFamily={typography.fontFamily.regular}
      >
        Day 1 · 40%
      </SvgText>
      <SvgText
        x={width - 74}
        y={last.y - 6}
        fontSize={10}
        fill={colors.success.DEFAULT}
        fontFamily={typography.fontFamily.bold}
        fontWeight="700"
      >
        Week 2 · 88%
      </SvgText>
    </Svg>
    </View>
  );
}
