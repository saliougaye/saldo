/**
 * Two projects: `db` runs the SQLite-backed tests in plain Node (better-sqlite3 is a native module
 * and cannot load in the React Native environment); `app` runs component tests through jest-expo.
 *
 * The transform patterns are pnpm-aware. Under pnpm every dependency really lives at
 * `node_modules/.pnpm/<name>@<version>_<hash>/node_modules/<name>/`, so the stock React Native
 * pattern — which expects the package name straight after `node_modules/` — leaves
 * `@react-native/jest-preset/jest/setup.js` untransformed and Jest then fails on its ESM syntax.
 * `@saldo/*` needs no entry: pnpm links workspace packages to `packages/*`, outside node_modules.
 */
const RN_PACKAGES =
  '(?:@react-native|react-native|expo|@expo|@gorhom|react-navigation|@react-navigation)';

const transformIgnorePatterns = [
  `/node_modules/\\.pnpm/(?!${RN_PACKAGES}[^/]*/)`,
  `/node_modules/(?!\\.pnpm/)(?!${RN_PACKAGES}[^/]*/)`,
];

module.exports = {
  projects: [
    {
      displayName: 'db',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/db/**/*.test.ts',
        '<rootDir>/src/features/**/*.test.ts',
        '<rootDir>/src/net/**/*.test.ts',
        '<rootDir>/src/auth/**/*.test.ts',
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
      testMatch: ['<rootDir>/src/**/*.test.tsx', '<rootDir>/src/i18n/**/*.test.ts'],
      setupFiles: ['<rootDir>/jest.setup.js'],
      transformIgnorePatterns,
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
  ],
};
