import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

/** Tall enough that a text row visibly dissolves into it, short enough to hide nothing. */
export const SCROLL_FADE_HEIGHT = 24;

/**
 * The bottom edge of a screen whose footer sits over its content.
 *
 * Without it the content is cut on a hard horizontal line and the button below reads as the end of
 * the document — which is why a form that scrolls has looked exactly like a form that does not.
 * `react-native-svg` is already a dependency (the charts use it), so this costs no package.
 */
export function ScrollFade() {
  const theme = useTheme();
  return (
    <View
      testID="screen-scroll-fade"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: SCROLL_FADE_HEIGHT }}
    >
      <Svg width="100%" height={SCROLL_FADE_HEIGHT}>
        <Defs>
          <LinearGradient id="saldoScrollFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.palette.bg} stopOpacity="0" />
            <Stop offset="1" stopColor={theme.palette.bg} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={SCROLL_FADE_HEIGHT} fill="url(#saldoScrollFade)" />
      </Svg>
    </View>
  );
}
