module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@fieldops/.*)',
  ],
  // Correct key is setupFilesAfterEnv (setupFilesAfterFramework is a typo)
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  moduleNameMapper: {
    // Pin react to the workspace-local copy (18.3.1) so react-test-renderer
    // and all components share the exact same React instance in tests.
    '^react$': '<rootDir>/node_modules/react',
    '^react/jsx-runtime$': '<rootDir>/node_modules/react/jsx-runtime',
    '^react/jsx-dev-runtime$': '<rootDir>/node_modules/react/jsx-dev-runtime',
    '^@fieldops/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@fieldops/api-client$': '<rootDir>/../../packages/api-client/src/index.ts',
  },
  testPathIgnorePatterns: ['/node_modules/', '/src/__tests__/setup\\.ts$'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      lines: 80,
      branches: 75,
      functions: 80,
      statements: 80,
    },
  },
};
