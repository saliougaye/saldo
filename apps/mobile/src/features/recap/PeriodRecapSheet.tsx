import {
  type Category,
  type CurrencyCode,
  type PeriodKind,
  type PeriodRecap,
  parseLocalDate,
} from '@saldo/core';
import {
  type AppLocale,
  formatCycleRange,
  formatDayMonth,
  formatMonthYear,
  formatSignedPercent,
} from '@saldo/i18n';
import { motion } from '@saldo/ui';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AmountText } from '../../components/AmountText';
import { PrimaryButton } from '../../components/Button';
import { Card } from '../../components/Card';
import {
  EASE,
  SWAP_EASE,
  stepDelay,
  stepEntering,
  useCountUp,
  useMotion,
} from '../../theme/motion';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { useHiddenAmounts, useHiddenMoney } from '../hidden/hiddenAmounts';
import { RecapBar } from './RecapBar';

export interface PeriodRecapSheetProps {
  recap: PeriodRecap;
  kind: PeriodKind;
  categories: readonly Category[];
  currency: CurrencyCode;
  locale: AppLocale;
  /** Runs once the sheet has left the screen. */
  onClose: () => void;
}

/** The blocks of the entrance, in the order they arrive (§5.15). */
const CHUNK = { eyebrow: 0, title: 1, hero: 2, rest: 3 } as const;
/** Leaving is quicker than arriving (`tallSheetMs`): the eye has already moved on to Home. */
const EXIT_MS = motion.fadeMs;
/** The bars wait for the blocks above them to land before they grow. */
const BARS_ARM_MS = stepDelay(CHUNK.rest) + motion.stepEnterMs;
/** A section counts as seen once its top is this far into the viewport. */
const SEEN_FRACTION = 0.9;

