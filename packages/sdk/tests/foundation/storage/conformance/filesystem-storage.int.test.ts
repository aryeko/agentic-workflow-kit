import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createLocalFilesystemBackend, openFilesystemStorage } from '../../../../src/index.js';
import {
  digestBytes,
  digestToken,
  encodeBytes,
  runFilesystemConformanceSuite,
  textDecoder,
  type FilesystemConformanceHarness,
} from '../../../fixtures/storage/filesystem-fixture-helpers.ts';

const createHarness = (): FilesystemConformanceHarness => {
  const rootPath = mkdtempSync(join(tmpdir(), 'workflow-kit-storage-'));
  const commonOptions = {
    digestBytes,
    digestToken,
    createToken: (() => {
      let next = 0;
      return () => `token-${++next}`;
    })(),
    now: (() => {
      let next = 0;
      return () => new Date(Date.UTC(2026, 5, 22, 0, 0, next++));
    })(),
    redactionHooks: {
      'mask-all': () => ({
        content: encodeBytes('[REDACTED]'),
      }),
    },
  };

  const storage = openFilesystemStorage({
    ...commonOptions,
    backend: createLocalFilesystemBackend({ rootPath }),
  });

  return {
    storage,
    reopen: () =>
      openFilesystemStorage({
        ...commonOptions,
        backend: createLocalFilesystemBackend({ rootPath }),
      }),
    cleanup: () => {
      rmSync(rootPath, { recursive: true, force: true });
    },
  };
};

runFilesystemConformanceSuite('filesystem conformance with local temp backend', createHarness);

describe('fnd-02-s5 local temp filesystem backend', () => {
  it('returns empty listings and undefined reads for a root that does not exist yet', () => {
    const rootPath = join(tmpdir(), `workflow-kit-missing-${Date.now()}`);
    const backend = createLocalFilesystemBackend({ rootPath });

    expect(backend.listFiles()).toEqual([]);
    expect(backend.readFile('/missing.txt')).toBeUndefined();
  });

  it('reports the full probe matrix as proven on a temp root', () => {
    const harness = createHarness();

    expect(harness.storage.getHealth()).toBe('ok');
    expect(harness.storage.getProbeResults()).toEqual([
      { probe: 'atomic-rename', ok: true },
      { probe: 'exclusive-create', ok: true },
      { probe: 'file-fsync', ok: true },
      { probe: 'directory-fsync', ok: true },
      { probe: 'lease-cas', ok: true },
    ]);

    harness.cleanup?.();
  });

  it('contains relative traversal attempts inside the backend root', () => {
    const parentPath = mkdtempSync(join(tmpdir(), 'workflow-kit-storage-parent-'));
    const rootPath = join(parentPath, 'root');
    const outsidePath = join(parentPath, 'outside.txt');
    const backend = createLocalFilesystemBackend({ rootPath });

    writeFileSync(outsidePath, 'outside-before');

    expect(textDecoder.decode(readFileSync(outsidePath))).toBe('outside-before');
    expect(backend.readFile('../outside.txt')).toBeUndefined();

    backend.writeFile('../outside.txt', encodeBytes('contained-write'));

    expect(textDecoder.decode(readFileSync(outsidePath))).toBe('outside-before');
    expect(existsSync(join(rootPath, 'outside.txt'))).toBe(true);
    expect(textDecoder.decode(backend.readFile('../outside.txt') as Uint8Array)).toBe('contained-write');
    expect(backend.listFiles()).toContain('/outside.txt');

    rmSync(parentPath, { recursive: true, force: true });
  });
});
