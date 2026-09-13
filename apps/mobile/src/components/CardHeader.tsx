import { Pressable, View } from 'react-native';
import { Icon } from '../theme/Icon';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

export interface CardHeaderProps {
  title: string;
  /** The line on the right: a count, a state, a total. */
  status?: string;
  /** Accent marks a status that is worth acting on; everything else is muted. */
  statusTone?: 'muted' | 'accent';
  /** Makes the whole header the card's one action, chevron included. */
  onPress?: () => void;
}

/**
 * The top row of a card that leads somewhere.
 *
 * Cards used to end with an accent line of text — "Tutti i budget" — which is neither a button nor
 * a row, and reads as a footnote. One action per card, declared where the eye lands first, with a
 * chevron so the tap is not the only cue and the whole row as the target.
 */
export function CardHeader({ title, status, statusTone = 'muted', onPress }: CardHeaderProps) {
  const theme = useTheme();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text weight="medium" tracking="tight" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
      {status === undefined ? null : (
        <Text size="footnote" color={statusTone === 'accent' ? 'accent' : 'textMuted'}>
          {status}
        </Text>
      )}
      {onPress === undefined ? null : (
        <Icon name="chevR" size={14} color={theme.palette.textFaint} />
      )}
    </View>
  );
  if (onPress === undefined) return content;
  return (
    <Pressable
      accessibilityRole="button"
      // The status belongs to the name: "Budget, 2 oltre il ritmo" is what the row is about.
      accessibilityLabel={status === undefined ? title : `${title}, ${status}`}
      onPress={onPress}
      // One line of body text is ~18pt tall; 13 above and below clears the 44pt target. The
      // sides stay narrow so the slop does not reach past the card's own padding.
      hitSlop={{ top: 13, bottom: 13, left: 6, right: 6 }}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {content}
    </Pressable>
  );
}
