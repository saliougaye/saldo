import type { LocalDate } from '@saldo/core';
import { formatDayMonth, formatLongDate, formatMoney, type SignDisplay } from '@saldo/i18n';
import type { SiteContent } from '../content/index';

/** Money and dates as plain text, at the edge (AGENTS.md): for strings that interpolate them. */
export const moneyText = (content: SiteContent, minor: number, sign: SignDisplay = 'negative') =>
  formatMoney(minor, content.currency, content.locale, sign);

export const dayText = (content: SiteContent, date: LocalDate) =>
  formatDayMonth(date, content.locale);

export const longDateText = (content: SiteContent, date: LocalDate) =>
  formatLongDate(date, content.locale);
