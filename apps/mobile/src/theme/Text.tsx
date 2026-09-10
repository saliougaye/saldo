import { type fontSize as sizes, trackingPx, type tracking as trackings } from '@saldo/ui';
import { Text as RnText, type TextProps as RnTextProps, type TextStyle } from 'react-native';
import { useTheme } from './ThemeProvider';

type SizeToken = keyof typeof sizes;
type TrackingToken = keyof typeof trackings;
type ColorToken = 'text' | 'textMuted' | 'textFaint' | 'accent' | 'positive' | 'onAccent';

export interface TextProps extends RnTextProps {
  size?: SizeToken;
  weight?: 'regular' | 'medium' | 'semibold';
  tracking?: TrackingToken;
  color?: ColorToken;
  /** Numbers must line up in columns; §6 uses tabular figures for every amount. */
  tabular?: boolean;
}

const FAMILIES = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
} as const;

export function Text({
  size = 'body',
  weight = 'regular',
  tracking,
  color = 'text',
  tabular = false,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const fontSize = theme.fontSize[size];
  const base: TextStyle = {
    fontFamily: FAMILIES[weight],
    fontSize,
    color: theme.palette[color],
  };
  if (tracking !== undefined) base.letterSpacing = trackingPx(theme.tracking[tracking], fontSize);
  if (tabular) base.fontVariant = ['tabular-nums'];
  return <RnText {...rest} style={[base, style]} />;
}
