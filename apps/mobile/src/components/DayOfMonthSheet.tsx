import { Pressable, View } from 'react-native';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';
import { Sheet } from './Sheet';

/** Credit-card days are 1–28 so every month has them (§4). */
const DAYS = Array.from({ length: 28 }, (_, index) => index + 1);

export function DayOfMonthSheet({
  visible,
  onClose,
  title,
  value,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  value: number | null;
  onSelect: (day: number) => void;
}) {
  const theme = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {DAYS.map((day) => {
          const selected = day === value;
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={String(day)}
              onPress={() => {
                onSelect(day);
                onClose();
              }}
              style={({ pressed }) => ({
                width: 38,
                height: 38,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radii.chipSmall,
                backgroundColor: selected ? theme.palette.accent : theme.palette.raised,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              })}
            >
              <Text size="footnote" tabular color={selected ? 'onAccent' : 'text'}>
                {day}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}
