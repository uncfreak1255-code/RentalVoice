/**
 * Rental Voice Design Tokens
 * 
 * Centralized design system for production-grade UI consistency.
 * All values follow a 4px grid system.
 */

// ─── Colors (Light Mode — Airbnb-inspired) ──────────────────
export const colors = {
  // Background layers (lightest → subtle elevation)
  bg: {
    base: '#FFFFFF',      // Pure white base
    card: '#FFFFFF',      // Cards on white
    elevated: '#F8FAFC',  // Elevated surfaces (modals, sheets)
    hover: '#F1F5F9',     // Hover/pressed state
    subtle: '#F8FAFC',    // Subtle contrast from base
  },

  // Brand
  primary: {
    DEFAULT: '#14B8A6',   // Teal — main brand
    light: '#2DD4BF',     // Hover/active variant
    muted: '#14B8A615',   // Subtle teal background
    soft: '#14B8A625',    // Light teal background
  },

  accent: {
    DEFAULT: '#F97316',   // Orange — CTA, attention
    light: '#FB923C',
    muted: '#F9731615',
    soft: '#F9731625',
  },

  danger: {
    DEFAULT: '#EF4444',
    light: '#F87171',
    muted: '#EF444415',
    soft: '#EF444425',
  },

  success: {
    DEFAULT: '#22C55E',
    light: '#4ADE80',
    muted: '#22C55E15',
  },

  warning: {
    DEFAULT: '#EAB308',
    light: '#FACC15',
    muted: '#EAB30815',
  },

  // Text
  text: {
    primary: '#1E293B',    // Near-black headings
    secondary: '#475569',  // Body text — 7.0:1 ✅
    muted: '#64748B',      // Captions, hints — 4.6:1 ✅
    disabled: '#6B7280',   // Disabled/placeholder — 5.0:1 ✅ (was #94A3B8 = 3.0:1 ❌)
    inverse: '#FFFFFF',    // Text on dark backgrounds
  },

  // Borders
  border: {
    subtle: '#F1F5F9',     // Faint dividers
    DEFAULT: '#E2E8F0',    // Input borders
    strong: '#CBD5E1',     // Focused borders
  },

  // Platform-specific accent colors
  platform: {
    airbnb: '#FF5A5F',
    vrbo: '#3B5998',
    booking: '#003580',
    direct: '#14B8A6',
  },

  // Semantic status colors  
  status: {
    online: '#22C55E',
    away: '#EAB308',
    offline: '#6B7280',   // Was #94A3B8 — WCAG fix
    urgent: '#EF4444',
  },
} as const;

// ─── Dark Mode Colors ────────────────────────────────────────
export const darkColors = {
  bg: {
    base: '#0A0F1A',
    card: '#111827',
    elevated: '#1E293B',
    hover: '#334155',
    subtle: '#0F172A',
  },
  primary: colors.primary,
  accent: colors.accent,
  danger: colors.danger,
  success: colors.success,
  warning: colors.warning,
  text: {
    primary: '#F8FAFC',
    secondary: '#CBD5E1',
    muted: '#9CA3AF',      // On dark bg this passes contrast
    disabled: '#6B7280',   // WCAG accessible on dark bg
    inverse: '#0F172A',
  },
  border: {
    subtle: '#1E293B',
    DEFAULT: '#334155',
    strong: '#475569',
  },
  platform: colors.platform,
  status: colors.status,
} as const;

// ─── Light Mode Colors ──────────────────────────────────────
export const lightColors = {
  bg: {
    base: '#F8FAFC',
    card: '#FFFFFF',
    elevated: '#F1F5F9',
    hover: '#E2E8F0',
    subtle: '#F1F5F9',
  },
  primary: colors.primary,
  accent: colors.accent,
  danger: colors.danger,
  success: colors.success,
  warning: colors.warning,
  text: {
    primary: '#0F172A',
    secondary: '#334155',
    muted: '#64748B',      // 4.6:1 on white ✅
    disabled: '#6B7280',   // 5.0:1 on white ✅ (was #94A3B8 = 3.0:1 ❌)
    inverse: '#F8FAFC',
  },
  border: {
    subtle: '#E2E8F0',
    DEFAULT: '#CBD5E1',
    strong: '#6B7280',     // WCAG accessible border contrast
  },
  platform: colors.platform,
  status: colors.status,
} as const;

export type ThemeMode = 'dark' | 'light' | 'system';

export function getThemeColors(mode: ThemeMode, systemIsDark: boolean = false) {
  if (mode === 'system') return systemIsDark ? darkColors : colors;
  return mode === 'dark' ? darkColors : colors;
}

// ─── Spacing (4px grid) ──────────────────────────────────────
export const spacing = {
  '0': 0,
  'px': 1,
  '0.5': 2,
  '1': 4,
  '1.5': 6,
  '2': 8,
  '2.5': 10,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '7': 28,
  '8': 32,
  '9': 36,
  '10': 40,
  '12': 48,
  '14': 56,
  '16': 64,
  '20': 80,
} as const;

