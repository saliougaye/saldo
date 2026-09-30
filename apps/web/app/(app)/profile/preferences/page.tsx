import { canonicalTimeZone } from '@saldo/i18n';
import {
  currencyOptions,
  languageOptions,
  themeOptions,
  timeZoneOptions,
} from '../../../../src/features/profile/preferenceOptions';
import {
  editPanel,
  PREFERENCES_PATH,
  preferenceRows,
} from '../../../../src/features/profile/profileRows';
import { readPage } from '../../../../src/server/page/context';
import { Section } from '../../../../src/ui/Section';
import { SummaryRow } from '../../../../src/ui/SummaryRow';
import { ProfilePanel } from '../ProfilePanel';
import { CurrencyPanel } from './CurrencyPanel';
import { CyclePanel } from './CyclePanel';
import { LanguagePanel } from './LanguagePanel';
import { ThemePanel } from './ThemePanel';
import { TimeZonePanel } from './TimeZonePanel';
import type { SettingErrors } from './useSaveSetting';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Profilo → Preferenze (§6.8, §17.1.7): the phone's five rows, each opening its editor in the
 * profile panel through `?edit=`. A choice is saved as it is made — the currency asks first — and
 * everything a panel lists is resolved here: the client gets plain rows, never a catalog.
 */
export default async function ProfilePreferencesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await readPage(searchParams);
  const { t, locale, settings, today, params } = page;
  const rows = preferenceRows(settings, locale);
  const edit = editPanel(params.edit);

  const errors: SettingErrors = {
    invalid: t('web.preferences.error_invalid'),
    notFound: t('web.preferences.error_notFound'),
    conflict: t('web.preferences.error_conflict'),
    unexpected: t('web.preferences.error_unexpected'),
  };

  const panel = () => {
    switch (edit) {
      case null:
        return null;
      case 'language':
        return (
          <LanguagePanel
            value={settings.language}
            options={languageOptions(t('profile.system'))}
            strings={{ title: t('profile.language'), note: t('web.preferences.systemFollows') }}
            errors={errors}
          />
        );
      case 'theme':
        return (
          <ThemePanel
            value={settings.theme}
            options={themeOptions(t)}
            strings={{ title: t('profile.theme'), note: t('web.preferences.systemFollows') }}
            errors={errors}
          />
        );
      case 'cycle':
        return (
          <CyclePanel
            value={settings.cycleStartDay}
            locale={locale}
            today={today}
            strings={{
              title: t('profile.cycleStart'),
              note: t('settings.cycleFootnote'),
              preview: t('profile.cyclePreview'),
              day: t('profile.cycleDay'),
            }}
            errors={errors}
          />
        );
      case 'currency':
        return (
          <CurrencyPanel
            value={settings.currency}
            locale={locale}
            options={currencyOptions(locale)}
            strings={{
              title: t('profile.currency'),
              search: t('currencyPicker.search'),
              common: t('currencyPicker.common'),
              all: t('currencyPicker.all'),
              noResults: t('currencyPicker.noResults'),
              confirmTitle: t('profile.currencyConfirmTitle'),
              confirmBody: t('profile.currencyConfirmBody'),
              confirmScale: t('profile.currencyConfirmScale'),
              save: t('common.save'),
              cancel: t('common.cancel'),
              busy: t('common.loading'),
            }}
            errors={errors}
          />
        );
      case 'timeZone': {
        const saved = settings.timeZone ?? null;
        return (
          <TimeZonePanel
            saved={saved === null ? null : canonicalTimeZone(saved)}
            {...timeZoneOptions(locale, new Date(), saved)}
            strings={{
              title: t('profile.timeZone'),
              note: t('timeZone.subtitle'),
              search: t('timeZone.search'),
              current: t('timeZone.current'),
              currentAndDevice: t('web.preferences.zoneCurrentAndDevice'),
              all: t('timeZone.all'),
              noResults: t('timeZone.noResults'),
            }}
            errors={errors}
          />
        );
      }
    }
  };

  return (
    <>
      <Section open title={t('settings.preferences')} trailing={t('settings.appliesToPhone')}>
        {rows.map((row) => (
          <SummaryRow
            key={row.key}
            href={row.href}
            selected={row.key === edit}
            title={t(row.labelKey)}
            value={
              row.key === 'cycle'
                ? t('settings.cycleValue', { day: row.value })
                : row.key === 'theme'
                  ? t(`profile.${row.value}`)
                  : row.value === ''
                    ? t('profile.system')
                    : row.value
            }
          />
        ))}
      </Section>

      {edit === null ? null : (
        <ProfilePanel
          title={t(rows.find((row) => row.key === edit)?.labelKey ?? 'settings.preferences')}
          closeHref={PREFERENCES_PATH}
          closeLabel={t('common.close')}
        >
          {panel()}
        </ProfilePanel>
      )}
    </>
  );
}
