import { canonicalTimeZone } from '@saldo/i18n';
import {
  currencyOptions,
  languageOptions,
  themeOptions,
  timeZoneOptions,
} from '../../../../src/features/profile/preferenceOptions';
import {
  PREFERENCES_PATH,
  type PreferenceKey,
  preferenceRows,
} from '../../../../src/features/profile/profileRows';
import { readPage } from '../../../../src/server/page/context';
import { type PanelSpec, PanelSwitch } from '../../../../src/ui/PanelSwitch';
import { Section } from '../../../../src/ui/Section';
import { SummaryRow } from '../../../../src/ui/SummaryRow';
import { CurrencyPanel } from './CurrencyPanel';
import { CyclePanel } from './CyclePanel';
import { LanguagePanel } from './LanguagePanel';
import { ThemePanel } from './ThemePanel';
import { TimeZonePanel } from './TimeZonePanel';
import { type SettingErrors, SettingErrorsShared } from './useSaveSetting';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** `?edit={key}` opens the editor of one preference. Any other value opens nothing. */
const PANEL_PARAMS = { flags: [], values: ['edit'] } as const;

/**
 * The editor that stays a navigation: its list of about 400 zones, each with the hour there now, is
 * 40 KB of the response and is right only at the time of the render. The page renders it only when
 * the URL asks for it.
 */
const ON_REQUEST: PreferenceKey = 'timeZone';

/**
 * Profilo → Preferenze (§6.8, §17.1.7): the phone's five rows, each opening its editor in the
 * profile panel through `?edit=` — in place (`PanelSwitch`), but for the time zone. A choice is
 * saved as it is made — the currency asks first — and everything a panel lists is resolved here:
 * the client gets plain rows, never a catalog.
 */
export default async function ProfilePreferencesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await readPage(searchParams);
  const { t, locale, settings, today, params } = page;
  const rows = preferenceRows(settings, locale);

  const errors: SettingErrors = {
    invalid: t('web.preferences.error_invalid'),
    notFound: t('web.preferences.error_notFound'),
    conflict: t('web.preferences.error_conflict'),
    unexpected: t('web.preferences.error_unexpected'),
  };

  const body = (key: PreferenceKey) => {
    switch (key) {
      case 'language':
        return (
          <LanguagePanel
            value={settings.language}
            options={languageOptions(t('profile.system'))}
            strings={{ title: t('profile.language'), note: t('web.preferences.systemFollows') }}
          />
        );
      case 'theme':
        return (
          <ThemePanel
            value={settings.theme}
            options={themeOptions(t)}
            strings={{ title: t('profile.theme'), note: t('web.preferences.systemFollows') }}
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
          />
        );
      }
    }
  };

  // Every editor, rendered here: a click only chooses one (`PanelSwitch`). The time zone's is here
  // only when the URL opens it, so its row navigates. A choice is saved as it is made, and
  // `router.refresh()` renders the page again with the panel still open.
  const panels: Record<string, PanelSpec> = Object.fromEntries(
    rows
      .filter((row) => row.key !== ON_REQUEST || params.edit === ON_REQUEST)
      .map((row): [string, PanelSpec] => [
        `edit:${row.key}`,
        { title: t(row.labelKey), body: body(row.key) },
      ]),
  );

  return (
    <SettingErrorsShared value={errors}>
      <PanelSwitch
        baseHref={PREFERENCES_PATH}
        params={PANEL_PARAMS}
        panels={panels}
        closeLabel={t('common.close')}
        slot
      >
        <Section open title={t('settings.preferences')} trailing={t('settings.appliesToPhone')}>
          {rows.map((row) => (
            <SummaryRow
              key={row.key}
              href={row.href}
              selectId={`edit:${row.key}`}
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
      </PanelSwitch>
    </SettingErrorsShared>
  );
}
