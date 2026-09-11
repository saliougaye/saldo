import { type ReactNode, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { ScrollFade } from './ScrollFade';

export interface ScreenProps {
  children: ReactNode;
  /** Screens with their own list use `scroll={false}` (§6). */
  scroll?: boolean;
  /** Pinned over the content rather than below it, so the content can run under it. */
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
  // The footer is drawn over the content, so the content has to be told how much of itself the
  // footer covers. Measured rather than assumed: it is one button on most screens and three
  // stacked elements on the transaction form.
  const [footerHeight, setFooterHeight] = useState(0);
  const padding = {
    paddingHorizontal: theme.layout.screenPaddingX,
    paddingTop: sheet ? 12 : insets.top + 8,
  };
  const tabBarSpace = underTabBar ? theme.layout.fabLift : 0;
  return (
    <View style={{ flex: 1, backgroundColor: theme.palette.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        /*
         * Android resizes the window itself (`android.softwareKeyboardLayoutMode` defaults to
         * `resize`), so padding on top of that would lift the footer twice. iOS does nothing at
         * all without this, which is why the save button used to sit under the keyboard — and on
         * Android there is no `InputAccessoryView` to fall back on, so it was unreachable.
         */
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            testID="screen-scroll"
            /*
             * The default is `'never'`: while the keyboard is up the first tap on any control is
             * swallowed to dismiss it. On the transaction form that is a tap wasted on every
             * entry — type the amount, tap a category, nothing happens, tap it again.
             */
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              ...padding,
              paddingBottom: 24 + tabBarSpace + footerHeight,
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
              paddingBottom: tabBarSpace + footerHeight,
              gap: theme.layout.cardGap,
            }}
          >
            {children}
          </View>
        )}
        {footer === undefined ? null : (
          <View
            onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
          >
            <ScrollFade />
            <View
              style={{
                backgroundColor: theme.palette.bg,
                paddingHorizontal: theme.layout.screenPaddingX,
                paddingBottom: insets.bottom + 16,
                paddingTop: 4,
                gap: 8,
              }}
            >
              {footer}
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
