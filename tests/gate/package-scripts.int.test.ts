import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { LOCAL_CHECK_GATE, localCheckGateScript } from '../../tooling/docs-nav/local-check-gate.js';

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, '../..');
const docsNavScript = resolve(repositoryRoot, 'tooling/docs-nav/generate-nav.mjs');

type PackageJson = {
  readonly scripts: Readonly<Record<string, string>>;
};

const readPackageJson = async (): Promise<PackageJson> =>
  JSON.parse(await readFile(resolve(repositoryRoot, 'package.json'), 'utf8')) as PackageJson;

describe('pnpm check package scripts', () => {
  it('matches the LocalCheckGate commands and fail-fast order', async () => {
    const packageJson = await readPackageJson();

    for (const step of LOCAL_CHECK_GATE.steps) {
      expect(packageJson.scripts[step.script]).toBe(step.command);
    }
    expect(packageJson.scripts.check).toBe(localCheckGateScript());
  });

  it('preserves leaf scripts and delegates the gate to Turbo', async () => {
    const packageJson = await readPackageJson();

    // Leaf scripts stay intact for targeted local runs.
    expect(packageJson.scripts.deps).toBe('depcruise --config .dependency-cruiser.cjs packages tooling tests');
    expect(packageJson.scripts.typecheck).toBe('tsc -b');
    expect(packageJson.scripts['test:unit']).toBe('vitest run --project unit --passWithNoTests');
    expect(packageJson.scripts['test:int']).toBe('vitest run --project integration --passWithNoTests');
    // The aggregate gate is now a Turbo root-task invocation, not a plain && chain.
    expect(packageJson.scripts.check).toBe('turbo run //#check:gate');
    // The no-op leaf that Turbo drives must be present.
    expect(packageJson.scripts['check:gate']).toBe('node -e ""');
    // A force-run variant is available for CI cold runs.
    expect(packageJson.scripts['check:ci']).toBe('turbo run //#check:gate --force');
  });

  it('keeps smoke-real out of pnpm check while preserving a separate smoke command', async () => {
    const packageJson = await readPackageJson();

    expect(packageJson.scripts['test:smoke']).toBe('vitest run --project smoke-real --passWithNoTests');
    expect(packageJson.scripts.check).not.toContain('test:smoke');
    expect(packageJson.scripts.check).not.toContain('smoke-real');
  });

  it('fails stale docs navigation before format or later gate steps can run', async () => {
    const docsRoot = await mkdtemp(join(tmpdir(), 'kit-vnext-docs-nav-'));

    try {
      await writeFile(join(docsRoot, 'README.md'), '# Fixture Root\n\n[Child](./child.md)\n');
      await writeFile(join(docsRoot, 'child.md'), '# Child\n\nstale nav fixture\n');

      await expect(
        execFileAsync(process.execPath, [docsNavScript, '--check', '--root', docsRoot], {
          cwd: repositoryRoot,
        }),
      ).rejects.toMatchObject({
        stderr: expect.stringContaining('Nav out of date:'),
      });
    } finally {
      await rm(docsRoot, { recursive: true, force: true });
    }
  });
});
