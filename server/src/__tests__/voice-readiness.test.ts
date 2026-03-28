import { describe, expect, it } from 'vitest';
import { getVoiceReadiness } from '../services/voice-readiness.js';

describe('getVoiceReadiness', () => {
  it('marks autopilot ineligible while examples are still below threshold', () => {
    const readiness = getVoiceReadiness({
      importedExamples: 40,
      styleSamples: 12,
      semanticReady: true,
    });

    expect(readiness.autopilotEligible).toBe(false);
    expect(readiness.state).toBe('learning');
  });

  it('marks readiness ready only once import and style thresholds are met', () => {
    const readiness = getVoiceReadiness({
      importedExamples: 120,
      styleSamples: 24,
      semanticReady: true,
    });

    expect(readiness.autopilotEligible).toBe(true);
    expect(readiness.state).toBe('ready');
  });
});
