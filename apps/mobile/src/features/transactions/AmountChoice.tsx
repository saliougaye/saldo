import { motion } from '@saldo/ui';
import { useEffect, useState } from 'react';
import { type LayoutChangeEvent, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { EASE, useMotion } from '../../theme/motion';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

export interface AmountOption {
  key: string;
  label: string;
  minor: number;
  /** The figure as the user reads it, already through hidden mode. */
  amount: string;
}

/** 3pt of padding on each side of the control, and the same gap between the two segments. */
const INSET = 3;
/** Two lines — label over amount — need more room than the 36pt segments of the kind switch. */
const SEGMENT_HEIGHT = 48;
/** The design's press scale for this control (2026-09-23 variants, "Segmenti"). */
const PRESS_SCALE = 0.97;

/**
 * Two amounts, one of which the field holds: the closed statement or the whole balance of a card
 * ("Salda carta", §6.10). The `Segmented` look, with the figure under each label, because the
 * choice is exactly one of two — chips read as shortcuts, and left nothing to say when the typed
 * amount was neither.
 *
 * `value` is the key the typed amount matches, or null for anything else: the thumb then fades
 * away and the caller names that state ("Importo personalizzato"). Radio roles rather than the
 * tabs of `Segmented`: a segmented control has no "neither" state, and this one does.
 */
export function AmountChoice({
  options,
  value,
  onSelect,
  accessibilityLabel,
}: {
  options: readonly AmountOption[];
  value: string | null;
  onSelect: (option: AmountOption) => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const { duration } = useMotion();
  const [width, setWidth] = useState(0);
  const offset = useSharedValue(0);
  const opacity = useSharedValue(value === null ? 0 : 1);
  const index = options.findIndex((option) => option.key === value);
  const segment = width === 0 ? 0 : (width - INSET * 2 - INSET * (options.length - 1)) / 2;
  const target = index < 0 ? offset.value : index * (segment + INSET);

  useEffect(() => {
    // The thumb travels; on a custom amount it fades out where it stood rather than sliding to
    // nowhere. Both are `motion.toggleMs`, the app's switch timing.
    const config = { duration: duration(motion.toggleMs), easing: EASE };
    offset.value = withTiming(target, config);
    opacity.value = withTiming(index < 0 ? 0 : 1, config);
  }, [target, index, duration, offset, opacity]);

  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
    opacity: opacity.value,
  }));

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      onLayout={onLayout}
      style={{
        flexDirection: 'row',
        gap: INSET,
        padding: INSET,
        marginTop: 12,
        borderRadius: theme.radii.input,
        backgroundColor: theme.palette.raised,
      }}
    >
      {segment > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: INSET,
              bottom: INSET,
              left: INSET,
              width: segment,
              borderRadius: theme.radii.chipSmall,
              backgroundColor: theme.palette.accent,
            },
            thumb,
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`${option.label}, ${option.amount}`}
            hitSlop={{ top: 4, bottom: 4 }}
            onPress={() => onSelect(option)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: SEGMENT_HEIGHT,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              borderRadius: theme.radii.chipSmall,
              transform: [{ scale: pressed ? PRESS_SCALE : 1 }],
            })}
          >
            <Text
              size="footnote"
              weight="medium"
              color={selected ? 'onAccent' : 'textMuted'}
              numberOfLines={1}
            >
              {option.label}
            </Text>
            <Text size="caption" tabular color={selected ? 'onAccent' : 'textMuted'}>
              {option.amount}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
