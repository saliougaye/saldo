/**
 * Two projects: `db` runs the SQLite-backed tests in plain Node (better-sqlite3 is a native module
 * and cannot load in the React Native environment); `app` runs component tests through jest-expo.
 *
 * The transform patterns are pnpm-aware. Under pnpm every dependency really lives at
 * `node_modules/.pnpm/<name>@<version>_<hash>/node_modules/<name>/`, so the stock React Native
 * pattern — which expects the package name straight after `node_modules/` — leaves
 * `@react-native/jest-preset/jest/setup.js` untransformed and Jest then fails on its ESM syntax.
 * `@saldo/*` needs no entry: pnpm links workspace packages to `packages/*`, outside node_modules.
 * `standard-navigation` is expo-router's own ESM dependency: without it `expo-router` cannot be
 * imported for real, only mocked, and `renderRouter` is out of reach. `@formatjs` ships the `Intl`
 * polyfills Hermes on iOS needs (src/i18n/polyfills.ts), as ESM only.
 */
const RN_PACKAGES =
  '(?:@react-native|react-native|expo|@expo|@gorhom|react-navigation|@react-navigation|standard-navigation|@formatjs)';

const transformIgnorePatterns = [
  `/node_modules/\\.pnpm/(?!${RN_PACKAGES}[^/]*/)`,
  `/node_modules/(?!\\.pnpm/)(?!${RN_PACKAGES}[^/]*/)`,
];

module.exports = {
  // The first render in a file compiles heavy modules. On a shared CI runner, with the whole suite
  // running in parallel, that can pass the 5 s default (RecurrenceSheet.test.tsx did). Jest reads
  // `testTimeout` from the top level only: inside a project it is ignored.
  testTimeout: 30000,
  projects: [
    {
      displayName: 'db',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/db/**/*.test.ts',
        '<rootDir>/src/features/**/*.test.ts',
        '<rootDir>/src/io/**/*.test.ts',
        '<rootDir>/src/net/**/*.test.ts',
        '<rootDir>/src/auth/**/*.test.ts',
        '<rootDir>/src/boot/**/*.test.ts',
        '<rootDir>/src/sync/**/*.test.ts',
      ],
      transform: {
        '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
      },
      transformIgnorePatterns,
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
    {
      displayName: 'app',
      preset: 'jest-expo',
      // Named directory by directory rather than `src/**/*.test.ts`: the `db` project claims the
      // rest, and a file matched by both would run twice — once in an environment where
      // better-sqlite3 cannot load.
      testMatch: [
        '<rootDir>/src/**/*.test.tsx',
        '<rootDir>/src/i18n/**/*.test.ts',
        '<rootDir>/src/components/**/*.test.ts',
        '<rootDir>/src/theme/**/*.test.ts',
      ],
      setupFiles: ['<rootDir>/jest.setup.js'],
      // Lets a component `import Animated` — see the file for why it is ours and not the one
      // Worklets ships.
      resolver: '<rootDir>/jest.resolver.js',
      transformIgnorePatterns,
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
  ],
};
