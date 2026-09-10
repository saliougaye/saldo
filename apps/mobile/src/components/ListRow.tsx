import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from '../theme/Icon';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Rendered on the left, usually an icon box or a colour dot. */
  leading?: ReactNode;
  /** Rendered on the right, usually an amount. */
  trailing?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  /** Scheduled rows get the 2px left border and a muted amount (§5.12). */
  upcoming?: boolean;
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  chevron = false,
  upcoming = false,
}: ListRowProps) {
  const theme = useTheme();
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: theme.layout.minHitTarget,
        paddingVertical: 8,
        paddingLeft: upcoming ? 10 : 0,
        borderLeftWidth: upcoming ? 2 : 0,
        borderLeftColor: theme.palette.borderStrong,
      }}
    >
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1}>{title}</Text>
        {subtitle === undefined ? null : (
          <Text size="footnote" color="textMuted" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
      {chevron ? <Icon name="chevR" size={16} color={theme.palette.textFaint} /> : null}
    </View>
  );
  if (onPress === undefined) return content;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {content}
    </Pressable>
  );
}

/** Rounded icon box used as a row's leading element (§6). */
export function IconBox({
  name,
  colour,
  small = false,
}: {
  name: Parameters<typeof Icon>[0]['name'];
  colour: string;
  small?: boolean;
}) {
  const theme = useTheme();
  const size = small ? theme.layout.iconBoxSmall : theme.layout.iconBox;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: theme.radii.iconBox,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.tint(colour, 0.14),
      }}
    >
      <Icon name={name} size={small ? 14 : 16} color={colour} />
    </View>
  );
}