function recapTitle(t: TFunction, kind: PeriodKind, start: string, locale: AppLocale): string {
  const { year, month } = parseLocalDate(start);
  if (kind === 'month') {
    const label = formatMonthYear({ year, month }, locale);
    return t('recap.title_month', { month: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  if (kind === 'year') return t('recap.title_year', { year });
  return t(`recap.title_${kind}`);
}

/**
 * The recap of a closed period (§6.39): a full-screen sheet over the Home of the new one, seen
 * once. It rises over `tallSheetMs`, its blocks arrive like an onboarding step's, the net counts up
 * from zero and the bars grow as their section scrolls into view; it leaves in `EXIT_MS`. With
 * Reduce Motion it only fades.
 */
export function PeriodRecapSheet({
  recap,
  kind,
  categories,
  currency,
  locale,
  onClose,
}: PeriodRecapSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { reduced } = useMotion();
  const { format } = useHiddenMoney();
  const byId = useMemo(() => new Map(categories.map((row) => [row.id, row])), [categories]);

  // --- Arrival and departure -------------------------------------------------------------------
  const offset = useSharedValue(reduced ? 0 : height);
  const opacity = useSharedValue(reduced ? 0 : 1);
  const scrim = useSharedValue(0);
  useEffect(() => {
    scrim.value = withTiming(1, { duration: motion.fadeMs, easing: EASE });
    if (reduced) opacity.value = withTiming(1, { duration: motion.fadeMs, easing: EASE });
    else offset.value = withTiming(0, { duration: motion.tallSheetMs, easing: EASE });
  }, [reduced, offset, opacity, scrim]);
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: offset.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));

  const closing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const config = { duration: EXIT_MS, easing: SWAP_EASE };
    scrim.value = withTiming(0, config);
    if (reduced) opacity.value = withTiming(0, config);
    else offset.value = withTiming(height, config);
    // A timer rather than the animation's callback: it also runs when Reanimated skips the motion.
    timer.current = setTimeout(onClose, EXIT_MS);
  }, [reduced, height, offset, opacity, scrim, onClose]);

  // --- Bars growing in view --------------------------------------------------------------------
  const [armed, setArmed] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const id = setTimeout(() => setArmed(true), BARS_ARM_MS);
    return () => clearTimeout(id);
  }, [reduced]);
  const [viewport, setViewport] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [restY, setRestY] = useState<number | null>(null);
  const [sectionY, setSectionY] = useState<{ categories?: number; budgets?: number }>({});
  const inView = (y: number | undefined): boolean =>
    reduced ||
    (armed &&
      restY !== null &&
      y !== undefined &&
      viewport > 0 &&
      restY + y < scrollY + viewport * SEEN_FRACTION);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    setScrollY(event.nativeEvent.contentOffset.y);

  // --- Copy ------------------------------------------------------------------------------------
  const title = recapTitle(t, kind, recap.period.start, locale);
  const comparisons = [
    recap.previousNet === null
      ? null
      : t(`recap.previous_${kind}`, {
          amount: format(recap.previousNet, currency, locale, 'always'),
        }),
    recap.usualNet === null
      ? null
      : t('recap.usual', { amount: format(recap.usualNet, currency, locale, 'always') }),
  ].filter((part): part is string => part !== null);
  const topAmount = recap.categories[0]?.amount ?? 0;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.palette.scrim }, scrimStyle]}
      />
      <Animated.View
        accessibilityViewIsModal
        style={[
          {
            flex: 1,
            marginTop: insets.top + 8,
            backgroundColor: theme.palette.bg,
            borderTopLeftRadius: theme.radii.sheet,
            borderTopRightRadius: theme.radii.sheet,
            borderTopWidth: 1,
            borderColor: theme.palette.borderStrong,
            overflow: 'hidden',
          },
          sheetStyle,
        ]}
      >
        <View style={{ alignItems: 'center', paddingTop: 8 }}>
          <View
            style={{
              width: theme.layout.sheetHandleWidth,
              height: theme.layout.sheetHandleHeight,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.palette.borderStrong,
            }}
          />
        </View>

        <ScrollView
          onLayout={(event) => setViewport(event.nativeEvent.layout.height)}
          onScroll={onScroll}
          scrollEventThrottle={32}
          contentContainerStyle={{
            paddingHorizontal: theme.layout.screenPaddingX,
            paddingTop: 18,
            paddingBottom: 32,
          }}
        >
          <Animated.View entering={stepEntering(CHUNK.eyebrow)}>
            <Text size="caption" color="textFaint" tabular>
              {formatCycleRange(recap.period, locale)}
            </Text>
          </Animated.View>

          <View
            accessible
            accessibilityRole="header"
            accessibilityLabel={title}
            style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 6, marginTop: 4 }}
          >
            {title.split(' ').map((word, index) => (
              <Animated.View
                // biome-ignore lint/suspicious/noArrayIndexKey: positional by nature
                key={`${index}-${word}`}
                entering={stepEntering(CHUNK.title, index)}
              >
                <Text size="title" weight="semibold" tracking="tighter">
                  {word}
                </Text>
              </Animated.View>
            ))}
          </View>

          <Animated.View entering={stepEntering(CHUNK.hero)} style={{ marginTop: 18 }}>
            <Card>
              <Text size="footnote" color="textMuted">
                {t(`recap.net_${kind}`)}
              </Text>
              <HeroNet net={recap.net} currency={currency} locale={locale} />
              {comparisons.length === 0 ? null : (
                <Text size="caption" color="textMuted" tabular style={{ marginTop: 8 }}>
                  {comparisons.join(' · ')}
                </Text>
              )}
              <View
                style={{
                  flexDirection: 'row',
                  gap: 16,
                  marginTop: 16,
                  paddingTop: 16,
                  borderTopWidth: 1,
                  borderColor: theme.palette.border,
                }}
              >
                <Figure
                  label={t('recap.income')}
                  minor={recap.income}
                  delta={
                    recap.incomeDelta === null
                      ? null
                      : t(`recap.delta_${kind}`, { pct: formatSignedPercent(recap.incomeDelta) })
                  }
                  currency={currency}
                  locale={locale}
                  positive
                />
                <Figure
                  label={t('recap.expenses')}
                  minor={recap.spent}
                  delta={
                    recap.spentDelta === null
                      ? null
                      : t(`recap.delta_${kind}`, { pct: formatSignedPercent(recap.spentDelta) })
                  }
                  currency={currency}
                  locale={locale}
                />
              </View>
            </Card>
          </Animated.View>

          <Animated.View
            entering={stepEntering(CHUNK.rest)}
            onLayout={(event) => setRestY(event.nativeEvent.layout.y)}
          >
            {recap.categories.length === 0 ? null : (
              <View
                style={{ marginTop: 28 }}
                onLayout={(event) => {
                  const y = event.nativeEvent.layout.y;
                  setSectionY((current) => ({ ...current, categories: y }));
                }}
              >
                <Text weight="medium" tracking="tight">
                  {t('recap.categories')}
                </Text>
                <View style={{ marginTop: 14, gap: 14 }}>
                  {recap.categories.map((row, index) => {
                    const found = byId.get(row.categoryId);
                    return (
                      <View key={row.categoryId}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: theme.radii.pill,
                              backgroundColor: theme.categoryColor(found?.colorIndex ?? 9),
                            }}
                          />
                          <Text size="footnote" numberOfLines={1} style={{ flexShrink: 1 }}>
                            {found?.name ?? t('recap.uncategorized')}
                          </Text>
                          {row.aboveUsual === null ? null : (
                            <View
                              style={{
                                paddingHorizontal: 7,
                                paddingVertical: 2,
                                borderRadius: theme.radii.pill,
                                backgroundColor: theme.palette.raised,
                                borderWidth: 1,
                                borderColor: theme.palette.border,
                              }}
                            >
                              <Text size="caption" tabular>
                                {t('recap.aboveUsual', {
                                  pct: formatSignedPercent(row.aboveUsual),
                                })}
                              </Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }} />
                          <AmountText
                            minor={row.amount}
                            currency={currency}
                            locale={locale}
                            size="footnote"
                            align="end"
                          />
                        </View>
                        <RecapBar
                          ratio={topAmount === 0 ? 0 : row.amount / topAmount}
                          accent={row.aboveUsual !== null}
                          seen={inView(sectionY.categories)}
                          index={index}
                        />
                      </View>
                    );
                  })}
                  {recap.otherCategories.count === 0 ? null : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text size="footnote" color="textFaint" style={{ flex: 1 }}>
                        {t('recap.otherCategories', { count: recap.otherCategories.count })}
                      </Text>
                      <AmountText
                        minor={recap.otherCategories.amount}
                        currency={currency}
                        locale={locale}
                        size="footnote"
                        color="textFaint"
                        align="end"
                      />
                    </View>
                  )}
                </View>
              </View>
            )}

            {recap.budgets.length === 0 ? null : (
              <View
                style={{ marginTop: 28 }}
                onLayout={(event) => {
                  const y = event.nativeEvent.layout.y;
                  setSectionY((current) => ({ ...current, budgets: y }));
                }}
              >
                <Text weight="medium" tracking="tight">
                  {t('recap.budgets')}
                </Text>
                <View style={{ marginTop: 14, gap: 14 }}>
                  {recap.budgets.map((row, index) => (
                    <View key={row.budgetId}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                        <Text size="footnote" numberOfLines={1} style={{ flex: 1 }}>
                          {row.name}
                        </Text>
                        <AmountText
                          minor={row.spent}
                          currency={currency}
                          locale={locale}
                          size="footnote"
                          color={row.over ? 'accent' : 'text'}
                          align="end"
                        />
                        <Text size="footnote" color="textFaint" tabular>
                          {t('recap.of', { amount: format(row.limit, currency, locale) })}
                        </Text>
                      </View>
                      <RecapBar
                        ratio={row.limit === 0 ? 0 : row.spent / row.limit}
                        accent={row.over}
                        seen={inView(sectionY.budgets)}
                        index={index}
                      />
                      <Text
                        size="caption"
                        color={row.over ? 'accent' : 'textMuted'}
                        weight={row.over ? 'medium' : 'regular'}
                        tabular
                        style={{ marginTop: 6 }}
                      >
                        {row.over
                          ? t('recap.over', {
                              amount: format(row.spent - row.limit, currency, locale),
                            })
                          : row.carry > 0
                            ? t('recap.withinCarry', {
                                amount: format(row.carry, currency, locale),
                              })
                            : t('recap.within')}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={{ marginTop: 28 }}>
              <Text weight="medium" tracking="tight">
                {t('recap.other')}
              </Text>
              {recap.biggestExpense === null ? null : (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    paddingVertical: 12,
                    gap: 12,
                  }}
                >
                  <Text size="footnote" color="textMuted" style={{ flex: 1 }}>
                    {t('recap.biggest')}
                  </Text>
                  <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
                    <Text size="footnote" numberOfLines={1}>
                      {recap.biggestExpense.description.trim() === ''
                        ? (byId.get(recap.biggestExpense.categoryId ?? '')?.name ??
                          t('recap.uncategorized'))
                        : recap.biggestExpense.description}
                    </Text>
                    <AmountText
                      minor={recap.biggestExpense.amount}
                      currency={currency}
                      locale={locale}
                      size="footnote"
                      align="end"
                      plain
                    />
                    <Text size="caption" color="textFaint">
                      {formatDayMonth(recap.biggestExpense.date, locale)}
                    </Text>
                  </View>
                </View>
              )}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  paddingVertical: 12,
                  borderTopWidth: recap.biggestExpense === null ? 0 : 1,
                  borderColor: theme.palette.border,
                }}
              >
                <Text size="footnote" color="textMuted" style={{ flex: 1 }}>
                  {t('recap.netWorth')}
                </Text>
                <AmountText
                  minor={recap.netWorthChange}
                  currency={currency}
                  locale={locale}
                  size="footnote"
                  signDisplay="always"
                  color={recap.netWorthChange >= 0 ? 'positive' : 'text'}
                  align="end"
                />
              </View>
            </View>
          </Animated.View>
        </ScrollView>

        <View
          style={{
            paddingHorizontal: theme.layout.screenPaddingX,
            paddingTop: 12,
            paddingBottom: insets.bottom + 16,
            borderTopWidth: 1,
            borderColor: theme.palette.border,
            backgroundColor: theme.palette.bg,
          }}
        >
          <PrimaryButton label={t(`recap.start_${kind}`)} onPress={dismiss} />
        </View>
      </Animated.View>
    </Modal>
  );
}

