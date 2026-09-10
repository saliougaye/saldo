import type { ExpoConfig } from 'expo/config';

const name = process.env.SALDO_APP_NAME ?? 'Saldo';
const bundleId = process.env.SALDO_BUNDLE_ID ?? 'io.github.saldo.app';
const scheme = process.env.SALDO_SCHEME ?? 'saldo';

const config: ExpoConfig = {
  name,
  slug: 'saldo',
  scheme,
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  assetBundlePatterns: ['**/*'],
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: false,
    infoPlist: {
      NSFaceIDUsageDescription: 'Unlock Saldo with Face ID.',
    },
  },
  android: {
    package: bundleId,
    edgeToEdgeEnabled: true,
  },
  plugins: ['expo-router', 'expo-font', 'expo-sqlite', 'expo-splash-screen', 'expo-local-authentication'],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
