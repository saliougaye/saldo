import type { CurrencyCode } from '@saldo/core';
import { type AppLocale, formatMoney } from '@saldo/i18n';
import { motion } from '@saldo/ui';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Card } from '../../components/Card';
import { IconBox } from '../../components/ListRow';
import { Icon } from '../../theme/Icon';
import { EASE, useMotion } from '../../theme/motion';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * The one row that stands in for everything dated after today (§5.12).
 *
 * A disclosure rather than a screen of its own: these are the same rows, in the same period, with
 * the same swipe actions — a separate screen would be a second copy of the list, and you open this
 * to glance at what is coming and then go back to what you were doing.
 */
export function UpcomingRow({
  count,
  net,
  currency,
  locale,
  open,
  onToggle,
}: {
  count: number;
  /** Signed: income up, everything else down. */
  net: number;
  currency: CurrencyCode;
  locale: AppLocale;
  open: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { reduced } = useMotion();
  const turn = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    const next = open ? 1 : 0;
    turn.value = reduced ? next : withTiming(next, { duration: motion.fadeMs, easing: EASE });
  }, [open, reduced, turn]);

  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));

  return (
    <Card padded={false}>
      <Pressable
        testID="transactions-upcoming"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={t('transactions.upcoming')}
        accessibilityHint={t(open ? 'transactions.upcomingHide' : 'transactions.upcomingShow')}
        onPress={onToggle}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: theme.layout.cardPadding,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <IconBox name="clock" colour={theme.palette.textMuted} small />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text weight="medium" tracking="tight">
            {t('transactions.upcoming')}
          </Text>
          <Text size="caption" color="textMuted">
            {t('transactions.upcomingCount', { count })}
          </Text>
        </View>
        <Text color="textMuted" tabular>
          {formatMoney(net, currency, locale)}
        </Text>
        <Animated.View style={chevron}>
          <Icon name="chevD" size={16} color={theme.palette.textFaint} />
        </Animated.View>
      </Pressable>
    </Card>
  );
}
