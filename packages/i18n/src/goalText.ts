import {
  type Account,
  type GoalProgress,
  goalAdvice,
  type LocalDate,
  type PeriodKind,
  parseLocalDate,
} from '@saldo/core';
import { type AppLocale, formatDayMonth, formatMonthYear } from './format';
import { plural, type Translate, type TranslationVars } from './translate';

/** «15 ott» this year, «giugno 2027» after. */
export function deadlineLabel(date: LocalDate, today: LocalDate, locale: AppLocale): string {
  const { year, month } = parseLocalDate(date);
  return year === parseLocalDate(today).year
    ? formatDayMonth(date, locale)
    : formatMonthYear({ year, month }, locale);
}

/**
 * What the goal strings read from their surroundings, injected so the phone (i18next's `t`, the
 * synced settings, the period provider) and the web (`makeTranslator`, the page's context) can
 * both supply it.
 */
export interface GoalTextDeps {
  t: Translate;
  locale: AppLocale;
  money: (minor: number) => string;
  today: LocalDate;
  periodKind: PeriodKind;
}

/** The part of a `GoalView` the strings read; a `GoalView` is one. */
export interface GoalTextSubject {
  account: Pick<Account, 'name' | 'goalDeadline' | 'goalStartDate'>;
  progress: GoalProgress;
}

/**
 * A string with `<b>` markup, not yet translated. The phone hands it to `<Trans>` — which
 * resolves the plural itself from `count` and turns `<b>` into a component — and the web to
 * `richText`. Translating it here would leave the phone to parse markup `<Trans>` already parses.
 */
export interface RichMessage {
  key: string;
  vars: TranslationVars;
  /** Set on a counted string; the key is then the one without `_one`/`_other`. */
  count?: number;
}

/** A `RichMessage` as the string it reads, `<b>` still in it. */
export function richText(message: RichMessage, t: Translate, locale: AppLocale): string {
  return message.count === undefined
    ? t(message.key, message.vars)
    : plural(t, locale, message.key, message.count, message.vars);
}

/** Beside the percentage on a row (§5.14). */
export function goalStatus(goal: GoalTextSubject, { t, money }: GoalTextDeps): string {
  const { state, gap, missing } = goal.progress;
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
}

/** Beside the name: short on the featured block, full on a row. */
export function goalMeta(goal: GoalTextSubject, deps: GoalTextDeps, short = false): string {
  const { t, locale, today } = deps;
  const { state, reachedOn } = goal.progress;
  const deadline = goal.account.goalDeadline ?? null;
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
}

/** The labels of the bar's two ends; no end label without a deadline. */
export function goalEnds(
  goal: GoalTextSubject,
  { locale, today }: GoalTextDeps,
): { start: string; end: string } {
  const start = goal.account.goalStartDate ?? today;
  const deadline = goal.account.goalDeadline ?? null;
  return {
    start: deadlineLabel(start, today, locale),
    end: deadline === null ? '' : deadlineLabel(deadline, today, locale),
  };
}

/** «di 1.000,00 € · 40%». */
export function goalOf(goal: GoalTextSubject, { t, money }: GoalTextDeps): string {
  return t('targets.ofLimit', {
    amount: money(goal.progress.target),
    percent: t('targets.percent', { value: Math.round(goal.progress.ratio * 100) }),
  });
}

/** The whole item, for a screen reader. */
export function goalLabel(goal: GoalTextSubject, deps: GoalTextDeps): string {
  return deps.t('goals.itemLabel', {
    name: goal.account.name,
    amount: deps.money(goal.progress.saved),
    target: deps.money(goal.progress.target),
    status: goalStatus(goal, deps),
  });
}

/** The featured goal's sentence (§5.13): an action with its figure in bold, then a muted state. */
export interface GoalSentence {
  action: RichMessage;
  state: string | null;
}

export function goalSentence(goal: GoalTextSubject, deps: GoalTextDeps): GoalSentence {
  const { t, locale, money, today, periodKind } = deps;
  const advice = goalAdvice(goal.progress);
  switch (advice.kind) {
    case 'perPeriod':
      return {
        action: { key: `goals.perPeriod_${periodKind}`, vars: { amount: money(advice.perPeriod) } },
        state: t(advice.behind ? 'goals.stateBehind' : 'goals.stateAhead', {
          amount: money(advice.gap),
        }),
      };
    case 'lastPeriod':
      return {
        action: {
          key: 'goals.lastPeriod',
          vars: { amount: money(advice.missing), count: advice.days },
          count: advice.days,
        },
        state: null,
      };
    case 'noDeadline':
      return {
        action: { key: 'goals.missingSentence', vars: { amount: money(advice.missing) } },
        state: null,
      };
    case 'expired':
      return {
        action: {
          key: 'goals.expiredSentence',
          vars: {
            amount: money(advice.missing),
            date: formatDayMonth(goal.account.goalDeadline ?? today, locale),
          },
        },
        state: t('goals.expiredState'),
      };
    case 'reached':
      return {
        action: { key: 'goals.reachedSentence', vars: { amount: money(advice.target) } },
        state: t('goals.reachedState'),
      };
  }
}
