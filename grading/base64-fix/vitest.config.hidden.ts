import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const gradingDir = path.dirname(fileURLToPath(import.meta.url));
const preferredWorkspaceRoot = path.resolve(gradingDir, 'workspace');
const fallbackWorkspaceRoot = path.resolve(gradingDir, '../../problems/base64-fix/workspace');
const workspaceRoot = fs.existsSync(preferredWorkspaceRoot)
  ? preferredWorkspaceRoot
  : fallbackWorkspaceRoot;

export default defineConfig({
  test: {
    include: ['tests/hidden/**/*.spec.ts'],
    coverage: {
      reporter: ['text', 'json'],
      reportsDirectory: 'coverage/hidden'
    }
  },
  resolve: {
    alias: {
      '@workspace': path.join(workspaceRoot, 'src'),
      '@workspace-tests': path.join(workspaceRoot, 'tests')
    }
  }
});
