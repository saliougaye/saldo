import { reloadAppAsync } from 'expo';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SecondaryButton } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { db } from '../../db/client';
import { useDatabase } from '../../db/DatabaseProvider';
import { seedDemoData } from '../../db/demo';
import { runMaterialiser } from '../../db/recurrenceService';
import { usePeriod } from '../period/PeriodProvider';
import { RECAP_KEY, RECAP_REPLAY } from '../recap/recapSchedule';

/**
 * Dev-only affordance for the demo seeder (§7). It belongs in Profile, which phase 05 builds; it
 * sits on Home until then so the app can be filled with data and looked at.
 */
export function DevTools() {
  const { t } = useTranslation();
  const { repos, kv } = useDatabase();
  const toast = useToast();
  const { today, def } = usePeriod();

  if (!__DEV__) return null;

  return (
    <View style={{ marginTop: 8, gap: 8 }}>
      <SecondaryButton
        label={t('dev.loadDemo')}
        onPress={() => {
          seedDemoData(repos, { today, def, translate: (key) => t(`seed.${key}`) });
          runMaterialiser(db, repos, today, def);
          toast.show(t('dev.demoLoaded'));
        }}
      />
      {/* The recap is seen once (§5.15): forget it and reload, so the gate decides again. */}
      <SecondaryButton
        label={t('dev.replayRecap')}
        onPress={() => {
          // Not a removal: a user who onboarded this period would never be due, and this is for looking.
          kv.set(RECAP_KEY, RECAP_REPLAY);
          // Expo's reload, not `DevSettings.reload()`: under the new architecture the latter restarts
          // the JS runtime without Expo's native modules, and the app dies on `ExpoAsset`.
          void reloadAppAsync('replay the period recap');
        }}
      />
    </View>
  );
}
