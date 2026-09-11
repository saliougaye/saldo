import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Card } from '../../components/Card';
import { ListRow } from '../../components/ListRow';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * The frame every profile setting shares (§6.8).
 *
 * These were bottom sheets; they are pushed screens now, like Categorie and Tag. A sheet is for a
 * choice you make and forget — the ones here have a footnote to read, a grid of 31 days, or a
 * confirmation behind them, and half of that was hidden under the fold of a sheet.
 */
export function SettingScreen({
  title,
  footnote,
  children,
}: {
  title: string;
  footnote?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Screen>
      <ScreenHeader title={title} />
      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
          {children}
        </View>
      </Card>
      {footnote === undefined ? null : (
        <Text size="caption" color="textFaint">
          {footnote}
        </Text>
      )}
    </Screen>
  );
}

/** One choice in a setting list: selected is a check, not a colour the user has to compare. */
export function OptionRow({
  label,
  detail,
  selected,
  onPress,
  leading,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  leading?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <ListRow
      title={label}
      leading={leading}
      onPress={onPress}
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {detail === undefined ? null : (
            <Text color="textMuted" tabular>
              {detail}
            </Text>
          )}
          {selected ? <Icon name="check" size={16} color={theme.palette.accent} /> : null}
        </View>
      }
    />
  );
}
