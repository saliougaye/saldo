import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface SplitSegment {
  key: string;
  amount: number;
  colour: string;
}

/** "Ripartizione" bar of §5.4: segments sized by share, in the order given. */
export function SplitBar({
  segments,
  height = 8,
}: {
  segments: readonly SplitSegment[];
  height?: number;
}) {
  const theme = useTheme();
  const total = segments.reduce((sum, segment) => sum + segment.amount, 0);
  if (total <= 0) {
    return (
      <View
        style={{ height, borderRadius: theme.radii.pill, backgroundColor: theme.palette.track }}
      />
    );
  }
  return (
    <View
      style={{ flexDirection: 'row', height, borderRadius: theme.radii.pill, overflow: 'hidden' }}
    >
      {segments.map((segment) => (
        <View
          key={segment.key}
          style={{ flexGrow: segment.amount, backgroundColor: segment.colour }}
        />
      ))}
    </View>
  );
}
