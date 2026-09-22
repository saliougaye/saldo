import { periodContaining, todayLocal } from '@saldo/core';
import { formatDayMonth } from '@saldo/i18n';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StepFooter } from '../../src/features/onboarding/StepFooter';
import { StepChunk, StepHeader } from '../../src/features/onboarding/StepHeader';
import { ONBOARDING_STEPS, useOnboarding } from '../../src/features/onboarding/state';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** 1–28 so every month has the day (§5.2), laid out as the four weeks they are. */
const WEEKS = Array.from({ length: 4 }, (_, week) =>
  Array.from({ length: 7 }, (_, index) => week * 7 + index + 1),
);

/**
 * §6.29 step 1, second screen, only for the pay cycle: the day it starts. Same step number as
 * the period kind — the user is still answering "how do you track spending" — so the strip does
 * not move.
 */
export default function CycleDayStep() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { draft, setDraft } = useOnboarding();
  const [day, setDay] = useState(draft.cycleStartDay);
  const locale = useAppLocale();
  const preview = periodContaining({ kind: 'cycle', startDay: day }, todayLocal());

  return (
    <Screen
      footer={
        <StepFooter
          testID="onboarding-cycle-day-continue"
          label={t('common.continue')}
          onPress={() => {
            setDraft({ cycleStartDay: day });
            router.push(draft.path === 'import' ? '/import-currency' : '/account-details');
          }}
        />
      }
    >
      <StepHeader
        step={{ current: 1, total: ONBOARDING_STEPS }}
        title={t('onboarding.cycleTitle')}
        body={t('onboarding.cycleBody')}
      />
      <StepChunk>
        <Card padded={false}>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('period.cycleStartDay')}
            style={{ gap: 6, padding: theme.layout.cardPadding }}
          >
            {WEEKS.map((week) => (
              <View key={week[0]} style={{ flexDirection: 'row', gap: 6 }}>
                {week.map((value) => {
                  const selected = value === day;
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={String(value)}
                      // Seven equal keys fill the row, edge to edge with the card's padding.
                      hitSlop={3}
                      onPress={() => setDay(value)}
                      style={({ pressed }) => ({
                        flex: 1,
                        height: 40,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: theme.radii.chipSmall,
                        backgroundColor: selected ? theme.palette.accent : theme.palette.raised,
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      })}
                    >
                      <Text size="footnote" tabular color={selected ? 'onAccent' : 'text'}>
                        {value}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: theme.palette.border,
              paddingHorizontal: theme.layout.cardPadding,
              paddingVertical: 12,
            }}
          >
            <Text color="textMuted" size="footnote">
              {t('onboarding.cycleTimeline', {
                start: formatDayMonth(preview.start, locale),
                end: formatDayMonth(preview.end, locale),
              })}
            </Text>
          </View>
        </Card>
      </StepChunk>
    </Screen>
  );
}
