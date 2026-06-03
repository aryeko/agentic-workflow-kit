import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { FileArtifactStore } from '../src/artifacts/FileArtifactStore';

describe('FileArtifactStore', () => {
  it('writes json, text, and append-only event streams', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-artifacts-'));
    const store = new FileArtifactStore(root);

    await store.writeJson('state.json', { status: 'running' });
    await store.writeText('logs/output.txt', 'hello');
    await store.appendEvent({ ts: '2026-06-02T00:00:00.000Z', type: 'run-started' });
    await store.appendEvent({ ts: '2026-06-02T00:00:01.000Z', type: 'run-complete' });

    expect(JSON.parse(await readFile(path.join(root, 'state.json'), 'utf8'))).toEqual({ status: 'running' });
    expect(await readFile(path.join(root, 'logs/output.txt'), 'utf8')).toBe('hello');
    expect((await readFile(path.join(root, 'events.ndjson'), 'utf8')).trim().split('\n')).toHaveLength(2);
  });
});
