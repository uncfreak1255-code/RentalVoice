import React from 'react';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { colors, typography } from '@/lib/design-tokens';

interface AccuracyDialProps {
  value: number;
  size?: number;
}

export function AccuracyDial({ value, size = 80 }: AccuracyDialProps) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const color = value >= 80 ? colors.success.DEFAULT : colors.warning.DEFAULT;
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Circle cx={40} cy={40} r={r} fill="none" stroke={colors.border.DEFAULT} strokeWidth={7} />
      <Circle
        cx={40}
        cy={40}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`}
        transform="rotate(-90 40 40)"
      />
      <SvgText
        x={40}
        y={46}
        textAnchor="middle"
        fontSize={18}
        fontWeight="800"
        fontFamily={typography.fontFamily.bold}
        fill={color}
        letterSpacing={-0.5}
      >
        {`${value}%`}
      </SvgText>
    </Svg>
  );
}
