import type { Category, TransactionKind } from '@saldo/core';
import { childCategories, topLevelCategories } from '@saldo/core';
import type { IconName } from '@saldo/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { IconBox, ListRow } from '../../components/ListRow';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../theme/Icon';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Parents first, each followed by its own children, so the list reads as the tree it is (§5.11).
 *
 * The filtering and the ordering come from `@saldo/core`, which is where the admin list reads them
 * too: the two used to sort and indent the same tree by their own rules and disagree about it.
 */
function ordered(categories: readonly Category[], kind: TransactionKind): Category[] {
  const direction = kind === 'income' ? 'income' : 'expense';
  return topLevelCategories(categories, direction).flatMap((parent) => [
    parent,
    ...childCategories(categories, parent.id),
  ]);
}

/**
 * The full category list behind "Altro" (§6.16). The grid on the form shows what is used most;
 * everything else, subcategories included, lives here — where it costs a scroll instead of half
 * the form.
 */
export function CategoryPickerSheet({
  visible,
  categories,
  kind,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  categories: readonly Category[];
  kind: TransactionKind;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const rows = useMemo(() => ordered(categories, kind), [categories, kind]);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('txForm.allCategories')} tall>
      <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
        <View>
          {rows.map((category) => (
            <View key={category.id} style={{ paddingStart: category.parentId === null ? 0 : 16 }}>
              <ListRow
                title={category.name}
                leading={
                  <IconBox
                    name={category.icon as IconName}
                    colour={theme.categoryColor(category.colorIndex)}
                    small={category.parentId !== null}
                  />
                }
                trailing={
                  category.id === selectedId ? (
                    <Icon name="check" size={16} color={theme.palette.accent} />
                  ) : undefined
                }
                onPress={() => {
                  onSelect(category.id);
                  onClose();
                }}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </Sheet>
  );
}
