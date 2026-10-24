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

export const SUPPORTED_LOCALES = ['it', 'en', 'fr', 'de', 'sv', 'es', 'pt'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export type LanguagePreference = 'system' | AppLocale;

const MINUS = '−';
const EN_DASH = '–';
const NBSP = ' ';
const NARROW_NBSP = ' ';

/**
 * Everything a locale formats differently, written out by hand rather than asked of `Intl`, so it
 * reads the same on every phone. The values are CLDR's, checked against Node's ICU.
 */
interface Conventions {
  group: string;
  decimal: string;
  /** CLDR `minimumGroupingDigits`: at 2, a four-digit integer stays ungrouped (es `1234`, `12.345`). */
  minimumGroupingDigits: 1 | 2;
  symbolPosition: 'prefix' | 'suffix';
  /** A **display** choice: it never moves the ISO week the period logic uses (§5.2). */
  firstWeekday: FirstWeekday;
  /** Format-context abbreviations, the ones that follow a day number. */
  monthsShort: readonly string[];
  /** Stand-alone abbreviations for a month shown alone, where CLDR's differ (de `Mär`, not `März`). */
  monthsTick?: readonly string[];
  monthsLong: readonly string[];
  /** Monday-first, because that is the order `weekdayOf` counts in; `weekdayLabels` reorders. */
  weekdaysShort: readonly string[];
  weekdaysLong: readonly string[];
  dayMonth: (day: number, month: string) => string;
  dayMonthYear: (dayMonth: string, year: number) => string;
  dayMonthLong: (day: number, month: string) => string;
  /** Two days of one month, the month in full: it `1 – 30 settembre`, en `September 1 – 30`. */
  dayRangeLong: (first: number, last: number, month: string, year?: number) => string;
  longDate: (day: number, month: string, year: number) => string;
  monthYear: (month: string, year: number) => string;
}

/** Day, then month, then year, spaces between: it, fr, sv. */
const dayFirst = {
  dayMonth: (day: number, month: string) => `${day} ${month}`,
  dayMonthYear: (dayMonth: string, year: number) => `${dayMonth} ${year}`,
  dayMonthLong: (day: number, month: string) => `${day} ${month}`,
  dayRangeLong: (first: number, last: number, month: string, year?: number) =>
    `${first} ${EN_DASH} ${last} ${month}${year === undefined ? '' : ` ${year}`}`,
  longDate: (day: number, month: string, year: number) => `${day} ${month} ${year}`,
  monthYear: (month: string, year: number) => `${month} ${year}`,
};

/** es and pt: `18 abr`, but `18 de abril de 2026` once the month is written in full. */
const dayFirstWithDe = {
  ...dayFirst,
  dayMonthLong: (day: number, month: string) => `${day} de ${month}`,
  dayRangeLong: (first: number, last: number, month: string, year?: number) =>
    `${first} ${EN_DASH} ${last} de ${month}${year === undefined ? '' : ` de ${year}`}`,
  longDate: (day: number, month: string, year: number) => `${day} de ${month} de ${year}`,
  monthYear: (month: string, year: number) => `${month} de ${year}`,
};

const CONVENTIONS: Record<AppLocale, Conventions> = {
  it: {
    group: '.',
    decimal: ',',
    minimumGroupingDigits: 1,
    symbolPosition: 'suffix',
    firstWeekday: 'monday',
    monthsShort: [
      'gen',
      'feb',
      'mar',
      'apr',
      'mag',
      'giu',
      'lug',
      'ago',
      'set',
      'ott',
      'nov',
      'dic',
    ],
    monthsLong: [
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
    weekdaysShort: ['L', 'M', 'M', 'G', 'V', 'S', 'D'],
    weekdaysLong: ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'],
    ...dayFirst,
  },
  en: {
    group: ',',
    decimal: '.',
    minimumGroupingDigits: 1,
    symbolPosition: 'prefix',
    firstWeekday: 'sunday',
    monthsShort: [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ],
    monthsLong: [
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
    weekdaysShort: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    weekdaysLong: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    dayMonth: (day, month) => `${month} ${day}`,
    dayMonthYear: (dayMonth, year) => `${dayMonth}, ${year}`,
    dayMonthLong: (day, month) => `${month} ${day}`,
    dayRangeLong: (first, last, month, year) =>
      `${month} ${first} ${EN_DASH} ${last}${year === undefined ? '' : `, ${year}`}`,
    longDate: (day, month, year) => `${month} ${day}, ${year}`,
    monthYear: (month, year) => `${month} ${year}`,
  },
  fr: {
    group: NARROW_NBSP,
    decimal: ',',
    minimumGroupingDigits: 1,
    symbolPosition: 'suffix',
    firstWeekday: 'monday',
    monthsShort: [
      'janv.',
      'févr.',
      'mars',
      'avr.',
      'mai',
      'juin',
      'juil.',
      'août',
      'sept.',
      'oct.',
      'nov.',
      'déc.',
    ],
    monthsLong: [
      'janvier',
      'février',
      'mars',
      'avril',
      'mai',
      'juin',
      'juillet',
      'août',
      'septembre',
      'octobre',
      'novembre',
      'décembre',
    ],
    weekdaysShort: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
    weekdaysLong: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
    ...dayFirst,
  },
  de: {
    group: '.',
    decimal: ',',
    minimumGroupingDigits: 1,
    symbolPosition: 'suffix',
    firstWeekday: 'monday',
    monthsShort: [
      'Jan.',
      'Feb.',
      'März',
      'Apr.',
      'Mai',
      'Juni',
      'Juli',
      'Aug.',
      'Sept.',
      'Okt.',
      'Nov.',
      'Dez.',
    ],
    monthsTick: [
      'Jan',
      'Feb',
      'Mär',
      'Apr',
      'Mai',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Okt',
      'Nov',
      'Dez',
    ],
    monthsLong: [
      'Januar',
      'Februar',
      'März',
      'April',
      'Mai',
      'Juni',
      'Juli',
      'August',
      'September',
      'Oktober',
      'November',
      'Dezember',
    ],
    weekdaysShort: ['M', 'D', 'M', 'D', 'F', 'S', 'S'],
    weekdaysLong: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
    dayMonth: (day, month) => `${day}. ${month}`,
    dayMonthYear: (dayMonth, year) => `${dayMonth} ${year}`,
    dayMonthLong: (day, month) => `${day}. ${month}`,
    dayRangeLong: (first, last, month, year) =>
      `${first}. ${EN_DASH} ${last}. ${month}${year === undefined ? '' : ` ${year}`}`,
    longDate: (day, month, year) => `${day}. ${month} ${year}`,
    monthYear: (month, year) => `${month} ${year}`,
  },
  sv: {
    group: NBSP,
    decimal: ',',
    minimumGroupingDigits: 1,
    symbolPosition: 'suffix',
    firstWeekday: 'monday',
    monthsShort: [
      'jan.',
      'feb.',
      'mars',
      'apr.',
      'maj',
      'juni',
      'juli',
      'aug.',
      'sep.',
      'okt.',
      'nov.',
      'dec.',
    ],
    monthsLong: [
      'januari',
      'februari',
      'mars',
      'april',
      'maj',
      'juni',
      'juli',
      'augusti',
      'september',
      'oktober',
      'november',
      'december',
    ],
    weekdaysShort: ['M', 'T', 'O', 'T', 'F', 'L', 'S'],
    weekdaysLong: ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'],
    ...dayFirst,
  },
  es: {
    group: '.',
    decimal: ',',
    minimumGroupingDigits: 2,
    symbolPosition: 'suffix',
    firstWeekday: 'monday',
    monthsShort: [
      'ene',
      'feb',
      'mar',
      'abr',
      'may',
      'jun',
      'jul',
      'ago',
      'sept',
      'oct',
      'nov',
      'dic',
    ],
    monthsLong: [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ],
    weekdaysShort: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
    weekdaysLong: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
    ...dayFirstWithDe,
  },
  /** European Portuguese (pt-PT), which Brazilian devices get too. */
  pt: {
    group: NBSP,
    decimal: ',',
    minimumGroupingDigits: 2,
    symbolPosition: 'suffix',
    firstWeekday: 'sunday',
    monthsShort: [
      'jan.',
      'fev.',
      'mar.',
      'abr.',
      'mai.',
      'jun.',
      'jul.',
      'ago.',
      'set.',
      'out.',
      'nov.',
      'dez.',
    ],
    monthsLong: [
      'janeiro',
      'fevereiro',
      'março',
      'abril',
      'maio',
      'junho',
      'julho',
      'agosto',
      'setembro',
      'outubro',
      'novembro',
      'dezembro',
    ],
    weekdaysShort: ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'],
    weekdaysLong: [
      'segunda-feira',
      'terça-feira',
      'quarta-feira',
      'quinta-feira',
      'sexta-feira',
      'sábado',
      'domingo',
    ],
    ...dayFirstWithDe,
  },
};

/** The app locale a BCP 47 tag belongs to, by its language subtag: `pt-BR` and `pt_PT` are `pt`. */
export function matchLocale(tag: string): AppLocale | undefined {
  const base = tag.toLowerCase().split(/[-_]/)[0] ?? '';
  return SUPPORTED_LOCALES.find((locale) => locale === base);
}

/**
 * The explicit preference, or else the first device language the app speaks — the way iOS picks an
 * app's localisation — and English when it speaks none of them.
 */
export function resolveLocale(
  preference: LanguagePreference,
  deviceLanguages: readonly string[],
): AppLocale {
  if (preference !== 'system') return preference;
  for (const tag of deviceLanguages) {
    const locale = matchLocale(tag);
    if (locale !== undefined) return locale;
  }
  return 'en';
}

/**
 * The language code to hand i18next. The `pt` catalog is European Portuguese, and i18next takes its
 * plural rules from this code: plain `pt` is Brazil's, where `0` is singular. i18next falls back
 * from `pt-PT` to the `pt` resources.
 */
export function i18nextLanguage(locale: AppLocale): string {
  return locale === 'pt' ? 'pt-PT' : locale;
}

function groupThousands(digits: string, conventions: Conventions): string {
  if (digits.length < 3 + conventions.minimumGroupingDigits) return digits;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, conventions.group);
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
  const conventions = CONVENTIONS[locale];
  let sign: MoneyParts['sign'] = '';
  if (signDisplay !== 'never' && minor < 0) sign = MINUS;
  if (signDisplay === 'always' && minor > 0) sign = '+';
  return {
    sign,
    integer: groupThousands(String(Math.floor(abs / scale)), conventions),
    decimalSeparator: conventions.decimal,
    fraction: minorDigits === 0 ? '' : String(abs % scale).padStart(minorDigits, '0'),
    symbol: getCurrency(currency).symbol,
    symbolPosition: conventions.symbolPosition,
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

function monthName(table: readonly string[], month: number): string {
  return table[month - 1] ?? '';
}

/** it `18 apr`, en `Apr 18`, de `18. Apr.` */
export function formatDayMonth(date: LocalDate, locale: AppLocale): string {
  const { month, day } = parseLocalDate(date);
  const conventions = CONVENTIONS[locale];
  return conventions.dayMonth(day, monthName(conventions.monthsShort, month));
}

/** it `settembre`, en `September`: the name of the month `date` falls in, lower-case as the catalogue has it. */
export function formatMonthLong(date: LocalDate, locale: AppLocale): string {
  const { month } = parseLocalDate(date);
  return monthName(CONVENTIONS[locale].monthsLong, month);
}

/** it `18 aprile 2026`, en `April 18, 2026`, es `18 de abril de 2026` */
export function formatLongDate(date: LocalDate, locale: AppLocale): string {
  const { year, month, day } = parseLocalDate(date);
  const conventions = CONVENTIONS[locale];
  return conventions.longDate(day, monthName(conventions.monthsLong, month), year);
}

/** it `venerdì`, en `Friday`. Monday-first, as `weekdayOf` counts. */
export function formatWeekday(date: LocalDate, locale: AppLocale): string {
  return CONVENTIONS[locale].weekdaysLong[weekdayOf(date)] ?? '';
}

/** it `18 settembre`, en `September 18`: a yearly anchor, whose year is the point of leaving out. */
export function formatDayMonthLong(date: LocalDate, locale: AppLocale): string {
  const { month, day } = parseLocalDate(date);
  const conventions = CONVENTIONS[locale];
  return conventions.dayMonthLong(day, monthName(conventions.monthsLong, month));
}

/** it `18 apr 2025`, en `Apr 18, 2025` */
function formatDayMonthYear(date: LocalDate, locale: AppLocale): string {
  const { year } = parseLocalDate(date);
  return CONVENTIONS[locale].dayMonthYear(formatDayMonth(date, locale), year);
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
 * The name of a period in the page head of the web (redesign §04): `1 – 30 settembre` when the
 * range lies in one month, with the year when that month is not in `today`'s year. A range that
 * crosses a month is `formatCycleRange`'s: `27 set – 26 ott`.
 */
export function formatPeriodRange(range: DateRange, locale: AppLocale, today: LocalDate): string {
  const start = parseLocalDate(range.start);
  const end = parseLocalDate(range.end);
  if (start.year !== end.year || start.month !== end.month) {
    return formatCycleRange(range, locale, today);
  }
  const conventions = CONVENTIONS[locale];
  const year = start.year === parseLocalDate(today).year ? undefined : start.year;
  return conventions.dayRangeLong(
    start.day,
    end.day,
    monthName(conventions.monthsLong, start.month),
    year,
  );
}

/**
 * The label under a chart column (§5.7): an 11px slot, so it carries only what tells one period
 * apart from its neighbours. A year is named by its number — six columns each reading `1 gen`
 * would be six identical labels — and a month by its name, the first of the month being noise.
 */
export function formatPeriodTick(start: LocalDate, kind: PeriodKind, locale: AppLocale): string {
  const { year, month } = parseLocalDate(start);
  if (kind === 'year') return String(year);
  if (kind === 'month') {
    const conventions = CONVENTIONS[locale];
    return monthName(conventions.monthsTick ?? conventions.monthsShort, month);
  }
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
 * `+325`, `−193`, `0`: rounded to whole major units, no currency symbol. The column labels of
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
  const digits = groupThousands(String(Math.abs(units)), CONVENTIONS[locale]);
  if (signDisplay === 'never') return digits;
  if (units > 0) return signDisplay === 'always' ? `+${digits}` : digits;
  if (units < 0) return `${MINUS}${digits}`;
  return '0';
}

/**
 * Where the week starts for a locale: Monday in most of Europe, Sunday in English and in Portugal.
 * This is a **display** choice and never moves the ISO week the period logic uses (§5.2).
 */
export function firstWeekdayFor(locale: AppLocale): FirstWeekday {
  return CONVENTIONS[locale].firstWeekday;
}

/** The seven column headings of a calendar, already in the order that calendar draws them. */
export function weekdayLabels(locale: AppLocale, firstWeekday: FirstWeekday): readonly string[] {
  const names = CONVENTIONS[locale].weekdaysShort;
  if (firstWeekday === 'monday') return names;
  const sunday = names[6] ?? '';
  return [sunday, ...names.slice(0, 6)];
}

/** it `aprile 2026`, en `April 2026`, pt `abril de 2026`: the title over a month grid. */
export function formatMonthYear(ym: YearMonth, locale: AppLocale): string {
  const conventions = CONVENTIONS[locale];
  return conventions.monthYear(monthName(conventions.monthsLong, ym.month), ym.year);
}
