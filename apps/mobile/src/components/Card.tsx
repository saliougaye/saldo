import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface CardProps extends ViewProps {
  children: ReactNode;
  /** Cards without padding host their own rows (§6 list cards). */
  padded?: boolean;
}

export function Card({ children, padded = true, style, ...rest }: CardProps) {
  const theme = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: theme.palette.surface,
          borderRadius: theme.radii.card,
          borderWidth: 1,
          borderColor: theme.palette.border,
          padding: padded ? theme.layout.cardPadding : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
