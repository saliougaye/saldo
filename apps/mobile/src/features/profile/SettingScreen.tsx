import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Card } from '../../components/Card';
import { ListRow } from '../../components/ListRow';
import { Screen } from '../../components/Screen';
import { BackButton } from '../../components/ScreenHeader';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * The frame every profile setting shares (§6.8).
 *
 * These were bottom sheets; they are pushed screens now, like Categorie and Tag — and they carry
 * the same chrome those two do: back button, a `display` title, and a muted line saying what
 * changing the setting does. A sheet is for a choice you make and forget; the ones here have a
 * footnote to read, a grid of days, or a confirmation behind them.
 */
export function SettingScreen({
  title,
  subtitle,
  card = true,
  children,
}: {
  title: string;
  /** The line under the title, as on Tag and Categorie: what changing this actually does. */
  subtitle?: string;
  /** Off for a setting that is not a list of rows, such as the day grid of the cycle. */
  card?: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Screen>
      <BackButton />
      <Text size="display" weight="semibold" tracking="tighter">
        {title}
      </Text>
      {subtitle === undefined ? null : <Text color="textMuted">{subtitle}</Text>}
      {card ? (
        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
            {children}
          </View>
        </Card>
      ) : (
        children
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
