import type { Tag } from '@saldo/core';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { TextField } from '../../components/TextField';
import { deleteTag, renameTag } from '../../db/adminService';
import { db } from '../../db/client';
import { useRepositories } from '../../db/DatabaseProvider';
import { useTags } from '../../db/hooks';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { tagMissingForSave } from './tagName';

export interface TagEditSheetProps {
  visible: boolean;
  onClose: () => void;
  tag: Pick<Tag, 'id' | 'name'>;
  /** Called after a delete, when there is no tag left to show. */
  onDeleted: () => void;
}

/**
 * §5.10 "Modifica tag": rename, or delete while keeping the transactions.
 *
 * The twin of "Nuovo tag" — same field, same Save and Cancel — so editing a tag looks like making
 * one. Delete lives here as it does in every other edit of the app, behind the inline confirmation
 * §5.10 asks for. Merging does not: it is its own action with its own sheet (`MergeTagSheet`), so
 * the one irreversible choice that rewrites other transactions is never a tap away from Save.
 */
export function TagEditSheet({ visible, onClose, tag, onDeleted }: TagEditSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const repos = useRepositories();
  const tags = useTags();
  const [name, setName] = useState(tag.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const missing = tagMissingForSave(name, tags, tag.id);

  // Each opening starts from the tag as it is now: a draft or a half-asked delete left behind by
  // Cancel would otherwise greet the next visit.
  useEffect(() => {
    if (!visible) return;
    setName(tag.name);
    setConfirmDelete(false);
  }, [visible, tag.name]);

  const save = () => {
    if (missing !== null) return;
    renameTag(repos, tag.id, name.trim());
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('tags.editTag')}>
      <TextField
        label={t('tags.name')}
        value={name}
        onChangeText={setName}
        returnKeyType="done"
        onSubmitEditing={save}
      />
      {missing === null ? null : (
        // Not an error — nothing is wrong yet — so it is a muted line, not a red one.
        <Text size="footnote" color="textMuted">
          {t(`tags.missing_${missing}`)}
        </Text>
      )}
      <PrimaryButton label={t('common.save')} disabled={missing !== null} onPress={save} />
      <SecondaryButton label={t('common.cancel')} onPress={onClose} />

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: theme.palette.border,
          minHeight: 44,
          justifyContent: 'center',
          marginTop: 4,
          paddingTop: 4,
        }}
      >
        {confirmDelete ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Text size="footnote" color="textMuted" style={{ flex: 1 }}>
              {t('tags.deleteConfirm', { name: tag.name })}
            </Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => setConfirmDelete(false)}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text size="footnote" color="textMuted">
                {t('common.cancel')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => {
                deleteTag(db, repos, tag.id);
                onClose();
                onDeleted();
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text size="footnote" weight="semibold">
                {t('common.delete')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setConfirmDelete(true)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              alignSelf: 'flex-start',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon name="trash" size={16} color={theme.palette.textMuted} />
            <Text color="textMuted">{t('tags.delete')}</Text>
          </Pressable>
        )}
      </View>
    </Sheet>
  );
}
