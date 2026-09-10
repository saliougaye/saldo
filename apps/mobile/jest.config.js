/**
 * Two projects: `db` runs the SQLite-backed tests in plain Node (better-sqlite3 is a native
 * module and cannot load in the React Native environment), `app` runs component tests through
 * jest-expo.
 */
const transformIgnore = [
  'node_modules/(?!(?:.pnpm/)?(?:(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|react-native-reanimated|react-native-worklets|react-native-gesture-handler|@gorhom/.*|@saldo/.*)/)',
];

module.exports = {
  projects: [
    {
      displayName: 'db',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/db/**/*.test.ts'],
      transform: {
        '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
      },
      transformIgnorePatterns: transformIgnore,
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
    {
      displayName: 'app',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/src/**/*.test.tsx', '<rootDir>/src/i18n/**/*.test.ts'],
      setupFiles: ['<rootDir>/jest.setup.js'],
      transformIgnorePatterns: transformIgnore,
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
  ],
};
