const fs = require('node:fs');
const path = require('node:path');

const preferredWorkspaceRoot = path.resolve(__dirname, 'workspace');
const fallbackWorkspaceRoot = path.resolve(__dirname, '../../problems/base64-fix/workspace');
const workspaceRoot = fs.existsSync(preferredWorkspaceRoot)
  ? preferredWorkspaceRoot
  : fallbackWorkspaceRoot;

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: path.join(workspaceRoot, 'tsconfig.json'),
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
  overrides: [
    {
      files: ['tests/**/*.ts'],
      parserOptions: {
        project: [path.join(__dirname, 'tsconfig.json')],
        tsconfigRootDir: __dirname
      }
    }
  ],
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
