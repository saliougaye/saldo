import type { AmountKeypadKey } from '@saldo/core';
import { motion } from '@saldo/ui';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Icon } from '../../theme/Icon';
import { EASE, useMotion } from '../../theme/motion';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import type { AmountKeypadSession } from './AmountKeypadProvider';

/**
 * `0` and the separator keep their place on every screen, so a field that cannot go negative
 * leaves the bottom-left cell empty rather than reshuffling the keys under the thumb.
 */
const ROWS: readonly (readonly AmountKeypadKey[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['sign', '0', 'separator'],
];

/** How far the pad starts below its resting place; taller than any pad, so it is fully off-screen. */
const SLIDE = 400;

export interface AmountKeypadProps {
  session: AmountKeypadSession;
  /** Whether the amount is negative right now: the sign key shows the state it toggles. */
  negative: boolean;
  onLayoutHeight: (height: number) => void;
}

/**
 * Saldo's own keypad (§5.1, D23). The amount fields never open the device keyboard, so the keys
 * are the same on iOS and Android, the decimal separator follows the app's language rather than
 * the device's, and a balance gets a `−` key where a calculator has one.
 */
export function AmountKeypad({ session, negative, onLayoutHeight }: AmountKeypadProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { duration } = useMotion();
  const offset = useSharedValue(SLIDE);

  useEffect(() => {
    offset.value = withTiming(0, { duration: duration(motion.sheetMs), easing: EASE });
  }, [offset, duration]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  const renderKey = (name: AmountKeypadKey) => {
    const sign = name === 'sign';
    if (sign && !session.allowNegative) return <View key={name} style={{ flex: 1 }} />;
    if (name === 'separator' && session.separator === null) {
      return <View key={name} style={{ flex: 1 }} />;
    }
    const label = name === 'separator' ? (session.separator ?? '') : sign ? '−' : name;
    const lit = sign && negative;
    return (
      <Pressable
        key={name}
        testID={`keypad-key-${name}`}
        accessibilityRole="button"
        accessibilityLabel={name === 'separator' ? t('common.decimalPoint') : label}
        // The field's sign tile is the switch assistive technology drives: two switches with one
        // name is worse than one, and the tile is on screen whether the pad is up or not.
        accessibilityElementsHidden={sign}
        importantForAccessibility={sign ? 'no-hide-descendants' : 'yes'}
        onPress={() => session.onKey(name)}
        style={({ pressed }) => ({
          flex: 1,
          height: theme.layout.keypadKeyHeight,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radii.input,
          borderWidth: 1,
          borderColor: theme.palette.border,
          backgroundColor: lit ? theme.palette.accent : theme.palette.raised,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        })}
      >
        <Text size="amountKey" weight="medium" tabular color={lit ? 'onAccent' : 'text'}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <Animated.View
      testID="amount-keypad"
      accessibilityLabel={t('common.amountKeypad')}
      onLayout={(event) => onLayoutHeight(event.nativeEvent.layout.height)}
      style={[
        {
          flexDirection: 'row',
          gap: theme.layout.keypadGap,
          paddingHorizontal: theme.layout.keypadPaddingX,
          paddingTop: theme.layout.keypadPaddingY,
          backgroundColor: theme.palette.bg,
          borderTopWidth: 1,
          borderTopColor: theme.palette.border,
        },
        slide,
      ]}
    >
      <View style={{ flex: 1, gap: theme.layout.keypadGap }}>
        {ROWS.map((row) => (
          <View key={row.join('')} style={{ flexDirection: 'row', gap: theme.layout.keypadGap }}>
            {row.map(renderKey)}
          </View>
        ))}
      </View>
      <View style={{ width: theme.layout.keypadSaveWidth, gap: theme.layout.keypadGap }}>
        <Pressable
          testID="keypad-key-delete"
          accessibilityRole="button"
          accessibilityLabel={t('common.deleteDigit')}
          onPress={() => session.onKey('delete')}
          style={({ pressed }) => ({
            height: theme.layout.keypadKeyHeight,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radii.input,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Icon name="del" size={22} color={theme.palette.textMuted} />
        </Pressable>
        <Pressable
          testID="keypad-action"
          accessibilityRole="button"
          onPress={session.onAction}
          style={({ pressed }) => ({
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radii.button,
            backgroundColor: theme.palette.accent,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Text size="headline" weight="medium" tracking="tight" color="onAccent">
            {session.actionLabel}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
