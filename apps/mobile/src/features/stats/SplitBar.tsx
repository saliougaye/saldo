import { splitShares } from '@saldo/ui';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useHiddenAmounts } from '../hidden/hiddenAmounts';

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
  const { hidden } = useHiddenAmounts();
  const shares = splitShares(segments);
  // The empty track is also the hidden rendering: shares are the figures, drawn as widths.
  if (hidden || shares === null) {
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
      {shares.map(({ segment, share }) => (
        <View key={segment.key} style={{ flexGrow: share, backgroundColor: segment.colour }} />
      ))}
    </View>
  );
}
