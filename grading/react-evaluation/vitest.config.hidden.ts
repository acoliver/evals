import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/hidden/**/*.spec.ts'],
    environment: 'node'
  },
  resolve: {
    alias: {
      // Create alias for dynamic imports
      '@react-evaluation': new URL('./workspace/src/index.js', import.meta.url).pathname
    }
  }
})