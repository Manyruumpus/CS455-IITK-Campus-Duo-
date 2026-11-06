import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 20000,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'html', 'json', 'json-summary', 'lcov'],
      reportsDirectory: './coverage'
    }
  }
});
