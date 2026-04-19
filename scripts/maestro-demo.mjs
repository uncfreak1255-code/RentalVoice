#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const port = process.env.EXPO_DEV_CLIENT_PORT || '8081';
const metroUrl = `http://localhost:${port}`;
const deepLink = `exp+rental-voice://expo-development-client/?url=${encodeURIComponent(metroUrl)}&disableOnboarding=1`;

try {
  execFileSync('xcrun', ['simctl', 'openurl', 'booted', deepLink], {
    stdio: 'inherit',
  });

  execFileSync('maestro', ['test', '.maestro/onboarding_demo_mode.yaml'], {
    stdio: 'inherit',
  });
} catch (error) {
  process.exit(typeof error.status === 'number' ? error.status : 1);
}
