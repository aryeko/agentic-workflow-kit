import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runTypeFixtures } from '../../tooling/type-fixtures/run-type-fixtures.js';

/**
 * Integration lane: this spawns `tsc`, so it lives in the `*.int.test.ts` suite.
 * It proves the lane logic against temp-dir fixtures rather than the real
 * (unmerged) Epic 3 fixtures, so it works on `v-next` where none exist yet.
 */

let fixtureRoot: string;

const writeFile2 = async (relativePath: string, contents: string): Promise<void> => {
  const absolutePath = join(fixtureRoot, relativePath);
  await mkdir(join(absolutePath, '..'), { recursive: true });
  await writeFile(absolutePath, contents);
};

const baseTsconfig = JSON.stringify({
  compilerOptions: {
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    target: 'ES2022',
    strict: true,
    noEmit: true,
  },
});

const negativeTsconfig = (include: string): string =>
  JSON.stringify({
    extends: '../tsconfig.json',
    compilerOptions: { noEmit: true, composite: false },
    include: [include],
  });

const publicTsconfig = (include: string): string =>
  JSON.stringify({
    extends: '../tsconfig.json',
    compilerOptions: { noEmit: true, composite: false },
    include: [include],
  });

beforeEach(async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), 'kit-vnext-type-fixtures-'));
  await writeFile2('packages/sdk/tests/tsconfig.json', baseTsconfig);
});

afterEach(async () => {
  await rm(fixtureRoot, { recursive: true, force: true });
});

describe('runTypeFixtures', () => {
  it('passes as a clean no-op when no fixtures exist and reports a zero count', async () => {
    await rm(join(fixtureRoot, 'packages'), { recursive: true, force: true });

    const result = await runTypeFixtures({ packagesRoot: join(fixtureRoot, 'packages') });

    expect(result.ok).toBe(true);
    expect(result.checked).toBe(0);
    expect(result.negativeCount).toBe(0);
    expect(result.publicCount).toBe(0);
    expect(result.violations).toEqual([]);
  });

  it('accepts a negative tsconfig that fails to compile', async () => {
    await writeFile2('packages/sdk/tests/feature/widens.fixture.ts', 'const value: "a" = "b";\nexport { value };\n');
    await writeFile2('packages/sdk/tests/feature/tsconfig.negative.json', negativeTsconfig('./widens.fixture.ts'));

    const result = await runTypeFixtures({ packagesRoot: join(fixtureRoot, 'packages') });

    expect(result.ok).toBe(true);
    expect(result.checked).toBe(1);
    expect(result.negativeCount).toBe(1);
    expect(result.violations).toEqual([]);
  });

  it('flags a negative tsconfig that compiles clean (the regression it must catch)', async () => {
    await writeFile2('packages/sdk/tests/feature/clean.fixture.ts', 'export const stillCompiles: number = 1;\n');
    await writeFile2('packages/sdk/tests/feature/tsconfig.negative.json', negativeTsconfig('./clean.fixture.ts'));

    const result = await runTypeFixtures({ packagesRoot: join(fixtureRoot, 'packages') });

    expect(result.ok).toBe(false);
    expect(result.checked).toBe(1);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      kind: 'negative',
      reason: 'negative-fixture-compiled-clean',
    });
  });

  it('accepts a public tsconfig that compiles clean', async () => {
    await writeFile2('packages/sdk/tests/feature/support.ts', 'export const supported: number = 1;\n');
    await writeFile2('packages/sdk/tests/feature/tsconfig.public.json', publicTsconfig('./support.ts'));

    const result = await runTypeFixtures({ packagesRoot: join(fixtureRoot, 'packages') });

    expect(result.ok).toBe(true);
    expect(result.checked).toBe(1);
    expect(result.publicCount).toBe(1);
    expect(result.violations).toEqual([]);
  });

  it('flags a public tsconfig that fails to compile', async () => {
    await writeFile2('packages/sdk/tests/feature/broken.ts', 'export const broken: number = "not a number";\n');
    await writeFile2('packages/sdk/tests/feature/tsconfig.public.json', publicTsconfig('./broken.ts'));

    const result = await runTypeFixtures({ packagesRoot: join(fixtureRoot, 'packages') });

    expect(result.ok).toBe(false);
    expect(result.checked).toBe(1);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      kind: 'public',
      reason: 'public-fixture-failed-compile',
    });
  });

  it('checks negative and public fixtures together and aggregates counts', async () => {
    await writeFile2('packages/sdk/tests/a/a.fixture.ts', 'const a: "x" = "y";\nexport { a };\n');
    await writeFile2('packages/sdk/tests/a/tsconfig.negative.json', negativeTsconfig('./a.fixture.ts'));
    await writeFile2('packages/sdk/tests/b/support.ts', 'export const b: number = 1;\n');
    await writeFile2('packages/sdk/tests/b/tsconfig.public.json', publicTsconfig('./support.ts'));

    const result = await runTypeFixtures({ packagesRoot: join(fixtureRoot, 'packages') });

    expect(result.ok).toBe(true);
    expect(result.checked).toBe(2);
    expect(result.negativeCount).toBe(1);
    expect(result.publicCount).toBe(1);
  });
});
