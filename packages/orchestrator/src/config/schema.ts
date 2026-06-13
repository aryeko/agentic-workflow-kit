import path from 'node:path';
import { z } from 'zod';

const nonEmpty = z.string().min(1);
const repoRelativePath = nonEmpty.refine((value) => !path.isAbsolute(value) && !value.split(/[\\/]+/).includes('..'), {
  message: 'must be a repo-relative path that does not contain .. segments',
});
const DEFAULT_CHILD_NO_PROGRESS_TIMEOUT_MS = 1_800_000;
const DEFAULT_CHILD_STARTUP_TIMEOUT_MS = 60_000;
const DEFAULT_CHILD_MAX_RUNTIME_MS = 7_200_000;
const DEFAULT_WATCH_INTERVAL_MS = 300_000;
const DEFAULT_WATCH_TIMEOUT_MS = 300_000;

export const ConfigSchema = z
  .object({
    version: z.literal(1),
    paths: z
      .object({
        tracksDir: nonEmpty.default('docs/tracks'),
        specsDir: nonEmpty.default('docs/specs'),
        plansDir: nonEmpty.default('docs/plans'),
        archiveDir: nonEmpty.default('docs/tracks/archive'),
        prdsDir: nonEmpty.default('docs/prds'),
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
  })
  .strict();

export type WorkflowConfig = z.infer<typeof ConfigSchema>;