/**
 * The net, counting up from zero as its block lands (`countMs`). Read once as its final value: the
 * wrapper carries the label, so a screen reader never hears the count.
 */
function HeroNet({
  net,
  currency,
  locale,
}: {
  net: number;
  currency: CurrencyCode;
  locale: AppLocale;
}) {
  const { reduced } = useMotion();
  const { hidden } = useHiddenAmounts();
  const { format } = useHiddenMoney();
  const [target, setTarget] = useState(reduced ? net : 0);
  useEffect(() => {
    if (reduced) {
      setTarget(net);
      return;
    }
    const id = setTimeout(() => setTarget(net), stepDelay(CHUNK.hero));
    return () => clearTimeout(id);
  }, [net, reduced]);
  const shown = useCountUp(target, !hidden);
  return (
    <View
      accessible
      accessibilityLabel={format(net, currency, locale, 'always')}
      style={{ marginTop: 6 }}
    >
      <AmountText
        minor={hidden ? net : shown}
        currency={currency}
        locale={locale}
        size="display"
        weight="semibold"
        tracking="tighter"
        signDisplay="always"
        color={net >= 0 ? 'positive' : 'text'}
      />
    </View>
  );
}

function Figure({
  label,
  minor,
  delta,
  currency,
  locale,
  positive = false,
}: {
  label: string;
  minor: number;
  delta: string | null;
  currency: CurrencyCode;
  locale: AppLocale;
  positive?: boolean;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text size="caption" color="textFaint">
        {label}
      </Text>
      <AmountText
        minor={minor}
        currency={currency}
        locale={locale}
        color={positive ? 'positive' : 'text'}
        style={{ marginTop: 3 }}
      />
      {delta === null ? null : (
        <Text size="caption" color="textMuted" tabular style={{ marginTop: 3 }}>
          {delta}
        </Text>
      )}
    </View>
  );
}
