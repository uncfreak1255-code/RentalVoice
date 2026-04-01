import { useColorScheme } from '@/lib/useColorScheme';
import { colors, darkColors } from '@/lib/design-tokens';

/**
 * Returns the correct color palette for the current system appearance.
 *
 * - Light mode -> `colors` (the original Airbnb-inspired palette)
 * - Dark mode  -> `darkColors`
 *
 * Usage:
 *   const t = useThemeColors();
 *   <View style={{ backgroundColor: t.bg.base }}>
 *     <Text style={{ color: t.text.primary }}>...</Text>
 *   </View>
 */
export function useThemeColors() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : colors;
}

/** Boolean helper — avoids repeating `useColorScheme() === 'dark'` everywhere */
export function useIsDark() {
  return useColorScheme() === 'dark';
}
