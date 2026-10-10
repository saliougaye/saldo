import type { Tag } from '@saldo/core';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { TextField } from '../../components/TextField';
import { renameTag } from '../../db/adminService';
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
  /**
   * "Elimina tag" was pressed. The screen closes this sheet and opens `DeleteTagSheet` once it is
   * gone: iOS drops a modal presented while another is still dismissing.
   */
  onDelete: () => void;
  /** Passed through to `Sheet`: runs once the sheet has finished going away. */
  onDismissed?: () => void;
}

/**
 * §5.10 "Modifica tag": rename, and the way to delete.
 *
 * The twin of "Nuovo tag" — same field, same Save and Cancel — so editing a tag looks like making
 * one. Delete starts here as it does in every other edit of the app, but is confirmed in a sheet of
 * its own (`DeleteTagSheet`) rather than inline, the way merging is (`MergeTagSheet`): the two
 * irreversible actions share one confirmation shape, and neither is a tap away from Save.
 */
export function TagEditSheet({ visible, onClose, tag, onDelete, onDismissed }: TagEditSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const repos = useRepositories();
  const tags = useTags();
  const [name, setName] = useState(tag.name);
  const missing = tagMissingForSave(name, tags, tag.id);

  // Each opening starts from the tag as it is now: a draft left behind by Cancel would otherwise
  // greet the next visit.
  useEffect(() => {
    if (visible) setName(tag.name);
  }, [visible, tag.name]);

  const save = () => {
    if (missing !== null) return;
    renameTag(repos, tag.id, name.trim());
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('tags.editTag')} onDismissed={onDismissed}>
      <TextField
        testID="tag-edit-name"
        label={t('tags.name')}
        value={name}
        onChangeText={setName}
        // Focused as in "Nuovo tag": renaming is the reason to open this sheet.
        autoFocus
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
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={onDelete}
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
      </View>
    </Sheet>
  );
}
