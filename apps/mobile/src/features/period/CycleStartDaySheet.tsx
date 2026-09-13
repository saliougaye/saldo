import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Sheet } from '../../components/Sheet';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

/** 1–28 only: a start day of 29–31 has no meaning in February (§5.2). */
const DAYS = Array.from({ length: 28 }, (_, index) => index + 1);

/** §6.15 "Giorno di inizio ciclo". Shown only while the period kind is the pay cycle. */
export function CycleStartDaySheet({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: number;
  onSelect: (day: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Sheet visible={visible} onClose={onClose} title={t('period.cycleStartDay')}>
      <View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {DAYS.map((day) => {
            const isSelected = day === selected;
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={String(day)}
                // The keys are 40pt tall; the two points each way are all the 6pt gap allows,
                // and all the 44pt floor asks for.
                hitSlop={{ top: 2, bottom: 2 }}
                onPress={() => {
                  onSelect(day);
                  onClose();
                }}
                style={{
                  width: `${100 / 7}%`,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: theme.radii.chipSmall,
                  backgroundColor: isSelected ? theme.palette.accent : theme.palette.raised,
                }}
              >
                <Text tabular color={isSelected ? 'onAccent' : 'text'}>
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text size="footnote" color="textMuted" style={{ marginTop: 12 }}>
          {t('settings.cycleFootnote')}
        </Text>
      </View>
    </Sheet>
  );
}
