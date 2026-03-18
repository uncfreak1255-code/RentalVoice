---
name: review-app
description: Launch the app in iOS Simulator and do a visual review pass — screenshot each key screen, identify UX issues, and generate a fix list
user_invokable: true
command: review-app
---

# Review App in Simulator

Visual QA workflow for Rental Voice. Launches the app in iOS Simulator, navigates key screens, and produces an actionable fix list.

## Prerequisites

- iOS Simulator installed (comes with Xcode)
- Expo dev server running or launchable

## Workflow

### Step 1: Ensure Simulator is running with the app

Check if there's already an Expo dev server running. If not, start one:

```bash
# Check for running Expo process
pgrep -f "expo start" || npx expo start --ios 2>&1 &
```

Wait for the app to load in Simulator. Use `xcrun simctl list devices booted` to confirm a simulator is booted.

### Step 2: Screenshot key screens

Use `xcrun simctl io booted screenshot` to capture each screen. Navigate between screens using Expo's deep linking:

**Screens to capture:**
1. **Inbox** (default landing) — check conversation list, filter tabs, unread badges, sync status
2. **Chat** — open a conversation, check message bubbles, composer, draft card area
3. **AI Draft generating** — trigger a draft, capture the typing indicator state
4. **AI Draft ready** — capture the draft card with approve/edit/reject buttons
5. **Settings** — check all settings rows, toggles, AI learning section
6. **Calendar** — check calendar view and any event cards
7. **Onboarding** (if accessible) — first-time user flow

```bash
# Screenshot to a timestamped file
xcrun simctl io booted screenshot ~/Desktop/rv-review-$(date +%s).png
```

### Step 3: Visual audit checklist

For each screenshot, check:

**Layout & Spacing**
- [ ] No text truncation or overlap
- [ ] Consistent padding/margins (use design tokens: 4/8/12/16/20/24)
- [ ] Nothing hidden behind notch, home indicator, or status bar
- [ ] Keyboard doesn't obscure critical UI elements

**Typography**
- [ ] Font hierarchy is clear (headers > body > caption)
- [ ] Text is readable (min 11pt for captions, 14pt for body)
- [ ] No orphaned words or awkward line breaks

**Interactive Elements**
- [ ] All buttons have adequate tap targets (min 44x44pt)
- [ ] Active/inactive states are visually distinct
- [ ] Loading states exist for async operations
- [ ] Empty states have helpful messaging

**Color & Contrast**
- [ ] Text meets WCAG AA contrast (4.5:1 for body, 3:1 for large text)
- [ ] Primary teal (#14B8A6) used consistently for actions
- [ ] Disabled states are visually muted
- [ ] Status colors are meaningful (green=good, yellow=warning, red=error)

**iOS Conventions**
- [ ] Safe area insets respected on all screens
- [ ] Pull-to-refresh where expected
- [ ] Swipe-back gesture works for navigation
- [ ] Tab bar is always visible on tab screens

### Step 4: Generate fix list

Produce a structured fix list:

```
## Visual Review — [date]

### Critical (blocks daily use)
- [ ] [Screen]: [Issue description]

### High (noticeable quality issue)
- [ ] [Screen]: [Issue description]

### Low (polish)
- [ ] [Screen]: [Issue description]
```

### Step 5: Optionally fix issues immediately

For quick fixes (spacing, colors, truncation), fix them in-place and let hot reload show the result. For larger issues, add them to the Phase 2 roadmap.

## Expo Dev Tools Reference

These are accessible via **Cmd+D** in Simulator (or shake on device):

| Tool | What it does | When to use |
|------|-------------|-------------|
| Element Inspector | Tap any element to see component tree + styles | Debugging spacing, identifying which component renders what |
| Performance Monitor | FPS overlay | Checking if animations are smooth (target 60fps) |
| Reload | Full app reload | When hot reload misses a change |
| Toggle Inspector | Show/hide element outlines | Seeing layout boundaries |

## Keyboard Shortcuts in Simulator

| Shortcut | Action |
|----------|--------|
| Cmd+D | Open Expo dev menu |
| Cmd+K | Toggle software keyboard |
| Cmd+S | Save screenshot to Desktop |
| Cmd+Shift+H | Go to home screen |
| Cmd+Right/Left | Rotate device |
| Cmd+1/2/3 | Window size (100%/75%/50%) |

## Tips

- Run at **Cmd+1** (100% size) for accurate pixel review
- Test with **Cmd+K** keyboard visible to catch keyboard-related layout issues
- Check both light text on dark backgrounds AND dark text on light backgrounds
- If the app crashes in Simulator, check `Console.app` filtered to the app process for crash logs
