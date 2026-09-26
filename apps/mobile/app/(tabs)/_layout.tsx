import { Tabs, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TabBar } from '../../src/components/TabBar';
import { CardRemindersGate } from '../../src/features/accounts/CardRemindersGate';
import { useLeaveWhenDataGone } from '../../src/features/deleteData/useLeaveWhenDataGone';
import { IntroGate } from '../../src/features/guide/IntroGate';
import { useAppLock } from '../../src/features/lock/useAppLock';
import { PeriodRecapGate } from '../../src/features/recap/PeriodRecapGate';
import { useNotificationRoutes } from '../../src/navigation/useNotificationRoutes';

export default function TabsLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  const [recapBusy, setRecapBusy] = useState(true);
  useAppLock();
  useLeaveWhenDataGone();
  useNotificationRoutes();
  return (
    <>
      {/* Here rather than on Home: the reminders follow every write, whichever screen made it. */}
      <CardRemindersGate />
      {/* The recap of the period that just closed (§5.15), over whichever tab opens first. */}
      <PeriodRecapGate onBusyChange={setRecapBusy} />
      {/* The first-run intro (§6.40), after the recap when both are due. */}
      <IntroGate blocked={recapBusy} />
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => (
          <TabBar
            {...props}
            label={(name) => t(`tabs.${name === 'index' ? 'home' : name}`)}
            fabLabel={t('transactions.newTransaction')}
            onFabPress={() => router.push('/transaction/new')}
          />
        )}
      >
        <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
        <Tabs.Screen name="transactions" options={{ title: t('tabs.transactions') }} />
        <Tabs.Screen name="stats" options={{ title: t('tabs.stats') }} />
        <Tabs.Screen name="accounts" options={{ title: t('tabs.accounts') }} />
      </Tabs>
    </>
  );
}
