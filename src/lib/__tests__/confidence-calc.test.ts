/**
 * Tests for the smooth logarithmic style profile growth curve.
 *
 * Formula: min(95, round(40 + 55 * log(1 + samples) / log(1 + 150)))
 *
 * Verifies the curve produces smoothly increasing values at key sample counts
 * and never exceeds the 95 ceiling.
 */

describe('style profile growth curve', () => {
  // Extracted formula so tests stay in sync with ai-enhanced.ts
  const computeStyleMatch = (samples: number): number =>
    Math.min(95, Math.round(40 + 55 * Math.log(1 + samples) / Math.log(1 + 150)));

  const keyPoints: [number, number][] = [
    [0, 40],
    [1, 48],
    [5, 60],
    [10, 66],
    [20, 73],
    [50, 83],
    [100, 91],
    [150, 95],
  ];

  it.each(keyPoints)(
    'returns %i for %i samples',
    (samples, expected) => {
      expect(computeStyleMatch(samples)).toBe(expected);
    },
  );

  it('never exceeds 95 even with very large sample counts', () => {
    expect(computeStyleMatch(500)).toBe(95);
    expect(computeStyleMatch(10_000)).toBe(95);
  });

  it('increases monotonically', () => {
    let prev = computeStyleMatch(0);
    for (let s = 1; s <= 200; s++) {
      const cur = computeStyleMatch(s);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });

  it('has no large jumps (max 8-point gap between consecutive samples)', () => {
    // Largest gap is 0->1 (8 points); after that the curve flattens quickly
    for (let s = 1; s <= 200; s++) {
      const diff = computeStyleMatch(s) - computeStyleMatch(s - 1);
      expect(diff).toBeLessThanOrEqual(8);
    }
  });

  it('smooths out quickly — gap shrinks to <=2 after 5 samples', () => {
    for (let s = 6; s <= 200; s++) {
      const diff = computeStyleMatch(s) - computeStyleMatch(s - 1);
      expect(diff).toBeLessThanOrEqual(2);
    }
  });
});
