import { chartLine, hiddenBaseline, trendGeometry } from '@saldo/ui';
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { useHiddenAmounts } from '../hidden/hiddenAmounts';

export interface CycleTrendChartProps {
  /** Cumulative counted expenses per elapsed day (§5.6). */
  current: readonly number[];
  /** Average of the previous three cycles, resampled to the current length. */
  usual: readonly number[];
  height?: number;
}

/**
 * "Andamento del ciclo" (§5.6): grey `usual` behind, accent `current` in front, with a dot at the
 * last point. The geometry is `@saldo/ui`'s, shared with the web.
 */
export function CycleTrendChart({ current, usual, height = 96 }: CycleTrendChartProps) {
  const theme = useTheme();
  const { hidden } = useHiddenAmounts();
  const [width, setWidth] = useState(0);
  const trend = trendGeometry(current, usual, width, height);

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height, width: '100%' }}
    >
      {width === 0 ? null : hidden ? (
        // The line is the figure: a flat dashed baseline says "there is a chart here" and no more.
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
          {trend.usual === '' ? null : (
            <Polyline
              points={trend.usual}
              fill="none"
              stroke={theme.palette.borderStrong}
              strokeWidth={chartLine.usualStroke}
            />
          )}
          {trend.current === '' ? null : (
            <Polyline
              points={trend.current}
              fill="none"
              stroke={theme.palette.accent}
              strokeWidth={chartLine.currentStroke}
            />
          )}
          {trend.last === null ? null : (
            <Circle
              cx={trend.last.x}
              cy={trend.last.y}
              r={chartLine.dotRadius}
              fill={theme.palette.accent}
            />
          )}
        </Svg>
      )}
    </View>
  );
}
