module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@fieldops/.*)',
  ],
  setupFilesAfterFramework: ['@testing-library/jest-native/extend-expect'],
  moduleNameMapper: {
    '^@fieldops/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
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
