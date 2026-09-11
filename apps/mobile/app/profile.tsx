import { COMMON_CURRENCY_CODES, type CurrencyCode, getCurrency } from '@saldo/core';
import { formatMoney } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useServer } from '../src/auth/ServerProvider';
import { Card } from '../src/components/Card';
import { ConfirmDialog } from '../src/components/ConfirmDialog';
import { IconBox, ListRow } from '../src/components/ListRow';
import { Screen } from '../src/components/Screen';
import { BackButton } from '../src/components/ScreenHeader';
import { Sheet } from '../src/components/Sheet';
import { useToast } from '../src/components/Toast';
import { Toggle } from '../src/components/Toggle';
import { db } from '../src/db/client';
import { useDatabase } from '../src/db/DatabaseProvider';
import { seedDemoData } from '../src/db/demo';
import { useAccounts, useSettings } from '../src/db/hooks';
import { runMaterialiser } from '../src/db/recurrenceService';
import { usePeriod } from '../src/features/period/PeriodProvider';
import { useAppLocale } from '../src/i18n/useAppLocale';
import { Text } from '../src/theme/Text';
import { useTheme } from '../src/theme/ThemeProvider';

type SheetKind = 'language' | 'theme' | 'currency' | 'cycle' | null;

/** §6.8. The server row lands in phase 07; import/export in phase 08. */
export default function ProfileScreen() {
  const { serverUrl, user } = useServer();
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { repos, kv } = useDatabase();
  const toast = useToast();
  const settings = useSettings();
  const accounts = useAccounts();
  const { today, def } = usePeriod();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [pendingCurrency, setPendingCurrency] = useState<CurrencyCode | null>(null);
  const [lockEnabled, setLockEnabled] = useState(kv.get('appLockEnabled') === 'true');

  const currency = settings?.currency ?? 'EUR';
  const archived = accounts.filter((account) => account.archivedAt !== null).length;

  // Every list elsewhere in the app leads with an icon box; the profile was the one screen of
  // plain text rows, which is what made it read as a different app (§13).
  const lead = (name: IconName) => <IconBox name={name} colour={theme.palette.textMuted} small />;

  const languageLabel = {
    system: t('profile.system'),
    it: t('profile.italian'),
    en: t('profile.english'),
  }[settings?.language ?? 'system'];
  const themeLabel = {
    system: t('profile.system'),
    dark: t('profile.dark'),
    light: t('profile.light'),
  }[settings?.theme ?? 'system'];

  return (
    <Screen>
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
            onPress={() => setSheet('cycle')}
            chevron
          />
          <ListRow
            title={t('profile.currency')}
            leading={lead('coins')}
            trailing={<Text color="textMuted">{currency}</Text>}
            onPress={() => setSheet('currency')}
            chevron
          />
          <ListRow
            title={t('profile.language')}
            leading={lead('book')}
            trailing={<Text color="textMuted">{languageLabel}</Text>}
            onPress={() => setSheet('language')}
            chevron
          />
          <ListRow
            title={t('profile.theme')}
            leading={lead('bulb')}
            trailing={<Text color="textMuted">{themeLabel}</Text>}
            onPress={() => setSheet('theme')}
            chevron
          />
        </View>
      </Card>

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
          <ListRow
            title={t('settings.categories')}
            leading={lead('grip')}
            onPress={() => router.push('/settings/categories')}
            chevron
          />
          <ListRow
            title={t('settings.tags')}
            leading={lead('tag')}
            onPress={() => router.push('/settings/tags')}
            chevron
          />
          <ListRow
            title={t('profile.archivedAccounts')}
            leading={lead('archive')}
            trailing={<Text color="textMuted">{String(archived)}</Text>}
            onPress={() => router.push('/(tabs)/accounts')}
            chevron
          />
          <ListRow
            title={t('settings.reviewOnboarding')}
            leading={lead('wrench')}
            onPress={() => router.push('/period')}
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
            trailing={
              <Text color="textMuted">
                {serverUrl === null
                  ? t('sync.notConnected')
                  : (user?.displayName ?? t('sync.notConnected'))}
              </Text>
            }
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
            onPress={() => router.push('/profile/export')}
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
          </View>
        </Card>
      ) : null}

      <Text size="caption" color="textFaint">
        {t('profile.version', { version: Application.nativeApplicationVersion ?? '0.1.0' })}
      </Text>

      <Sheet
        visible={sheet === 'language'}
        onClose={() => setSheet(null)}
        title={t('profile.language')}
      >
        {(['system', 'it', 'en'] as const).map((value) => (
          <ListRow
            key={value}
            title={
              { system: t('profile.system'), it: t('profile.italian'), en: t('profile.english') }[
                value
              ]
            }
            onPress={() => {
              repos.settings.update({ language: value });
              setSheet(null);
            }}
          />
        ))}
      </Sheet>

      <Sheet visible={sheet === 'theme'} onClose={() => setSheet(null)} title={t('profile.theme')}>
        {(['system', 'dark', 'light'] as const).map((value) => (
          <ListRow
            key={value}
            title={
              { system: t('profile.system'), dark: t('profile.dark'), light: t('profile.light') }[
                value
              ]
            }
            onPress={() => {
              repos.settings.update({ theme: value });
              setSheet(null);
            }}
          />
        ))}
      </Sheet>

      <Sheet
        visible={sheet === 'currency'}
        onClose={() => setSheet(null)}
        title={t('profile.currency')}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {COMMON_CURRENCY_CODES.map((code) => (
            <Pressable
              key={code}
              accessibilityRole="button"
              accessibilityState={{ selected: code === currency }}
              onPress={() => {
                setSheet(null);
                if (code !== currency) setPendingCurrency(code);
              }}
              style={{
                paddingHorizontal: 12,
                height: 34,
                justifyContent: 'center',
                borderRadius: theme.radii.chipSmall,
                backgroundColor: code === currency ? theme.palette.accent : theme.palette.raised,
              }}
            >
              <Text size="footnote" color={code === currency ? 'onAccent' : 'text'}>
                {code}
              </Text>
            </Pressable>
          ))}
        </View>
      </Sheet>

      <Sheet
        visible={sheet === 'cycle'}
        onClose={() => setSheet(null)}
        title={t('profile.cycleStart')}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={String(day)}
              onPress={() => {
                repos.settings.update({ cycleStartDay: day });
                setSheet(null);
              }}
              style={{
                width: 40,
                height: 34,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radii.chipSmall,
                backgroundColor:
                  day === settings?.cycleStartDay ? theme.palette.accent : theme.palette.raised,
              }}
            >
              <Text
                size="footnote"
                tabular
                color={day === settings?.cycleStartDay ? 'onAccent' : 'text'}
              >
                {day}
              </Text>
            </Pressable>
          ))}
        </View>
      </Sheet>

      <ConfirmDialog
        visible={pendingCurrency !== null}
        title={t('profile.currencyConfirmTitle')}
        body={
          pendingCurrency === null
            ? undefined
            : getCurrency(pendingCurrency).minorDigits === getCurrency(currency).minorDigits
              ? t('profile.currencyConfirmBody')
              : // §5.1: a different scale moves the decimal point, so the copy says so with the
                // user's own number rather than a generic sentence.
                t('profile.currencyConfirmScale', {
                  before: formatMoney(184260, currency, locale),
                  after: formatMoney(184260, pendingCurrency, locale),
                })
        }
        confirmLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          if (pendingCurrency !== null) repos.settings.update({ currency: pendingCurrency });
          setPendingCurrency(null);
        }}
        onCancel={() => setPendingCurrency(null)}
      />
    </Screen>
  );
}
