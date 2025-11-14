const fs = require('node:fs');
const path = require('node:path');

const workspaceRoot = __dirname;
const workspaceTsconfig =
  ['tsconfig.eslint.json', 'tsconfig.json']
    .map((filename) => path.join(workspaceRoot, filename))
    .find((file) => fs.existsSync(file)) ||
  path.join(workspaceRoot, 'tsconfig.json');

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: workspaceTsconfig,
    tsconfigRootDir: workspaceRoot
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
