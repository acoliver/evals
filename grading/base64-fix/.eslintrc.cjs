const path = require('node:path');

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: path.join(__dirname, 'tsconfig.json'),
    tsconfigRootDir: __dirname
  },
  plugins: ['@typescript-eslint', 'sonarjs'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/stylistic',
    'plugin:sonarjs/recommended'
  ],
  env: {
    node: true,
    es2021: true
  },
  ignorePatterns: [],
  rules: {
    complexity: ['error', 10],
    'sonarjs/cognitive-complexity': ['error', 15],
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/explicit-function-return-type': [
      'error',
      { allowExpressions: true }
    ]
  }
};
