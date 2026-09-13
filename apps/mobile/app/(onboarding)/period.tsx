import { PERIOD_KINDS, type PeriodKind, periodContaining, todayLocal } from '@saldo/core';
import { formatDayMonth } from '@saldo/i18n';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { PrimaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { BackButton } from '../../src/components/ScreenHeader';
import { useOnboarding } from '../../src/features/onboarding/state';
import { Icon } from '../../src/theme/Icon';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

const DAYS = Array.from({ length: 28 }, (_, index) => index + 1);

/**
 * §6.29 step 1: how the user tracks spending. The month is the default because it needs no
 * decision; the pay cycle is the one kind that asks a second question, so its day grid appears
 * only when it is chosen — and it stops at 28 for the reason §5.2 gives.
 */
export default function PeriodStep() {
  const theme = useTheme();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { draft, setDraft } = useOnboarding();
  const [kind, setKind] = useState<PeriodKind>(draft.periodKind);
  const [day, setDay] = useState(draft.cycleStartDay);
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const preview = periodContaining({ kind, startDay: day }, todayLocal());

  return (
    <Screen
      footer={
        <PrimaryButton
          label={t('common.continue')}
          onPress={() => {
            setDraft({ periodKind: kind, cycleStartDay: day });
            router.push('/account-details');
          }}
        />
      }
    >
      <BackButton />
      <ProgressBar ratio={1 / 4} />
      <Text size="caption" color="textFaint">
        {t('onboarding.step', { current: 1, total: 4 })}
      </Text>
      <Text size="display" weight="semibold" tracking="tighter">
        {t('onboarding.periodTitle')}
      </Text>
      <Text color="textMuted">{t('onboarding.periodBody')}</Text>

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 4 }}>
          {PERIOD_KINDS.map((value) => (
            <ListRow
              key={value}
              title={t(`period.kind_${value}`)}
              subtitle={t(`period.kindBody_${value}`)}
              trailing={
                value === kind ? (
                  <Icon name="check" size={18} color={theme.palette.accent} />
                ) : undefined
              }
              onPress={() => setKind(value)}
            />
          ))}
        </View>
      </Card>

      {kind === 'cycle' ? (
        <Card>
          <Text size="footnote" color="textMuted">
            {t('period.cycleStartDay')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {DAYS.map((value) => {
              const selected = value === day;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={String(value)}
                  // 40pt keys, 6 apart — the same grid, and the same two points, as the sheet.
                  hitSlop={{ top: 2, bottom: 2 }}
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
      ) : null}

      <Text color="textMuted" size="footnote">
        {t('onboarding.periodTimeline', {
          start: formatDayMonth(preview.start, locale),
          end: formatDayMonth(preview.end, locale),
        })}
      </Text>
    </Screen>
  );
}
