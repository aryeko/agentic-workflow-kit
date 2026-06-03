import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

const schema = JSON.parse(readFileSync('references/config.schema.json', 'utf8'));
const ajv = new Ajv2020({ allErrors: true });
const validate = ajv.compile(schema);

const goodConfig = {
  version: 1,
  paths: {
    tracksDir: 'docs/tracks',
    specsDir: 'docs/specs',
    plansDir: 'docs/plans',
    archiveDir: 'docs/tracks/archive',
    prdsDir: 'docs/prds',
  },
  statuses: { eligible: ['specced', 'plan-approved'], inProgress: 'implementing', complete: ['done', 'verified'] },
  tracker: { idPattern: '^[A-Z]{2,}[0-9]+$' },
  verify: { changed: 'pnpm check:changed', full: 'pnpm check' },
  git: { strategy: 'worktree', branchPattern: '{track}/{id-lc}-{slug}', baseBranch: 'main', commitOnBase: 'forbid' },
  pr: {
    create: true,
    ci: { wait: false, command: null },
    review: { wait: 'none', bot: 'none', triageComments: false },
    merge: { auto: true, method: 'squash', deleteBranch: true },
  },
  orchestrator: { driver: 'codex-mcp', maxParallel: 2, stopLaunchingOnBlocked: true },
};

describe('config.schema.json', () => {
  it('accepts a fully-populated valid config', () => {
    expect(validate(goodConfig)).toBe(true);
  });
  it('accepts a version-only config because all other fields have defaults', () => {
    expect(validate({ version: 1 })).toBe(true);
  });
  it('accepts partial nested config objects and relies on runtime defaults', () => {
    expect(
      validate({
        version: 1,
        paths: {},
        pr: {
          ci: {},
          review: {},
          merge: {},
        },
      }),
    ).toBe(true);
  });
  it('requires version', () => {
    const { version, ...noVersion } = goodConfig;
    expect(validate(noVersion)).toBe(false);
  });
  it('rejects an invalid git.strategy', () => {
    expect(validate({ ...goodConfig, git: { ...goodConfig.git, strategy: 'fork' } })).toBe(false);
  });
  it('rejects a non-array statuses.eligible', () => {
    expect(validate({ ...goodConfig, statuses: { ...goodConfig.statuses, eligible: 'specced' } })).toBe(false);
  });
  it('rejects unknown top-level keys', () => {
    expect(validate({ ...goodConfig, bogus: true })).toBe(false);
  });
  it('rejects an unknown paths key', () => {
    expect(validate({ ...goodConfig, paths: { ...goodConfig.paths, bogusDir: 'x' } })).toBe(false);
  });
});
