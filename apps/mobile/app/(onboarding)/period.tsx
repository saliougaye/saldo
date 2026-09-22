import { PERIOD_KINDS, type PeriodKind, periodContaining, todayLocal } from '@saldo/core';
import { formatDayMonth } from '@saldo/i18n';
import { useRouter } from 'expo-router';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { StepFooter } from '../../src/features/onboarding/StepFooter';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { StepChunk, StepHeader } from '../../src/features/onboarding/StepHeader';
import { ONBOARDING_STEPS, useOnboarding } from '../../src/features/onboarding/state';
import { Icon } from '../../src/theme/Icon';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * §6.29 step 1: how the user tracks spending. The month is the default because it needs no
 * decision; the pay cycle is the one kind that asks a second question, and that question gets a
 * screen of its own (`cycle-day`) under the same step number — one screen, one thing to decide.
 */
export default function PeriodStep() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { draft, setDraft } = useOnboarding();
  const [kind, setKind] = useState<PeriodKind>(draft.periodKind);
  const locale = useAppLocale();
  // The cycle has no day yet; its timeline waits for the next screen.
  const preview =
    kind === 'cycle'
      ? null
      : periodContaining({ kind, startDay: draft.cycleStartDay }, todayLocal());

  return (
    <Screen
      footer={
        <StepFooter
          testID="onboarding-period-continue"
          label={t('common.continue')}
          onPress={() => {
            setDraft({ periodKind: kind });
            if (kind === 'cycle') router.push('/cycle-day');
            else router.push(draft.path === 'import' ? '/import-currency' : '/account-details');
          }}
        />
      }
    >
      <StepHeader
        step={{ current: 1, total: ONBOARDING_STEPS }}
        title={t('onboarding.periodTitle')}
        body={t('onboarding.periodBody')}
      />
      <StepChunk>
        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 4 }}>
            {PERIOD_KINDS.map((value, index) => (
              <Fragment key={value}>
                {/* A rule between choices, as the design draws them (1616–1717). */}
                {index > 0 ? (
                  <View style={{ height: 1, backgroundColor: theme.palette.border }} />
                ) : null}
                {/* 13pt above and below, the design's row height for a choice list. */}
                <View style={{ paddingVertical: 5 }}>
                  <ListRow
                    title={t(`period.kind_${value}`)}
                    subtitle={t(`period.kindBody_${value}`)}
                    trailing={
                      value === kind ? (
                        <Icon name="check" size={18} color={theme.palette.accent} />
                      ) : undefined
                    }
                    onPress={() => setKind(value)}
                  />
                </View>
              </Fragment>
            ))}
          </View>
          {/* What the choice means today, as the card's last line: it belongs to the choice. */}
          {preview === null ? null : (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: theme.palette.border,
                paddingHorizontal: theme.layout.cardPadding,
                paddingVertical: 12,
              }}
            >
              <Text color="textMuted" size="footnote">
                {t('onboarding.periodTimeline', {
                  start: formatDayMonth(preview.start, locale),
                  end: formatDayMonth(preview.end, locale),
                })}
              </Text>
            </View>
          )}
        </Card>
      </StepChunk>
    </Screen>
  );
}
