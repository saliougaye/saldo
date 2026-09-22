import type { CurrencyCode } from '@saldo/core';
import { type AppLocale, formatMoneyParts, type SignDisplay } from '@saldo/i18n';
import { useTranslation } from 'react-i18next';
import { Text as RnText, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useHiddenAmounts } from '../features/hidden/hiddenAmounts';
import { MASK } from '../features/hidden/mask';
import { useRoll } from '../features/hidden/useRoll';
import { useCountUp } from '../theme/motion';
import { Text, type TextProps } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

export interface AmountTextProps extends Omit<TextProps, 'children' | 'tabular' | 'style'> {
  /**
   * Lands on the wrapper that clips the hidden-mode roll, not on the text: layout only (margins,
   * flex). Colour and size have their own props.
   */
  style?: StyleProp<ViewStyle>;
  minor: number;
  currency: CurrencyCode;
  locale: AppLocale;
  signDisplay?: SignDisplay;
  /**
   * Which edge the `••••` mask keeps when the figures are hidden. The real figure stays in
   * layout at opacity 0 and holds the width, so a trailing amount in a row wants `end`.
   */
  align?: 'start' | 'end';
  /** Position in the Home stagger (0 = the hero); other screens leave it at 0. */
  stagger?: number;
  /**
   * Never masked. For a single transaction — a list row, its detail, an occurrence — which stays
   * readable in hidden mode: it is small and contextual, and the list has to remain usable. The
   * figures hidden mode is for are the aggregates: balances, totals, budgets, charts.
   */
  plain?: boolean;
}

/**
 * Money split as the design renders it: the fraction and the symbol sit at 50% opacity (§5.1),
 * with tabular figures so columns line up.
 *
 * In hidden mode the figure is `•••• €` (fixed four dots: a dot per digit would say how many digits
 * the balance has). Two layers: the real text keeps its place at opacity 0, so nothing shifts, and
 * leaves the accessibility tree; the mask sits on top as one element labelled "Importo nascosto".
 * The swap rolls like an odometer (`useRoll`), entirely on the UI thread.
 */
export function AmountText({
  minor,
  currency,
  locale,
  signDisplay = 'negative',
  align = 'start',
  stagger = 0,
  plain = false,
  style,
  size = 'body',
  ...rest
}: AmountTextProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const hidden = useHiddenAmounts().hidden && !plain;
  const parts = formatMoneyParts(minor, currency, locale, signDisplay);
  const roll = useRoll(hidden, theme.fontSize[size], stagger);
  const tail =
    parts.fraction === ''
      ? ` ${parts.symbol}`
      : `${parts.decimalSeparator}${parts.fraction} ${parts.symbol}`;
  const prefix = parts.symbolPosition === 'prefix' ? parts.symbol : '';
  const mask =
    parts.symbolPosition === 'prefix' ? `${parts.symbol}${MASK}` : `${MASK} ${parts.symbol}`;

  return (
    // `overflow: 'hidden'` clips the drum: a layer rolling out disappears at the line's edge.
    <View style={[style, { overflow: 'hidden' }]} accessible={false}>
      <Animated.View
        style={roll.realStyle}
        accessibilityElementsHidden={hidden}
        importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      >
        <Text {...rest} size={size} tabular>
          {`${parts.sign}${prefix}${parts.integer}`}
          <RnText style={{ opacity: 0.5 }}>
            {parts.symbolPosition === 'prefix'
              ? parts.fraction === ''
                ? ''
                : `${parts.decimalSeparator}${parts.fraction}`
              : tail}
          </RnText>
        </Text>
      </Animated.View>
      <Animated.View
        // The mask is narrower than the figure it covers, so which edge it keeps is decided here,
        // not by whatever the parent does with its children.
        style={[
          StyleSheet.absoluteFill,
          { justifyContent: 'center', alignItems: align === 'end' ? 'flex-end' : 'flex-start' },
          roll.maskStyle,
        ]}
        pointerEvents="none"
        accessible={hidden}
        accessibilityLabel={t('common.amountHidden')}
        accessibilityElementsHidden={!hidden}
        importantForAccessibility={hidden ? 'yes' : 'no-hide-descendants'}
      >
        <Text {...rest} size={size} color="textMuted" tabular numberOfLines={1}>
          {mask}
        </Text>
      </Animated.View>
    </View>
  );
}

/**
 * The same amount, rolling from its previous value to the new one.
 *
 * Only for the figure a screen is *about* — the money left in the cycle, an account's balance.
 * A number that animates tells you it **was** something else, which is exactly what you want to
 * know after adding a transaction; a list where fifty of them count at once is a slot machine.
 *
 * The count-up pauses while the figures are hidden: nobody sees it, and it would fight the roll.
 */
export function AnimatedAmount({ minor, ...rest }: AmountTextProps) {
  const { hidden } = useHiddenAmounts();
  return <AmountText {...rest} minor={useCountUp(minor, !hidden)} />;
}
