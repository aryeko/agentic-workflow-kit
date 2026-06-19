import { defineConfig } from 'vitest/config';

const aliases = {
  '@kit-vnext/conformance-kit': new URL('./packages/conformance-kit/src/index.ts', import.meta.url).pathname,
  '@kit-vnext/contracts-execution-host': new URL('./packages/contracts-execution-host/src/index.ts', import.meta.url)
    .pathname,
  '@kit-vnext/drivers-mocks': new URL('./packages/drivers-mocks/src/index.ts', import.meta.url).pathname,
};

export default defineConfig({
  resolve: {
    alias: aliases,
  },
  test: {
    projects: [
      {
        resolve: {
          alias: aliases,
        },
        test: {
          name: 'unit',
          include: ['tests/**/*.unit.test.ts', 'packages/**/*.unit.test.ts'],
          setupFiles: ['./tooling/no-side-effects.setup.ts'],
        },
      },
      {
        resolve: {
          alias: aliases,
        },
        test: {
          name: 'integration',
          include: ['tests/**/*.int.test.ts', 'packages/**/*.int.test.ts'],
        },
      },
      {
        resolve: {
          alias: aliases,
        },
        test: {
          name: 'conformance-mock',
          include: ['tests/**/*.conformance.test.ts', 'packages/**/*.conformance.test.ts'],
          setupFiles: ['./tooling/no-side-effects.setup.ts'],
        },
      },
      {
        resolve: {
          alias: aliases,
        },
        test: {
          name: 'smoke-real',
          include: ['tests/**/*.smoke.test.ts', 'packages/**/*.smoke.test.ts'],
        },
      },
    ],
  },
});
