import { chartLine, hiddenBaseline, sparklinePoints } from '@saldo/ui';
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { useHiddenAmounts } from '../hidden/hiddenAmounts';

/** Month-end balances drawn as one line (§6.10). Negative values are handled by the scale. */
export function Sparkline({ series, height = 48 }: { series: readonly number[]; height?: number }) {
  const theme = useTheme();
  const { hidden } = useHiddenAmounts();
  const [width, setWidth] = useState(0);
  const points = width === 0 ? '' : sparklinePoints(series, width, height);

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height, width: '100%' }}
    >
      {points === '' ? null : hidden ? (
        <Svg width={width} height={height}>
          <Polyline
            points={hiddenBaseline(width, height)}
            fill="none"
            stroke={theme.palette.borderStrong}
            strokeWidth={chartLine.hiddenStroke}
            strokeDasharray={chartLine.hiddenDash}
          />
        </Svg>
      ) : (
        <Svg width={width} height={height}>
          <Polyline
            points={points}
            fill="none"
            stroke={theme.palette.accent}
            strokeWidth={chartLine.sparklineStroke}
          />
        </Svg>
      )}
    </View>
  );
}
