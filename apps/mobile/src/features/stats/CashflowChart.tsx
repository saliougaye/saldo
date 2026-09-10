import { View } from 'react-native';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

export interface CashflowBar {
  key: string;
  label: string;
  income: number;
  expenses: number;
  /** The current cycle is drawn hatched in the design; here it keeps full opacity. */
  current: boolean;
}

/**
 * Cashflow of §5.7: income up, expenses down, one pair per cycle. Plain views rather than SVG —
 * bars are rectangles, and this keeps the layout responsive for free.
 */
export function CashflowChart({
  bars,
  height = 96,
}: {
  bars: readonly CashflowBar[];
  height?: number;
}) {
  const theme = useTheme();
  const max = Math.max(1, ...bars.flatMap((bar) => [bar.income, bar.expenses]));
  const half = height / 2;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
      {bars.map((bar) => (
        <View key={bar.key} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <View style={{ height, justifyContent: 'center', width: '100%' }}>
            <View style={{ height: half, justifyContent: 'flex-end' }}>
              <View
                style={{
                  height: Math.max(1, (bar.income / max) * half),
                  borderRadius: 2,
                  backgroundColor: theme.palette.positive,
                  opacity: bar.current ? 1 : 0.55,
                }}
              />
            </View>
            <View style={{ height: half }}>
              <View
                style={{
                  height: Math.max(1, (bar.expenses / max) * half),
                  borderRadius: 2,
                  backgroundColor: theme.palette.accent,
                  opacity: bar.current ? 1 : 0.55,
                }}
              />
            </View>
          </View>
          <Text size="caption" color={bar.current ? 'text' : 'textFaint'} numberOfLines={1}>
            {bar.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
