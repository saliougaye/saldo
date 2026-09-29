import { type GoalView, goalPace, goalTone } from '@saldo/core';
import {
  formatMoney,
  type GoalTextDeps,
  goalEnds,
  goalLabel,
  goalMeta,
  goalOf,
  goalSentence,
  goalStatus,
} from '@saldo/i18n';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { TargetTone } from '../../components/TargetRing';
import { useSettings } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';
import { usePeriod } from '../period/PeriodProvider';

const BOLD = { b: <Text weight="medium" /> };

/**
 * Every string a goal renders (§5.14), in one place: the Home card, the list and the detail read
 * the same status, meta and sentence. The strings themselves are `@saldo/i18n`'s — the web's Home
 * calls the same functions — and this binds them to i18next, the settings and the period.
 */
export function useGoalText() {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const { today } = usePeriod();
  const currency = settings?.currency ?? 'EUR';
  const money = (minor: number) => formatMoney(minor, currency, locale);
  const deps: GoalTextDeps = {
    t,
    locale,
    money,
    today,
    periodKind: settings?.periodKind ?? 'month',
  };

  const sentence = (view: GoalView): ReactNode => {
    const { action, state } = goalSentence(view, deps);
    const bold = (
      <Trans
        t={t}
        i18nKey={action.key}
        values={action.vars}
        count={action.count}
        components={BOLD}
      />
    );
    if (state === null) return bold;
    return (
      <>
        {bold} <Text color="textMuted">{state}</Text>
      </>
    );
  };

  return {
    t,
    locale,
    currency,
    money,
    tone: (view: GoalView): TargetTone => goalTone(view.progress),
    status: (view: GoalView) => goalStatus(view, deps),
    meta: (view: GoalView, short = false) => goalMeta(view, deps, short),
    pace: (view: GoalView) => goalPace(view.progress),
    ends: (view: GoalView) => goalEnds(view, deps),
    of: (view: GoalView) => goalOf(view, deps),
    label: (view: GoalView) => goalLabel(view, deps),
    sentence,
  };
}
