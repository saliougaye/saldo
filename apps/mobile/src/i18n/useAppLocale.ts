import { type AppLocale, matchLocale } from '@saldo/i18n';
import { useTranslation } from 'react-i18next';

/** The active locale, narrowed to what the formatters accept (i18next runs `pt` as `pt-PT`). */
export function useAppLocale(): AppLocale {
  const { i18n } = useTranslation();
  return matchLocale(i18n.language) ?? 'en';
}
