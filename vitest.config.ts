import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      include: ['tooling/**/*.ts'],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/**/*.unit.test.ts', 'packages/**/*.unit.test.ts'],
          setupFiles: ['./tooling/no-side-effects.setup.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/**/*.int.test.ts', 'packages/**/*.int.test.ts'],
        },
      },
      {
        test: {
          name: 'conformance-mock',
          include: ['tests/**/*.conformance.test.ts', 'packages/**/*.conformance.test.ts'],
          setupFiles: ['./tooling/no-side-effects.setup.ts'],
        },
      },
      {
        test: {
          name: 'smoke-real',
          include: ['tests/**/*.smoke.test.ts', 'packages/**/*.smoke.test.ts'],
        },
      },
    ],
  },
});
