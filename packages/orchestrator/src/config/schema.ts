import path from 'node:path';
import { z } from 'zod';

const nonEmpty = z.string().min(1);
const REPO_RELATIVE_PATH_PATTERN = /^(?!\/)(?![A-Za-z]:[\\/])(?!.*(?:^|[\\/])\.\.(?:[\\/]|$)).+$/;
const REPO_RELATIVE_PATH_MESSAGE = 'must be a repo-relative path that does not contain .. segments';

export function isRepoRelativePath(value: string): boolean {
  return !path.isAbsolute(value) && REPO_RELATIVE_PATH_PATTERN.test(value);
}

export function assertRepoRelativePath(value: string, label: string): void {
  if (!isRepoRelativePath(value)) {
    throw new Error(`${label} ${REPO_RELATIVE_PATH_MESSAGE}`);
  }
}

const repoRelativePath = nonEmpty.regex(REPO_RELATIVE_PATH_PATTERN, {
  message: REPO_RELATIVE_PATH_MESSAGE,
});
const DEFAULT_CHILD_NO_PROGRESS_TIMEOUT_MS = 1_800_000;
const DEFAULT_CHILD_STARTUP_TIMEOUT_MS = 60_000;
const DEFAULT_CHILD_MAX_RUNTIME_MS = 7_200_000;
const DEFAULT_WATCH_INTERVAL_MS = 300_000;
const DEFAULT_WATCH_TIMEOUT_MS = 300_000;
const AGENT_TASK_TYPES = [
  'implementStory',
  'prePrReview',
  'planTrack',
  'analyzeRun',
  'recoverRun',
  'migrateTracker',
] as const;
const BUDGET_ACTIONS = ['warn', 'stop-new-launches', 'checkpoint-stop', 'abort'] as const;

function agentBudgetDimensionSchema(defaultAction: (typeof BUDGET_ACTIONS)[number]) {
  return z
    .object({
      limit: z.number().min(0).nullable().default(null),
      warnAtPercent: z.number().int().min(1).max(100).nullable().default(80),
      action: z.enum(BUDGET_ACTIONS).default(defaultAction),
    })
    .strict()
    .prefault({});
}

const AgentBudgetPolicySchema = z
  .object({
    wallMs: agentBudgetDimensionSchema('checkpoint-stop'),
    tokens: agentBudgetDimensionSchema('stop-new-launches'),
    toolCalls: agentBudgetDimensionSchema('checkpoint-stop'),
    failedToolCalls: agentBudgetDimensionSchema('warn'),
    costUsd: agentBudgetDimensionSchema('stop-new-launches'),
  })
  .strict()
  .prefault({});

