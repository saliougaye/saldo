import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { AmountKeypad } from './keypad/AmountKeypad';
import { AmountKeypadProvider, useAmountKeypad } from './keypad/AmountKeypadProvider';
import { revealOffset } from './keypad/revealOffset';
import { ScrollFade } from './ScrollFade';
import { SyncScrollView } from './SyncScrollView';

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
  /**
   * Pulling the content down runs a sync (§8.5). For screens that show synced data and hold nothing
   * half-typed: a form's sheet already closes on a downward swipe, and onboarding has no account to
   * sync with yet.
   */
  refreshable?: boolean;
  /** Children of the scrolling content that stay pinned once they reach the top. */
  stickyHeaderIndices?: number[];
  keyboardDismissMode?: ScrollViewProps['keyboardDismissMode'];
}

/**
 * Screen frame: theme background, safe-area insets and the §6 horizontal padding.
 *
 * It also hosts the amount keypad (§5.1, D23), which is why every amount field works without a
 * host provider of its own: the pad is drawn in the same bottom stack as the footer, so the footer
 * rides above it and the content reserves room for both.
 */
export function Screen(props: ScreenProps) {
  return (
    <AmountKeypadProvider>
      <ScreenBody {...props} />
    </AmountKeypadProvider>
  );
}

function ScreenBody({
  children,
  scroll = true,
  footer,
  underTabBar = false,
  sheet = false,
  refreshable = false,
  stickyHeaderIndices,
  keyboardDismissMode,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // The footer is drawn over the content, so the content has to be told how much of itself the
  // footer covers. Measured rather than assumed: it is one button on most screens and three
  // stacked elements on the transaction form.
  const [footerHeight, setFooterHeight] = useState(0);
  // The keypad is the other thing drawn over the content, and the only one that comes and goes.
  const { session, version } = useAmountKeypad();
  const [padHeight, setPadHeight] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const viewport = useRef({ top: 0, bottom: 0 });
  const padded = session === null ? 0 : padHeight;

  // Bring the focused field out from under the pad. `measureInWindow` does nothing under RNTL,
  // which is why this is a no-op in tests and the maths it feeds is tested on its own.
  useEffect(() => {
    const node = session?.node.current;
    if (node === null || node === undefined || padHeight === 0) return;
    node.measureInWindow((_x, y, _width, height) => {
      const offset = revealOffset({
        fieldTop: y,
        fieldBottom: y + height,
        top: viewport.current.top,
        bottom: viewport.current.bottom,
      });
      if (offset !== 0) scroller.current?.scrollTo({ y: scrollY.current + offset, animated: true });
    });
  }, [session, padHeight]);

  const padding = {
    paddingHorizontal: theme.layout.screenPaddingX,
    paddingTop: sheet ? 12 : insets.top + 8,
  };
  const tabBarSpace = underTabBar ? theme.layout.fabLift : 0;
  const Scroller = refreshable ? SyncScrollView : ScrollView;
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
          <Scroller
            ref={scroller}
            testID="screen-scroll"
            onScroll={(event) => {
              scrollY.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            onLayout={(event) => {
              const { y, height } = event.nativeEvent.layout;
              viewport.current = { top: y, bottom: y + height - footerHeight - padded };
            }}
            /*
             * The top inset sits outside the scroll view, not inside its content. A pull's spinner
             * is drawn at the top of the scroll view's own frame: with the frame starting at the
             * top of the display it spun under the status bar and the notch, where nobody could
             * see it. The content now stops at the status bar instead of scrolling behind it.
             */
            style={{ marginTop: padding.paddingTop }}
            /*
             * The default is `'never'`: while the keyboard is up the first tap on any control is
             * swallowed to dismiss it. On the transaction form that is a tap wasted on every
             * entry — type the amount, tap a category, nothing happens, tap it again.
             */
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={keyboardDismissMode}
            stickyHeaderIndices={stickyHeaderIndices}
            contentContainerStyle={{
              paddingHorizontal: padding.paddingHorizontal,
              paddingBottom: 24 + tabBarSpace + footerHeight + padded,
              gap: theme.layout.cardGap,
            }}
          >
            {children}
          </Scroller>
        ) : (
          <View
            style={{
              flex: 1,
              ...padding,
              paddingBottom: tabBarSpace + footerHeight + padded,
              gap: theme.layout.cardGap,
            }}
          >
            {children}
          </View>
        )}
        {footer === undefined && session === null ? null : (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
            {footer === undefined ? null : (
              <View onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}>
                <ScrollFade />
                <View
                  style={{
                    backgroundColor: theme.palette.bg,
                    paddingHorizontal: theme.layout.screenPaddingX,
                    // The keypad below brings its own bottom inset; the footer only keeps one
                    // while it is the last thing on the screen.
                    paddingBottom: session === null ? insets.bottom + 16 : 16,
                    paddingTop: 4,
                    gap: 8,
                  }}
                >
                  {footer}
                </View>
              </View>
            )}
            {session === null ? null : (
              <View
                // Re-mounted per field, so the pad slides in again when a new one takes it over.
                key={session.id}
                style={{
                  backgroundColor: theme.palette.bg,
                  paddingBottom: insets.bottom + theme.layout.keypadPaddingY,
                }}
              >
                <AmountKeypad
                  session={session}
                  // `version` changes on every press, which is what re-reads the sign.
                  negative={version >= 0 && session.isNegative()}
                  onLayoutHeight={setPadHeight}
                />
              </View>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
