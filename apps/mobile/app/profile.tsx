import { getCurrency } from '@saldo/core';
import { canonicalTimeZone, LANGUAGE_NAMES, systemTimeZone, timeZoneCity } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { deleteAllAttachmentFiles } from '../src/attachments/localFiles';
import { useServer } from '../src/auth/ServerProvider';
import { Card } from '../src/components/Card';
import { ConfirmDialog } from '../src/components/ConfirmDialog';
import { IconBox, ListRow } from '../src/components/ListRow';
import { Screen } from '../src/components/Screen';
import { BackButton } from '../src/components/ScreenHeader';
import { useToast } from '../src/components/Toast';
import { Toggle } from '../src/components/Toggle';
import { db } from '../src/db/client';
import { useDatabase } from '../src/db/DatabaseProvider';
import { seedDemoData } from '../src/db/demo';
import { useAccounts, useSettings } from '../src/db/hooks';
import { runMaterialiser } from '../src/db/recurrenceService';
import { wipeDevice } from '../src/db/wipe';
import { usePeriod } from '../src/features/period/PeriodProvider';
import { useAppLocale } from '../src/i18n/useAppLocale';
import { startOver } from '../src/navigation/history';
import { Text } from '../src/theme/Text';
import { useTheme } from '../src/theme/ThemeProvider';

/**
 * §6.8. Every setting here opens its own screen rather than a bottom sheet: the same place
 * Categorie and Tag already went, and the only place a footnote or a confirmation has room.
 */
