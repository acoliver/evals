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
  env: {
    node: true,
    es2022: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: workspaceTsconfig,
    tsconfigRootDir: workspaceRoot
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    'no-useless-escape': 'error'
  }
};
