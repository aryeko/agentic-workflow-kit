import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/codex-plugin-smoke.vitest.ts'],
  },
});
