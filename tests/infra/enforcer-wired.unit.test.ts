import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// Load the CommonJS dependency-cruiser config via createRequire so that the
// ESM vitest environment can still reach a .cjs file without a dynamic import.
const require = createRequire(import.meta.url);
type ForbiddenRule = {
  name: string;
  from?: { path?: string };
  to?: { path?: string | string[] };
};

const config = require('../../.dependency-cruiser.cjs') as { forbidden: ForbiddenRule[] };

describe('dependency-cruiser baseline config', () => {
  it('exports a forbidden array', () => {
    expect(Array.isArray(config.forbidden)).toBe(true);
  });

  it('declares the no-circular rule', () => {
    expect(config.forbidden.map((r) => r.name)).toContain('no-circular');
  });

  it('declares the no-orphans rule', () => {
    expect(config.forbidden.map((r) => r.name)).toContain('no-orphans');
  });

  it('blocks sdk imports of child_process', () => {
    const rule = config.forbidden.find((r) => r.name === 'sdk-must-not-import-child-process');

    expect(rule).toMatchObject({
      from: { path: '^packages/sdk(?:/|$)' },
      to: { path: expect.arrayContaining(['^node:child_process$', '^child_process$']) },
    });
  });
});
