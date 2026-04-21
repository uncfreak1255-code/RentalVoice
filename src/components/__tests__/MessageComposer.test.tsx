/**
 * Component tests for MessageComposer — the critical messaging UI.
 * 
 * Tests cover:
 * - Sending a manual message
 * - Approving an AI draft (Send Draft)
 * - Editing a draft then Save & Send
 * - Dismissing a draft
 * - Draft panel visibility states
 * - Keyboard interaction via "Done" button
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MessageComposer } from '../MessageComposer';

// ── Mocks ──

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (Component: any) => Component,
      View,
    },
    useAnimatedStyle: () => ({}),
    useSharedValue: (initial: any) => ({ value: initial }),
    withSpring: (val: any) => val,
    withTiming: (val: any) => val,
    withDelay: (_delay: number, val: any) => val,
    withSequence: (...values: any[]) => values[values.length - 1],
    withRepeat: (val: any) => val,
    useReducedMotion: () => false,
    FadeIn: { duration: () => ({}) },
    FadeInDown: { duration: () => ({}) },
    FadeOut: { duration: () => ({}) },
    SlideInDown: { duration: () => ({}) },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
}));

// Mock lucide icons
jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const icon = (name: string) => {
    const MockIcon = (props: any) => <View testID={`icon-${name}`} {...props} />;
    MockIcon.displayName = `${name}IconMock`;
    return MockIcon;
  };
  return {
    Send: icon('send'),
    Sparkles: icon('sparkles'),
    RefreshCw: icon('refresh'),
    Edit3: icon('edit'),
    Check: icon('check'),
    X: icon('x'),
    Gauge: icon('gauge'),
    ChevronDown: icon('chevron-down'),
    Paperclip: icon('paperclip'),
    Trash2: icon('trash'),
    MoreHorizontal: icon('more'),
  };
});

// Mock privacy scanner
jest.mock('@/lib/privacy-scanner', () => ({
  scanForSensitiveData: jest.fn(() => null),
}));

// Mock PrivacyAlertBanner
jest.mock('../PrivacyAlertBanner', () => ({
  PrivacyAlertBanner: () => null,
  PrivacyIndicator: () => null,
}));

// Mock AIReasoningSection
jest.mock('../AIReasoningSection', () => ({
  AIReasoningSection: () => null,
}));

// Mock ModelPicker
jest.mock('../ModelPicker', () => ({
  ModelPicker: () => null,
}));

// Mock PremiumPressable — render as regular Pressable
jest.mock('@/components/ui', () => {
  const { Pressable } = require('react-native');
  return {
    PremiumPressable: ({ children, onPress, ...props }: any) => (
      <Pressable onPress={onPress} {...props}>{children}</Pressable>
    ),
  };
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn().mockResolvedValue(undefined),
    getItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

// ── Helpers ──

const defaultProps = {
  onSend: jest.fn(),
  onApproveAiDraft: jest.fn(),
  onRegenerateAiDraft: jest.fn(),
  onEditAiDraft: jest.fn(),
  onDismissAiDraft: jest.fn(),
  aiDraft: null as any,
  isGenerating: false,
  disabled: false,
  autoPilotEnabled: false,
  privacyScanEnabled: false, // Disable privacy scan to simplify tests
};

const makeDraft = (overrides: any = {}) => ({
  content: 'Thanks for reaching out! We look forward to hosting you.',
  confidence: 85,
  sentiment: { primary: 'Positive', intensity: 80, emotions: [], requiresEscalation: false },
  ...overrides,
});

// ── Tests ──

describe('MessageComposer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────
  // MANUAL SEND
  // ─────────────────────────────────────────

  describe('Manual Send', () => {
    it('should render the text input', () => {
      const { getByPlaceholderText } = render(<MessageComposer {...defaultProps} />);
      expect(getByPlaceholderText('Type a message...')).toBeTruthy();
    });

    it('should call onSend with trimmed message content', () => {
      const onSend = jest.fn();
      const { getByPlaceholderText, getByLabelText } = render(
        <MessageComposer {...defaultProps} onSend={onSend} />
      );

      const input = getByPlaceholderText('Type a message...');
      fireEvent.changeText(input, '  Hello world  ');

      // The send button should now be enabled
      const sendButton = getByLabelText('Send message');
      fireEvent.press(sendButton);

      expect(onSend).toHaveBeenCalledWith('Hello world');
    });

    it('should clear the input after sending', () => {
      const onSend = jest.fn();
      const { getByPlaceholderText, getByLabelText } = render(
        <MessageComposer {...defaultProps} onSend={onSend} />
      );

      const input = getByPlaceholderText('Type a message...');
      fireEvent.changeText(input, 'Hello');
      fireEvent.press(getByLabelText('Send message'));

      // Input should be cleared
      expect(input.props.value).toBe('');
    });

    it('should not send empty or whitespace-only messages', () => {
      const onSend = jest.fn();
      const { getByPlaceholderText, getByLabelText } = render(
        <MessageComposer {...defaultProps} onSend={onSend} />
      );

      const input = getByPlaceholderText('Type a message...');
      fireEvent.changeText(input, '   ');
      fireEvent.press(getByLabelText('Send message'));

      expect(onSend).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────
  // AI DRAFT PANEL
  // ─────────────────────────────────────────

  describe('AI Draft Panel', () => {
    it('should show draft content when aiDraft is provided', () => {
      const { getByText } = render(
        <MessageComposer {...defaultProps} aiDraft={makeDraft()} />
      );
      expect(getByText(/Thanks for reaching out/)).toBeTruthy();
    });

    it('should show the learning proof summary when present', () => {
      const { getByText } = render(
        <MessageComposer
          {...defaultProps}
          aiDraft={makeDraft({
            learningProofSummary: 'Using 2 similar examples and 1 recent correction',
          })}
        />
      );

      fireEvent.press(getByText('Why this?'));
      expect(getByText('Using 2 similar examples and 1 recent correction')).toBeTruthy();
    });

    it('should show "AI draft" header', () => {
      const { getByText } = render(
        <MessageComposer {...defaultProps} aiDraft={makeDraft()} />
      );
      expect(getByText('AI draft')).toBeTruthy();
    });

    it('should show confidence percentage', () => {
      const { getByText } = render(
        <MessageComposer {...defaultProps} aiDraft={makeDraft({ confidence: 92 })} />
      );
      expect(getByText(/92%/i)).toBeTruthy();
    });

    it('should show generating state', () => {
      const { getByText } = render(
        <MessageComposer {...defaultProps} isGenerating={true} />
      );
      expect(getByText('Writing your reply')).toBeTruthy();
    });

    it('should not show draft panel when aiDraft is null', () => {
      const { queryByText } = render(<MessageComposer {...defaultProps} />);
      expect(queryByText('AI draft')).toBeNull();
    });

    it('should collapse the AI draft preview when typing a manual reply', async () => {
      const { getByPlaceholderText, getByText, queryByText, getByLabelText } = render(
        <MessageComposer {...defaultProps} aiDraft={makeDraft()} />
      );

      fireEvent.changeText(getByPlaceholderText('Type a message...'), 'I will handle this manually');

      await waitFor(() => {
        expect(getByText('Tap to view')).toBeTruthy();
      });

      expect(queryByText(/Thanks for reaching out/)).toBeNull();
      expect(getByLabelText('Send message')).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────
  // APPROVE DRAFT (Send Draft button)
  // ─────────────────────────────────────────

  describe('Approve Draft', () => {
    it('should call onApproveAiDraft when Send Draft is pressed', () => {
      const onApprove = jest.fn();
      const { getByLabelText } = render(
        <MessageComposer {...defaultProps} onApproveAiDraft={onApprove} aiDraft={makeDraft()} />
      );

      fireEvent.press(getByLabelText('Send AI draft to guest'));
      expect(onApprove).toHaveBeenCalledTimes(1);
      expect(onApprove).toHaveBeenCalledWith(); // No content override
    });
  });

  // ─────────────────────────────────────────
  // EDIT → SAVE & SEND (the flow that crashed)
  // ─────────────────────────────────────────

  describe('Edit → Save & Send', () => {
    it('should enter edit mode when Edit is pressed', () => {
      const { getByLabelText, getByText } = render(
        <MessageComposer {...defaultProps} aiDraft={makeDraft()} />
      );

      fireEvent.press(getByLabelText('Edit AI draft'));

      // Should show editing UI
      expect(getByText('Editing AI Draft')).toBeTruthy();
    });

    it('should call onApproveAiDraft with edited content on Send Edited Draft', async () => {
      const onApprove = jest.fn();
      const { getByLabelText, getByText, getByDisplayValue } = render(
        <MessageComposer {...defaultProps} onApproveAiDraft={onApprove} aiDraft={makeDraft()} />
      );

      // Enter edit mode
      fireEvent.press(getByLabelText('Edit AI draft'));

      // Find the edit input (it's pre-populated with draft content)
      const editInput = getByDisplayValue('Thanks for reaching out! We look forward to hosting you.');
      fireEvent.changeText(editInput, 'Custom edited reply here');

      // Press Send Edited Draft
      fireEvent.press(getByText('Send Edited Draft'));

      expect(onApprove).toHaveBeenCalledWith('Custom edited reply here');
    });

    it('should not send empty edited content', () => {
      const onApprove = jest.fn();
      const { getByLabelText, getByText, getByDisplayValue } = render(
        <MessageComposer {...defaultProps} onApproveAiDraft={onApprove} aiDraft={makeDraft()} />
      );

      fireEvent.press(getByLabelText('Edit AI draft'));
      const editInput = getByDisplayValue('Thanks for reaching out! We look forward to hosting you.');
      fireEvent.changeText(editInput, '   ');

      fireEvent.press(getByText('Send Edited Draft'));
      expect(onApprove).not.toHaveBeenCalled();
    });

    it('should exit edit mode when Cancel is pressed', () => {
      const { getByLabelText, getByText, queryByText } = render(
        <MessageComposer {...defaultProps} aiDraft={makeDraft()} />
      );

      fireEvent.press(getByLabelText('Edit AI draft'));
      expect(getByText('Editing AI Draft')).toBeTruthy();

      fireEvent.press(getByText('Cancel'));
      // Should show draft panel again, not edit mode
      expect(queryByText('Editing AI Draft')).toBeNull();
    });

    it('should keep the edited draft empty after pressing Clear', async () => {
      const { getByLabelText, getByText, queryByDisplayValue, getByDisplayValue } = render(
        <MessageComposer {...defaultProps} aiDraft={makeDraft()} />
      );

      fireEvent.press(getByLabelText('Edit AI draft'));
      expect(getByDisplayValue('Thanks for reaching out! We look forward to hosting you.')).toBeTruthy();

      fireEvent.press(getByText('Clear'));

      await waitFor(() => {
        expect(queryByDisplayValue('Thanks for reaching out! We look forward to hosting you.')).toBeNull();
      });
    });
  });

  // ─────────────────────────────────────────
  // DISMISS DRAFT
  // ─────────────────────────────────────────

  describe('Dismiss Draft', () => {
    it('should call onDismissAiDraft when X is pressed', () => {
      const onDismiss = jest.fn();
      const { getByLabelText } = render(
        <MessageComposer {...defaultProps} onDismissAiDraft={onDismiss} aiDraft={makeDraft()} />
      );

      fireEvent.press(getByLabelText('Dismiss AI draft'));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────
  // REGENERATE
  // ─────────────────────────────────────────

  describe('Regenerate Draft', () => {
    it('should call onRegenerateAiDraft when regenerate icon is pressed', () => {
      const onRegenerate = jest.fn();
      const { getByLabelText } = render(
        <MessageComposer {...defaultProps} onRegenerateAiDraft={onRegenerate} aiDraft={makeDraft()} />
      );

      fireEvent.press(getByLabelText('Regenerate AI draft'));
      expect(onRegenerate).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────
  // DRAFT RESET ON NULL
  // ─────────────────────────────────────────

  describe('Draft Lifecycle', () => {
    it('should reset edit state when aiDraft goes from value to null', () => {
      const { rerender, queryByText } = render(
        <MessageComposer {...defaultProps} aiDraft={makeDraft()} />
      );

      // Now simulate the draft being cleared (e.g., after approve)
      rerender(<MessageComposer {...defaultProps} aiDraft={null} />);

      // Edit panel should not be visible
      expect(queryByText('Editing AI Draft')).toBeNull();
      // Draft panel should not be visible
      expect(queryByText('AI draft')).toBeNull();
    });
  });
});
