'use client';

import { type LocalDate, type PeriodKind, periodContaining } from '@saldo/core';
import { type AppLocale, formatCycleRange } from '@saldo/i18n/format';
import { interpolate } from '@saldo/i18n/translate';
import { Alert } from '../../../../src/ui/Alert';
import { OptionList, useRovingFocus } from '../../../../src/ui/OptionList';
import { rovingTabStop } from '../../../../src/ui/rovingRadios';
import styles from './preferences.module.css';
import { useSaveSetting } from './useSaveSetting';

/** §5.2: 1–28, a day every month has, as four weeks of seven. */
const DAYS = Array.from({ length: 28 }, (_, index) => index + 1);

interface Props {
  kind: PeriodKind;
  day: number;
  locale: AppLocale;
  /** The server's «today», for the preview. */
  today: LocalDate;
  /** The four kinds, each with the sentence that says what it covers. */
  options: readonly { value: PeriodKind; label: string; subtitle: string }[];
  strings: {
    title: string;
    note: string;
    /** `profile.periodPreview`, the label over the range. */
    preview: string;
    /** `profile.cycleDay`, with `{{day}}`: a key's name for a screen reader. */
    day: string;
    /** `period.cycleStartDay`: the name of the grid of days. */
    dayGroup: string;
  };
}

/**
 * §6.8 «Periodo», as the phone draws it: the four kinds, the period the choice produces today —
 * «27 ago – 26 set» says what the whole app will show — and, under the pay cycle only, the grid of
 * days. A kind and a day are two settings, each saved as it is chosen.
 */
export function PeriodPanel({ kind, day, locale, today, options, strings }: Props) {
  const kindSetting = useSaveSetting(kind);
  const daySetting = useSaveSetting(day);
  const roving = useRovingFocus(DAYS.length);
  const stop = rovingTabStop(DAYS.indexOf(daySetting.shown), DAYS.length);
  const error = kindSetting.error ?? daySetting.error;
  const preview = periodContaining({ kind: kindSetting.shown, startDay: daySetting.shown }, today);
  return (
    <>
      <p className={styles.note}>{strings.note}</p>
      {error === null ? null : <Alert body={error} />}
      <OptionList
        label={strings.title}
        groups={[{ options }]}
        selected={kindSetting.shown}
        onSelect={(next) => {
          if (next !== kindSetting.shown)
            kindSetting.save({ key: 'periodKind', value: next }, next);
        }}
      />
      <div className={styles.preview}>
        <span className={styles.previewLabel}>{strings.preview}</span>
        <span className={styles.previewRange}>{formatCycleRange(preview, locale, today)}</span>
      </div>
      {kindSetting.shown === 'cycle' ? (
        <div className={styles.dayGrid} role="radiogroup" aria-label={strings.dayGroup}>
          {DAYS.map((value, index) => (
            // biome-ignore lint/a11y/useSemanticElements: a day is drawn as a key; the radio role keeps the grid's one tab stop.
            <button
              key={value}
              ref={roving.ref(index)}
              type="button"
              role="radio"
              aria-checked={value === daySetting.shown}
              aria-label={interpolate(strings.day, { day: value })}
              tabIndex={index === stop ? 0 : -1}
              className={styles.day}
              onClick={() => {
                if (value !== daySetting.shown) {
                  daySetting.save({ key: 'cycleStartDay', value }, value);
                }
              }}
              onKeyDown={(event) => roving.onKeyDown(event, index)}
            >
              {value}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
