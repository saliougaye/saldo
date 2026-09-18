import {
  type CurrencyCode,
  type DateRange,
  type FirstWeekday,
  getCurrency,
  type LocalDate,
  type PeriodKind,
  parseLocalDate,
  weekdayOf,
  type YearMonth,
} from '@saldo/core';

export const SUPPORTED_LOCALES = ['it', 'en'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export type LanguagePreference = 'system' | AppLocale;

const MINUS = '\u2212';
const EN_DASH = '\u2013';

const SEPARATORS: Record<AppLocale, { group: string; decimal: string }> = {
  it: { group: '.', decimal: ',' },
  en: { group: ',', decimal: '.' },
};

const MONTHS_SHORT: Record<AppLocale, readonly string[]> = {
  it: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

const MONTHS_LONG: Record<AppLocale, readonly string[]> = {
  it: [
    'gennaio',
    'febbraio',
    'marzo',
    'aprile',
    'maggio',
    'giugno',
    'luglio',
    'agosto',
    'settembre',
    'ottobre',
    'novembre',
    'dicembre',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
};

export function resolveLocale(
  preference: LanguagePreference,
  deviceLanguages: readonly string[],
): AppLocale {
  if (preference !== 'system') return preference;
  return deviceLanguages[0]?.toLowerCase().startsWith('it') ? 'it' : 'en';
}

export type SignDisplay = 'negative' | 'always' | 'never';

export interface MoneyParts {
  sign: '' | '+' | typeof MINUS;
  integer: string;
  decimalSeparator: string;
  /** Empty for currencies without a minor unit (JPY, ISK); callers must then skip the separator. */
  fraction: string;
  symbol: string;
  symbolPosition: 'prefix' | 'suffix';
}

/** Splits an amount for rendering; the design shows the fraction and symbol at 50% opacity. */
export function formatMoneyParts(
  minor: number,
  currency: CurrencyCode,
  locale: AppLocale,
  signDisplay: SignDisplay = 'negative',
): MoneyParts {
  const abs = Math.abs(Math.round(minor));
  const { minorDigits } = getCurrency(currency);
  const scale = 10 ** minorDigits;
  const { group, decimal } = SEPARATORS[locale];
  let sign: MoneyParts['sign'] = '';
  if (signDisplay !== 'never' && minor < 0) sign = MINUS;
  if (signDisplay === 'always' && minor > 0) sign = '+';
  return {
    sign,
    integer: String(Math.floor(abs / scale)).replace(/\B(?=(\d{3})+(?!\d))/g, group),
    decimalSeparator: decimal,
    fraction: minorDigits === 0 ? '' : String(abs % scale).padStart(minorDigits, '0'),
    symbol: getCurrency(currency).symbol,
    symbolPosition: locale === 'it' ? 'suffix' : 'prefix',
  };
}

export function formatMoney(
  minor: number,
  currency: CurrencyCode,
  locale: AppLocale,
  signDisplay: SignDisplay = 'negative',
): string {
  const parts = formatMoneyParts(minor, currency, locale, signDisplay);
  const number =
    parts.fraction === ''
      ? parts.integer
      : `${parts.integer}${parts.decimalSeparator}${parts.fraction}`;
  if (parts.symbolPosition === 'suffix') return `${parts.sign}${number} ${parts.symbol}`;
  const gap = parts.symbol.length > 1 ? ' ' : '';
  return `${parts.sign}${parts.symbol}${gap}${number}`;
}

function monthName(
  table: Record<AppLocale, readonly string[]>,
  locale: AppLocale,
  month: number,
): string {
  return table[locale][month - 1] ?? '';
}

/** it `18 apr`, en `Apr 18` */
export function formatDayMonth(date: LocalDate, locale: AppLocale): string {
  const { month, day } = parseLocalDate(date);
  const name = monthName(MONTHS_SHORT, locale, month);
  return locale === 'it' ? `${day} ${name}` : `${name} ${day}`;
}

/** it `18 aprile 2026`, en `April 18, 2026` */
export function formatLongDate(date: LocalDate, locale: AppLocale): string {
  const { year, month, day } = parseLocalDate(date);
  const name = monthName(MONTHS_LONG, locale, month);
  return locale === 'it' ? `${day} ${name} ${year}` : `${name} ${day}, ${year}`;
}

/** it `venerdì`, en `Friday`. Monday-first, as `weekdayOf` counts. */
export function formatWeekday(date: LocalDate, locale: AppLocale): string {
  return WEEKDAYS_LONG[locale][weekdayOf(date)] ?? '';
}

/** it `18 settembre`, en `September 18`: a yearly anchor, whose year is the point of leaving out. */
export function formatDayMonthLong(date: LocalDate, locale: AppLocale): string {
  const { month, day } = parseLocalDate(date);
  const name = monthName(MONTHS_LONG, locale, month);
  return locale === 'it' ? `${day} ${name}` : `${name} ${day}`;
}

/** it `18 apr 2025`, en `Apr 18, 2025` */
function formatDayMonthYear(date: LocalDate, locale: AppLocale): string {
  const { year } = parseLocalDate(date);
  const dayMonth = formatDayMonth(date, locale);
  return locale === 'it' ? `${dayMonth} ${year}` : `${dayMonth}, ${year}`;
}

/**
 * it `27 mar – 26 apr`, en `Mar 27 – Apr 26`, with the year named on any end that does not fall in
 * `today`'s year: `27 dic 2025 – 26 gen`, `27 mar – 26 apr 2025`.
 *
 * Without the year the period list of §6.15 is ambiguous — two consecutive Decembers produce the
 * same label — and so is a range that crosses New Year. A range that lies wholly in one other year
 * names it once, at the end, rather than twice.
 *
 * `today` is optional because some labels have no reference date to speak of; the start year is
 * then the reference, so only a crossing into another year is named.
 */
export function formatCycleRange(range: DateRange, locale: AppLocale, today?: LocalDate): string {
  const startYear = parseLocalDate(range.start).year;
  const endYear = parseLocalDate(range.end).year;
  const reference = today === undefined ? startYear : parseLocalDate(today).year;
  const bothOutside = startYear !== reference && endYear !== reference;
  const withYear = (date: LocalDate) => formatDayMonthYear(date, locale);
  const plain = (date: LocalDate) => formatDayMonth(date, locale);
  // One year for the whole range reads better than the same year twice.
  const startFormat = startYear !== reference && !(bothOutside && startYear === endYear);
  const endFormat = endYear !== reference;
  const start = startFormat ? withYear(range.start) : plain(range.start);
  const end = endFormat ? withYear(range.end) : plain(range.end);
  return `${start} ${EN_DASH} ${end}`;
}

/**
 * The label under a chart column (§5.7): an 11px slot, so it carries only what tells one period
 * apart from its neighbours. A year is named by its number — six columns each reading `1 gen`
 * would be six identical labels — and a month by its name, the first of the month being noise.
 */
export function formatPeriodTick(start: LocalDate, kind: PeriodKind, locale: AppLocale): string {
  const { year, month } = parseLocalDate(start);
  if (kind === 'year') return String(year);
  if (kind === 'month') return monthName(MONTHS_SHORT, locale, month);
  return formatDayMonth(start, locale);
}

/** `+12%`, `−7%`, `0%` */
export function formatSignedPercent(value: number): string {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${rounded}%`;
  if (rounded < 0) return `${MINUS}${Math.abs(rounded)}%`;
  return '0%';
}

/**
 * `+325`, `\u2212193`, `0`: rounded to whole major units, no currency symbol. The column labels of
 * §5.7 are 11px slots that must fit six of them side by side, so they drop the fraction and the
 * symbol and keep only the magnitude. `signDisplay: 'never'` gives the unsigned variant the
 * category history uses.
 */
export function formatMajor(
  minor: number,
  currency: CurrencyCode,
  locale: AppLocale,
  signDisplay: SignDisplay = 'always',
): string {
  const { minorDigits } = getCurrency(currency);
  const units = Math.round(minor / 10 ** minorDigits);
  const digits = String(Math.abs(units)).replace(/\B(?=(\d{3})+(?!\d))/g, SEPARATORS[locale].group);
  if (signDisplay === 'never') return digits;
  if (units > 0) return signDisplay === 'always' ? `+${digits}` : digits;
  if (units < 0) return `${MINUS}${digits}`;
  return '0';
}

/** Monday-first, because that is the order `weekdayOf` counts in; the reorder happens below. */
const WEEKDAYS_SHORT: Record<AppLocale, readonly string[]> = {
  it: ['L', 'M', 'M', 'G', 'V', 'S', 'D'],
  en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
};

const WEEKDAYS_LONG: Record<AppLocale, readonly string[]> = {
  it: ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};

/**
 * Where the week starts for a locale. Italian calendars start on Monday, English-language ones on
 * Sunday; this is a **display** choice and never moves the ISO week the period logic uses (§5.2).
 */
export function firstWeekdayFor(locale: AppLocale): FirstWeekday {
  return locale === 'it' ? 'monday' : 'sunday';
}

/** The seven column headings of a calendar, already in the order that calendar draws them. */
export function weekdayLabels(locale: AppLocale, firstWeekday: FirstWeekday): readonly string[] {
  const names = WEEKDAYS_SHORT[locale];
  if (firstWeekday === 'monday') return names;
  const sunday = names[6] ?? '';
  return [sunday, ...names.slice(0, 6)];
}

/** it `aprile 2026`, en `April 2026`: the title over a month grid. */
export function formatMonthYear(ym: YearMonth, locale: AppLocale): string {
  return `${monthName(MONTHS_LONG, locale, ym.month)} ${ym.year}`;
}
