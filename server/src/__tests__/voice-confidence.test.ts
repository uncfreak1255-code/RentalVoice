import { describe, expect, it } from 'vitest';
import { calculateVoiceConfidence } from '../services/voice-grounding.js';
import type { ManagedVoiceGrounding } from '../services/voice-grounding.js';

function makeGrounding(overrides: Partial<ManagedVoiceGrounding> = {}): ManagedVoiceGrounding {
  return {
    propertyId: null,
    styleProfile: null,
    semanticExamples: [],
    recentEditPatterns: [],
    ...overrides,
  };
}

function makeExample(similarity: number) {
  return {
    guest_message: 'When is check-in?',
    host_response: 'Check-in is at 3pm!',
    origin_type: 'imported',
    property_id: null,
    similarity,
  };
}

describe('calculateVoiceConfidence', () => {
  it('returns base confidence of 30 with zero grounding data', () => {
    const confidence = calculateVoiceConfidence(makeGrounding());
    expect(confidence).toBe(30);
  });

  it('adds 10 points for 1-2 voice examples', () => {
    const confidence = calculateVoiceConfidence(
      makeGrounding({
        semanticExamples: [makeExample(0)],
      }),
    );
    // 30 base + 10 (1 example) + 0 (similarity 0) = 40
    expect(confidence).toBe(40);
  });

  it('adds 20 points for 3-4 voice examples', () => {
    const confidence = calculateVoiceConfidence(
      makeGrounding({
        semanticExamples: [makeExample(0), makeExample(0), makeExample(0)],
      }),
    );
    // 30 base + 20 (3 examples) + 0 (similarity 0) = 50
    expect(confidence).toBe(50);
  });

  it('adds 30 points for 5+ voice examples', () => {
    const confidence = calculateVoiceConfidence(
      makeGrounding({
        semanticExamples: [
          makeExample(0),
          makeExample(0),
          makeExample(0),
          makeExample(0),
          makeExample(0),
        ],
      }),
    );
    // 30 base + 30 (5 examples) + 0 (similarity 0) = 60
    expect(confidence).toBe(60);
  });

  it('adds similarity-based points (avg * 20)', () => {
    const confidence = calculateVoiceConfidence(
      makeGrounding({
        semanticExamples: [makeExample(0.8), makeExample(0.9)],
      }),
    );
    // 30 base + 10 (2 examples) + round(0.85 * 20) = 30 + 10 + 17 = 57
    expect(confidence).toBe(57);
  });

  it('adds 10 points when style profile is trained', () => {
    const confidence = calculateVoiceConfidence(
      makeGrounding({
        styleProfile: { trained: true, tonePreference: 'balanced' },
      }),
    );
    // 30 base + 10 (style) = 40
    expect(confidence).toBe(40);
  });

  it('does not add style points when profile exists but is not trained', () => {
    const confidence = calculateVoiceConfidence(
      makeGrounding({
        styleProfile: { trained: false },
      }),
    );
    expect(confidence).toBe(30);
  });

  it('adds 10 points when edit patterns exist', () => {
    const confidence = calculateVoiceConfidence(
      makeGrounding({
        recentEditPatterns: [
          { original: 'Hello!', edited: 'Hey there!', category: null },
        ],
      }),
    );
    // 30 base + 10 (edit patterns) = 40
    expect(confidence).toBe(40);
  });

  it('reaches 80+ with 5 high-similarity examples and style profile', () => {
    const confidence = calculateVoiceConfidence(
      makeGrounding({
        semanticExamples: [
          makeExample(0.85),
          makeExample(0.9),
          makeExample(0.88),
          makeExample(0.92),
          makeExample(0.87),
        ],
        styleProfile: { trained: true, tonePreference: 'detailed' },
      }),
    );
    // 30 base + 30 (5 examples) + round(0.884 * 20)=18 (similarity) + 10 (style) = 88
    expect(confidence).toBeGreaterThanOrEqual(80);
  });

  it('caps confidence at 95 even with maximum grounding', () => {
    const confidence = calculateVoiceConfidence(
      makeGrounding({
        semanticExamples: [
          makeExample(1.0),
          makeExample(1.0),
          makeExample(1.0),
          makeExample(1.0),
          makeExample(1.0),
        ],
        styleProfile: { trained: true },
        recentEditPatterns: [
          { original: 'a', edited: 'b', category: null },
        ],
      }),
    );
    // 30 + 30 + 20 + 10 + 10 = 100 → capped to 95
    expect(confidence).toBe(95);
  });

  it('handles null similarity values gracefully', () => {
    const example = makeExample(0.5);
    // Simulate a null similarity from DB
    (example as Record<string, unknown>).similarity = null;

    const confidence = calculateVoiceConfidence(
      makeGrounding({
        semanticExamples: [example],
      }),
    );
    // 30 base + 10 (1 example) + round(0 * 20)=0 = 40
    expect(confidence).toBe(40);
  });
});
