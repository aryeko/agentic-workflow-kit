import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { codexSessionLogRoots } from '../src/drivers/codex-mcp/sessionLogs';
import { defaultSessionLogRoots } from '../src/drivers/sessionLogs';

const originalHome = process.env.HOME;

afterEach(() => {
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }
});

describe('session log root helpers', () => {
  it('returns Codex session and archive roots for an explicit home directory', () => {
    expect(codexSessionLogRoots('/tmp/example-home')).toEqual([
      path.join('/tmp/example-home', '.codex', 'sessions'),
      path.join('/tmp/example-home', '.codex', 'archived_sessions'),
    ]);
  });

  it('returns no roots when no home directory is available', () => {
    expect(codexSessionLogRoots('')).toEqual([]);
  });

  it('uses the process home directory for default session log discovery', () => {
    process.env.HOME = '/tmp/default-home';

    expect(defaultSessionLogRoots()).toEqual([
      path.join('/tmp/default-home', '.codex', 'sessions'),
      path.join('/tmp/default-home', '.codex', 'archived_sessions'),
    ]);
  });
});
