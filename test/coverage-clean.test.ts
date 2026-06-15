import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('coverage cleanup script', () => {
  it('removes stale coverage output before test runs', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-coverage-clean-'));
    tempRoots.push(root);
    const coverageDir = path.join(root, 'coverage');
    const staleFile = path.join(coverageDir, '.tmp', 'coverage-0.json');
    await mkdir(path.dirname(staleFile), { recursive: true });
    await writeFile(staleFile, '{}\n');

    await execFileAsync(process.execPath, ['scripts/clean-coverage.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, AGENTIC_WORKFLOW_KIT_COVERAGE_DIR: coverageDir },
    });

    await expect(readFile(staleFile, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
