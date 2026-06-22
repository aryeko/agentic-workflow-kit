export const workspaceRepositoryForbiddenBoundaryTerms = [
  'remote',
  'credential',
  'process',
  'ci',
  'pr',
  'check',
  'review',
  'merge',
  'containment',
] as const;

export const workspaceRepositoryBoundaryReport = {
  repositoryIdentity: {
    typeName: 'RepositoryIdentity',
    fields: ['repoId', 'repoRoot', 'gitDir', 'defaultBaseRef'],
  },
  branchModel: {
    typeName: 'LocalBranchPlan',
    fields: ['branchName', 'targetSha'],
  },
  failureTokens: ['base-ref-unresolved', 'branch-conflict'],
  forbiddenTerms: workspaceRepositoryForbiddenBoundaryTerms,
} as const;

export type WorkspaceRepositoryForbiddenBoundaryTerm = (typeof workspaceRepositoryForbiddenBoundaryTerms)[number];
export type WorkspaceRepositoryBoundaryReport = typeof workspaceRepositoryBoundaryReport;
