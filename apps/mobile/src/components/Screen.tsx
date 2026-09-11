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
   * Tab screens clear the FAB, which is lifted over the top edge of the tab bar. The bar itself
   * needs no room: a custom `tabBar` is laid out in flow by the navigator, so the screen already
   * ends above it — reserving its height again left a dead band the content could not scroll
   * into. Push screens and onboarding have no tab bar, so they leave this off.
   */
  underTabBar?: boolean;
  /**
   * A screen presented as a sheet (`presentation: 'modal'`) already starts below the status bar,
   * so the device's top inset would be dead space above the header — it uses a plain gap instead.
   */
  sheet?: boolean;
}

/** Screen frame: theme background, safe-area insets and the §6 horizontal padding. */
export function Screen({
  children,
  scroll = true,
  footer,
  underTabBar = false,
  sheet = false,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const padding = {
    paddingHorizontal: theme.layout.screenPaddingX,
    paddingTop: sheet ? 12 : insets.top + 8,
  };
  const tabBarSpace = underTabBar ? theme.layout.fabLift : 0;
  const bottomSpace = 24 + tabBarSpace;
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
            paddingBottom: tabBarSpace,
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
