import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  define: {
    // Polyfill CJS __dirname for ESM transform context; actual values don't matter
    // because node:fs is mocked in service tests and services are mocked in route tests
    __dirname: '"."',
    __filename: '"index.ts"',
  },
})
