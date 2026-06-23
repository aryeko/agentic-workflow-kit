import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const scriptPath = path.join(process.cwd(), '.agents/skills/delivery-retro/scripts/analyze-delivery-run.mjs');

type ScriptResult = {
  code: number;
  stdout: string;
  stderr: string;
};

const runScript = async (args: string[]): Promise<ScriptResult> => {
  try {
    const result = await execFileAsync(process.execPath, [scriptPath, ...args], {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024,
    });

    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as Error & { code?: number; stdout?: string; stderr?: string };
    return {
      code: typeof failure.code === 'number' ? failure.code : 1,
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? failure.message,
    };
  }
};

const withFixture = async <T>(fn: (fixtureRoot: string) => Promise<T>): Promise<T> => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'delivery-retro-'));
  try {
    return await fn(fixtureRoot);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
};

const writePackage = async (
  fixtureRoot: string,
  options: {
    includeSession?: boolean;
    includePr?: boolean;
    includeWorkers?: boolean;
    planExtras?: string;
    trackerNotes?: string;
  } = {},
): Promise<{ packagePath: string; sessionPath: string }> => {
  const packagePath = path.join(fixtureRoot, 'docs/implementation/epics/demo/execution');
  const sessionPath = path.join(fixtureRoot, 'rollout-demo.jsonl');
  await mkdir(packagePath, { recursive: true });
  await writeFile(
    path.join(packagePath, 'plan.md'),
    [
      '# Demo execution plan',
      '',
      options.includeSession === false ? '' : `Session JSONL: ${sessionPath}`,
      options.includePr === false ? '' : 'PR: https://github.com/example/workflow-kit/pull/42',
      'Git range: abcdef1..abcdef2',
      options.planExtras ?? '',
    ].join('\n'),
  );
  await writeFile(
    path.join(packagePath, 'tracker.md'),
    [
      '# Tracker',
      '',
      '| story id | status | reviewer verdict | gate evidence | commit hash | blockers | notes |',
      '|---|---|---|---|---|---|---|',
      `| S1 | done | approved | pnpm check pass | abcdef2 | none | ${
        options.includeWorkers === false ? '' : 'workers: impl-s1, rev-s1; '
      }${options.trackerNotes ?? ''} |`,
    ].join('\n'),
  );
  return { packagePath, sessionPath };
};

const writeSession = async (sessionPath: string, records: unknown[]): Promise<void> => {
  await writeFile(sessionPath, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`);
};

describe('delivery retro analyzer', () => {
  it('resolves required handles and reports unavailable token usage without estimating', async () => {
    await withFixture(async (fixtureRoot) => {
      const { packagePath, sessionPath } = await writePackage(fixtureRoot);
      await writeSession(sessionPath, [
        {
          timestamp: '2026-06-23T10:00:00.000Z',
          story_id: 'S1',
          worker_alias: 'impl-s1',
          role: 'implementer',
          event: 'started',
        },
        {
          timestamp: '2026-06-23T10:05:00.000Z',
          story_id: 'S1',
          worker_alias: 'impl-s1',
          role: 'implementer',
          event: 'completed',
        },
        {
          timestamp: '2026-06-23T10:08:00.000Z',
          story_id: 'S1',
          worker_alias: 'rev-s1',
          role: 'reviewer',
          event: 'blocking',
          findings: [{ class: 'ac-miss', summary: 'AC-1 evidence missing' }],
        },
        {
          timestamp: '2026-06-23T10:12:00.000Z',
          story_id: 'S1',
          worker_alias: 'rev-s1',
          role: 'reviewer',
          event: 'approved',
        },
      ]);

      const result = await runScript(['--package', packagePath, '--format', 'json']);
      expect(result).toMatchObject({ code: 0 });
      const parsed = JSON.parse(result.stdout);

      expect(parsed.status).toBe('ok');
      expect(parsed.handles).toMatchObject({
        packagePath,
        sessionJsonl: sessionPath,
        pr: 'https://github.com/example/workflow-kit/pull/42',
        gitRange: 'abcdef1..abcdef2',
      });
      expect(parsed.handles.workerIds.sort()).toEqual(['impl-s1', 'rev-s1']);
      expect(parsed.report.stories).toHaveLength(1);
      expect(parsed.report.stories[0]).toMatchObject({
        storyId: 'S1',
        reviewRounds: { value: 2, source: 'session-jsonl', confidence: 'observed' },
        tokenUsage: { status: 'unavailable', source: 'session-jsonl', confidence: 'observed' },
      });
      expect(parsed.report.summary.findingClasses).toEqual({ 'ac-miss': 1 });
    });
  });

  it('returns needs_input when the session JSONL handle cannot be resolved', async () => {
    await withFixture(async (fixtureRoot) => {
      const { packagePath } = await writePackage(fixtureRoot, { includeSession: false });

      const result = await runScript([
        '--package',
        packagePath,
        '--pr',
        'https://github.com/example/workflow-kit/pull/42',
        '--workers',
        'impl-s1,rev-s1',
        '--git-range',
        'abcdef1..abcdef2',
        '--format',
        'json',
      ]);
      expect(result.code).toBe(2);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.status).toBe('needs_input');
      expect(parsed.missing).toContain('sessionJsonl');
      expect(parsed.attempted.sessionJsonl.length).toBeGreaterThan(0);
    });
  });

  it('returns needs_input when the PR handle cannot be resolved', async () => {
    await withFixture(async (fixtureRoot) => {
      const { packagePath, sessionPath } = await writePackage(fixtureRoot, { includePr: false });
      await writeSession(sessionPath, [
        { timestamp: '2026-06-23T10:00:00.000Z', worker_alias: 'impl-s1', story_id: 'S1' },
      ]);

      const result = await runScript([
        '--package',
        packagePath,
        '--session-jsonl',
        sessionPath,
        '--workers',
        'impl-s1,rev-s1',
        '--git-range',
        'abcdef1..abcdef2',
        '--format',
        'json',
      ]);
      expect(result.code).toBe(2);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.status).toBe('needs_input');
      expect(parsed.missing).toContain('pr');
    });
  });

  it('returns needs_input when worker ids cannot be resolved', async () => {
    await withFixture(async (fixtureRoot) => {
      const { packagePath, sessionPath } = await writePackage(fixtureRoot, { includeWorkers: false });
      await writeSession(sessionPath, [{ timestamp: '2026-06-23T10:00:00.000Z', story_id: 'S1' }]);

      const result = await runScript([
        '--package',
        packagePath,
        '--session-jsonl',
        sessionPath,
        '--pr',
        'https://github.com/example/workflow-kit/pull/42',
        '--git-range',
        'abcdef1..abcdef2',
        '--format',
        'json',
      ]);
      expect(result.code).toBe(2);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.status).toBe('needs_input');
      expect(parsed.missing).toContain('workerIds');
    });
  });
});
