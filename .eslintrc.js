module.exports = {
  root: true,
  extends: [
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_|_', 'varsIgnorePattern': '^_|_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'prefer-const': 'error',
  },
  env: {
    browser: true,
    es2022: true,
    webextensions: true,
  },
  globals: {
    chrome: 'readonly',
  },
}