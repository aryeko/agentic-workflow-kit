import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const packageRoot = new URL('../../', import.meta.url);

const targetPackages = [
  'cli',
  'mcp',
  'provider-codex',
  'provider-github',
  'provider-local',
  'provider-markdown',
  'sdk',
  'testkit',
] as const;

const expectedDependencies: Record<(typeof targetPackages)[number], readonly string[]> = {
  cli: ['provider-codex', 'provider-github', 'provider-local', 'provider-markdown', 'sdk'],
  mcp: ['provider-codex', 'provider-github', 'provider-local', 'provider-markdown', 'sdk'],
  'provider-codex': ['sdk'],
  'provider-github': ['sdk'],
  'provider-local': ['sdk'],
  'provider-markdown': ['sdk'],
  sdk: [],
  testkit: ['sdk'],
};

type PackageManifest = {
  readonly name?: string;
  readonly private?: boolean;
  readonly type?: string;
  readonly dependencies?: Record<string, string>;
  readonly scripts?: Record<string, string>;
};

const readManifest = async (packageId: string): Promise<PackageManifest> => {
  const manifest = await readFile(join(packageRoot.pathname, packageId, 'package.json'), 'utf8');
  return JSON.parse(manifest) as PackageManifest;
};

describe('epic0-s1-package-graph', () => {
  it('contains exactly the frozen package target directories', async () => {
    const entries = await readdir(packageRoot, { withFileTypes: true });
    const packageIds = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(packageIds).toEqual([...targetPackages]);
  });

  it('declares canonical workspace package manifests', async () => {
    for (const packageId of targetPackages) {
      const manifest = await readManifest(packageId);

      expect(manifest.name).toBe(packageId);
      expect(manifest.private).toBe(true);
      expect(manifest.type).toBe('module');
      expect(manifest.scripts).toMatchObject({
        build: 'tsc -b',
        test: 'vitest run --passWithNoTests',
        typecheck: 'tsc -b',
      });
    }
  });

  it('declares only dependency-rule-approved workspace edges', async () => {
    for (const packageId of targetPackages) {
      const manifest = await readManifest(packageId);
      const workspaceDependencies = Object.entries(manifest.dependencies ?? {})
        .filter(([, version]) => version === 'workspace:*')
        .map(([dependency]) => dependency)
        .sort();

      expect(workspaceDependencies).toEqual([...expectedDependencies[packageId]].sort());
    }
  });

  it('serializes downstream package graph evidence in package-owned files', async () => {
    const evidence = await readFile(join(packageRoot.pathname, 'testkit', 'README.md'), 'utf8');

    expect(evidence).toContain('PackageTargetPathset');
    expect(evidence).toContain('WorkspacePackageManifest');
    for (const packageId of targetPackages) {
      expect(evidence).toContain(`packages/${packageId}`);
      expect(evidence).toContain(`| \`${packageId}\` |`);
    }
  });
});
