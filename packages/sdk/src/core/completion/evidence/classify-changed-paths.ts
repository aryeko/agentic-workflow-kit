import { matchesAnyPathPattern } from './match-path.js';
import type { ChangedPathClassification, ChangedPathGateResult } from './types.js';

type ClassifyChangedPathsInput = {
  readonly changedPaths: readonly string[];
  readonly allowedChangePaths?: readonly string[];
  readonly protectedPathSets?:
    | readonly {
        readonly label: string;
        readonly digest: string;
        readonly paths: readonly string[];
      }[]
    | undefined;
  readonly runnerEvidencePaths?: readonly string[];
  readonly protectedPolicyApproved?: boolean;
};

const classifyPath = (
  path: string,
  input: Required<Pick<ClassifyChangedPathsInput, 'allowedChangePaths' | 'protectedPathSets' | 'runnerEvidencePaths'>>,
): ChangedPathClassification => {
  const protectedPatterns = input.protectedPathSets.flatMap((entry) => entry.paths);
  if (matchesAnyPathPattern(path, protectedPatterns)) {
    return { path, class: 'protected-policy-change' };
  }

  if (matchesAnyPathPattern(path, input.runnerEvidencePaths)) {
    return { path, class: 'runner-evidence-change' };
  }

  if (matchesAnyPathPattern(path, input.allowedChangePaths)) {
    return { path, class: 'allowed-task-change' };
  }

  return { path, class: 'outside-allowlist' };
};

export const classifyChangedPaths = (input: ClassifyChangedPathsInput): ChangedPathGateResult => {
  if (input.allowedChangePaths === undefined || input.protectedPathSets === undefined) {
    return {
      classifications: input.changedPaths.map((path) => ({ path, class: 'unclassified' })),
      state: 'changed-file-policy-absent',
    };
  }

  const allowedChangePaths = input.allowedChangePaths;
  const protectedPathSets = input.protectedPathSets;
  const classifications = input.changedPaths.map((path) =>
    classifyPath(path, {
      allowedChangePaths,
      protectedPathSets,
      runnerEvidencePaths: input.runnerEvidencePaths ?? [],
    }),
  );

  if (classifications.some((entry) => entry.class === 'outside-allowlist')) {
    return { classifications, state: 'changed-files-outside-allowlist' };
  }

  if (
    classifications.some((entry) => entry.class === 'protected-policy-change') &&
    input.protectedPolicyApproved !== true
  ) {
    return { classifications, state: 'protected-policy-change-unapproved' };
  }

  return { classifications };
};
