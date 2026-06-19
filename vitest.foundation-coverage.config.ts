import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@kit-vnext/foundation-fnd-01': fileURLToPath(
        new URL('./packages/foundation-fnd-01/src/index.ts', import.meta.url),
      ),
      '@kit-vnext/foundation-fnd-02': fileURLToPath(
        new URL('./packages/foundation-fnd-02/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['packages/foundation-*/tests/**/*.test.ts'],
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      // @ts-expect-error -- Vitest runtime honors coverage.all; current config types omit it.
      all: true,
      reporter: ['text'],
      reportsDirectory: './coverage/foundation',
      include: ['packages/foundation-*/src/**/*.ts'],
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
});
