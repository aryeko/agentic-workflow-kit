import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { ConfigSchema } from '../packages/orchestrator/src/config/schema.js';

const schema = JSON.parse(readFileSync('references/config.schema.json', 'utf8'));
const ajv = new Ajv2020({ allErrors: true });
const validate = ajv.compile(schema);

function validateConfigContract(value: unknown): boolean {
  return validate(value) && ConfigSchema.safeParse(value).success;
}

const goodConfig = {
  version: '0.7.0',
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
  git: {
    strategy: 'worktree',
    branchPattern: '{track}/{id-lc}-{slug}',
    baseBranch: 'main',
    commitOnBase: 'forbid',
    worktreeDir: '.worktrees',
  },
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
  orchestrator: {
    driver: 'codex-mcp',
    maxParallel: 2,
    stopLaunchingOnBlocked: true,
    watch: {
      enabled: false,
      wait: false,
      intervalMs: 300_000,
      timeoutMs: 300_000,
    },
    childTimeoutMs: 1_800_000,
    childNoProgressTimeoutMs: 1_800_000,
    childStartupTimeoutMs: 60_000,
    childMaxRuntimeMs: 7_200_000,
  },
  agents: {
    profiles: {
      storyImplementer: {
        driver: 'codex-mcp',
        model: null,
        reasoning: 'medium',
        approvalPolicy: 'never',
        sandbox: 'workspace-write',
        prompt: {
          template: 'built-in/story-implementer',
          variables: {
            includeRepoInstructions: true,
            includePrPolicy: true,
            includeVerificationPolicy: true,
          },
        },
        structuredOutput: { schema: 'built-in/child-run-result', required: true },
        budget: {
          wallMs: { limit: 7_200_000, warnAtPercent: 80, action: 'checkpoint-stop' },
          tokens: { limit: null, warnAtPercent: 80, action: 'stop-new-launches' },
          toolCalls: { limit: null, warnAtPercent: 80, action: 'checkpoint-stop' },
          failedToolCalls: { limit: null, warnAtPercent: 80, action: 'warn' },
        },
        host: {},
      },
      reviewer: {
        driver: 'codex-mcp',
        prompt: { template: 'built-in/pre-pr-reviewer' },
        structuredOutput: { schema: 'built-in/review-result', required: true },
      },
    },
    bindings: {
      implementStory: 'storyImplementer',
      prePrReview: 'reviewer',
      planTrack: 'storyImplementer',
      analyzeRun: 'storyImplementer',
      recoverRun: 'storyImplementer',
      migrateTracker: 'storyImplementer',
    },
  },
};

