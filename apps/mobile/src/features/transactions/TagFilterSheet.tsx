import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Sheet } from '../../components/Sheet';
import { useTags, useTagUsage } from '../../db/hooks';
import { Text } from '../../theme/Text';

export interface TagFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  selected: readonly string[];
  onChange: (tagIds: string[]) => void;
}

/** §6.23: multi-select ordered by usage, with Azzera / Fatto. */
export function TagFilterSheet({ visible, onClose, selected, onChange }: TagFilterSheetProps) {
  const { t } = useTranslation();
  const tags = useTags();
  const usage = useTagUsage();

  const ordered = useMemo(
    () => [...tags].sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0)),
    [tags, usage],
  );

  return (
    <Sheet visible={visible} onClose={onClose} title={t('transactions.tags')}>
      {ordered.length === 0 ? (
        <Text color="textMuted">{t('tags.empty')}</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {ordered.map((tag) => {
            const isSelected = selected.includes(tag.id);
            return (
              <Chip
                key={tag.id}
                label={tag.name}
                active={isSelected}
                onPress={() =>
                  onChange(
                    isSelected ? selected.filter((id) => id !== tag.id) : [...selected, tag.id],
                  )
                }
              />
            );
          })}
        </View>
      )}
      <View style={{ gap: 8, marginTop: 6 }}>
        <PrimaryButton label={t('common.done')} onPress={onClose} />
        <SecondaryButton label={t('common.reset')} onPress={() => onChange([])} />
      </View>
    </Sheet>
  );
}
