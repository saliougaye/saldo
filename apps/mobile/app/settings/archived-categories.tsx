import type { IconName } from '@saldo/ui';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import { Card } from '../../src/components/Card';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { useToast } from '../../src/components/Toast';
import { restoreCategory } from '../../src/db/adminService';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useCategories } from '../../src/db/hooks';
import { SettingScreen } from '../../src/features/profile/SettingScreen';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * §5.11 "Archiviate", as its own screen.
 *
 * It used to be an accordion at the bottom of Categorie whose only cue was a line of muted text —
 * nothing said it opened, and nothing said it was open. The Accounts tab settled the same question
 * already (`settings/archived-accounts`): a row with a count leads here, and restore is the only
 * thing offered, because everything else about an archived category is edited after it is back.
 */
export default function ArchivedCategories() {
  const theme = useTheme();
  const { t } = useTranslation();
  const repos = useRepositories();
  const toast = useToast();
  const all = useCategories();
  const archived = all.filter((category) => category.archivedAt !== null);

  const parentName = (parentId: string | null): string | undefined => {
    if (parentId === null) return undefined;
    return all.find((category) => category.id === parentId)?.name;
  };

  /**
   * Archiving a parent takes its children with it (`archiveCategory`), so restoring a child on its
   * own would leave it live under an archived parent — invisible on every screen that walks the
   * tree from the top. Its parent comes back with it.
   */
  const restore = (categoryId: string, parentId: string | null, name: string) => {
    if (parentId !== null && all.find((row) => row.id === parentId)?.archivedAt !== null) {
      restoreCategory(repos, parentId);
    }
    restoreCategory(repos, categoryId);
    toast.show(t('categories.restored', { name }));
  };

  if (archived.length === 0) {
    return (
      <SettingScreen
        title={t('categories.archived')}
        subtitle={t('categories.archivedNote')}
        card={false}
      >
        <Card>
          <Text color="textMuted">{t('categories.archivedEmpty')}</Text>
        </Card>
      </SettingScreen>
    );
  }

  return (
    <SettingScreen title={t('categories.archived')} subtitle={t('categories.archivedNote')}>
      {archived.map((category) => (
        <ListRow
          key={category.id}
          title={category.name}
          subtitle={parentName(category.parentId)}
          leading={<IconBox name={category.icon as IconName} colour={theme.palette.textFaint} />}
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('common.restore')} ${category.name}`}
              hitSlop={8}
              onPress={() => restore(category.id, category.parentId, category.name)}
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
                {t('common.restore')}
              </Text>
            </Pressable>
          }
        />
      ))}
    </SettingScreen>
  );
}
