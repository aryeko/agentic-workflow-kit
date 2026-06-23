import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const scriptPath = path.join(process.cwd(), '.agents/skills/delivery-retro/scripts/find-worker-aliases.mjs');

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
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'delivery-retro-workers-'));
  try {
    return await fn(fixtureRoot);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
};

const writeSession = async (fixtureRoot: string): Promise<string> => {
  const sessionPath = path.join(fixtureRoot, 'rollout-demo.jsonl');
  await mkdir(fixtureRoot, { recursive: true });
  await writeFile(
    sessionPath,
    `${[
      {
        timestamp: '2026-06-23T10:00:00.000Z',
        type: 'response_item',
        payload: {
          type: 'function_call',
          name: 'spawn_agent',
          arguments: JSON.stringify({
            agent_type: 'worker',
            model: 'gpt-5.4',
            reasoning_effort: 'medium',
            message: 'Alias: b1-attest-impl\\n\\nImplement the attestation story.',
          }),
          call_id: 'call_impl',
        },
      },
      {
        timestamp: '2026-06-23T10:00:01.000Z',
        type: 'response_item',
        payload: {
          type: 'function_call_output',
          call_id: 'call_impl',
          output: JSON.stringify({ agent_id: '019ef0d1-9537-7eb0-856a-e6eb46e11d05', nickname: 'Maxwell' }),
        },
      },
      {
        timestamp: '2026-06-23T10:02:00.000Z',
        worker_alias: 'top-level-reviewer',
        worker_id: 'worker-7',
      },
      {
        timestamp: '2026-06-23T10:03:00.000Z',
        type: 'event_msg',
        payload: {
          message: '`b1-attest-review` is running as subagent `019ef0d6-f60b-7150-ba4a-9f3a1d111ca3`.',
        },
      },
    ]
      .map((record) => JSON.stringify(record))
      .join('\n')}\n`,
  );

  return sessionPath;
};

describe('worker alias finder', () => {
  it('extracts aliases and linked agent ids from Codex session JSONL', async () => {
    await withFixture(async (fixtureRoot) => {
      const sessionPath = await writeSession(fixtureRoot);

      const result = await runScript(['--session-jsonl', sessionPath, '--format', 'json']);
      expect(result).toMatchObject({ code: 0 });
      const parsed = JSON.parse(result.stdout);

      expect(parsed).toMatchObject({
        status: 'ok',
        sessionJsonl: sessionPath,
        workersArg: 'b1-attest-impl,b1-attest-review,top-level-reviewer',
      });
      expect(parsed.aliases).toEqual([
        expect.objectContaining({
          alias: 'b1-attest-impl',
          agentIds: ['019ef0d1-9537-7eb0-856a-e6eb46e11d05'],
          callIds: ['call_impl'],
          sourceKinds: ['spawn_agent'],
          confidence: 'observed',
        }),
        expect.objectContaining({
          alias: 'b1-attest-review',
          agentIds: ['019ef0d6-f60b-7150-ba4a-9f3a1d111ca3'],
          sourceKinds: ['event_msg'],
          confidence: 'reconstructed',
        }),
        expect.objectContaining({
          alias: 'top-level-reviewer',
          agentIds: ['worker-7'],
          sourceKinds: ['record_field'],
          confidence: 'observed',
        }),
      ]);
    });
  });

  it('prints a comma-separated workers argument for the analyzer', async () => {
    await withFixture(async (fixtureRoot) => {
      const sessionPath = await writeSession(fixtureRoot);

      const result = await runScript(['--session-jsonl', sessionPath, '--format', 'workers']);

      expect(result).toMatchObject({ code: 0, stdout: 'b1-attest-impl,b1-attest-review,top-level-reviewer\n' });
    });
  });
});
