import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { codexReplyJournalFields, resolveCodexControlTarget } from '../packages/orchestrator/src/mcp/codexControl.js';

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
    await writeFile(
      path.join(runPath, 'children/DLD07.launch.json'),
      JSON.stringify({ storyId: 'DLD07', sessionId: null }),
    );

    await expect(resolveCodexControlTarget({ runPath, storyId: 'DLD07' })).rejects.toThrow(
      'story DLD07 does not have a linked Codex session',
    );
  });

  it('does not include reply message previews in journal fields', () => {
    const fields = codexReplyJournalFields('secret token sk-live-123', 'codex_reply');

    expect(fields).toEqual({
      messageSha256: '3fb49f5289846a39350df3f09b5f9e64e06473dc56143fdbe82d68ca6c850a6a',
      tool: 'codex_reply',
    });
    expect(JSON.stringify(fields)).not.toContain('secret');
    expect(JSON.stringify(fields)).not.toContain('sk-live');
  });
});
