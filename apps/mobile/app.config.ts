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
   * Saldo's mark is Rocky, the raccoon mascot. Its asset kit is generated in
   * github.com/saliougaye/mascots (branch `mascot/saldo`, `out/saldo/icons/`); the files here are
   * copies of it, so change the mascot there and copy them back. This fallback covers web and
   * anything that ignores the per-platform icons below.
   */
  icon: './assets/icon.png',
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: false,
    /**
     * iOS 18 picks one of the three by appearance. Light must be opaque (iOS rejects its alpha
     * channel); dark and tinted keep theirs, because iOS paints its own background behind them.
     */
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
     * alpha only: Android tints it for themed icons, and the mask band, eyes and tail rings are holes.
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
    fr: './locales/fr.json',
    de: './locales/de.json',
    sv: './locales/sv.json',
    es: './locales/es.json',
    // European Portuguese, like the app's `pt` catalog; iOS falls back to it from pt-BR.
    pt: './locales/pt.json',
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
         * The splash image carries alpha and no background of its own, so the colours below are
         * the only thing painted behind it: `palettes.light.page` and `palettes.dark.page` from
         * `packages/ui/src/tokens.ts`, which is what the first screen shows underneath its cards.
         */
        image: './assets/splash-icon.png',
        imageWidth: 180,
        resizeMode: 'contain',
        backgroundColor: '#E9E9E7',
        dark: {
          image: './assets/splash-icon.png',
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
    /**
     * `locales` above is iOS's permission-prompt channel, but Expo writes it into Android resources
     * too, where Lint fails the release build over translations the default locale never declares.
     * This declares them. See the file for why the alternatives are worse.
     */
    './plugins/withAndroidLocaleDefaults',
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
