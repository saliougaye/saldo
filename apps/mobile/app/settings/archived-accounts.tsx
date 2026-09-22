import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import { Card } from '../../src/components/Card';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { SkeletonList } from '../../src/components/Skeleton';
import { useToast } from '../../src/components/Toast';
import { useDelayed } from '../../src/components/useDelayed';
import { restoreAccount } from '../../src/db/adminService';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useAccountsQuery } from '../../src/db/hooks';
import { SettingScreen } from '../../src/features/profile/SettingScreen';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * §6.5 / §6.8 "Conti archiviati", as its own screen.
 *
 * The Profile row used to push the Accounts **tab**, which opened at the top with the archived
 * accordion closed — the one thing the row was about was then two scrolls and a tap away, and the
 * jump also swapped the pushed stack for a tab. The accordion on the tab stays; this is the door
 * the Profile row opens.
 */
export default function ArchivedAccounts() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const repos = useRepositories();
  const toast = useToast();
  const { accounts, loaded } = useAccountsQuery();
  const slow = useDelayed(!loaded);
  const archived = accounts.filter((account) => account.archivedAt !== null);

  if (!loaded) {
    return (
      <SettingScreen
        title={t('profile.archivedAccounts')}
        subtitle={t('accounts.archivedNote')}
        card={false}
      >
        {slow ? <SkeletonList rows={3} label={t('common.loading')} /> : null}
      </SettingScreen>
    );
  }

  if (archived.length === 0) {
    return (
      <SettingScreen
        title={t('profile.archivedAccounts')}
        subtitle={t('accounts.archivedNote')}
        card={false}
      >
        <Card>
          <Text color="textMuted">{t('accounts.archivedEmpty')}</Text>
        </Card>
      </SettingScreen>
    );
  }

  return (
    <SettingScreen title={t('profile.archivedAccounts')} subtitle={t('accounts.archivedNote')}>
      {archived.map((account) => (
        <ListRow
          key={account.id}
          title={account.name}
          subtitle={account.institution ?? undefined}
          leading={<IconBox name={account.icon as IconName} colour={theme.palette.textFaint} />}
          onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })}
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('accounts.restore')}
              hitSlop={8}
              onPress={() => {
                restoreAccount(repos, account.id);
                toast.show(t('accounts.restored', { name: account.name }));
              }}
              style={({ pressed }) => ({
                paddingHorizontal: 10,
                height: 30,
                justifyContent: 'center',
                borderRadius: theme.radii.chipSmall,
                backgroundColor: theme.palette.raised,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              })}
            >
              <Text size="footnote" color="accent">
                {t('accounts.restore')}
              </Text>
            </Pressable>
          }
        />
      ))}
    </SettingScreen>
  );
}
