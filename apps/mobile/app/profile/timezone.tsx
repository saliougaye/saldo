import { canonicalTimeZone, systemTimeZone } from '@saldo/i18n';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useSettings } from '../../src/db/hooks';
import { SettingScreen } from '../../src/features/profile/SettingScreen';
import { TimeZoneList } from '../../src/features/profile/TimeZoneList';

/** §6.8 Fuso orario (D37): saved at once on tap, like Lingua; the server computes «today» with it. */
export default function TimeZoneSetting() {
  const { t } = useTranslation();
  const repos = useRepositories();
  const settings = useSettings();
  const [device] = useState(systemTimeZone);
  const [now] = useState(() => new Date());
  const saved = settings?.timeZone ?? null;

  return (
    <SettingScreen title={t('profile.timeZone')} subtitle={t('timeZone.subtitle')} card={false}>
      <TimeZoneList
        saved={saved}
        device={device}
        now={now}
        onSelect={(zone) => {
          if (saved === null || zone !== canonicalTimeZone(saved)) {
            repos.settings.update({ timeZone: zone });
          }
        }}
      />
    </SettingScreen>
  );
}
