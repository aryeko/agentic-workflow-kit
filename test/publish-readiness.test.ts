import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const orchestratorDist = path.join(repoRoot, 'packages/orchestrator/dist');
const orchestratorVersion = JSON.parse(
  readFileSync(path.join(repoRoot, 'packages/orchestrator/package.json'), 'utf8'),
).version;
const orchestratorTarball = `agentic-workflow-kit-orchestrator-${orchestratorVersion}.tgz`;

function removeDist(): void {
  rmSync(orchestratorDist, { recursive: true, force: true });
}

function run(command: string, args: string[]): string {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

describe.sequential('publish readiness smoke', () => {
  beforeEach(() => {
    removeDist();
  });

  it('builds a runnable package entrypoint and CLI', () => {
    run('pnpm', ['build']);

    const help = run('node', ['packages/orchestrator/dist/cli.js', '--help']);
    expect(help).toContain('agentic-workflow-kit');
    expect(help).toContain('list-tracks');

    const orchestrator = run('node', [
      '-e',
      "import('./packages/orchestrator/dist/index.js').then(() => console.log('orchestrator ok'))",
    ]);
    expect(orchestrator.trim()).toBe('orchestrator ok');
  }, 120_000);

  it('builds before packing from a fresh state', () => {
    const output = run('pnpm', ['pack:dry-run']);

    expect(output).toContain(orchestratorTarball);
    expect(output).toContain('dist/index.js');
    expect(output).toContain('dist/cli.js');
  }, 120_000);

  it('raw package pack command builds a publishable tarball from a fresh state', () => {
    const destination = mkdtempSync(path.join(tmpdir(), 'agentic-workflow-kit-pack-'));

    run('pnpm', ['--filter', '@agentic-workflow-kit/orchestrator', 'pack', '--pack-destination', destination]);
    const orchestratorContents = run('tar', ['-tf', path.join(destination, orchestratorTarball)]);

    expect(orchestratorContents).toContain('package/dist/index.js');
    expect(orchestratorContents).toContain('package/dist/cli.js');
    expect(orchestratorContents).toContain('package/dist/index.d.ts');
  }, 120_000);

  it('keeps the root agentic-workflow-kit dev command working without dist', () => {
    const help = run('pnpm', ['agentic-workflow-kit', '--', '--help']);
    expect(help).toContain('agentic-workflow-kit');
    expect(help).toContain('list-tracks');
  }, 120_000);
});
