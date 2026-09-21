import type { Tag } from '@saldo/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { TextField } from '../../components/TextField';
import { deleteTag, mergeTags, renameTag } from '../../db/adminService';
import { db } from '../../db/client';
import { useRepositories } from '../../db/DatabaseProvider';
import { useTags } from '../../db/hooks';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { tagMissingForSave } from './tagName';

export interface TagEditCardProps {
  tag: Pick<Tag, 'id' | 'name'>;
  /** Called after a merge or a delete, when there is no tag left to show. */
  onDeleted: () => void;
}

/**
 * §6.24 / §5.10: rename, merge into another tag, or delete while keeping the transactions.
 *
 * A card on the tag's own screen rather than a sheet over it. Two of the three actions are
 * irreversible and one asks for confirmation, which is the line the form-architecture decisions
 * draw: a sheet is for a choice made and closed, a screen for one with a confirmation.
 */
export function TagEditCard({ tag, onDeleted }: TagEditCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const repos = useRepositories();
  const tags = useTags();
  const [name, setName] = useState(tag.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const others = tags.filter((candidate) => candidate.id !== tag.id);
  const missing = tagMissingForSave(name, tags, tag.id);

  return (
    <Card>
      <View style={{ gap: 12 }}>
        {/* The sheet carried this as its title; on a screen the section needs its own heading. */}
        <Text size="footnote" color="textMuted">
          {t('tags.editTag')}
        </Text>

        <TextField label={t('tags.name')} value={name} onChangeText={setName} />

        {/* The actions sit under the name, above the merge list: that list grows with every tag,
            and it used to push Save and Delete below the fold. */}
        <View style={{ gap: 8 }}>
          {missing === null ? null : (
            // Not an error — nothing is wrong yet — so it is a muted line, not a red one.
            <Text size="footnote" color="textMuted">
              {t(`tags.missing_${missing}`)}
            </Text>
          )}
          <PrimaryButton
            label={t('common.save')}
            disabled={missing !== null}
            onPress={() => renameTag(repos, tag.id, name.trim())}
          />
          <SecondaryButton label={t('tags.delete')} onPress={() => setConfirmDelete(true)} />
        </View>

        {others.length === 0 ? null : (
          <View style={{ gap: 8 }}>
            <Text size="footnote" color="textMuted">
              {t('tags.mergeInto')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {others.map((other) => (
                <Pressable
                  key={other.id}
                  accessibilityRole="button"
                  // 30pt chips, as in `ArchiveCategorySheet`, and short by the same 14.
                  hitSlop={{ top: 7, bottom: 7, left: 3, right: 3 }}
                  onPress={() => {
                    mergeTags(db, repos, tag.id, other.id);
                    onDeleted();
                  }}
                  style={({ pressed }) => ({
                    paddingHorizontal: 10,
                    height: 30,
                    justifyContent: 'center',
                    borderRadius: theme.radii.chipSmall,
                    backgroundColor: theme.palette.raised,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  })}
                >
                  <Text size="footnote">{other.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
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
    </Card>
  );
}
