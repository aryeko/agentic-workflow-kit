import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { workspaceRepositoryBoundaryReport } from '../../../../src/foundation/workspace-repository/boundary/index.js';
import { workspaceRepositoryForbiddenBoundaryTerms } from '../../../../src/foundation/workspace-repository/boundary/index.js';

const readModuleSource = (relativePathFromTest: string): string =>
  readFileSync(fileURLToPath(new URL(relativePathFromTest, import.meta.url)), 'utf8');

const collectExportedTypeNames = (source: string): string[] =>
  [...source.matchAll(/export\s+type\s+([A-Za-z0-9_]+)/g)].map((match) => match[1]);

const collectReadonlyFieldNames = (source: string): string[] =>
  [...source.matchAll(/readonly\s+([A-Za-z0-9_]+)\??:/g)].map((match) => match[1]);

const tokenRepresentsForbiddenConcept = (token: string, term: string): boolean => {
  const lowered = token.toLowerCase();

  if (term === 'pr' || term === 'ci') {
    return lowered === term || lowered.startsWith(`${term}_`) || lowered.endsWith(`_${term}`);
  }

  return lowered.includes(term);
};

describe('fnd-03-s1 boundary report sweeps', () => {
  it('keeps forbidden boundary terms out of the reported field names', () => {
    const loweredFieldNames = Object.values(workspaceRepositoryBoundaryReport)
      .flatMap((entry) => ('fields' in entry ? entry.fields : []))
      .map((fieldName) => fieldName.toLowerCase());

    for (const term of workspaceRepositoryBoundaryReport.forbiddenTerms) {
      expect(loweredFieldNames.some((fieldName) => fieldName.includes(term))).toBe(false);
    }
  });

  it('keeps forbidden terms and fnd-01 policy producers out of the real repository and branch export surface', () => {
    const repositorySource = readModuleSource('../../../../src/foundation/workspace-repository/repository/index.ts');
    const branchSource = readModuleSource('../../../../src/foundation/workspace-repository/branch/index.ts');
    const workspaceRepositoryBarrelSource = readModuleSource(
      '../../../../src/foundation/workspace-repository/index.ts',
    );
    const rootSdkBarrelSource = readModuleSource('../../../../src/index.ts');
    const exportedSurfaceTokens = [
      ...collectExportedTypeNames(repositorySource),
      ...collectReadonlyFieldNames(repositorySource),
      ...collectExportedTypeNames(branchSource),
      ...collectReadonlyFieldNames(branchSource),
    ].map((token) => token.toLowerCase());

    for (const term of workspaceRepositoryForbiddenBoundaryTerms) {
      expect(exportedSurfaceTokens.some((token) => tokenRepresentsForbiddenConcept(token, term))).toBe(false);
    }

    expect(collectExportedTypeNames(repositorySource)).not.toContain('WorkspaceRepositoryPolicySource');
    expect(repositorySource.includes('PolicyLayer')).toBe(false);
    expect(repositorySource.includes('ResolvedPolicy')).toBe(false);
    expect(workspaceRepositoryBarrelSource.includes('WorkspaceRepositoryPolicySource')).toBe(false);
    expect(rootSdkBarrelSource).toContain("export * from './foundation/workspace-repository/index.js';");
  });
});
