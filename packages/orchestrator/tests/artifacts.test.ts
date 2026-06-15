import { chmod, mkdir, mkdtemp, readdir, readFile, stat } from 'node:fs/promises';
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
    await store.appendEvent({
      recordedAt: '2026-06-02T00:00:00.000Z',
      eventAt: '2026-06-02T00:00:00.000Z',
      type: 'run-started',
    });
    await store.appendEvent({
      recordedAt: '2026-06-02T00:00:01.000Z',
      eventAt: '2026-06-02T00:00:01.000Z',
      type: 'run-complete',
    });

    expect(JSON.parse(await readFile(path.join(root, 'state.json'), 'utf8'))).toEqual({ status: 'running' });
    expect(await readFile(path.join(root, 'logs/output.txt'), 'utf8')).toBe('hello');
    expect((await readFile(path.join(root, 'events.ndjson'), 'utf8')).trim().split('\n')).toHaveLength(2);
  });

  it('returns null for missing text artifacts', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-artifacts-'));
    const store = new FileArtifactStore(root);

    await expect(store.readText('missing.json')).resolves.toBeNull();
  });

  it('cleans up atomic temp files when replacement fails', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-artifacts-'));
    await mkdir(path.join(root, 'state.json'));
    const store = new FileArtifactStore(root);

    await expect(store.writeText('state.json', '{"status":"new"}\n')).rejects.toThrow();

    expect((await readdir(root)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('preserves existing file mode when atomically replacing artifacts', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-artifacts-'));
    const store = new FileArtifactStore(root);
    const filePath = path.join(root, 'state.json');

    await store.writeText('state.json', '{"status":"old"}\n');
    await chmod(filePath, 0o777);
    await store.writeText('state.json', '{"status":"new"}\n');

    expect((await stat(filePath)).mode & 0o777).toBe(0o777);
    expect(await readFile(filePath, 'utf8')).toBe('{"status":"new"}\n');
  });
});
