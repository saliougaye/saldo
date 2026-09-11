import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  useFonts,
} from '@expo-google-fonts/geist';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import type { i18n as I18nInstance } from 'i18next';
import { type ReactNode, useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ServerProvider } from '../src/auth/ServerProvider';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { ToastProvider } from '../src/components/Toast';
import { DatabaseProvider } from '../src/db/DatabaseProvider';
import { useSettings } from '../src/db/hooks';
import { MaterialiserGate } from '../src/features/period/MaterialiserGate';
import { PeriodProvider } from '../src/features/period/PeriodProvider';
import { createI18n } from '../src/i18n';
import { createQueryClient } from '../src/net/queryClient';
import { SyncProvider } from '../src/sync/SyncProvider';
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
        <ServerProvider>
          <PeriodProvider>
            <SyncProvider>
              <ToastProvider>
                <MaterialiserGate>{children}</MaterialiserGate>
              </ToastProvider>
            </SyncProvider>
          </PeriodProvider>
        </ServerProvider>
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
  const [queryClient] = useState(createQueryClient);
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
          {/* D22: TanStack Query is the network layer only — local reads stay on useLiveQuery. */}
          <QueryClientProvider client={queryClient}>
            <DatabaseProvider>
              <SettingsScopedProviders>
                <Ready>
                  <Stack screenOptions={{ headerShown: false }}>
                    {/*
                      §6.16 draws the transaction form as a sheet over whatever you were looking
                      at, and the design is right about why: you are adding a transaction *to* the
                      list or the cycle you can still see behind it, and a swipe down is a cheaper
                      "never mind" than finding a back button.

                      A modal route rather than our own `Modal`: the form already opens sheets of
                      its own — the calendar, the category picker, the attachment source — and
                      stacking those inside a `Modal` is what broke the image picker before.
                    */}
                    <Stack.Screen name="transaction/new" options={{ presentation: 'modal' }} />
                    <Stack.Screen
                      name="transaction/edit/[id]"
                      options={{ presentation: 'modal' }}
                    />
                  </Stack>
                </Ready>
              </SettingsScopedProviders>
            </DatabaseProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
