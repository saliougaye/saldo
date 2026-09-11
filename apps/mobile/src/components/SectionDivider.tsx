import { View } from 'react-native';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

/**
 * A labelled boundary between two runs of cards.
 *
 * A caption alone is enough above a group that starts the screen; between two groups that look
 * alike it is not, because by the time you have scrolled to it the header that explained the first
 * group is gone. The rule carries the break across the full width, so it reads as "a different
 * kind of thing starts here" wherever the scroll happens to be.
 */
export function SectionDivider({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 }}>
      <Text size="caption" color="textMuted" weight="medium" style={{ textTransform: 'uppercase' }}>
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: theme.palette.border }} />
    </View>
  );
}
