---
description: Scaffold a new screen with proper routing, component, and navigation
model: sonnet
---

Add a new screen to the RentalVoice app. Follow these steps exactly:

1. Ask the user for: screen name, which tab it belongs under (settings, tabs root, or standalone), and a brief description of the screen's purpose.

2. Create the Expo Router page file:
   - Settings sub-screen: `src/app/settings/{kebab-name}.tsx`
   - Tab screen: `src/app/(tabs)/{kebab-name}.tsx`
   - Standalone: `src/app/{kebab-name}.tsx`

3. Create the screen component in `src/components/{PascalName}Screen.tsx`:
   - Import design tokens from `@/lib/design-tokens`
   - Accept `onBack: () => void` prop
   - Use `StyleSheet.create` with design tokens (NO hardcoded colors)
   - Use DM Sans font family from `typography.fontFamily.*`
   - Use UI primitives from `@/components/ui/` where applicable

4. Wire up the route file to import and render the component, passing `router.back` as `onBack`.

5. If it's a settings screen, add a navigation entry in `src/components/SettingsScreen.tsx`.

6. Run `npm run typecheck` to verify no type errors.
