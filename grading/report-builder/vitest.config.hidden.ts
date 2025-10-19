import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const gradingDir = path.dirname(fileURLToPath(import.meta.url));
const preferredWorkspaceRoot = path.resolve(gradingDir, 'workspace');
const fallbackWorkspaceRoot = path.resolve(gradingDir, '../../problems/report-builder/workspace');
const workspaceRoot = fs.existsSync(preferredWorkspaceRoot)
  ? preferredWorkspaceRoot
  : fallbackWorkspaceRoot;

export default defineConfig({
  test: {
    include: ['tests/hidden/**/*.spec.ts'],
    environment: 'node',
    globals: true,
    setupFiles: []
  },
  resolve: {
    alias: {
      '@workspace': path.join(workspaceRoot, 'src'),
      '@workspace-bin': path.join(workspaceRoot, 'bin'),
      '@workspace-tests': path.join(workspaceRoot, 'tests'),
      '@workspace-fixtures': path.join(workspaceRoot, 'fixtures')
    }
  }
});
