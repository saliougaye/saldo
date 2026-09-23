import { Pressable, View } from 'react-native';
import { TargetRing, type TargetRingProps } from '../../components/TargetRing';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

export type PreviewRing = Omit<TargetRingProps, 'size' | 'testID'> & { id: string };

export interface SeeAllRowProps {
  label: string;
  /** Total number of items, featured and events included; omitted on an empty card. */
  count?: number;
  /** Everything the card does not show, as small rings in sort order. */
  rings?: readonly PreviewRing[];
  onPress: () => void;
}

/**
 * A target card's only action (§5.13): the rest of the items as a strip of rings, then
 * "Tutti i budget · 5". A full row with a chevron, not a line of text at the bottom of the card —
 * the thing `CardHeader` was written to get rid of.
 */
export function SeeAllRow({ label, count, rings = [], onPress }: SeeAllRowProps) {
  const theme = useTheme();
  const text = count === undefined ? label : `${label} · ${count}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.6 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minHeight: theme.layout.minHitTarget,
        marginTop: 4,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: theme.palette.border,
      })}
    >
      {rings.length === 0 ? (
        <Text style={{ flex: 1 }}>{text}</Text>
      ) : (
        <>
          <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
            {rings.map(({ id, ...ring }) => (
              <TargetRing key={id} size={theme.layout.targetRingSmall} {...ring} />
            ))}
          </View>
          <Text size="footnote" color="textMuted">
            {text}
          </Text>
        </>
      )}
      <Icon name="chevR" size={14} color={theme.palette.textFaint} />
    </Pressable>
  );
}
