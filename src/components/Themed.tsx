/**
 * Themed primitives using design tokens.
 * NOTE: Currently unused — kept for backwards compatibility.
 */

import { Text as DefaultText, View as DefaultView } from 'react-native';
import { colors } from '@/lib/design-tokens';

export type TextProps = DefaultText['props'];
export type ViewProps = DefaultView['props'];

export function Text(props: TextProps) {
  const { style, ...otherProps } = props;
  return (
    <DefaultText
      style={[{ color: colors.text.primary }, style]}
      {...otherProps}
    />
  );
}

export function View(props: ViewProps) {
  const { style, ...otherProps } = props;
  return (
    <DefaultView
      style={[{ backgroundColor: colors.bg.base }, style]}
      {...otherProps}
    />
  );
}
