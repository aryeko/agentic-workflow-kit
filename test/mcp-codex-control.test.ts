import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveCodexControlTarget } from '../packages/orchestrator/src/mcp/codexControl.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('codex MCP control target resolution', () => {
  it('resolves a child session from runPath and storyId', async () => {
    const runPath = await mkdtemp(path.join(tmpdir(), 'awk-control-'));
    tempRoots.push(runPath);
    await mkdir(path.join(runPath, 'children'), { recursive: true });
    await writeFile(
      path.join(runPath, 'children/DLD07.launch.json'),
      JSON.stringify({ storyId: 'DLD07', sessionId: '019e-child', sessionLogPath: '/sessions/dld07.jsonl' }),
    );

    const target = await resolveCodexControlTarget({ runPath, storyId: 'DLD07' });

    expect(target).toEqual({ sessionId: '019e-child', storyId: 'DLD07', runPath });
  });

  it('rejects a run-resolved target without a linked session', async () => {
    const runPath = await mkdtemp(path.join(tmpdir(), 'awk-control-missing-'));
    tempRoots.push(runPath);
    await mkdir(path.join(runPath, 'children'), { recursive: true });
    await writeFile(path.join(runPath, 'children/DLD07.launch.json'), JSON.stringify({ storyId: 'DLD07', sessionId: null }));

    await expect(resolveCodexControlTarget({ runPath, storyId: 'DLD07' })).rejects.toThrow(
      'story DLD07 does not have a linked Codex session',
    );
  });
});
