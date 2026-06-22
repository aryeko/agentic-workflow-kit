import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import vitestConfig from '../../vitest.config.js';

type VitestProject = {
  readonly test: {
    readonly name: string;
    readonly include: readonly string[];
    readonly setupFiles?: readonly string[];
  };
};

const projects = (vitestConfig.test?.projects ?? []) as readonly VitestProject[];

const projectByName = (name: string): VitestProject => {
  const project = projects.find((candidate) => candidate.test.name === name);

  if (!project) {
    throw new Error(`Missing Vitest project ${name}`);
  }

  return project;
};

describe('Vitest lane configuration', () => {
  it('matches the documented lane names and globs', () => {
    expect(projects.map((project) => project.test.name)).toEqual([
      'unit',
      'integration',
      'conformance-mock',
      'smoke-real',
    ]);
    expect(projectByName('unit').test.include).toEqual(['tests/**/*.unit.test.ts', 'packages/**/*.unit.test.ts']);
    expect(projectByName('integration').test.include).toEqual(['tests/**/*.int.test.ts', 'packages/**/*.int.test.ts']);
    expect(projectByName('conformance-mock').test.include).toEqual([
      'tests/**/*.conformance.test.ts',
      'packages/**/*.conformance.test.ts',
    ]);
    expect(projectByName('smoke-real').test.include).toEqual([
      'tests/**/*.smoke.test.ts',
      'packages/**/*.smoke.test.ts',
    ]);
  });

  it('loads the no-side-effects guard only for hermetic unit and conformance-mock lanes', () => {
    expect(projectByName('unit').test.setupFiles).toEqual(['./tooling/no-side-effects.setup.ts']);
    expect(projectByName('conformance-mock').test.setupFiles).toEqual(['./tooling/no-side-effects.setup.ts']);
    expect(projectByName('integration').test.setupFiles).toBeUndefined();
    expect(projectByName('smoke-real').test.setupFiles).toBeUndefined();
  });

  it('permits local filesystem reads and writes in the integration lane', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'kit-vnext-integration-lane-'));
    const fixtureFile = join(fixtureRoot, 'fixture.txt');

    try {
      await writeFile(fixtureFile, 'integration filesystem access\n');

      await expect(readFile(fixtureFile, 'utf8')).resolves.toBe('integration filesystem access\n');
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('defines the guard setup file at the configured path', async () => {
    await expect(
      readFile(resolve(import.meta.dirname, '../..', 'tooling/no-side-effects.setup.ts'), 'utf8'),
    ).resolves.toContain('forbidden in this lane');
  });
});
