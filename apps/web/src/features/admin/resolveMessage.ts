import {
  type AppLocale,
  formatDayMonth,
  formatLongDate,
  localDateOf,
  wallClock,
} from '@saldo/i18n';
import { plural, type Translate, type TranslationVars } from '@saldo/i18n/translate';
import type { AdminMessage } from './message';

export interface InstantFormat {
  timeZone: string;
  locale: AppLocale;
  now: Date;
  /**
   * `long` is «25 settembre 2026». `short` is «25 set» for a day of this year — a list row has little
   * room — and the long form otherwise, so an old invite never reads as this year's.
   */
  style: 'long' | 'short';
}

/**
 * An ISO instant as a date in the admin's zone and language. The instant becomes a `LocalDate` first
 * (`wallClock`, as the server derives «today») and the formatters take it from there: no
 * `new Date(localDate)`, no `toLocaleDateString`. Something that is not an instant comes back as it was.
 */
export function instantFormatter(format: InstantFormat): (iso: string) => string {
  const at = (instant: Date) =>
    wallClock(format.timeZone, instant) ?? wallClock('UTC', instant) ?? null;
  const thisYear = at(format.now)?.year;
  return (iso) => {
    const instant = new Date(iso);
    if (Number.isNaN(instant.getTime())) return iso;
    const clock = at(instant);
    if (clock === null) return iso;
    const day = localDateOf(clock);
    return format.style === 'short' && clock.year === thisYear
      ? formatDayMonth(day, format.locale)
      : formatLongDate(day, format.locale);
  };
}

/** A view's `AdminMessage` as the sentence to render (see `message.ts`). */
export function resolveMessage(
  message: AdminMessage,
  deps: { t: Translate; locale: AppLocale; formatDate: (iso: string) => string },
): string {
  if ('text' in message) return message.text;
  const vars: TranslationVars = { ...message.vars };
  for (const name of message.dateVars ?? []) {
    const raw = vars[name];
    if (typeof raw === 'string') vars[name] = deps.formatDate(raw);
  }
  return message.count === undefined
    ? deps.t(message.key, vars)
    : plural(deps.t, deps.locale, message.key, message.count, vars);
}
