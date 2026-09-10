import {
  categoryColors,
  gestures,
  layout,
  motion,
  type Palette,
  palettes,
  radii,
  type ThemeName,
  fontSize as tokenFontSize,
  fontWeight as tokenFontWeight,
  tracking as tokenTracking,
  withAlpha,
} from '@saldo/ui';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { type ColorSchemeName, useColorScheme } from 'react-native';

export type ThemePreference = 'system' | ThemeName;

export interface Theme {
  name: ThemeName;
  palette: Palette;
  radii: typeof radii;
  layout: typeof layout;
  motion: typeof motion;
  gestures: typeof gestures;
  fontSize: typeof tokenFontSize;
  fontWeight: typeof tokenFontWeight;
  tracking: typeof tokenTracking;
  categoryColor(index: number): string;
  tint(hex: string, alpha: number): string;
}

const ThemeContext = createContext<Theme | null>(null);

/**
 * `system` follows the OS. The design's default is dark, so anything that is not explicitly light
 * resolves to dark — including React Native's `'unspecified'`.
 */
export function resolveThemeName(
  preference: ThemePreference,
  scheme: ColorSchemeName | null | undefined,
): ThemeName {
  if (preference !== 'system') return preference;
  return scheme === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({
  preference = 'system',
  children,
}: {
  preference?: ThemePreference;
  children: ReactNode;
}) {
  const scheme = useColorScheme();
  const name = resolveThemeName(preference, scheme);
  const theme = useMemo<Theme>(
    () => ({
      name,
      palette: palettes[name],
      radii,
      layout,
      motion,
      gestures,
      fontSize: tokenFontSize,
      fontWeight: tokenFontWeight,
      tracking: tokenTracking,
      categoryColor: (index) =>
        categoryColors[
          ((index % categoryColors.length) + categoryColors.length) % categoryColors.length
        ] ?? categoryColors[0],
      tint: withAlpha,
    }),
    [name],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (theme === null) throw new Error('useTheme must be used inside a ThemeProvider');
  return theme;
}
