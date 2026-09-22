import { amountBufferToMinor, getCurrency } from '@saldo/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { PICKABLE_SEED_CATEGORIES, seedFromOnboarding } from '../../src/db/seed';
import { ACCOUNT_TYPE_ICONS } from '../../src/features/accounts/accountTypeIcon';
import { StepFooter } from '../../src/features/onboarding/StepFooter';
import { CHUNK, StepChunk, StepHeader } from '../../src/features/onboarding/StepHeader';
import { useOnboarding } from '../../src/features/onboarding/state';
import { enterTabs } from '../../src/navigation/history';
import { Icon } from '../../src/theme/Icon';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.29 step 3: the 12-tile grid, all selected by default; "Inizia" writes everything. */
export default function CategoriesStep() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const repos = useRepositories();
  const { draft } = useOnboarding();
  const [selected, setSelected] = useState<string[]>(
    PICKABLE_SEED_CATEGORIES.map((category) => category.nameKey),
  );
  const [saving, setSaving] = useState(false);

  const toggle = (key: string) =>
    setSelected((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    );

  const finish = () => {
    setSaving(true);
    const { minorDigits } = getCurrency(draft.currency);
    // The return value is deliberately ignored: false means a sync delivered the account's own
    // settings while the user was stepping through onboarding, and those rows win (§8.3). Either
    // way the app is ready, so the destination is the same.
    seedFromOnboarding(repos, {
      periodKind: draft.periodKind,
      cycleStartDay: draft.cycleStartDay,
      currency: draft.currency,
      language: 'system',
      theme: 'system',
      account: {
        name: draft.accountName.length > 0 ? draft.accountName : t('seed.firstAccount'),
        type: draft.accountType,
        openingBalance: amountBufferToMinor(draft.balanceBuffer, minorDigits),
        icon: ACCOUNT_TYPE_ICONS[draft.accountType],
      },
      selectedCategoryKeys: selected,
      translate: (key) => t(`seed.${key}`),
      completedAt: new Date().toISOString(),
    });
    enterTabs(router);
  };

  return (
    <Screen
      footer={
        <StepFooter
          testID="onboarding-start"
          label={t('common.start')}
          loading={saving}
          onPress={finish}
        />
      }
    >
      <StepHeader
        step={{ current: 4, total: 4 }}
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
