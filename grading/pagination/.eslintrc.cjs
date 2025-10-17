const fs = require('node:fs');
const path = require('node:path');

const preferredWorkspaceRoot = path.resolve(__dirname, 'workspace');
const fallbackWorkspaceRoot = path.resolve(__dirname, '../../problems/pagination/workspace');
const workspaceRoot = fs.existsSync(preferredWorkspaceRoot)
  ? preferredWorkspaceRoot
  : fallbackWorkspaceRoot;

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: path.join(__dirname, 'tsconfig.json'),
    tsconfigRootDir: __dirname
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended'
  ],
  env: {
    node: true,
    es2021: true,
    browser: true
  },
  ignorePatterns: [],
  rules: {
    '@typescript-eslint/explicit-function-return-type': [
      'error',
      { allowExpressions: true }
    ],
    '@typescript-eslint/no-explicit-any': 'error'
  }
};
