import type { CurrencyCode } from '@saldo/core';
import { type AppLocale, formatMoneyParts, type SignDisplay } from '@saldo/i18n';
import { Text as RnText } from 'react-native';
import { useCountUp } from '../theme/motion';
import { Text, type TextProps } from '../theme/Text';

export interface AmountTextProps extends Omit<TextProps, 'children' | 'tabular'> {
  minor: number;
  currency: CurrencyCode;
  locale: AppLocale;
  signDisplay?: SignDisplay;
}

/**
 * Money split as the design renders it: the fraction and the symbol sit at 50% opacity (§5.1),
 * with tabular figures so columns line up.
 */
export function AmountText({
  minor,
  currency,
  locale,
  signDisplay = 'negative',
  ...rest
}: AmountTextProps) {
  const parts = formatMoneyParts(minor, currency, locale, signDisplay);
  const tail =
    parts.fraction === ''
      ? ` ${parts.symbol}`
      : `${parts.decimalSeparator}${parts.fraction} ${parts.symbol}`;
  const prefix = parts.symbolPosition === 'prefix' ? parts.symbol : '';
  return (
    <Text {...rest} tabular>
      {`${parts.sign}${prefix}${parts.integer}`}
      <RnText style={{ opacity: 0.5 }}>
        {parts.symbolPosition === 'prefix'
          ? parts.fraction === ''
            ? ''
            : `${parts.decimalSeparator}${parts.fraction}`
          : tail}
      </RnText>
    </Text>
  );
}

/**
 * The same amount, rolling from its previous value to the new one.
 *
 * Only for the figure a screen is *about* — the money left in the cycle, an account's balance.
 * A number that animates tells you it **was** something else, which is exactly what you want to
 * know after adding a transaction; a list where fifty of them count at once is a slot machine.
 */
export function AnimatedAmount({ minor, ...rest }: AmountTextProps) {
  return <AmountText {...rest} minor={useCountUp(minor)} />;
}
