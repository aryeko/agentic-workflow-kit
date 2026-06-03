import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // TODO: ratchet to 90 as test coverage improves
      thresholds: {
        lines: 78,
        statements: 77,
        functions: 77,
        branches: 68,
      },
    },
  },
});
