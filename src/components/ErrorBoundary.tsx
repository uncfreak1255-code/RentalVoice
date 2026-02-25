import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { colors, spacing, typography, radius } from '@/lib/design-tokens';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches rendering errors in child components and shows a friendly
 * "Something went wrong" screen instead of crashing the entire app.
 * Also reports the error to Sentry for remote monitoring.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>😵</Text>
          <Text style={styles.title}>
            {this.props.fallbackTitle ?? 'Something went wrong'}
          </Text>
          <Text style={styles.message}>
            An unexpected error occurred. We've reported it to our team.
          </Text>
          <Pressable
            onPress={this.handleRetry}
            style={({ pressed }) => [styles.button, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.base,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['8'],
  },
  emoji: { fontSize: 48, marginBottom: spacing['4'] },
  title: {
    fontSize: 20,
    fontFamily: typography.fontFamily.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing['2'],
  },
  message: {
    fontSize: 15,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing['6'],
    paddingHorizontal: spacing['4'],
  },
  button: {
    backgroundColor: colors.primary.DEFAULT,
    paddingHorizontal: spacing['6'],
    paddingVertical: spacing['3'],
    borderRadius: radius.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: typography.fontFamily.semibold,
    fontSize: 16,
  },
});
