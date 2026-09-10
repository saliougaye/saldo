import {
  type CurrencyCode,
  type DateRange,
  getCurrency,
  type LocalDate,
  parseLocalDate,
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

/** it `27 mar – 26 apr`, en `Mar 27 – Apr 26` */
export function formatCycleRange(range: DateRange, locale: AppLocale): string {
  return `${formatDayMonth(range.start, locale)} ${EN_DASH} ${formatDayMonth(range.end, locale)}`;
}

/** `+12%`, `−7%`, `0%` */
export function formatSignedPercent(value: number): string {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${rounded}%`;
  if (rounded < 0) return `${MINUS}${Math.abs(rounded)}%`;
  return '0%';
}
