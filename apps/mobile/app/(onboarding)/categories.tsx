import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { PICKABLE_SEED_CATEGORIES } from '../../src/db/seed';
import { StepFooter } from '../../src/features/onboarding/StepFooter';
import { CHUNK, StepChunk, StepHeader } from '../../src/features/onboarding/StepHeader';
import { ONBOARDING_STEPS, useOnboarding } from '../../src/features/onboarding/state';
import { Icon } from '../../src/theme/Icon';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.29 step 4: the 12-tile grid, all selected by default. «Inizia» is on step 5 now. */
export default function CategoriesStep() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { setDraft } = useOnboarding();
  const [selected, setSelected] = useState<string[]>(
    PICKABLE_SEED_CATEGORIES.map((category) => category.nameKey),
  );

  const toggle = (key: string) =>
    setSelected((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    );

  return (
    <Screen
      footer={
        <StepFooter
          testID="onboarding-categories-continue"
          label={t('common.continue')}
          onPress={() => {
            setDraft({ selectedCategoryKeys: selected });
            router.push('/permissions');
          }}
        />
      }
    >
      <StepHeader
        step={{ current: 4, total: ONBOARDING_STEPS }}
        title={t('onboarding.categoriesTitle')}
        body={t('onboarding.categoriesBody')}
      />
      <StepChunk>
        <Text size="footnote" color="textFaint">
          {t('onboarding.categoriesSelected', { count: selected.length })}
        </Text>
      </StepChunk>
      <StepChunk index={CHUNK.content + 1}>
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PICKABLE_SEED_CATEGORIES.map((category) => {
              const isSelected = selected.includes(category.nameKey);
              const colour = theme.categoryColor(category.colorIndex);
              return (
                <Pressable
                  key={category.nameKey}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={t(`seed.${category.nameKey}`)}
                  onPress={() => toggle(category.nameKey)}
                  style={{
                    width: '31%',
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: 12,
                    borderRadius: theme.radii.input,
                    borderWidth: 1,
                    borderColor: isSelected ? theme.palette.borderStrong : theme.palette.border,
                    backgroundColor: isSelected ? theme.tint(colour, 0.14) : 'transparent',
                    opacity: isSelected ? 1 : 0.45,
                  }}
                >
                  <Icon name={category.icon} size={20} color={colour} />
                  <Text size="caption" numberOfLines={1}>
                    {t(`seed.${category.nameKey}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      </StepChunk>
    </Screen>
  );
}
