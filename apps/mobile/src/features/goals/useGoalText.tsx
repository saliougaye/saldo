import { type GoalView, goalAdvice, type LocalDate, parseLocalDate } from '@saldo/core';
import { type AppLocale, formatDayMonth, formatMoney, formatMonthYear } from '@saldo/i18n';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { TargetTone } from '../../components/TargetRing';
import { useSettings } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';
import { usePeriod } from '../period/PeriodProvider';

const BOLD = { b: <Text weight="medium" /> };

/** «15 ott» this year, «giugno 2027» after. */
export function deadlineLabel(date: LocalDate, today: LocalDate, locale: AppLocale): string {
  const { year, month } = parseLocalDate(date);
  return year === parseLocalDate(today).year
    ? formatDayMonth(date, locale)
    : formatMonthYear({ year, month }, locale);
}

/**
 * Every string a goal renders (§5.14), in one place: the Home card, the list and the detail read
 * the same status, meta and sentence.
 */
export function useGoalText() {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const { today } = usePeriod();
  const currency = settings?.currency ?? 'EUR';
  const kind = settings?.periodKind ?? 'month';
  const money = (minor: number) => formatMoney(minor, currency, locale);

  const tone = (view: GoalView): TargetTone => {
    const { state } = view.progress;
    if (state === 'reached') return 'done';
    return state === 'expired' || state === 'behind' ? 'attention' : 'plain';
  };

  const status = (view: GoalView): string => {
    const { state, gap, missing } = view.progress;
    switch (state) {
      case 'reached':
        return t('goals.statusReached');
      case 'expired':
        return t('goals.statusExpired');
      case 'behind':
        return t('goals.statusBehind', { amount: money(-(gap ?? 0)) });
      case 'onTrack':
        return t('goals.statusAhead', { amount: money(gap ?? 0) });
      case 'open':
        return t('goals.statusMissing', { amount: money(missing) });
    }
  };

  /** Beside the name: short on the featured block, full on a row. */
  const meta = (view: GoalView, short = false): string => {
    const { state, reachedOn } = view.progress;
    const deadline = view.account.goalDeadline ?? null;
    if (state === 'reached') {
      return short || reachedOn === null
        ? t('goals.toClose')
        : t('goals.reachedOnMeta', { date: formatDayMonth(reachedOn, locale) });
    }
    if (state === 'expired' && deadline !== null) {
      return short
        ? t('goals.expiredMeta')
        : t('goals.expiredOnMeta', { date: formatDayMonth(deadline, locale) });
    }
    return deadline === null
      ? t('goals.noDeadline')
      : t('goals.by', { date: deadlineLabel(deadline, today, locale) });
  };

  /** The tick, «oggi» included; none once the goal is reached or expired. */
  const pace = (view: GoalView): number | null => {
    const { state, pace: value } = view.progress;
    return state === 'reached' || state === 'expired' ? null : value;
  };

  const ends = (view: GoalView) => {
    const start = view.account.goalStartDate ?? today;
    const deadline = view.account.goalDeadline ?? null;
    return {
      start: deadlineLabel(start, today, locale),
      end: deadline === null ? '' : deadlineLabel(deadline, today, locale),
    };
  };

  const of = (view: GoalView) =>
    t('targets.ofLimit', {
      amount: money(view.progress.target),
      percent: t('targets.percent', { value: Math.round(view.progress.ratio * 100) }),
    });

  const label = (view: GoalView) =>
    t('goals.itemLabel', {
      name: view.account.name,
      amount: money(view.progress.saved),
      target: money(view.progress.target),
      status: status(view),
    });

  const sentence = (view: GoalView): ReactNode => {
    const advice = goalAdvice(view.progress);
    switch (advice.kind) {
      case 'perPeriod':
        return (
          <>
            <Trans
              t={t}
              i18nKey={`goals.perPeriod_${kind}`}
              values={{ amount: money(advice.perPeriod) }}
              components={BOLD}
            />{' '}
            <Text color="textMuted">
              {t(advice.behind ? 'goals.stateBehind' : 'goals.stateAhead', {
                amount: money(advice.gap),
              })}
            </Text>
          </>
        );
      case 'lastPeriod':
        return (
          <Trans
            t={t}
            i18nKey="goals.lastPeriod"
            count={advice.days}
            values={{ amount: money(advice.missing), count: advice.days }}
            components={BOLD}
          />
        );
      case 'noDeadline':
        return (
          <Trans
            t={t}
            i18nKey="goals.missingSentence"
            values={{ amount: money(advice.missing) }}
            components={BOLD}
          />
        );
      case 'expired':
        return (
          <>
            <Trans
              t={t}
              i18nKey="goals.expiredSentence"
              values={{
                amount: money(advice.missing),
                date: formatDayMonth(view.account.goalDeadline ?? today, locale),
              }}
              components={BOLD}
            />{' '}
            <Text color="textMuted">{t('goals.expiredState')}</Text>
          </>
        );
      case 'reached':
        return (
          <>
            <Trans
              t={t}
              i18nKey="goals.reachedSentence"
              values={{ amount: money(advice.target) }}
              components={BOLD}
            />{' '}
            <Text color="textMuted">{t('goals.reachedState')}</Text>
          </>
        );
    }
  };

  return { t, locale, currency, money, tone, status, meta, pace, ends, of, label, sentence };
}
