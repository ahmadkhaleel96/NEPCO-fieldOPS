/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['../../.eslintrc.cjs'],
  env: { browser: true, node: true, es2022: true },
  ignorePatterns: ['dist/', 'node_modules/', '.expo/'],
  rules: {
    // React Native uses global crypto — not an import
    'no-undef': 'off',
  },
};
