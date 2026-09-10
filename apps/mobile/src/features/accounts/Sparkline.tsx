import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';

/** Month-end balances drawn as one line (§6.10). Negative values are handled by the scale. */
export function Sparkline({ series, height = 48 }: { series: readonly number[]; height?: number }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const min = Math.min(...series, 0);
  const max = Math.max(...series, 0);
  const span = max - min || 1;

  const points =
    series.length === 0 || width === 0
      ? ''
      : series
          .map((value, index) => {
            const x = series.length === 1 ? width / 2 : (index / (series.length - 1)) * width;
            const y = height - ((value - min) / span) * height;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ');

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height, width: '100%' }}
    >
      {points === '' ? null : (
        <Svg width={width} height={height}>
          <Polyline points={points} fill="none" stroke={theme.palette.accent} strokeWidth={1.5} />
        </Svg>
      )}
    </View>
  );
}
