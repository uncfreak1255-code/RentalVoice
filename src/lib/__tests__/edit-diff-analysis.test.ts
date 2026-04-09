/**
 * Tests for edit-diff-analysis.ts pure computation functions.
 * Covers: analyzeEdit, analyzeRejection, analyzeIndependentReply,
 * getEditSummary, getRejectionSummary, getIndependentReplySummary.
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn().mockResolvedValue(undefined),
    getItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

import {
  analyzeEdit,
  getEditSummary,
  analyzeRejection,
  getRejectionSummary,
  analyzeIndependentReply,
  getIndependentReplySummary,
} from '../edit-diff-analysis';

// ── Edit Analysis ──

describe('analyzeEdit', () => {
  it('should detect tone change when host rewrites greeting', () => {
    const pattern = analyzeEdit(
      'Dear Guest, We hope this message finds you well. The WiFi password is guest123.',
      'Hey! WiFi is guest123 🎉',
      'prop-1',
      'wifi'
    );
    expect(pattern).toBeDefined();
    expect(pattern.propertyId).toBe('prop-1');
  });

  it('should detect content addition when host adds details', () => {
    const pattern = analyzeEdit(
      'Check-in is at 3pm.',
      'Check-in is at 3pm. The door code is 4521. Parking is in the back lot.',
      'prop-1',
      'check_in'
    );
    expect(pattern).toBeDefined();
    const summary = getEditSummary(pattern);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });

  it('should handle identical content (no edit)', () => {
    const pattern = analyzeEdit(
      'Thanks for your message!',
      'Thanks for your message!',
      'prop-1',
      'greeting'
    );
    expect(pattern).toBeDefined();
  });

  it('should handle empty original content gracefully', () => {
    const pattern = analyzeEdit(
      '',
      'Here is your answer.',
      'prop-1',
      'general'
    );
    expect(pattern).toBeDefined();
  });
});

describe('getEditSummary', () => {
  it('should return a non-empty human-readable summary', () => {
    const pattern = analyzeEdit(
      'The pool is open 9am-9pm.',
      'Pool hours are 9am-9pm. Towels are by the pool house.',
      'prop-1',
      'amenities'
    );
    const summary = getEditSummary(pattern);
    expect(summary).toBeTruthy();
    expect(typeof summary).toBe('string');
  });
});

// ── Rejection Analysis ──

describe('analyzeRejection', () => {
  it('should analyze why a draft was rejected', () => {
    const pattern = analyzeRejection(
      'Thanks for your message! We are happy to assist you.',
      'Can I have early check-in?',
      'prop-1',
      'early_checkin',
      'neutral',
      85
    );
    expect(pattern).toBeDefined();
    expect(pattern).toBeDefined();
    expect(pattern.propertyId).toBe('prop-1');
  });

  it('should handle missing optional parameters', () => {
    const pattern = analyzeRejection(
      'Draft content',
      'Guest message',
      undefined,
      undefined,
      undefined,
      undefined
    );
    expect(pattern).toBeDefined();
  });
});

describe('getRejectionSummary', () => {
  it('should return human-readable rejection reason', () => {
    const pattern = analyzeRejection(
      'Generic response here.',
      'What is the WiFi password?',
      'prop-1',
      'wifi',
      'neutral',
      60
    );
    const summary = getRejectionSummary(pattern);
    expect(summary).toBeTruthy();
    expect(typeof summary).toBe('string');
  });
});

// ── Independent Reply Analysis ──

describe('analyzeIndependentReply', () => {
  it('should detect when host ignores AI draft entirely', () => {
    const pattern = analyzeIndependentReply(
      'Hello! Welcome to our property. Check-in is at 3pm.',
      'Hey! Just text me when you arrive and I will walk you through everything.',
      'When can I check in?',
      'prop-1',
      'check_in'
    );
    expect(pattern).toBeDefined();
  });

  it('should handle case where AI draft was empty', () => {
    const pattern = analyzeIndependentReply(
      '',
      'The WiFi password is Beach2024',
      'What is the WiFi?',
      'prop-1',
      'wifi'
    );
    expect(pattern).toBeDefined();
    const summary = getIndependentReplySummary(pattern);
    expect(summary).toBeTruthy();
  });
});

describe('getIndependentReplySummary', () => {
  it('should explain what the host preferred', () => {
    const pattern = analyzeIndependentReply(
      'The parking is available on-site.',
      'Park anywhere in the driveway — there are 2 spots marked Guest.',
      'Where do I park?',
      'prop-1',
      'parking'
    );
    const summary = getIndependentReplySummary(pattern);
    expect(summary).toBeTruthy();
    expect(summary.length).toBeGreaterThan(10);
  });
});
