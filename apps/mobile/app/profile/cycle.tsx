import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useSettings } from '../../src/db/hooks';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §5.2 clamps the start day to 1–28: 29–31 has no meaning in February. */
const DAYS = Array.from({ length: 28 }, (_, index) => index + 1);

/** §6.8 "Inizio del ciclo": the day the salary cycle starts. */
export default function CycleSetting() {
  const { t } = useTranslation();
  const theme = useTheme();
  const repos = useRepositories();
  const settings = useSettings();
  const selected = settings?.cycleStartDay ?? 27;

  return (
    <Screen>
      <ScreenHeader title={t('profile.cycleStart')} />
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {DAYS.map((day) => (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityState={{ selected: day === selected }}
              accessibilityLabel={String(day)}
              onPress={() => repos.settings.update({ cycleStartDay: day })}
              style={({ pressed }) => ({
                width: 44,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radii.chipSmall,
                backgroundColor: day === selected ? theme.palette.accent : theme.palette.raised,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              })}
            >
              <Text size="footnote" tabular color={day === selected ? 'onAccent' : 'text'}>
                {day}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>
      <Text size="caption" color="textFaint">
        {t('settings.cycleFootnote')}
      </Text>
    </Screen>
  );
}