const AgentProfileSchema = z
  .object({
    driver: z.enum(['codex-mcp', 'inline']).default('codex-mcp'),
    model: nonEmpty.nullable().default(null),
    reasoning: nonEmpty.nullable().default(null),
    approvalPolicy: nonEmpty.nullable().default(null),
    sandbox: nonEmpty.nullable().default(null),
    prompt: z
      .object({
        template: nonEmpty,
        variables: z.record(z.string(), z.unknown()).default({}),
      })
      .strict(),
    structuredOutput: z
      .object({
        schema: nonEmpty,
        required: z.boolean().default(false),
      })
      .strict()
      .prefault({ schema: 'built-in/none', required: false }),
    budget: AgentBudgetPolicySchema,
    host: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

const ChildSessionSchema = z
  .object({
    model: nonEmpty.optional(),
    approvalPolicy: z.enum(['never', 'on-failure', 'on-request', 'untrusted']).optional(),
    sandbox: z.enum(['danger-full-access', 'read-only', 'workspace-write']).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const DEFAULT_AGENT_PROFILES = {
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
      wallMs: { limit: DEFAULT_CHILD_MAX_RUNTIME_MS, warnAtPercent: 80, action: 'checkpoint-stop' },
    },
    host: {},
  },
  prePrReviewer: {
    driver: 'codex-mcp',
    model: null,
    reasoning: 'medium',
    approvalPolicy: null,
    sandbox: null,
    prompt: { template: 'built-in/pre-pr-reviewer', variables: {} },
    structuredOutput: { schema: 'built-in/review-result', required: true },
    budget: {},
    host: {},
  },
  planner: {
    driver: 'inline',
    model: null,
    reasoning: null,
    approvalPolicy: null,
    sandbox: null,
    prompt: { template: 'built-in/planner', variables: {} },
    structuredOutput: { schema: 'built-in/planning-result', required: false },
    budget: {},
    host: {},
  },
  analyzer: {
    driver: 'inline',
    model: null,
    reasoning: null,
    approvalPolicy: null,
    sandbox: null,
    prompt: { template: 'built-in/analyzer', variables: {} },
    structuredOutput: { schema: 'built-in/run-analysis', required: true },
    budget: {},
    host: {},
  },
  recovery: {
    driver: 'inline',
    model: null,
    reasoning: null,
    approvalPolicy: null,
    sandbox: null,
    prompt: { template: 'built-in/recovery', variables: {} },
    structuredOutput: { schema: 'built-in/recovery-decision', required: true },
    budget: {},
    host: {},
  },
} as const;

const DEFAULT_AGENT_BINDINGS = {
  implementStory: 'storyImplementer',
  prePrReview: 'prePrReviewer',
  planTrack: 'planner',
  analyzeRun: 'analyzer',
  recoverRun: 'recovery',
  migrateTracker: 'planner',
} as const;

function mergeAgentProfiles(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;

  const profiles = { ...DEFAULT_AGENT_PROFILES } as Record<string, unknown>;
  for (const [name, profile] of Object.entries(value as Record<string, unknown>)) {
    const defaultProfile = profiles[name];
    profiles[name] =
      defaultProfile &&
      profile &&
      typeof defaultProfile === 'object' &&
      typeof profile === 'object' &&
      !Array.isArray(profile)
        ? deepMergeObjects(defaultProfile as Record<string, unknown>, profile as Record<string, unknown>)
        : profile;
  }
  return profiles;
}

function deepMergeObjects(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = merged[key];
    merged[key] =
      baseValue &&
      value &&
      typeof baseValue === 'object' &&
      typeof value === 'object' &&
      !Array.isArray(baseValue) &&
      !Array.isArray(value)
        ? deepMergeObjects(baseValue as Record<string, unknown>, value as Record<string, unknown>)
        : value;
  }
  return merged;
}

export const ConfigSchema = z
  .object({
    version: z.literal(1),
    paths: z
      .object({
        tracksDir: repoRelativePath.default('docs/tracks'),
        specsDir: repoRelativePath.default('docs/specs'),
        plansDir: repoRelativePath.default('docs/plans'),
        archiveDir: repoRelativePath.default('docs/tracks/archive'),
        prdsDir: repoRelativePath.default('docs/prds'),
      })
      .strict()
      .prefault({}),
    statuses: z
      .object({
        eligible: z.array(nonEmpty).min(1).default(['specced', 'plan-approved']),
        inProgress: nonEmpty.default('implementing'),
        complete: z.array(nonEmpty).min(1).default(['done', 'verified']),
      })
      .strict()
      .prefault({}),
    tracker: z
      .object({ idPattern: nonEmpty.default('^[A-Z]{2,}[0-9]+$') })
      .strict()
      .prefault({}),
    verify: z
      .object({
        changed: nonEmpty.nullable().default(null),
        full: nonEmpty.nullable().default(null),
      })
      .strict()
      .prefault({}),
    git: z
      .object({
        strategy: z.enum(['worktree', 'branch']).default('worktree'),
        branchPattern: nonEmpty.default('{track}/{id-lc}-{slug}'),
        baseBranch: nonEmpty.default('main'),
        commitOnBase: z.enum(['forbid', 'allow']).default('forbid'),
        worktreeDir: repoRelativePath.default('.worktrees'),
      })
      .strict()
      .prefault({}),
    pr: z
      .object({
        create: z.boolean().default(true),
        ci: z
          .object({ wait: z.boolean().default(false), command: nonEmpty.nullable().default(null) })
          .strict()
          .prefault({}),
        review: z
          .object({
            wait: z.enum(['none', 'bot', 'human']).default('none'),
            bot: nonEmpty.default('none'),
            triageComments: z.boolean().default(false),
            maxFixBatches: z.number().int().min(1).default(1),
            rerequestAfterFix: z.boolean().default(false),
            waitTimeoutMinutes: z.number().int().min(1).default(30),
          })
          .strict()
          .prefault({}),
        merge: z
          .object({
            auto: z.boolean().default(false),
            method: z.enum(['squash', 'merge', 'rebase']).default('squash'),
            deleteBranch: z.boolean().default(true),
          })
          .strict()
          .prefault({}),
      })
      .strict()
      .prefault({}),
    implement: z
      .object({
        review: z
          .object({
            prePr: z
              .object({
                enabled: z.boolean().default(true),
                mode: z.enum(['auto', 'subagent', 'inline']).default('auto'),
                maxLoops: z.number().int().min(1).default(2),
                loopMode: z.enum(['incremental', 'full']).default('incremental'),
              })
              .strict()
              .prefault({}),
            semanticChecks: z
              .object({ enabled: z.boolean().default(true) })
              .strict()
              .prefault({}),
          })
          .strict()
          .prefault({}),
        subagents: z
          .object({
            enabled: z.boolean().default(true),
            maxParallel: z.number().int().min(1).default(2),
            allowWorkers: z.boolean().default(false),
          })
          .strict()
          .prefault({}),
      })
      .strict()
      .prefault({}),
    orchestrator: z
      .object({
        driver: nonEmpty.default('codex-mcp'),
        maxParallel: z.number().int().min(1).default(2),
        stopLaunchingOnBlocked: z.boolean().default(true),
        watch: z
          .object({
            enabled: z.boolean().default(false),
            wait: z.boolean().default(false),
            intervalMs: z.number().int().min(1).default(DEFAULT_WATCH_INTERVAL_MS),
            timeoutMs: z.number().int().min(1).default(DEFAULT_WATCH_TIMEOUT_MS),
          })
          .strict()
          .prefault({}),
        childTimeoutMs: z.number().int().min(1).default(DEFAULT_CHILD_NO_PROGRESS_TIMEOUT_MS),
        childNoProgressTimeoutMs: z.number().int().min(1).default(DEFAULT_CHILD_NO_PROGRESS_TIMEOUT_MS),
        childStartupTimeoutMs: z.number().int().min(1).default(DEFAULT_CHILD_STARTUP_TIMEOUT_MS),
        childMaxRuntimeMs: z.number().int().min(1).default(DEFAULT_CHILD_MAX_RUNTIME_MS),
      })
      .strict()
      .prefault({}),
    childSession: ChildSessionSchema.optional(),
    codex: z
      .object({
        childSession: ChildSessionSchema.optional(),
      })
      .strict()
      .prefault({}),
    agents: z
      .object({
        profiles: z
          .preprocess(mergeAgentProfiles, z.record(nonEmpty, AgentProfileSchema))
          .prefault(DEFAULT_AGENT_PROFILES),
        bindings: z
          .object(
            Object.fromEntries(
              AGENT_TASK_TYPES.map((taskType) => [taskType, nonEmpty.default(DEFAULT_AGENT_BINDINGS[taskType])]),
            ) as Record<(typeof AGENT_TASK_TYPES)[number], z.ZodDefault<typeof nonEmpty>>,
          )
          .strict()
          .prefault(DEFAULT_AGENT_BINDINGS),
      })
      .strict()
      .prefault({})
      .superRefine((agents, context) => {
        for (const taskType of AGENT_TASK_TYPES) {
          const profileName = agents.bindings[taskType];
          if (!Object.hasOwn(agents.profiles, profileName)) {
            context.addIssue({
              code: 'custom',
              path: ['bindings', taskType],
              message: `references missing agent profile "${profileName}"`,
            });
          }
        }
      }),
  })
  .strict();

export type WorkflowConfig = z.infer<typeof ConfigSchema>;
