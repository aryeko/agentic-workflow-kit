import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatTypeFixturesReport,
  main,
  type TypeFixturesResult,
} from '../../tooling/type-fixtures/run-type-fixtures.js';

const baseResult: TypeFixturesResult = {
  ok: true,
  checked: 0,
  negativeCount: 0,
  publicCount: 0,
  violations: [],
};

describe('formatTypeFixturesReport', () => {
  it('reports a clean no-op when no fixtures are found', () => {
    expect(formatTypeFixturesReport(baseResult)).toContain('no negative/public fixtures found');
  });

  it('reports the checked counts when all fixtures pass', () => {
    const report = formatTypeFixturesReport({
      ...baseResult,
      checked: 3,
      negativeCount: 2,
      publicCount: 1,
    });

    expect(report).toContain('checked 3 fixture tsconfig(s) (2 negative, 1 public)');
    expect(report).toContain('All passed.');
  });

  it('lists every violation with its kind, reason, and detail', () => {
    const report = formatTypeFixturesReport({
      ok: false,
      checked: 2,
      negativeCount: 1,
      publicCount: 1,
      violations: [
        {
          kind: 'negative',
          reason: 'negative-fixture-compiled-clean',
          tsconfig: '/repo/packages/sdk/tests/a/tsconfig.negative.json',
          detail: 'expected at least one TypeScript error, but tsc exited 0',
        },
        {
          kind: 'public',
          reason: 'public-fixture-failed-compile',
          tsconfig: '/repo/packages/sdk/tests/b/tsconfig.public.json',
          detail: 'TS2322: type error',
        },
      ],
    });

    expect(report).toContain('2 violation(s):');
    expect(report).toContain('[negative]');
    expect(report).toContain('negative-fixture-compiled-clean');
    expect(report).toContain('[public]');
    expect(report).toContain('public-fixture-failed-compile');
  });
});

describe('main', () => {
  it('returns exit code 0 when no fixtures are found', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'kit-vnext-type-fixtures-main-'));

    try {
      await expect(main({ packagesRoot: join(fixtureRoot, 'packages') })).resolves.toBe(0);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});
