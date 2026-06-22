import type { GitSha } from '../repository/index.js';

export type LocalBranchNameOptions = {
  readonly prefix: string;
  readonly includeRunId: boolean;
  readonly includeTaskId: boolean;
  readonly maxLength: number;
};

export type LocalBranchPlan = {
  readonly branchName: string;
  readonly targetSha: GitSha;
};

export type BranchConflict = {
  readonly token: 'branch-conflict';
  readonly branchName: string;
  readonly existingSha: GitSha;
  readonly targetSha: GitSha;
};

export type LocalBranchPlanResult =
  | {
      readonly ok: true;
      readonly value: LocalBranchPlan;
    }
  | {
      readonly ok: false;
      readonly error: BranchConflict;
    };

export type BuildLocalBranchNameInput = {
  readonly repoId: string;
  readonly runId: string;
  readonly taskId: string;
  readonly options: LocalBranchNameOptions;
  readonly collisionSuffix?: string;
};

export type PlanLocalBranchInput = BuildLocalBranchNameInput & {
  readonly targetSha: GitSha;
  readonly existingBranchSha?: GitSha;
};

const sanitizeBranchSegment = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '');

  return normalized.length > 0 ? normalized : 'branch';
};

const trimToLength = (value: string, length: number): string =>
  length <= 0 ? '' : value.slice(0, length).replace(/[.-]+$/g, '');

export const buildLocalBranchName = (input: BuildLocalBranchNameInput): string => {
  const segments = [
    sanitizeBranchSegment(input.options.prefix),
    sanitizeBranchSegment(input.repoId),
    ...(input.options.includeRunId ? [sanitizeBranchSegment(input.runId)] : []),
    ...(input.options.includeTaskId ? [sanitizeBranchSegment(input.taskId)] : []),
  ];

  const suffix = input.collisionSuffix === undefined ? '' : `-${sanitizeBranchSegment(input.collisionSuffix)}`;
  const prefixSegments = segments.slice(0, -1);
  const lastSegment = segments.at(-1) ?? 'task';
  const reservedLength = prefixSegments.join('/').length + (prefixSegments.length > 0 ? 1 : 0) + suffix.length;
  const availableLength = Math.max(input.options.maxLength - reservedLength, 1);
  const trimmedLastSegment = trimToLength(lastSegment, availableLength);
  const branchName = [...prefixSegments, `${trimmedLastSegment || 'task'}${suffix}`].join('/');

  return branchName.length <= input.options.maxLength ? branchName : trimToLength(branchName, input.options.maxLength);
};

export const planLocalBranch = (input: PlanLocalBranchInput): LocalBranchPlanResult => {
  const branchName = buildLocalBranchName(input);

  if (input.existingBranchSha !== undefined && input.existingBranchSha !== input.targetSha) {
    return {
      ok: false,
      error: {
        token: 'branch-conflict',
        branchName,
        existingSha: input.existingBranchSha,
        targetSha: input.targetSha,
      },
    };
  }

  return {
    ok: true,
    value: {
      branchName,
      targetSha: input.targetSha,
    },
  };
};
