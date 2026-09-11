import { useTranslation } from 'react-i18next';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useSettings } from '../../src/db/hooks';
import { OptionRow, SettingScreen } from '../../src/features/profile/SettingScreen';

const THEMES = ['system', 'dark', 'light'] as const;

/** §6.8: Sistema / Scuro / Chiaro. The choice applies as it is made, so there is nothing to save. */
export default function ThemeSetting() {
  const { t } = useTranslation();
  const repos = useRepositories();
  const settings = useSettings();
  const current = settings?.theme ?? 'system';

  return (
    <SettingScreen title={t('profile.theme')}>
      {THEMES.map((value) => (
        <OptionRow
          key={value}
          label={
            { system: t('profile.system'), dark: t('profile.dark'), light: t('profile.light') }[
              value
            ]
          }
          selected={value === current}
          onPress={() => repos.settings.update({ theme: value })}
        />
      ))}
    </SettingScreen>
  );
}