export default function ProfileScreen() {
  const { user, disconnect } = useServer();
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { repos, kv } = useDatabase();
  const toast = useToast();
  const settings = useSettings();
  const accounts = useAccounts();
  const { today, def } = usePeriod();
  const [lockEnabled, setLockEnabled] = useState(kv.get('appLockEnabled') === 'true');
  const [resetOpen, setResetOpen] = useState(false);
  const locale = useAppLocale();

  const currency = settings?.currency ?? 'EUR';
  const archived = accounts.filter((account) => account.archivedAt !== null).length;

  // Every list elsewhere in the app leads with an icon box; the profile was the one screen of
  // plain text rows, which is what made it read as a different app (§13).
  const lead = (name: IconName) => <IconBox name={name} colour={theme.palette.textMuted} small />;

  const language = settings?.language ?? 'system';
  const languageLabel = language === 'system' ? t('profile.system') : LANGUAGE_NAMES[language];
  const themeLabel = {
    system: t('profile.system'),
    dark: t('profile.dark'),
    light: t('profile.light'),
  }[settings?.theme ?? 'system'];
  const device = systemTimeZone();
  const zone = canonicalTimeZone(settings?.timeZone ?? device);

  return (
    <Screen refreshable>
      <BackButton />
      <Text size="display" weight="semibold" tracking="tighter">
        {t('profile.title')}
      </Text>

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
          <ListRow
            title={t('profile.cycleStart')}
            leading={lead('cal')}
            trailing={
              <Text color="textMuted">
                {t('settings.cycleValue', { day: settings?.cycleStartDay ?? 27 })}
              </Text>
            }
            onPress={() => router.push('/profile/cycle')}
            chevron
          />
          <ListRow
            title={t('profile.currency')}
            leading={lead('coins')}
            trailing={
              <Text color="textMuted">{`${getCurrency(currency).symbol}  ${currency}`}</Text>
            }
            onPress={() => router.push('/profile/currency')}
            chevron
          />
          <ListRow
            title={t('profile.language')}
            leading={lead('book')}
            trailing={<Text color="textMuted">{languageLabel}</Text>}
            onPress={() => router.push('/profile/language')}
            chevron
          />
          <ListRow
            title={t('profile.theme')}
            leading={lead('bulb')}
            trailing={<Text color="textMuted">{themeLabel}</Text>}
            onPress={() => router.push('/profile/theme')}
            chevron
          />
          <ListRow
            title={t('profile.timeZone')}
            subtitle={
              zone === device
                ? undefined
                : t('timeZone.phoneIsIn', { city: timeZoneCity(device, locale) })
            }
            leading={lead('clock')}
            trailing={<Text color="textMuted">{timeZoneCity(zone, locale)}</Text>}
            onPress={() => router.push('/profile/timezone')}
            chevron
          />
        </View>
      </Card>

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
          <ListRow
            title={t('settings.budgets')}
            leading={lead('target')}
            onPress={() => router.push('/budgets')}
            chevron
          />
          <ListRow
            title={t('goals.title')}
            leading={lead('piggy')}
            onPress={() => router.push('/goals')}
            chevron
          />
          <ListRow
            title={t('settings.categories')}
            leading={lead('grip')}
            onPress={() => router.push('/settings/categories')}
            chevron
          />
          <ListRow
            title={t('settings.manageTags')}
            leading={lead('tag')}
            onPress={() => router.push('/settings/tags')}
            chevron
          />
          <ListRow
            title={t('profile.archivedAccounts')}
            leading={lead('archive')}
            trailing={<Text color="textMuted">{String(archived)}</Text>}
            onPress={() => router.push('/settings/archived-accounts')}
            chevron
          />
          <ListRow
            title={t('settings.reviewOnboarding')}
            leading={lead('wrench')}
            onPress={() => router.push('/period')}
            chevron
          />
          <ListRow
            title={t('guide.title')}
            leading={lead('info')}
            onPress={() => router.push('/guide')}
            testID="profile-guide"
            chevron
          />
        </View>
      </Card>

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
          <ListRow
            title={t('profile.server')}
            leading={lead('wifi')}
            onPress={() => router.push('/profile/server')}
            chevron
            trailing={<Text color="textMuted">{user?.displayName ?? t('sync.notConnected')}</Text>}
          />
          <ListRow
            title={t('profile.importCsv')}
            leading={lead('arrowDL')}
            onPress={() => router.push('/profile/import')}
            chevron
          />
          <ListRow
            title={t('profile.exportData')}
            leading={lead('arrowUR')}
            onPress={() => router.push('/profile/export')}
            chevron
          />
          <ListRow
            title={t('profile.restoreBackup')}
            leading={lead('inbox')}
            onPress={() => router.push('/profile/restore')}
            chevron
          />
          <ListRow
            title={t('profile.permissions')}
            leading={lead('bell')}
            onPress={() => router.push('/profile/permissions')}
            chevron
          />
          <ListRow
            title={t('profile.appLock')}
            leading={lead('key')}
            trailing={
              <Toggle
                value={lockEnabled}
                onChange={(next) => {
                  setLockEnabled(next);
                  kv.set('appLockEnabled', next ? 'true' : 'false');
                }}
                accessibilityLabel={t('profile.appLock')}
              />
            }
          />
        </View>
      </Card>

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
          <ListRow
            title={t('profile.deleteAllData')}
            leading={lead('trash')}
            onPress={() => router.push('/profile/delete-data')}
            chevron
          />
        </View>
      </Card>

      {__DEV__ ? (
        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
            <ListRow
              title={t('dev.loadDemo')}
              leading={lead('zap')}
              onPress={() => {
                seedDemoData(repos, { today, def, translate: (key) => t(`seed.${key}`) });
                runMaterialiser(db, repos, today, def);
                toast.show(t('dev.demoLoaded'));
              }}
            />
            <ListRow
              title={t('dev.resetDevice')}
              leading={lead('trash')}
              onPress={() => setResetOpen(true)}
            />
          </View>
        </Card>
      ) : null}

      <ConfirmDialog
        visible={resetOpen}
        title={t('dev.resetTitle')}
        body={t('dev.resetBody')}
        confirmLabel={t('dev.resetConfirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          setResetOpen(false);
          void (async () => {
            /**
             * Sign out **first**, while the session still exists: the token has to be handed back
             * to the server, and the scheduler has to stop before the rows under it disappear.
             * Then the bytes, then the rows — and the boot router takes it from there, because a
             * database with no settings row is what onboarding means (§6.29).
             */
            await disconnect();
            deleteAllAttachmentFiles();
            wipeDevice(db);
            startOver(router, '/');
          })();
        }}
        onCancel={() => setResetOpen(false)}
      />

      <Text size="caption" color="textFaint">
        {t('profile.version', { version: Application.nativeApplicationVersion ?? '0.1.0' })}
      </Text>
    </Screen>
  );
}
