import type { Tag } from '@saldo/core';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { mergeTags } from '../../db/adminService';
import { db } from '../../db/client';
import { useRepositories } from '../../db/DatabaseProvider';
import { useTags } from '../../db/hooks';
import { Text } from '../../theme/Text';
import { OptionRow } from '../profile/SettingScreen';

export interface MergeTagSheetProps {
  visible: boolean;
  onClose: () => void;
  tag: Pick<Tag, 'id' | 'name'>;
  /** How many transactions carry the tag: the note says what the merge will move. */
  uses: number;
  /** Called after the merge, when the tag no longer exists. */
  onMerged: () => void;
}

/**
 * §5.10 "Unisci a un altro tag", as an action of its own rather than a field of the edit.
 *
 * Merging rewrites every transaction the tag carries and cannot be undone, so a tap on a tag only
 * picks it: the sheet then says what will happen, and "Unisci" is what does it. The list used to
 * merge on the first tap, one mis-hit away from losing the tag.
 */
export function MergeTagSheet({ visible, onClose, tag, uses, onMerged }: MergeTagSheetProps) {
  const { t } = useTranslation();
  const repos = useRepositories();
  const tags = useTags();
  const [targetId, setTargetId] = useState<string | null>(null);

  // A pick left behind by Cancel must not be one tap from merging on the next visit.
  useEffect(() => {
    if (visible) setTargetId(null);
  }, [visible]);

  const others = tags.filter((candidate) => candidate.id !== tag.id);
  const target = others.find((candidate) => candidate.id === targetId);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('tags.mergeTitle', { name: tag.name })}>
      <ScrollView style={{ flexShrink: 1 }}>
        {others.map((other) => (
          <OptionRow
            key={other.id}
            label={other.name}
            selected={other.id === targetId}
            onPress={() => setTargetId(other.id)}
          />
        ))}
      </ScrollView>
      {target === undefined ? null : (
        <Text size="footnote" color="textMuted">
          {uses === 0
            ? t('tags.mergeNoteUnused', { name: tag.name, target: target.name })
            : t('tags.mergeNote', { count: uses, name: tag.name, target: target.name })}
        </Text>
      )}
      <PrimaryButton
        label={t('tags.merge')}
        disabled={target === undefined}
        onPress={() => {
          if (target === undefined) return;
          mergeTags(db, repos, tag.id, target.id);
          onClose();
          onMerged();
        }}
      />
      <SecondaryButton label={t('common.cancel')} onPress={onClose} />
    </Sheet>
  );
}
