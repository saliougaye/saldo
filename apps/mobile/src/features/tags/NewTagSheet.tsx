import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { TextField } from '../../components/TextField';
import { useRepositories } from '../../db/DatabaseProvider';
import { useTags } from '../../db/hooks';
import { Text } from '../../theme/Text';
import { tagMissingForSave } from './tagName';

/**
 * §5.10 "Nuovo tag": a tag made ahead of the transactions that will carry it.
 *
 * A sheet, not a screen: a tag is only its name, so there is one field to fill and nothing to
 * confirm — the choice made and closed that the form-architecture decisions give to a sheet.
 */
export function NewTagSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const repos = useRepositories();
  const tags = useTags();
  const [name, setName] = useState('');
  const missing = tagMissingForSave(name, tags);

  const close = () => {
    setName('');
    onClose();
  };
  const save = () => {
    if (missing !== null) return;
    repos.tags.create({ name: name.trim() });
    close();
  };

  return (
    <Sheet visible={visible} onClose={close} title={t('tags.newTag')}>
      <TextField
        label={t('tags.name')}
        value={name}
        onChangeText={setName}
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
      <SecondaryButton label={t('common.cancel')} onPress={close} />
    </Sheet>
  );
}
