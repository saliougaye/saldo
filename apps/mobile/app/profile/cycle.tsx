import { periodContaining } from '@saldo/core';
import { formatCycleRange } from '@saldo/i18n';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useSettings } from '../../src/db/hooks';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { SettingScreen } from '../../src/features/profile/SettingScreen';
import { useAppLocale } from '../../src/i18n/useAppLocale';
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
 * §6.8 "Inizio del ciclo".
 *
 * The days are laid out as a grid with no gaps, like the calendar, rather than as loose tiles: a
 * number here is a day of the month, and the app already has one way of drawing those. Above it,
 * the cycle the chosen day produces — the number on its own says nothing, "27 ago – 26 set" says
 * what the whole app will show.
 */
export default function CycleSetting() {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useAppLocale();
  const repos = useRepositories();
  const settings = useSettings();
  const { today } = usePeriod();
  const selected = settings?.cycleStartDay ?? 27;
  const preview = periodContaining({ kind: 'cycle', startDay: selected }, today);

  return (
    <SettingScreen
      title={t('profile.cycleStart')}
      subtitle={t('settings.cycleFootnote')}
      card={false}
    >
      <Card>
        <Text size="footnote" color="textMuted">
          {t('profile.cyclePreview')}
        </Text>
        <Text size="title" weight="semibold" tracking="tighter" tabular style={{ marginTop: 4 }}>
          {formatCycleRange(preview, locale, today)}
        </Text>
      </Card>

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
                  onPress={() => repos.settings.update({ cycleStartDay: day })}
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
    </SettingScreen>
  );
}
