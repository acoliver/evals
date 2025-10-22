import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/public/**/*.spec.ts'],
    environment: 'node'
  }
})