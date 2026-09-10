import { type AppLocale, type LanguagePreference, resolveLocale, resources } from '@saldo/i18n';
import i18next, { type i18n as I18nInstance } from 'i18next';
import { NativeModules, Platform } from 'react-native';

/** Device languages, most preferred first. Empty when the platform does not report any. */
export function deviceLanguages(): string[] {
  if (Platform.OS === 'ios') {
    const settings: unknown = NativeModules.SettingsManager?.settings;
    if (settings !== null && typeof settings === 'object') {
      const languages = (settings as { AppleLanguages?: unknown }).AppleLanguages;
      if (Array.isArray(languages)) {
        return languages.filter((value): value is string => typeof value === 'string');
      }
      const locale = (settings as { AppleLocale?: unknown }).AppleLocale;
      if (typeof locale === 'string') return [locale];
    }
    return [];
  }
  const locale: unknown = NativeModules.I18nManager?.localeIdentifier;
  return typeof locale === 'string' ? [locale.replace('_', '-')] : [];
}

export async function createI18n(
  preference: LanguagePreference,
  languages: readonly string[] = deviceLanguages(),
): Promise<I18nInstance> {
  const language: AppLocale = resolveLocale(preference, languages);
  const instance = i18next.createInstance();
  await instance.init({
    resources,
    lng: language,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return instance;
}
