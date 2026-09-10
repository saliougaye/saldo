import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  useFonts,
} from '@expo-google-fonts/geist';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import type { i18n as I18nInstance } from 'i18next';
import { type ReactNode, useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { ToastProvider } from '../src/components/Toast';
import { DatabaseProvider } from '../src/db/DatabaseProvider';
import { useSettings } from '../src/db/hooks';
import { MaterialiserGate } from '../src/features/period/MaterialiserGate';
import { PeriodProvider } from '../src/features/period/PeriodProvider';
import { createI18n } from '../src/i18n';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may already be hidden on a fast reload; nothing to recover from.
});

/**
 * Theme and language both live in `settings`, which lives in the database — so the tree is
 * bootstrapped with system defaults, then re-provided from settings once the row exists. Nested
 * providers mean the inner values win.
 */
function SettingsScopedProviders({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const [i18n, setI18n] = useState<I18nInstance | null>(null);

  useEffect(() => {
    let cancelled = false;
    createI18n(settings?.language ?? 'system').then((instance) => {
      if (!cancelled) setI18n(instance);
    });
    return () => {
      cancelled = true;
    };
  }, [settings?.language]);

  if (i18n === null) {
    return (
      <ThemeProvider preference={settings?.theme ?? 'system'}>
        <LoadingScreen />
      </ThemeProvider>
    );
  }
  return (
    <ThemeProvider preference={settings?.theme ?? 'system'}>
      <I18nextProvider i18n={i18n}>
        <ThemedStatusBar />
        <PeriodProvider>
          <ToastProvider>
            <MaterialiserGate>{children}</MaterialiserGate>
          </ToastProvider>
        </PeriodProvider>
      </I18nextProvider>
    </ThemeProvider>
  );
}

function ThemedStatusBar() {
  const theme = useTheme();
  // §13: the status bar follows the theme.
  return <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />;
}

function Ready({ children }: { children: ReactNode }) {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {
      // Already hidden.
    });
  }, []);
  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
  });

  if (!fontsLoaded) {
    return (
      <ThemeProvider preference="system">
        <LoadingScreen />
      </ThemeProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider preference="system">
          <DatabaseProvider>
            <SettingsScopedProviders>
              <Ready>
                <Stack screenOptions={{ headerShown: false }} />
              </Ready>
            </SettingsScopedProviders>
          </DatabaseProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
