import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

export interface ScreenProps {
  children: ReactNode;
  /** Screens with their own list use `scroll={false}` (§6). */
  scroll?: boolean;
  /** Onboarding pins its buttons to the bottom instead of scrolling them away. */
  footer?: ReactNode;
}

/** Screen frame: theme background, safe-area insets and the §6 horizontal padding. */
export function Screen({ children, scroll = true, footer }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const padding = {
    paddingHorizontal: theme.layout.screenPaddingX,
    paddingTop: insets.top + 8,
  };
  return (
    <View style={{ flex: 1, backgroundColor: theme.palette.bg }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ ...padding, paddingBottom: 24, gap: theme.layout.cardGap }}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, ...padding, gap: theme.layout.cardGap }}>{children}</View>
      )}
      {footer === undefined ? null : (
        <View
          style={{
            paddingHorizontal: theme.layout.screenPaddingX,
            paddingBottom: insets.bottom + 16,
            paddingTop: 12,
            gap: 8,
          }}
        >
          {footer}
        </View>
      )}
    </View>
  );
}
