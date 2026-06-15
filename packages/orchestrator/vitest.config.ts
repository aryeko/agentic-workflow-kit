import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // AWK136 ratchet: keep moving toward 90 without blocking on long-tail files.
      thresholds: {
        lines: 85,
        statements: 81,
        functions: 85,
        branches: 72,
      },
    },
  },
});
