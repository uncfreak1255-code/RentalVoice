import React from 'react';
import { Pressable, PressableProps, GestureResponderEvent } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { animation } from '@/lib/design-tokens'; // Assumes alias setup, otherwise relative path needed

export interface PremiumPressableProps extends PressableProps {
  children: React.ReactNode;
  /** Scale target when pressed (default: 0.96) */
  scaleTo?: number;
  /** Haptic feedback style (default: 'light') */
  hapticFeedback?: 'light' | 'medium' | 'heavy' | 'selection' | 'none';
  /** Spring config key from design-tokens when releasing */
  springReleaseConfig?: keyof typeof animation.spring;
  /** Disable animation but keep haptics? */
  disableAnimation?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PremiumPressable({
  children,
  style,
  scaleTo = 0.96,
  hapticFeedback = 'light',
  springReleaseConfig = 'subtle',
  disableAnimation = false,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...props
}: PremiumPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = (e: GestureResponderEvent) => {
    if (disabled) return;
    
    // Scale down quickly (snappy feels best for touch down)
    if (!disableAnimation) {
      scale.value = withSpring(scaleTo, animation.spring.snappy);
    }
    
    // Trigger haptic if configured
    if (hapticFeedback !== 'none') {
      try {
        switch (hapticFeedback) {
          case 'selection':
            Haptics.selectionAsync();
            break;
          case 'light':
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case 'medium':
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
          case 'heavy':
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            break;
        }
      } catch {
        // Haptics might fail on some platforms/devices, silently ignore
      }
    }

    if (onPressIn) onPressIn(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    // Spring back to full size using the designated release config
    if (!disableAnimation) {
      scale.value = withSpring(1, animation.spring[springReleaseConfig]);
    }
    if (onPressOut) onPressOut(e);
  };

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={(state) => {
        const baseStyle = typeof style === 'function' ? style(state) : style;
        return [baseStyle, disableAnimation ? undefined : animatedStyle];
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
