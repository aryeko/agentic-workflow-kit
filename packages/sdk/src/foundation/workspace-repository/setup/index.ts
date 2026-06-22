import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ArtifactRef } from '../../storage/artifacts/index.js';
import type { AbsolutePath, RelativePath } from '../repository/index.js';

export type DeclaredSetup = {
  readonly command: string;
  readonly workingDirectory: RelativePath;
  readonly freshness:
    | { readonly kind: 'marker-file'; readonly path: RelativePath; readonly contentHash?: string }
    | { readonly kind: 'path-set'; readonly paths: readonly RelativePath[] }
    | { readonly kind: 'artifact-ref'; readonly refName: string };
  readonly rerunPolicy: 'on-fresh-worktree' | 'when-stale' | 'always';
};

export type SetupFreshnessReason =
  | 'new-worktree'
  | 'marker-missing'
  | 'marker-mismatch'
  | 'paths-missing'
  | 'artifact-stale'
  | 'setup-freshness-unknown';

export type SetupEvaluation = {
  readonly leaseId: string;
  readonly setup: DeclaredSetup;
  readonly fresh: boolean;
  readonly reason: SetupFreshnessReason;
};

export type ReadTextFileResult = { readonly ok: true; readonly value: string | undefined } | { readonly ok: false };

export type ResolveArtifactRefResult =
  | { readonly ok: true; readonly value: ArtifactRef | undefined }
  | { readonly ok: false };

export type SetupDependencies = {
  readonly pathExists: (path: AbsolutePath) => boolean;
  readonly readTextFile: (path: AbsolutePath) => ReadTextFileResult;
  readonly resolveArtifactRef: (refName: string) => ResolveArtifactRefResult;
};

export type EvaluateDeclaredSetupInput = {
  readonly leaseId: string;
  readonly setup: DeclaredSetup;
  readonly worktreePath: AbsolutePath;
  readonly isInitialEvaluation: boolean;
};

const toAbsolutePath = (root: AbsolutePath, relativePath: RelativePath): AbsolutePath =>
  join(root, relativePath) as AbsolutePath;

export const createSetupDependencies = (overrides: Partial<SetupDependencies> = {}): SetupDependencies => ({
  pathExists: overrides.pathExists ?? ((path) => existsSync(path)),
  readTextFile:
    overrides.readTextFile ??
    ((path) => {
      if (!existsSync(path)) {
        return { ok: true, value: undefined };
      }

      return {
        ok: true,
        value: readFileSync(path, 'utf8'),
      };
    }),
  resolveArtifactRef:
    overrides.resolveArtifactRef ??
    (() => ({
      ok: true,
      value: undefined,
    })),
});

const evaluateFreshness = (
  setup: DeclaredSetup,
  worktreePath: AbsolutePath,
  dependencies: SetupDependencies,
): { readonly fresh: boolean; readonly reason: SetupFreshnessReason } => {
  switch (setup.freshness.kind) {
    case 'marker-file': {
      const readResult = dependencies.readTextFile(toAbsolutePath(worktreePath, setup.freshness.path));

      if (!readResult.ok) {
        return { fresh: false, reason: 'setup-freshness-unknown' };
      }

      if (readResult.value === undefined) {
        return { fresh: false, reason: 'marker-missing' };
      }

      if (setup.freshness.contentHash !== undefined && readResult.value !== setup.freshness.contentHash) {
        return { fresh: false, reason: 'marker-mismatch' };
      }

      return { fresh: true, reason: 'new-worktree' };
    }

    case 'path-set': {
      const hasMissingPath = setup.freshness.paths.some(
        (relativePath) => !dependencies.pathExists(toAbsolutePath(worktreePath, relativePath)),
      );

      return hasMissingPath ? { fresh: false, reason: 'paths-missing' } : { fresh: true, reason: 'new-worktree' };
    }

    case 'artifact-ref': {
      const artifactResult = dependencies.resolveArtifactRef(setup.freshness.refName);

      if (!artifactResult.ok) {
        return { fresh: false, reason: 'setup-freshness-unknown' };
      }

      return artifactResult.value === undefined
        ? { fresh: false, reason: 'artifact-stale' }
        : { fresh: true, reason: 'new-worktree' };
    }
  }
};

export const evaluateDeclaredSetup = (
  input: EvaluateDeclaredSetupInput,
  dependencies: SetupDependencies,
): SetupEvaluation => {
  if (input.isInitialEvaluation && input.setup.rerunPolicy !== 'when-stale') {
    return {
      leaseId: input.leaseId,
      setup: input.setup,
      fresh: false,
      reason: 'new-worktree',
    };
  }

  const freshness = evaluateFreshness(input.setup, input.worktreePath, dependencies);

  return {
    leaseId: input.leaseId,
    setup: input.setup,
    fresh: freshness.fresh,
    reason: freshness.reason,
  };
};
