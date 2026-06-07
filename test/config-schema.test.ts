import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { ConfigSchema } from '../packages/orchestrator/src/config/schema.js';

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
    review: {
      wait: 'none',
      bot: 'none',
      triageComments: false,
      maxFixBatches: 1,
      rerequestAfterFix: false,
      waitTimeoutMinutes: 30,
    },
    merge: { auto: true, method: 'squash', deleteBranch: true },
  },
  implement: {
    review: {
      prePr: { enabled: true, mode: 'auto', maxLoops: 2, loopMode: 'incremental' },
      semanticChecks: { enabled: true },
    },
    subagents: { enabled: true, maxParallel: 2, allowWorkers: false },
  },
  orchestrator: { driver: 'codex-mcp', maxParallel: 2, stopLaunchingOnBlocked: true, childTimeoutMs: 1_800_000 },
};

describe('config.schema.json', () => {
  it('accepts a fully-populated valid config', () => {
    expect(validate(goodConfig)).toBe(true);
  });
  it('accepts a version-only config because all other fields have defaults', () => {
    expect(validate({ version: 1 })).toBe(true);
  });
  it('applies runtime defaults for interactive review and subagent policy', () => {
    const parsed = ConfigSchema.parse({ version: 1 });

    expect(parsed.implement.review.prePr).toEqual({
      enabled: true,
      mode: 'auto',
      maxLoops: 2,
      loopMode: 'incremental',
    });
    expect(parsed.implement.review.semanticChecks).toEqual({ enabled: true });
    expect(parsed.implement.subagents).toEqual({ enabled: true, maxParallel: 2, allowWorkers: false });
    expect(parsed.pr.review.maxFixBatches).toBe(1);
    expect(parsed.pr.review.rerequestAfterFix).toBe(false);
    expect(parsed.pr.review.waitTimeoutMinutes).toBe(30);
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
  it('rejects invalid pre-PR review modes, including the old disabled mode', () => {
    expect(
      validate({
        ...goodConfig,
        implement: {
          ...goodConfig.implement,
          review: {
            ...goodConfig.implement.review,
            prePr: { ...goodConfig.implement.review.prePr, mode: 'crowdsource' },
          },
        },
      }),
    ).toBe(false);
    expect(
      validate({
        ...goodConfig,
        implement: {
          ...goodConfig.implement,
          review: {
            ...goodConfig.implement.review,
            prePr: { ...goodConfig.implement.review.prePr, mode: 'none' },
          },
        },
      }),
    ).toBe(false);
  });
  it('rejects zero review loop limits', () => {
    expect(
      validate({
        ...goodConfig,
        pr: { ...goodConfig.pr, review: { ...goodConfig.pr.review, maxFixBatches: 0 } },
      }),
    ).toBe(false);
    expect(
      validate({
        ...goodConfig,
        implement: {
          ...goodConfig.implement,
          review: {
            ...goodConfig.implement.review,
            prePr: { ...goodConfig.implement.review.prePr, maxLoops: 0 },
          },
        },
      }),
    ).toBe(false);
  });
  it('rejects an invalid pre-PR review loop mode', () => {
    expect(
      validate({
        ...goodConfig,
        implement: {
          ...goodConfig.implement,
          review: {
            ...goodConfig.implement.review,
            prePr: { ...goodConfig.implement.review.prePr, loopMode: 'random' },
          },
        },
      }),
    ).toBe(false);
  });
});
