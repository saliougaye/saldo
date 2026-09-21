import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PrimaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { TextField } from '../../src/components/TextField';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useTags } from '../../src/db/hooks';
import { tagMissingForSave } from '../../src/features/tags/TagEditCard';
import { Text } from '../../src/theme/Text';

/**
 * §5.10: a tag made ahead of the transactions that will carry it — for a trip before its first
 * receipt. The inline "Crea «X»" on the transaction form remains the other way in.
 */
export default function NewTag() {
  const router = useRouter();
  const { t } = useTranslation();
  const repos = useRepositories();
  const tags = useTags();
  const [name, setName] = useState('');
  const missing = tagMissingForSave(name, tags);

  return (
    <Screen
      footer={
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
            onPress={() => {
              repos.tags.create({ name: name.trim() });
              router.back();
            }}
          />
        </View>
      }
    >
      <ScreenHeader title={t('tags.newTag')} />
      <Card>
        <TextField label={t('tags.name')} value={name} onChangeText={setName} autoFocus />
      </Card>
    </Screen>
  );
}
