import type { Category } from '@saldo/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { archiveCategory } from '../../db/adminService';
import { db } from '../../db/client';
import { useRepositories } from '../../db/DatabaseProvider';
import { useCategories, useCategoryUsage } from '../../db/hooks';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

export interface ArchiveCategorySheetProps {
  visible: boolean;
  onClose: () => void;
  category: Category;
  onDone: () => void;
}

/**
 * §6.20 / §5.11. Deleting a category is not offered: a transaction without one could not satisfy
 * `transactionSchema`, so the choice is archive, optionally moving the rows to another category of
 * the same direction.
 */
export function ArchiveCategorySheet({
  visible,
  onClose,
  category,
  onDone,
}: ArchiveCategorySheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const repos = useRepositories();
  const categories = useCategories();
  const usage = useCategoryUsage();
  const [target, setTarget] = useState<string | null>(null);

  // The same count the admin list shows (§5.11). It used to be read once from its own query, so a
  // category the list called empty could open a sheet saying a transaction used it.
  const uses = usage.get(category.id) ?? 0;
  const targets = categories.filter(
    (candidate) =>
      candidate.id !== category.id &&
      candidate.direction === category.direction &&
      candidate.archivedAt === null,
  );

  const archive = (moveTo: string | null) => {
    archiveCategory(db, repos, {
      categoryId: category.id,
      moveToCategoryId: moveTo,
      nowIso: new Date().toISOString(),
    });
    onDone();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('categories.archiveTitle')}>
      <Text color="textMuted">{t('categories.archiveBody', { count: uses })}</Text>

      {uses === 0 ? null : (
        <View style={{ gap: 8 }}>
          <Text size="footnote" color="textMuted">
            {t('categories.moveTo')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {targets.map((candidate) => {
              const selected = candidate.id === target;
              return (
                <Pressable
                  key={candidate.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  // 30pt chips: the height is what falls short. 7 each way reaches 44, meeting
                  // the row above in the 6pt gap — a near miss lands on a chip, not on nothing.
                  hitSlop={{ top: 7, bottom: 7, left: 3, right: 3 }}
                  onPress={() => setTarget(selected ? null : candidate.id)}
                  style={{
                    paddingHorizontal: 10,
                    height: 30,
                    justifyContent: 'center',
                    borderRadius: theme.radii.chipSmall,
                    backgroundColor: selected ? theme.palette.accent : theme.palette.raised,
                  }}
                >
                  <Text size="footnote" color={selected ? 'onAccent' : 'text'}>
                    {candidate.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View style={{ gap: 8, marginTop: 6 }}>
        {target === null ? (
          <PrimaryButton label={t('categories.archive')} onPress={() => archive(null)} />
        ) : (
          <PrimaryButton label={t('categories.moveAndArchive')} onPress={() => archive(target)} />
        )}
        <SecondaryButton label={t('common.cancel')} onPress={onClose} />
      </View>
    </Sheet>
  );
}
