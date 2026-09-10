import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';

export interface CycleTrendChartProps {
  /** Cumulative counted expenses per elapsed day (§5.6). */
  current: readonly number[];
  /** Average of the previous three cycles, resampled to the current length. */
  usual: readonly number[];
  height?: number;
}

function points(series: readonly number[], width: number, height: number, max: number): string {
  if (series.length === 0) return '';
  const step = series.length === 1 ? 0 : width / (series.length - 1);
  return series
    .map((value, index) => {
      const x = series.length === 1 ? width / 2 : index * step;
      const y = height - (max === 0 ? 0 : (value / max) * height);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * "Andamento del ciclo" (§5.6): grey `usual` behind, accent `current` in front, with a dot at the
 * last point. Drawn with SVG polylines, so it needs no charting dependency.
 */
export function CycleTrendChart({ current, usual, height = 96 }: CycleTrendChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const max = Math.max(1, ...current, ...usual);
  const last = current[current.length - 1] ?? 0;
  const lastX = current.length <= 1 ? width / 2 : width;
  const lastY = height - (last / max) * height;

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height, width: '100%' }}
    >
      {width === 0 ? null : (
        <Svg width={width} height={height}>
          {usual.length > 0 ? (
            <Polyline
              points={points(usual, width, height, max)}
              fill="none"
              stroke={theme.palette.borderStrong}
              strokeWidth={1.5}
            />
          ) : null}
          {current.length > 0 ? (
            <Polyline
              points={points(current, width, height, max)}
              fill="none"
              stroke={theme.palette.accent}
              strokeWidth={2}
            />
          ) : null}
          {current.length > 0 ? (
            <Circle cx={lastX} cy={lastY} r={3} fill={theme.palette.accent} />
          ) : null}
        </Svg>
      )}
    </View>
  );
}
