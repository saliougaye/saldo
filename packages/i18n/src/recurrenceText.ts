import { type LocalDate, parseLocalDate, type RecurrenceRule } from '@saldo/core';
import { type AppLocale, formatDayMonth, formatDayMonthLong, formatWeekday } from './format';
import { plural, type Translate } from './translate';

/**
 * "Ogni 2 settimane, il venerdì": the cadence plus what `startDate` anchors it to (§5.9). Here
 * rather than on the phone so the web's transaction panel says it in the same words; the plural
 * goes through `plural`, which i18next's `t` and `makeTranslator` both sit under.
 */
export function cadenceLabel(
  rule: Pick<RecurrenceRule, 'frequency' | 'interval'>,
  startDate: LocalDate,
  t: Translate,
  locale: AppLocale,
): string {
  const every = plural(t, locale, `recurrence.every_${rule.frequency}`, rule.interval);
  switch (rule.frequency) {
    case 'monthly':
      return `${every}, ${t('recurrence.onDayOfMonth', { day: parseLocalDate(startDate).day })}`;
    case 'weekly':
      return `${every}, ${t('recurrence.onWeekday', { weekday: formatWeekday(startDate, locale) })}`;
    case 'yearly':
      return `${every}, ${t('recurrence.onDate', { date: formatDayMonthLong(startDate, locale) })}`;
    case 'daily':
      return every;
  }
}

/** "senza fine" / "fino al 18 dic". */
export function endLabel(endDate: LocalDate | null, t: Translate, locale: AppLocale): string {
  return endDate === null
    ? t('recurrence.noEnd')
    : t('recurrence.untilDate', { date: formatDayMonth(endDate, locale) });
}