describe('config.schema.json', () => {
  it('accepts a fully-populated valid config', () => {
    expect(validateConfigContract(goodConfig)).toBe(true);
  });
  it('accepts a version-only config because all other fields have defaults', () => {
    expect(validateConfigContract({ version: '0.7.0' })).toBe(true);
  });
  it('accepts the minimum supported config schema version 0.6.0 against the JSON schema', () => {
    // The JSON schema must accept every version in [MIN_SUPPORTED..CURRENT], not just CURRENT.
    // A 0.6.0 config is still runtime-compatible and must not fail JSON-schema validation.
    expect(validate({ version: '0.6.0' })).toBe(true);
  });
  it('applies runtime defaults for interactive review and subagent policy', () => {
    const parsed = ConfigSchema.parse({ version: '0.7.0' });

    expect(parsed.implement.review.prePr).toEqual({
      enabled: true,
      mode: 'auto',
      maxLoops: 2,
      loopMode: 'incremental',
      downgradeTo: 'none',
    });
    expect(parsed.implement.review.semanticChecks).toEqual({ enabled: true });
    expect(parsed.implement.subagents).toEqual({ enabled: true, maxParallel: 2, allowWorkers: false });
    expect(parsed.pr.review.maxFixBatches).toBe(1);
    expect(parsed.pr.review.rerequestAfterFix).toBe(false);
    expect(parsed.pr.review.waitTimeoutMinutes).toBe(30);
    expect(parsed.orchestrator.watch).toEqual({
      enabled: false,
      wait: false,
      intervalMs: 300_000,
      timeoutMs: 300_000,
    });
    expect(parsed.orchestrator.childNoProgressTimeoutMs).toBe(1_800_000);
    expect(parsed.orchestrator.childStartupTimeoutMs).toBe(60_000);
    expect(parsed.orchestrator.childMaxRuntimeMs).toBe(7_200_000);
    expect(parsed.orchestrator.childReviewWaitTimeoutMs).toBe(1_800_000);
    expect(parsed.agents.bindings.implementStory).toBe('storyImplementer');
    expect(parsed.agents.profiles.storyImplementer.prompt.template).toBe('built-in/story-implementer');
    expect(parsed.agents.profiles.storyImplementer.budget.wallMs).toEqual({
      limit: 7_200_000,
      warnAtPercent: 80,
      action: 'checkpoint-stop',
    });
  });
  it('keeps childTimeoutMs as a compatibility alias for no-progress timeout', () => {
    const parsed = ConfigSchema.parse({
      version: '0.7.0',
      orchestrator: { childTimeoutMs: 60_000 },
    });

    expect(parsed.orchestrator.childTimeoutMs).toBe(60_000);
    expect(parsed.orchestrator.childNoProgressTimeoutMs).toBe(1_800_000);
    expect(parsed.orchestrator.childStartupTimeoutMs).toBe(60_000);
    expect(parsed.orchestrator.childMaxRuntimeMs).toBe(7_200_000);
  });
  it('accepts partial nested config objects and relies on runtime defaults', () => {
    expect(
      validateConfigContract({
        version: '0.7.0',
        paths: {},
        pr: {
          ci: {},
          review: {},
          merge: {},
        },
      }),
    ).toBe(true);
  });
  it('accepts child-session speed policy values in the generated schema', () => {
    for (const speed of ['derive', 'fast', 'standard']) {
      expect(validateConfigContract({ version: '0.7.0', childSession: { speed } })).toBe(true);
      expect(validateConfigContract({ version: '0.7.0', codex: { childSession: { speed } } })).toBe(true);
    }
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
  it('rejects invalid child-session speed values in the generated schema', () => {
    expect(validate({ ...goodConfig, childSession: { speed: 'turbo' } })).toBe(false);
    expect(validate({ ...goodConfig, codex: { childSession: { speed: 'turbo' } } })).toBe(false);
  });
  it('rejects explicit child-session speed plus raw service_tier in the generated schema', () => {
    const conflicts = [
      { childSession: { speed: 'fast', config: { service_tier: 'fast' } } },
      { childSession: { speed: 'standard' }, codex: { childSession: { config: { service_tier: 'fast' } } } },
      { childSession: { config: { service_tier: 'fast' } }, codex: { childSession: { speed: 'fast' } } },
      { codex: { childSession: { speed: 'standard', config: { service_tier: 'fast' } } } },
    ];

    for (const conflict of conflicts) {
      expect(validate({ version: '0.7.0', ...conflict })).toBe(false);
    }
  });
  it('accepts raw service_tier when child-session speed derives', () => {
    expect(
      validateConfigContract({
        version: '0.7.0',
        childSession: { speed: 'derive', config: { service_tier: 'fast' } },
      }),
    ).toBe(true);
    expect(
      validateConfigContract({
        version: '0.7.0',
        childSession: { speed: 'derive' },
        codex: { childSession: { speed: 'fast', config: { service_tier: 'fast' } } },
      }),
    ).toBe(true);
  });
  it('rejects repo-relative path fields that are absolute or contain parent segments', () => {
    expect(validate({ ...goodConfig, paths: { ...goodConfig.paths, tracksDir: '/tmp/tracks' } })).toBe(false);
    expect(validate({ ...goodConfig, paths: { ...goodConfig.paths, specsDir: '../specs' } })).toBe(false);
    expect(validate({ ...goodConfig, paths: { ...goodConfig.paths, specsDir: 'C:specs' } })).toBe(false);
    expect(validate({ ...goodConfig, paths: { ...goodConfig.paths, plansDir: 'nested/../plans' } })).toBe(false);
    expect(validate({ ...goodConfig, paths: { ...goodConfig.paths, archiveDir: '../archive' } })).toBe(false);
    expect(validate({ ...goodConfig, paths: { ...goodConfig.paths, prdsDir: '../prds' } })).toBe(false);
    expect(validate({ ...goodConfig, git: { ...goodConfig.git, worktreeDir: '../worktrees' } })).toBe(false);
    expect(validate({ ...goodConfig, git: { ...goodConfig.git, worktreeDir: 'C:worktrees' } })).toBe(false);
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
  it('accepts the orchestrator pre-PR review mode', () => {
    expect(
      validateConfigContract({
        ...goodConfig,
        implement: {
          ...goodConfig.implement,
          review: {
            ...goodConfig.implement.review,
            prePr: { ...goodConfig.implement.review.prePr, mode: 'orchestrator' },
          },
        },
      }),
    ).toBe(true);
  });
  it('defaults orchestrator-mode downgradeTo to none (fail-closed)', () => {
    const parsed = ConfigSchema.parse({
      version: 1,
      implement: { review: { prePr: { mode: 'orchestrator' } } },
    });

    expect(parsed.implement.review.prePr.mode).toBe('orchestrator');
    expect(parsed.implement.review.prePr.downgradeTo).toBe('none');
  });
  it('accepts downgradeTo subagent and inline, rejects other values', () => {
    for (const downgradeTo of ['none', 'subagent', 'inline']) {
      expect(
        validateConfigContract({
          ...goodConfig,
          implement: {
            ...goodConfig.implement,
            review: {
              ...goodConfig.implement.review,
              prePr: { ...goodConfig.implement.review.prePr, mode: 'orchestrator', downgradeTo },
            },
          },
        }),
      ).toBe(true);
    }
    expect(
      validate({
        ...goodConfig,
        implement: {
          ...goodConfig.implement,
          review: {
            ...goodConfig.implement.review,
            prePr: { ...goodConfig.implement.review.prePr, downgradeTo: 'auto' },
          },
        },
      }),
    ).toBe(false);
  });
  it('rejects a non-positive childReviewWaitTimeoutMs', () => {
    expect(validate({ ...goodConfig, orchestrator: { ...goodConfig.orchestrator, childReviewWaitTimeoutMs: 0 } })).toBe(
      false,
    );
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
  it('accepts a fully-populated agents config', () => {
    expect(validateConfigContract(goodConfig)).toBe(true);
  });
  it('rejects invalid agents budget policy values', () => {
    expect(
      validate({
        ...goodConfig,
        agents: {
          ...goodConfig.agents,
          profiles: {
            ...goodConfig.agents.profiles,
            storyImplementer: {
              ...goodConfig.agents.profiles.storyImplementer,
              budget: {
                ...goodConfig.agents.profiles.storyImplementer.budget,
                wallMs: { limit: -1, warnAtPercent: 101, action: 'explode' },
              },
            },
          },
        },
      }),
    ).toBe(false);
  });
  it('rejects bindings that reference missing agent profiles', () => {
    const config = {
      ...goodConfig,
      agents: {
        ...goodConfig.agents,
        bindings: {
          ...goodConfig.agents.bindings,
          implementStory: 'missingProfile',
        },
      },
    };

    expect(validate(config)).toBe(true);
    expect(validateConfigContract(config)).toBe(false);
    expect(() => ConfigSchema.parse(config)).toThrow(/implementStory/);
    expect(schema.$comment).toContain('every agents.bindings value must reference a key in agents.profiles');
  });
});
