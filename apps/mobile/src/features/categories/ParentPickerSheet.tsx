import type { Category } from '@saldo/core';
import type { IconName } from '@saldo/ui';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { IconBox, ListRow } from '../../components/ListRow';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../theme/Icon';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * The category a category sits under (§4). Top level only — a child cannot have children — and
 * "Nessuna" first, because detaching is as common a choice as attaching.
 */
export function ParentPickerSheet({
  visible,
  onClose,
  parents,
  selectedId,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  parents: readonly Category[];
  selectedId: string | null;
  onSelect: (parentId: string | null) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const check = (isSelected: boolean) =>
    isSelected ? <Icon name="check" size={16} color={theme.palette.accent} /> : undefined;
  return (
    <Sheet visible={visible} onClose={onClose} title={t('categories.parent')} tall>
      <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
        <View>
          <ListRow
            title={t('categories.noParent')}
            trailing={check(selectedId === null)}
            onPress={() => {
              onSelect(null);
              onClose();
            }}
          />
          {parents.map((parent) => (
            <ListRow
              key={parent.id}
              title={parent.name}
              leading={
                <IconBox
                  name={parent.icon as IconName}
                  colour={theme.categoryColor(parent.colorIndex)}
                />
              }
              trailing={check(parent.id === selectedId)}
              onPress={() => {
                onSelect(parent.id);
                onClose();
              }}
            />
          ))}
        </View>
      </ScrollView>
    </Sheet>
  );
}
