import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'packages/orchestrator/tests/**/*.test.ts'],
    coverage: {
      enabled: true,
      provider: 'v8',
      // AWK1311 ratchet: one combined gate for root and orchestrator package suites.
      thresholds: {
        lines: 88.5,
        statements: 85,
        functions: 90,
        branches: 76,
      },
    },
  },
});
