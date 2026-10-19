import { PERIOD_KINDS, type PeriodDef, periodContaining } from '@saldo/core';
import { formatCycleRange } from '@saldo/i18n';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useSettings } from '../../src/db/hooks';
import { InfoButton } from '../../src/features/guide/InfoButton';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { SettingScreen } from '../../src/features/profile/SettingScreen';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Icon } from '../../src/theme/Icon';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §5.2 clamps the start day to 1–28: 29–31 has no meaning in February. Four rows of seven. */
const COLUMNS = 7;
const DAYS = Array.from({ length: 28 }, (_, index) => index + 1);
const ROWS = Array.from({ length: DAYS.length / COLUMNS }, (_, row) =>
  DAYS.slice(row * COLUMNS, row * COLUMNS + COLUMNS),
);
const CELL_HEIGHT = 44;

/**
 * §6.8 "Periodo". The four kinds as onboarding step 1 lists them, then what the choice produces
 * today; the day grid only under the pay cycle, the one kind that asks a second question (§5.2).
 *
 * The days are laid out as a grid with no gaps, like the calendar, rather than as loose tiles: a
 * number here is a day of the month, and the app already has one way of drawing those. Above it,
 * the period the choice produces — the number on its own says nothing, "27 ago – 26 set" says
 * what the whole app will show.
 */
export default function PeriodSetting() {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useAppLocale();
  const repos = useRepositories();
  const settings = useSettings();
  const { today, resetToCurrent } = usePeriod();
  const kind = settings?.periodKind ?? 'month';
  const selected = settings?.cycleStartDay ?? 27;
  const def: PeriodDef = { kind, startDay: selected };
  const preview = periodContaining(def, today);

  return (
    <SettingScreen
      title={t('period.title')}
      subtitle={t('settings.cycleFootnote')}
      card={false}
      trailing={<InfoButton concept="period" />}
    >
      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 4 }}>
          {PERIOD_KINDS.map((value, index) => (
            <Fragment key={value}>
              {index > 0 ? (
                <View style={{ height: 1, backgroundColor: theme.palette.border }} />
              ) : null}
              <View style={{ paddingVertical: 5 }}>
                <ListRow
                  title={t(`period.kind_${value}`)}
                  subtitle={t(`period.kindBody_${value}`)}
                  trailing={
                    value === kind ? (
                      <Icon name="check" size={18} color={theme.palette.accent} />
                    ) : undefined
                  }
                  onPress={() => {
                    repos.settings.update({ periodKind: value });
                    // The stored range belongs to the old kind (§5.2): back to the current period.
                    resetToCurrent();
                  }}
                />
              </View>
            </Fragment>
          ))}
        </View>
      </Card>

      <Card>
        <Text size="footnote" color="textMuted">
          {t('profile.periodPreview')}
        </Text>
        <Text size="title" weight="semibold" tracking="tighter" tabular style={{ marginTop: 4 }}>
          {formatCycleRange(preview, locale, today)}
        </Text>
      </Card>

      {kind === 'cycle' ? (
        <Card>
          {ROWS.map((row) => (
            <View key={row[0]} style={{ flexDirection: 'row' }}>
              {row.map((day) => {
                const isSelected = day === selected;
                return (
                  <Pressable
                    key={day}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={t('profile.cycleDay', { day })}
                    onPress={() => {
                      repos.settings.update({ cycleStartDay: day });
                      resetToCurrent();
                    }}
                    style={({ pressed }) => ({
                      flex: 1,
                      height: CELL_HEIGHT,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: isSelected ? theme.radii.input : 0,
                      backgroundColor: isSelected ? theme.palette.accent : 'transparent',
                      opacity: pressed ? 0.6 : 1,
                      transform: [{ scale: pressed && !isSelected ? 0.96 : 1 }],
                    })}
                  >
                    <Text
                      size="footnote"
                      tabular
                      weight={isSelected ? 'medium' : 'regular'}
                      color={isSelected ? 'onAccent' : 'text'}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Card>
      ) : null}
    </SettingScreen>
  );
}
