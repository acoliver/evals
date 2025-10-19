import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const gradingDir = path.dirname(fileURLToPath(import.meta.url));
const preferredWorkspace = path.resolve(gradingDir, 'workspace');
const fallbackWorkspace = path.resolve(gradingDir, '../../problems/form-capture/workspace');
const workspaceRoot = fs.existsSync(preferredWorkspace) ? preferredWorkspace : fallbackWorkspace;

export default defineConfig({
  test: {
    include: ['tests/hidden/**/*.spec.ts'],
    environment: 'node',
    globals: true
  },
  resolve: {
    alias: {
      '@workspace': path.join(workspaceRoot, 'src'),
      '@workspace-tests': path.join(workspaceRoot, 'tests'),
      '@workspace-public': path.join(workspaceRoot, 'public'),
      '@workspace-templates': path.join(workspaceRoot, 'src', 'templates')
    }
  }
});
