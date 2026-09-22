import type { Tag } from '@saldo/core';
import { useTranslation } from 'react-i18next';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { deleteTag } from '../../db/adminService';
import { db } from '../../db/client';
import { useRepositories } from '../../db/DatabaseProvider';
import { Text } from '../../theme/Text';

export interface DeleteTagSheetProps {
  visible: boolean;
  onClose: () => void;
  tag: Pick<Tag, 'id' | 'name'>;
  /** How many transactions carry the tag: the note says they stay. */
  uses: number;
  /** Called after the delete, when there is no tag left to show. */
  onDeleted: () => void;
}

/**
 * §5.10 delete: the tag goes, its transactions stay without it. Confirmed in a sheet of its own,
 * the same shape as `MergeTagSheet`, opened from "Elimina tag" in `TagEditSheet`.
 */
export function DeleteTagSheet({ visible, onClose, tag, uses, onDeleted }: DeleteTagSheetProps) {
  const { t } = useTranslation();
  const repos = useRepositories();

  return (
    <Sheet visible={visible} onClose={onClose} title={t('tags.deleteTitle', { name: tag.name })}>
      <Text color="textMuted">
        {uses === 0 ? t('tags.deleteNoteUnused') : t('tags.deleteNote', { count: uses })}
      </Text>
      <PrimaryButton
        label={t('common.delete')}
        onPress={() => {
          deleteTag(db, repos, tag.id);
          onClose();
          onDeleted();
        }}
      />
      <SecondaryButton label={t('common.cancel')} onPress={onClose} />
    </Sheet>
  );
}
