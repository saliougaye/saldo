import { LANGUAGE_NAMES } from '@saldo/i18n';
import { useTranslation } from 'react-i18next';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useSettings } from '../../src/db/hooks';
import { OptionRow, SettingScreen } from '../../src/features/profile/SettingScreen';

/** The two the app was written in first, then the rest alphabetically by their own names. */
const LANGUAGES = ['system', 'it', 'en', 'de', 'es', 'fr', 'pt', 'sv'] as const;

/**
 * §6.8: Sistema, then each language named in its own tongue — `LANGUAGE_NAMES`, never a
 * translation — so someone who opened the wrong one can still find theirs.
 */
export default function LanguageSetting() {
  const { t } = useTranslation();
  const repos = useRepositories();
  const settings = useSettings();
  const current = settings?.language ?? 'system';

  return (
    <SettingScreen title={t('profile.language')} subtitle={t('profile.systemFollows')}>
      {LANGUAGES.map((value) => (
        <OptionRow
          key={value}
          label={value === 'system' ? t('profile.system') : LANGUAGE_NAMES[value]}
          selected={value === current}
          onPress={() => repos.settings.update({ language: value })}
        />
      ))}
    </SettingScreen>
  );
}
