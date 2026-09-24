import type { IconName } from '@saldo/ui';
import { motion } from '@saldo/ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { Circle, G, Line, Svg } from 'react-native-svg';
import { Icon } from '../theme/Icon';
import { EASE, useMotion } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { ringGeometry } from './ringGeometry';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * `attention`: over pace or over the limit (a budget), behind or expired (a goal). `done`: a goal
 * reached — the only green (§5.13). Colour carries the meaning, never fullness.
 */
export type TargetTone = 'attention' | 'done' | 'plain';

export interface TargetRingProps {
  size: number;
  /** 0..1, clamped. */
  ratio: number;
  /** Where the pace tick sits, or null for none (a closed range). */
  pace: number | null;
  tone: TargetTone;
  icon: IconName;
  /** The item's colour, for the icon in the middle. */
  colour: string;
  testID?: string;
}

/**
 * Progress, pace and icon in one mark: the icon box of a row that has a target.
 *
 * Starts at its value and animates only a **change** of it, as `ProgressBar` does: Home is opened
 * tens of times a day, so a ring filling on every open would be noise, while one moving after a
 * new expense confirms what changed. `strokeDashoffset` runs on the UI thread and costs no layout.
 */
export function TargetRing({ size, ratio, pace, tone, icon, colour, testID }: TargetRingProps) {
  const theme = useTheme();
  const { reduced } = useMotion();
  const ring = ringGeometry(size, ratio, pace);
  const target = Math.min(1, Math.max(0, ratio));
  const progress = useSharedValue(target);
  useEffect(() => {
    progress.value = reduced
      ? target
      : withTiming(target, { duration: motion.progressMs, easing: EASE });
  }, [target, reduced, progress]);
  const { circumference } = ring;
  const arc = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
    // A zero-length dash still draws its round cap as a dot.
    opacity: progress.value > 0 ? 1 : 0,
  }));
  const fill =
    tone === 'attention'
      ? theme.palette.accent
      : tone === 'done'
        ? theme.palette.positive
        : theme.palette.barGrey;
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
        <G rotation={-90} origin={`${ring.centre}, ${ring.centre}`}>
          <Circle
            cx={ring.centre}
            cy={ring.centre}
            r={ring.radius}
            stroke={theme.palette.track}
            strokeWidth={ring.stroke}
            fill="none"
          />
          <AnimatedCircle
            cx={ring.centre}
            cy={ring.centre}
            r={ring.radius}
            stroke={fill}
            strokeWidth={ring.stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeLinecap="round"
            fill="none"
            animatedProps={arc}
          />
          {ring.tick === null ? null : (
            <Line {...ring.tick} stroke={theme.palette.textFaint} strokeWidth={1.25} />
          )}
        </G>
      </Svg>
      <Icon name={icon} size={ring.icon} color={colour} />
    </View>
  );
}
