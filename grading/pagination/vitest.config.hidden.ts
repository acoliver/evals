import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const gradingDir = path.dirname(fileURLToPath(import.meta.url));
const preferredWorkspaceRoot = path.resolve(gradingDir, 'workspace');
const fallbackWorkspaceRoot = path.resolve(gradingDir, '../../problems/pagination/workspace');
const workspaceRoot = fs.existsSync(preferredWorkspaceRoot)
  ? preferredWorkspaceRoot
  : fallbackWorkspaceRoot;

export default defineConfig({
  test: {
    include: ['tests/hidden/**/*.spec.ts'],
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.join(gradingDir, 'vitest.setup.ts')]
  },
  resolve: {
    alias: {
      '@workspace': path.join(workspaceRoot, 'src'),
      '@workspace-tests': path.join(workspaceRoot, 'tests')
    }
  }
});
