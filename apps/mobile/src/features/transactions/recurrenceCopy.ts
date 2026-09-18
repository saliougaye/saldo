import { type LocalDate, parseLocalDate, type RecurrenceRule } from '@saldo/core';
import { type AppLocale, formatDayMonth, formatDayMonthLong, formatWeekday } from '@saldo/i18n';
import type { TFunction } from 'i18next';

/** "Ogni 2 settimane, il venerdì": the cadence plus what `startDate` anchors it to (§5.9). */
export function cadenceLabel(
  rule: Pick<RecurrenceRule, 'frequency' | 'interval'>,
  startDate: LocalDate,
  t: TFunction,
  locale: AppLocale,
): string {
  const every = t(`recurrence.every_${rule.frequency}`, { count: rule.interval });
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
export function endLabel(endDate: LocalDate | null, t: TFunction, locale: AppLocale): string {
  return endDate === null
    ? t('recurrence.noEnd')
    : t('recurrence.untilDate', { date: formatDayMonth(endDate, locale) });
}

/** The rows of the sheet and the chips of the form. `custom` is anything the presets do not name. */
export type RecurrencePreset = 'never' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom';

const PRESET_RULES: Record<
  Exclude<RecurrencePreset, 'never' | 'custom'>,
  Pick<RecurrenceRule, 'frequency' | 'interval'>
> = {
  weekly: { frequency: 'weekly', interval: 1 },
  biweekly: { frequency: 'weekly', interval: 2 },
  monthly: { frequency: 'monthly', interval: 1 },
  yearly: { frequency: 'yearly', interval: 1 },
};

const PRESET_NAMES = Object.keys(PRESET_RULES) as Exclude<RecurrencePreset, 'never' | 'custom'>[];

export function presetOf(rule: RecurrenceRule | null): RecurrencePreset {
  if (rule === null) return 'never';
  for (const preset of PRESET_NAMES) {
    const candidate = PRESET_RULES[preset];
    if (candidate.frequency === rule.frequency && candidate.interval === rule.interval) {
      return preset;
    }
  }
  return 'custom';
}

/** `custom` is not a rule by itself; callers keep the rule they have and open the custom block. */
export function ruleForPreset(
  preset: Exclude<RecurrencePreset, 'custom'>,
  endDate: LocalDate | null,
): RecurrenceRule | null {
  if (preset === 'never') return null;
  return { ...PRESET_RULES[preset], endDate };
}
