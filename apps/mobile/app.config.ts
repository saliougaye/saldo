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
  plugins: [
    'expo-router',
    'expo-font',
    'expo-sqlite',
    'expo-splash-screen',
    'expo-local-authentication',
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
