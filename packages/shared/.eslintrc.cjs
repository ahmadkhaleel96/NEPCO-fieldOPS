/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['../../.eslintrc.cjs'],
  env: { node: true, es2022: true },
  parserOptions: { project: './tsconfig.json' },
  ignorePatterns: ['dist/', 'node_modules/'],
};
