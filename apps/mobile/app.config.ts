import type { ExpoConfig } from 'expo/config';

const name = process.env.SALDO_APP_NAME ?? 'Saldo';
const bundleId = process.env.SALDO_BUNDLE_ID ?? 'io.github.saldo.app';
const scheme = process.env.SALDO_SCHEME ?? 'saldo';
const serverUrl = process.env.SALDO_SERVER_URL ?? '';

const config: ExpoConfig = {
  name,
  slug: 'saldo',
  scheme,
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: false,
    infoPlist: {
      NSFaceIDUsageDescription: 'Unlock Saldo with Face ID.',
    },
  },
  android: {
    // SDK 57 is edge-to-edge by default, so there is no flag to set here.
    package: bundleId,
  },
  /**
   * iOS shows these when it asks, so they are localised like any other user-visible string: the
   * `infoPlist` values below are the fallback, and these files override them per language.
   */
  locales: {
    en: './locales/en.json',
    it: './locales/it.json',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-sqlite',
    'expo-splash-screen',
    'expo-local-authentication',
    [
      'expo-image-picker',
      {
        photosPermission:
          'Saldo needs your photos so you can attach a receipt you have already taken.',
        cameraPermission:
          'Saldo uses the camera to photograph a receipt and attach it to a transaction.',
        // Saldo records no audio. `false` also blocks RECORD_AUDIO on Android, which the plugin
        // would otherwise add for video capture we never use.
        microphonePermission: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // Validated at runtime by `readServerUrl`: this file cannot import app code, and throwing
    // here would break `expo prebuild` for anyone who has not exported the variable yet.
    serverUrl,
  },
};

export default config;
