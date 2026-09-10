import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface ProgressBarProps {
  /** 0..1; values above 1 are clamped, the caller decides how to signal "over". */
  ratio: number;
  /** Where the cycle pace sits, drawn as a tick (§5.8). */
  pace?: number;
  overPace?: boolean;
}

export function ProgressBar({ ratio, pace, overPace = false }: ProgressBarProps) {
  const theme = useTheme();
  const width = `${Math.min(1, Math.max(0, ratio)) * 100}%` as const;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
      style={{
        height: theme.layout.progressHeight,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.palette.track,
        overflow: 'visible',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width,
          height: theme.layout.progressHeight,
          borderRadius: theme.radii.pill,
          backgroundColor: overPace ? theme.palette.accent : theme.palette.barGrey,
        }}
      />
      {pace === undefined ? null : (
        <View
          style={{
            position: 'absolute',
            left: `${Math.min(1, Math.max(0, pace)) * 100}%`,
            top: -theme.layout.paceTickOverhang,
            width: 1,
            height: theme.layout.progressHeight + theme.layout.paceTickOverhang * 2,
            backgroundColor: theme.palette.textFaint,
          }}
        />
      )}
    </View>
  );
}
