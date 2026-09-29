import type { LocalDate, RecurrenceRule } from '@saldo/core';

// `cadenceLabel` and `endLabel` live in `@saldo/i18n`, where the web's transaction panel reads them too.

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
