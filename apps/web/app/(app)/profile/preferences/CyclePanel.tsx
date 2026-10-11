'use client';

import { type LocalDate, periodContaining } from '@saldo/core';
import { type AppLocale, formatCycleRange } from '@saldo/i18n/format';
import { interpolate } from '@saldo/i18n/translate';
import { Alert } from '../../../../src/ui/Alert';
import { useRovingFocus } from '../../../../src/ui/OptionList';
import { rovingTabStop } from '../../../../src/ui/rovingRadios';
import styles from './preferences.module.css';
import { useSaveSetting } from './useSaveSetting';

/** §5.2: 1–28, a day every month has, as four weeks of seven. */
const DAYS = Array.from({ length: 28 }, (_, index) => index + 1);

interface Props {
  value: number;
  locale: AppLocale;
  /** The server's «today», for the preview. */
  today: LocalDate;
  strings: {
    title: string;
    note: string;
    /** `profile.cyclePreview`, the label over the range. */
    preview: string;
    /** `profile.cycleDay`, with `{{day}}`: a key's name for a screen reader. */
    day: string;
  };
}

/**
 * §6.8 «Inizio del ciclo», as the phone draws it: the cycle the chosen day produces — «27 ago –
 * 26 set» says what the whole app will show, the number alone says nothing — over the grid of days.
 */
export function CyclePanel({ value, locale, today, strings }: Props) {
  const { shown, error, save } = useSaveSetting(value);
  const roving = useRovingFocus(DAYS.length);
  const stop = rovingTabStop(DAYS.indexOf(shown), DAYS.length);
  const preview = periodContaining({ kind: 'cycle', startDay: shown }, today);
  return (
    <>
      <p className={styles.note}>{strings.note}</p>
      <div className={styles.preview}>
        <span className={styles.previewLabel}>{strings.preview}</span>
        <span className={styles.previewRange}>{formatCycleRange(preview, locale, today)}</span>
      </div>
      {error === null ? null : <Alert body={error} />}
      <div className={styles.dayGrid} role="radiogroup" aria-label={strings.title}>
        {DAYS.map((day, index) => (
          // biome-ignore lint/a11y/useSemanticElements: a day is drawn as a key; the radio role keeps the grid's one tab stop.
          <button
            key={day}
            ref={roving.ref(index)}
            type="button"
            role="radio"
            aria-checked={day === shown}
            aria-label={interpolate(strings.day, { day })}
            tabIndex={index === stop ? 0 : -1}
            className={styles.day}
            onClick={() => {
              if (day !== shown) save({ key: 'cycleStartDay', value: day }, day);
            }}
            onKeyDown={(event) => roving.onKeyDown(event, index)}
          >
            {day}
          </button>
        ))}
      </div>
    </>
  );
}
