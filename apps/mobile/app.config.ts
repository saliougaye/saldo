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
  /**
   * Saldo's mark is the raccoon mascot; `docs/design/logo/mascotte/README.md` is its character
   * sheet. This fallback covers web and anything that ignores the per-platform icons below.
   */
  icon: './assets/icon.png',
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: false,
    // iOS 18 picks one of the three by appearance. All must be opaque: iOS rejects an alpha channel.
    icon: {
      light: './assets/icon.png',
      dark: './assets/ios-icon-dark.png',
      tinted: './assets/ios-icon-tinted.png',
    },
    infoPlist: {
      NSFaceIDUsageDescription: 'Unlock Saldo with Face ID.',
    },
  },
  android: {
    // SDK 57 is edge-to-edge by default, so there is no flag to set here.
    package: bundleId,
    /**
     * The launcher crops the foreground to its own shape, so the mascot is drawn smaller and
     * centred here than in `icon.png`, inside the 66/108 safe zone. `monochromeImage` carries
     * alpha only: Android tints it for themed icons, and the mask reads as the hole in the face.
     */
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  /**
   * iOS shows these when it asks, so they are localised like any other user-visible string: the
   * `infoPlist` values below are the fallback, and these files override them per language.
   */
  locales: {
    en: './locales/en.json',
    it: './locales/it.json',
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-sqlite',
    [
      'expo-splash-screen',
      {
        /**
         * The splash images carry alpha and no background of their own, so the colours below are
         * the only thing painted behind them: `palettes.light.page` and `palettes.dark.page` from
         * `packages/ui/src/tokens.ts`, which is what the first screen shows underneath its cards.
         * The dark mascot is the variant whose ears take the head's grey — the black ones vanish
         * against `#050505`.
         */
        image: './assets/splash-icon.png',
        imageWidth: 180,
        resizeMode: 'contain',
        backgroundColor: '#E9E9E7',
        dark: {
          image: './assets/splash-icon-dark.png',
          backgroundColor: '#050505',
        },
      },
    ],
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
    /**
     * Ours, not a package: a relative path is how Expo finds a plugin that lives in the repo. It
     * points the release build type at a key of your own instead of the template's shared debug
     * one, on every prebuild, because `android/` is regenerated and never committed. The file
     * documents the `~/.gradle/gradle.properties` entries it reads.
     */
    './plugins/withReleaseSigning',
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
