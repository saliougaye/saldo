import type { AppLocale } from '@saldo/i18n';
import { useTranslation } from 'react-i18next';

/** The active locale, narrowed to what the formatters accept. */
export function useAppLocale(): AppLocale {
  const { i18n } = useTranslation();
  return i18n.language.startsWith('it') ? 'it' : 'en';
}
