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
  /**
   * Tab screens must clear the custom tab bar, which floats over their content. Push screens and
   * onboarding have no tab bar, so they leave this off.
   */
  underTabBar?: boolean;
}

/** Screen frame: theme background, safe-area insets and the §6 horizontal padding. */
export function Screen({ children, scroll = true, footer, underTabBar = false }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const padding = {
    paddingHorizontal: theme.layout.screenPaddingX,
    paddingTop: insets.top + 8,
  };
  const bottomSpace = 24 + (underTabBar ? theme.layout.tabBarHeight + insets.bottom : 0);
  return (
    <View style={{ flex: 1, backgroundColor: theme.palette.bg }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{
            ...padding,
            paddingBottom: bottomSpace,
            gap: theme.layout.cardGap,
          }}
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={{
            flex: 1,
            ...padding,
            paddingBottom: underTabBar ? theme.layout.tabBarHeight + insets.bottom : 0,
            gap: theme.layout.cardGap,
          }}
        >
          {children}
        </View>
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
