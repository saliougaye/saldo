import { useTranslation } from 'react-i18next';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useSettings } from '../../src/db/hooks';
import { OptionRow, SettingScreen } from '../../src/features/profile/SettingScreen';

const LANGUAGES = ['system', 'it', 'en'] as const;

/** §6.8: Sistema / Italiano / English. */
export default function LanguageSetting() {
  const { t } = useTranslation();
  const repos = useRepositories();
  const settings = useSettings();
  const current = settings?.language ?? 'system';

  return (
    <SettingScreen title={t('profile.language')}>
      {LANGUAGES.map((value) => (
        <OptionRow
          key={value}
          label={
            { system: t('profile.system'), it: t('profile.italian'), en: t('profile.english') }[
              value
            ]
          }
          selected={value === current}
          onPress={() => repos.settings.update({ language: value })}
        />
      ))}
    </SettingScreen>
  );
}
