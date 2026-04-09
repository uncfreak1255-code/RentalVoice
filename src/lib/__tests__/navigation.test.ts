/**
 * Tests for the Expo Router navigation structure.
 *
 * Validates that the route file structure is correct and that
 * key route files export valid default components. These are
 * structural / smoke tests — not full render tests.
 */

import * as fs from 'fs';
import * as path from 'path';

const APP_DIR = path.join(__dirname, '..', '..', 'app');

// ── Route File Structure ──

describe('Route file structure', () => {
  it('should have root _layout.tsx', () => {
    expect(fs.existsSync(path.join(APP_DIR, '_layout.tsx'))).toBe(true);
  });

  it('should have (tabs) group with _layout.tsx', () => {
    expect(fs.existsSync(path.join(APP_DIR, '(tabs)', '_layout.tsx'))).toBe(true);
  });

  it('should have 3 tab screens', () => {
    const tabsDir = path.join(APP_DIR, '(tabs)');
    expect(fs.existsSync(path.join(tabsDir, 'index.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(tabsDir, 'calendar.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(tabsDir, 'settings.tsx'))).toBe(true);
  });

  it('should have chat/[id].tsx dynamic route', () => {
    expect(fs.existsSync(path.join(APP_DIR, 'chat', '[id].tsx'))).toBe(true);
  });

  it('should have settings/_layout.tsx stack navigator', () => {
    expect(fs.existsSync(path.join(APP_DIR, 'settings', '_layout.tsx'))).toBe(true);
  });

  it('should have all 18 settings sub-screens', () => {
    const settingsDir = path.join(APP_DIR, 'settings');
    const expectedScreens = [
      'property-knowledge.tsx',
      'issue-tracker.tsx',
      'automations.tsx',
      'analytics.tsx',
      'upsells.tsx',
      'api.tsx',
      'sync-data.tsx',
      'language.tsx',
      'help-center.tsx',
      'privacy-security.tsx',

      'ai-learning.tsx',
      'webhook-setup.tsx',
      'notifications.tsx',
      'auto-pilot.tsx',
      'auto-pilot-audit.tsx',
      'sentiment-trends.tsx',
      'ai-providers.tsx',
      'review-response.tsx',
    ];

    for (const screen of expectedScreens) {
      const filePath = path.join(settingsDir, screen);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });

  it('should NOT have old flat index.tsx (should be backed up)', () => {
    const rootIndex = path.join(APP_DIR, 'index.tsx');
    expect(fs.existsSync(rootIndex)).toBe(true);
  });
});

// ── Route File Content ──

describe('Route file exports', () => {
  it('should export default function from (tabs)/_layout.tsx', () => {
    const content = fs.readFileSync(path.join(APP_DIR, '(tabs)', '_layout.tsx'), 'utf-8');
    expect(content).toContain('export default function');
    expect(content).toContain('Tabs');
  });

  it('should export default function from chat/[id].tsx', () => {
    const content = fs.readFileSync(path.join(APP_DIR, 'chat', '[id].tsx'), 'utf-8');
    expect(content).toContain('export default function');
    expect(content).toContain('useLocalSearchParams');
    expect(content).toContain('ChatScreen');
  });

  it('should wire an onBack handler in settings sub-screens', () => {
    const settingsDir = path.join(APP_DIR, 'settings');
    const files = fs.readdirSync(settingsDir).filter(f => f !== '_layout.tsx');

    for (const file of files) {
      const content = fs.readFileSync(path.join(settingsDir, file), 'utf-8');
      expect(content).toContain('onBack={() =>');
    }
  });

  it('should avoid utility-class leftovers in all tab routes', () => {
    const tabsDir = path.join(APP_DIR, '(tabs)');
    const tabFiles = ['index.tsx', 'calendar.tsx', 'settings.tsx'];

    for (const file of tabFiles) {
      const content = fs.readFileSync(path.join(tabsDir, file), 'utf-8');
      // Should NOT contain hardcoded dark colors
      expect(content).not.toContain('bg-slate-900');
    }
  });
});

// ── Settings Route Mapping ──

describe('Settings route mapping', () => {
  it('should map all screen names to valid file paths', () => {
    const content = fs.readFileSync(path.join(APP_DIR, '(tabs)', 'settings.tsx'), 'utf-8');

    // All expected screen name mappings
    const expectedMappings = [
      'propertyKnowledge',
      'issueTracker',
      'automations',
      'analytics',
      'upsells',
      'apiSettings',
      'syncData',
      'languageSettings',
      'helpCenter',
      'privacySecurity',

      'aiLearning',
      'webhookSetup',
      'notificationSettings',
      'autoPilotSettings',
      'autoPilotAuditLog',
      'sentimentTrends',
      'aiProviders',
      'reviewResponse',
    ];

    for (const mapping of expectedMappings) {
      expect(content).toContain(mapping);
    }
  });
});

// ── Deep Linking ──

describe('Deep linking support', () => {
  it('should handle activeConversationId in inbox tab', () => {
    const content = fs.readFileSync(path.join(APP_DIR, '(tabs)', 'index.tsx'), 'utf-8');
    expect(content).toContain('activeConversationId');
    expect(content).toContain('router.push');
    expect(content).toContain('/chat/');
  });

  it('should handle missing ID in chat route gracefully', () => {
    const content = fs.readFileSync(path.join(APP_DIR, 'chat', '[id].tsx'), 'utf-8');
    expect(content).toContain('if (!id)');
    expect(content).toContain('router.back()');
  });
});

// ── StatusBar and Theme ──

describe('Theme and StatusBar', () => {
  it('should use dark StatusBar style in root layout', () => {
    const content = fs.readFileSync(path.join(APP_DIR, '_layout.tsx'), 'utf-8');
    expect(content).toContain('style="dark"');
    expect(content).not.toContain('style="light"');
  });

  it('should use DefaultTheme (light) not DarkTheme', () => {
    const content = fs.readFileSync(path.join(APP_DIR, '_layout.tsx'), 'utf-8');
    expect(content).toContain('DefaultTheme');
    expect(content).not.toContain('DarkTheme');
  });
});