// ─── Typography ──────────────────────────────────────────────
export const typography = {
  // Font family keys (loaded via expo-font)
  fontFamily: {
    regular: 'DMSans_400Regular',
    medium: 'DMSans_500Medium',
    semibold: 'DMSans_600SemiBold',
    bold: 'DMSans_700Bold',
  },

  // Predefined text styles
  styles: {
    // Display — hero/splash use only
    displayLg: { fontSize: 32, lineHeight: 40, fontFamily: 'DMSans_700Bold', letterSpacing: -0.5 },
    displayMd: { fontSize: 28, lineHeight: 36, fontFamily: 'DMSans_700Bold', letterSpacing: -0.3 },
    
    // Headings
    h1: { fontSize: 24, lineHeight: 32, fontFamily: 'DMSans_700Bold', letterSpacing: -0.2 },
    h2: { fontSize: 20, lineHeight: 28, fontFamily: 'DMSans_600SemiBold', letterSpacing: -0.1 },
    h3: { fontSize: 17, lineHeight: 24, fontFamily: 'DMSans_600SemiBold' },

    // Body
    bodyLg: { fontSize: 16, lineHeight: 24, fontFamily: 'DMSans_400Regular' },
    body: { fontSize: 15, lineHeight: 22, fontFamily: 'DMSans_400Regular' },
    bodySm: { fontSize: 14, lineHeight: 20, fontFamily: 'DMSans_400Regular' },
    bodySmMedium: { fontSize: 14, lineHeight: 20, fontFamily: 'DMSans_500Medium' },

    // UI
    label: { fontSize: 13, lineHeight: 18, fontFamily: 'DMSans_500Medium', letterSpacing: 0.2 },
    caption: { fontSize: 12, lineHeight: 16, fontFamily: 'DMSans_400Regular' },
    overline: { fontSize: 11, lineHeight: 16, fontFamily: 'DMSans_600SemiBold', letterSpacing: 0.8, textTransform: 'uppercase' as const },
    
    // Special
    tabLabel: { fontSize: 10, lineHeight: 14, fontFamily: 'DMSans_500Medium' },
    badge: { fontSize: 11, lineHeight: 14, fontFamily: 'DMSans_600SemiBold' },
    mono: { fontSize: 13, lineHeight: 18, fontFamily: 'DMSans_400Regular' }, // Use monospace when available
  },
} as const;

// ─── Border Radius ───────────────────────────────────────────
export const radius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

// ─── Elevation / Shadows ─────────────────────────────────────
export const elevation = {
  none: {},
  // Premium Layout Shadows (Layered for depth)
  shadows: {
    premium: {
      sm: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      },
      md: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.05,
        shadowRadius: 24,
        elevation: 4,
      },
      lg: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08,
        shadowRadius: 32,
        elevation: 8,
      }
    }
  },
  // Legacy
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  }),
} as const;

// ─── Animation Constants ─────────────────────────────────────
export const animation = {
  duration: {
    instant: 100,
    fast: 150,
    normal: 250,
    slow: 400,
    page: 350,
  },
  easing: {
    easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
    easeIn: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  // Reanimated Spring configs for tactile physics
  spring: {
    bouncy: { stiffness: 200, damping: 15, mass: 1 }, // Playful (e.g., success checkmarks)
    subtle: { stiffness: 300, damping: 22, mass: 1 }, // Standard UI elements (cards, buttons)
    snappy: { stiffness: 400, damping: 28, mass: 1 }, // Fast interactions (toggles, chips)
  },
} as const;

// ─── Avatar Gradient Presets ─────────────────────────────────
// Deterministic gradient based on name hash for consistent colors
export const avatarGradients = [
  ['#667EEA', '#764BA2'], // Purple-indigo
  ['#F093FB', '#F5576C'], // Pink-rose
  ['#4FACFE', '#00F2FE'], // Blue-cyan
  ['#43E97B', '#38F9D7'], // Green-teal
  ['#FA709A', '#FEE140'], // Pink-gold
  ['#A18CD1', '#FBC2EB'], // Lavender-pink
  ['#FF9A9E', '#FAD0C4'], // Peach
  ['#FDCB82', '#F38181'], // Coral-warm
  ['#667EEA', '#38F9D7'], // Blue-teal
  ['#F5576C', '#FF9A76'], // Red-orange
] as const;

export function getAvatarGradient(name: string): readonly [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarGradients[Math.abs(hash) % avatarGradients.length];
}

// ─── Icon Sizes ──────────────────────────────────────────────
export const iconSize = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  '2xl': 32,
} as const;

// ─── Z-Index Scale ───────────────────────────────────────────
export const zIndex = {
  base: 0,
  card: 10,
  sticky: 20,
  header: 30,
  overlay: 40,
  modal: 50,
  toast: 60,
  max: 100,
} as const;

// ─── Hit Slop (touch target expansion) ───────────────────────
export const hitSlop = {
  sm: { top: 8, bottom: 8, left: 8, right: 8 },
  md: { top: 12, bottom: 12, left: 12, right: 12 },
  lg: { top: 16, bottom: 16, left: 16, right: 16 },
} as const;

// ─── Accessibility Minimum Touch Target ──────────────────────
// Apple HIG + WCAG 2.5.5: minimum 44×44pt touch targets
export const a11y = {
  minTouchTarget: { minWidth: 44, minHeight: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
} as const;
