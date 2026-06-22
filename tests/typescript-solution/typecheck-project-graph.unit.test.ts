import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  TYPECHECK_PROJECT_FAILURE_TOKENS,
  TYPECHECK_PROJECT_PACKAGE_IDS,
  createTypecheckProjectGraph,
  type PackageId,
  type PackageTsconfigSource,
  type RootTypecheckSolution,
} from '../../tooling/typescript-solution/typecheck-project-graph.js';

const readJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, 'utf8')) as T;

const loadActualGraphInputs = async (): Promise<{
  readonly rootConfig: RootTypecheckSolution;
  readonly packageConfigs: readonly PackageTsconfigSource[];
}> => ({
  rootConfig: await readJson<RootTypecheckSolution>('tsconfig.json'),
  packageConfigs: await Promise.all(
    TYPECHECK_PROJECT_PACKAGE_IDS.map(async (packageId) => ({
      packageId,
      config: await readJson(`packages/${packageId}/tsconfig.json`),
    })),
  ),
});

describe('TypecheckProjectGraph', () => {
  it('names the S3 failure tokens required by the story contract', () => {
    expect(TYPECHECK_PROJECT_FAILURE_TOKENS).toEqual([
      'project-reference-missing',
      'forbidden-ts-reference',
      'non-composite-package-project',
    ]);
  });

  it('emits the root TypeScript solution graph in stable package order', async () => {
    const { rootConfig, packageConfigs } = await loadActualGraphInputs();
    const graph = createTypecheckProjectGraph(rootConfig, packageConfigs);

    expect(graph.valid).toBe(true);
    expect(graph.contractName).toBe('TypecheckProjectGraph');
    expect(graph.rootReferences.map((reference) => reference.path)).toEqual([
      './packages/cli',
      './packages/mcp',
      './packages/provider-codex',
      './packages/provider-github',
      './packages/provider-local',
      './packages/provider-markdown',
      './packages/sdk',
      './packages/testkit',
      './tsconfig.infra.json',
    ]);
    expect(graph.packages.map((project) => project.packageId)).toEqual(TYPECHECK_PROJECT_PACKAGE_IDS);
  });

  it('validates every package as a composite declaration-emitting project', async () => {
    const { rootConfig, packageConfigs } = await loadActualGraphInputs();
    const graph = createTypecheckProjectGraph(rootConfig, packageConfigs);

    expect(
      graph.packages.map((project) => ({
        packageId: project.packageId,
        packageRoot: project.packageRoot,
        extends: project.extends,
        compilerOptions: project.compilerOptions,
        include: project.include,
      })),
    ).toEqual(
      TYPECHECK_PROJECT_PACKAGE_IDS.map((packageId) => ({
        packageId,
        packageRoot: `packages/${packageId}`,
        extends: '../../tsconfig.base.json',
        compilerOptions: {
          composite: true,
          declaration: true,
          declarationMap: true,
          outDir: './dist',
          rootDir: '.',
        },
        include: ['package.json', 'src/**/*.ts', 'src/**/*.tsx'],
      })),
    );
    expect(graph.failures).toEqual([]);
  });

  it('keeps package project references aligned with the dependency matrix', async () => {
    const { rootConfig, packageConfigs } = await loadActualGraphInputs();
    const graph = createTypecheckProjectGraph(rootConfig, packageConfigs);

    expect(
      graph.packages.map((project) => [project.packageId, project.references.map((reference) => reference.path)]),
    ).toEqual([
      ['cli', ['../sdk', '../provider-codex', '../provider-github', '../provider-local', '../provider-markdown']],
      ['mcp', ['../sdk', '../provider-codex', '../provider-github', '../provider-local', '../provider-markdown']],
      ['provider-codex', ['../sdk']],
      ['provider-github', ['../sdk']],
      ['provider-local', ['../sdk']],
      ['provider-markdown', ['../sdk']],
      ['sdk', []],
      ['testkit', ['../sdk']],
    ]);
  });

  it('reports project-reference-missing when root or package references are absent', async () => {
    const { rootConfig, packageConfigs } = await loadActualGraphInputs();
    const rootMissingSdk = {
      ...rootConfig,
      references: rootConfig.references.filter((reference) => reference.path !== './packages/sdk'),
    };
    const cliMissingProvider = packageConfigs.map((source) =>
      source.packageId === 'cli'
        ? {
            packageId: source.packageId,
            config: {
              ...(source.config as Record<string, unknown>),
              references: [{ path: '../sdk' }],
            },
          }
        : source,
    );
    const graph = createTypecheckProjectGraph(rootMissingSdk, cliMissingProvider);

    expect(graph.valid).toBe(false);
    expect(graph.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          token: 'project-reference-missing',
          project: 'root',
          message: 'Root TypeScript solution must reference ./packages/sdk.',
        }),
        expect.objectContaining({
          token: 'project-reference-missing',
          project: 'cli',
          message: 'Package cli must reference allowed dependency provider-codex.',
        }),
      ]),
    );
  });

  it('reports forbidden-ts-reference before implementation imports can rely on the edge', async () => {
    const { rootConfig, packageConfigs } = await loadActualGraphInputs();
    const graph = createTypecheckProjectGraph(rootConfig, withReference(packageConfigs, 'sdk', '../cli'));

    expect(graph.valid).toBe(false);
    expect(graph.failures).toContainEqual({
      token: 'forbidden-ts-reference',
      project: 'sdk',
      message: 'Package sdk must not reference forbidden package cli.',
    });
  });

  it('reports non-composite-package-project for invalid package configs', async () => {
    const { rootConfig, packageConfigs } = await loadActualGraphInputs();
    const graph = createTypecheckProjectGraph(
      rootConfig,
      packageConfigs.map((source) =>
        source.packageId === 'sdk'
          ? {
              packageId: source.packageId,
              config: {
                ...(source.config as Record<string, unknown>),
                compilerOptions: { composite: false },
              },
            }
          : source,
      ),
    );

    expect(graph.valid).toBe(false);
    expect(graph.failures).toContainEqual({
      token: 'non-composite-package-project',
      project: 'sdk',
      message: 'Package sdk must be a composite package project with declaration output.',
    });
  });

  it('reports non-composite-package-project for malformed package references', async () => {
    const { rootConfig, packageConfigs } = await loadActualGraphInputs();
    const graph = createTypecheckProjectGraph(
      rootConfig,
      packageConfigs.map((source) =>
        source.packageId === 'testkit'
          ? {
              packageId: source.packageId,
              config: {
                ...(source.config as Record<string, unknown>),
                references: [{ path: '../testkit' }, { path: 42 }],
              },
            }
          : source,
      ),
    );

    expect(graph.valid).toBe(false);
    expect(graph.failures).toContainEqual({
      token: 'non-composite-package-project',
      project: 'testkit',
      message: 'Package testkit must be a composite package project with declaration output.',
    });
  });
});

const withReference = (
  packageConfigs: readonly PackageTsconfigSource[],
  packageId: PackageId,
  referencePath: string,
): readonly PackageTsconfigSource[] =>
  packageConfigs.map((source) =>
    source.packageId === packageId
      ? {
          packageId,
          config: {
            ...(source.config as Record<string, unknown>),
            references: [
              ...(((source.config as { readonly references?: readonly unknown[] }).references ??
                []) as readonly unknown[]),
              { path: referencePath },
            ],
          },
        }
      : source,
  );
