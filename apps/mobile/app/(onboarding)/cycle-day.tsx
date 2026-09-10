import { cycleContaining, todayLocal } from '@saldo/core';
import { formatDayMonth } from '@saldo/i18n';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { PrimaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { useOnboarding } from '../../src/features/onboarding/state';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

/** §6.29 step 1: the 7-column day grid with the "your month runs from X to Y" timeline. */
export default function CycleDayStep() {
  const theme = useTheme();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { draft, setDraft } = useOnboarding();
  const [day, setDay] = useState(draft.cycleStartDay);
  const cycle = cycleContaining(todayLocal(), day);
  const locale = i18n.language === 'it' ? 'it' : 'en';

  return (
    <Screen
      footer={
        <PrimaryButton
          label={t('common.continue')}
          onPress={() => {
            setDraft({ cycleStartDay: day });
            router.push('/first-account');
          }}
        />
      }
    >
      <ProgressBar ratio={1 / 3} />
      <Text size="caption" color="textFaint">
        {t('onboarding.step', { current: 1, total: 3 })}
      </Text>
      <Text size="display" weight="semibold" tracking="tighter">
        {t('onboarding.cycleTitle')}
      </Text>
      <Text color="textMuted">{t('onboarding.cycleBody')}</Text>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {DAYS.map((value) => {
            const selected = value === day;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={String(value)}
                onPress={() => setDay(value)}
                style={{
                  width: `${100 / 7}%`,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: theme.radii.chipSmall,
                  backgroundColor: selected ? theme.palette.accent : theme.palette.raised,
                }}
              >
                <Text tabular color={selected ? 'onAccent' : 'text'}>
                  {value}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
      <Text color="textMuted" size="footnote">
        {t('onboarding.cycleTimeline', {
          start: formatDayMonth(cycle.start, locale),
          end: formatDayMonth(cycle.end, locale),
        })}
      </Text>
    </Screen>
  );
}
