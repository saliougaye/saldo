import type { Tag } from '@saldo/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Sheet } from '../../components/Sheet';
import { TextField } from '../../components/TextField';
import { deleteTag, mergeTags, renameTag } from '../../db/adminService';
import { db } from '../../db/client';
import { useRepositories } from '../../db/DatabaseProvider';
import { useTags } from '../../db/hooks';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

export interface TagEditSheetProps {
  visible: boolean;
  onClose: () => void;
  tag: Tag;
  onDeleted: () => void;
}

/** §6.24 / §5.10: rename, merge into another tag, or delete while keeping the transactions. */
export function TagEditSheet({ visible, onClose, tag, onDeleted }: TagEditSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const repos = useRepositories();
  const tags = useTags();
  const [name, setName] = useState(tag.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const others = tags.filter((candidate) => candidate.id !== tag.id);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('tags.editTag')}>
      <TextField label={t('tags.name')} value={name} onChangeText={setName} />

      {others.length === 0 ? null : (
        <View style={{ gap: 8, marginTop: 4 }}>
          <Text size="footnote" color="textMuted">
            {t('tags.mergeInto')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {others.map((other) => (
              <Pressable
                key={other.id}
                accessibilityRole="button"
                onPress={() => {
                  mergeTags(db, repos, tag.id, other.id);
                  onDeleted();
                }}
                style={{
                  paddingHorizontal: 10,
                  height: 30,
                  justifyContent: 'center',
                  borderRadius: theme.radii.chipSmall,
                  backgroundColor: theme.palette.raised,
                }}
              >
                <Text size="footnote">{other.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={{ gap: 8, marginTop: 6 }}>
        <PrimaryButton
          label={t('common.save')}
          disabled={name.trim().length === 0}
          onPress={() => {
            renameTag(repos, tag.id, name.trim());
            onClose();
          }}
        />
        <SecondaryButton label={t('tags.delete')} onPress={() => setConfirmDelete(true)} />
      </View>

      <ConfirmDialog
        visible={confirmDelete}
        title={t('tags.deleteConfirm', { name: tag.name })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          deleteTag(db, repos, tag.id);
          setConfirmDelete(false);
          onDeleted();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </Sheet>
  );
}
