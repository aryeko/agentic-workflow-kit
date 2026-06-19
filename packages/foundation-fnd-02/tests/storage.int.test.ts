import { readdir, readFile, rm, writeFile, appendFile, mkdtemp, unlink } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  createFileSystemStorageRoot,
  isStorageError,
  type ArtifactRef,
  type FileSystemStorageRootOptions,
  type IdGenerator,
  type StorageClock,
  type TokenGenerator,
} from '../src/index.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

class ManualClock implements StorageClock {
  #ms: number;

  constructor(iso: string) {
    this.#ms = Date.parse(iso);
  }

  now(): Date {
    return new Date(this.#ms);
  }

  advance(ms: number): void {
    this.#ms += ms;
  }
}

class SequenceGenerator implements IdGenerator, TokenGenerator {
  #next = 0;

  nextId(purpose: string): string {
    this.#next += 1;
    return `${purpose}-${this.#next}`;
  }

  nextToken(purpose: string): string {
    this.#next += 1;
    return `${purpose}-token-${this.#next}`;
  }
}

const tempRoots: string[] = [];

const makeRoot = async (
  options: Partial<Omit<FileSystemStorageRootOptions, 'root' | 'clock' | 'idGenerator' | 'tokenGenerator'>> = {},
) => {
  const root = await mkdtemp(join(tmpdir(), 'fnd-02-'));
  tempRoots.push(root);
  const clock = new ManualClock('2026-06-19T00:00:00.000Z');
  const generator = new SequenceGenerator();
  const storage = createFileSystemStorageRoot({
    root,
    clock,
    idGenerator: generator,
    tokenGenerator: generator,
    ...options,
  });

  return { root, clock, storage };
};

const bytes = (value: string): Uint8Array => encoder.encode(value);

const text = (content: Uint8Array): string => decoder.decode(content);

const digest = (content: Uint8Array | string): string => createHash('sha256').update(content).digest('hex');

const canonicalJson = (value: unknown): string => JSON.stringify(sortForJson(value));

const digestJson = (value: unknown): string => digest(canonicalJson(value));

const sortForJson = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sortForJson(item));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, sortForJson(entryValue)]),
    );
  }
  return value;
};

const expectStorageError = <T>(value: T, code: string) => {
  expect(isStorageError(value)).toBe(true);
  if (!isStorageError(value)) {
    throw new Error('expected storage error');
  }
  expect(value.code).toBe(code);
  return value;
};

const findOnlyFile = async (root: string, directory: string): Promise<string> => {
  const entries = await readdir(join(root, directory), { recursive: true, withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name));
  expect(files).toHaveLength(1);
  return files[0] ?? '';
};

const leaseGuardFile = (root: string, name: string): string => join(root, 'leases', `${digest(name)}.guard`);

const leaseRecordFile = (root: string, name: string): string => join(root, 'leases', `${digest(name)}.json`);

const artifactMetadataFile = (root: string, id: string): string =>
  join(root, 'artifacts', 'metadata', `${digest(id)}.json`);

const logFile = (root: string, logId: string): string => join(root, 'logs', `${digest(logId)}.jsonl`);

const guardRecord = (name: string, guardExpiresAt: string, holder: string) => ({
  schema: 'kit-vnext.lease-guard.v1',
  name,
  holder,
  operationId: `${holder}-operation`,
  operation: 'acquire',
  guardExpiresAt,
});

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('filesystem storage root', () => {
  it('points package exports at the emitted package entrypoint', async () => {
    const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
      exports: { '.': { types: string; default: string } };
      types: string;
    };

    expect(packageJson.exports['.']).toEqual({
      types: './dist/src/index.d.ts',
      default: './dist/src/index.js',
    });
    expect(packageJson.types).toBe('./dist/src/index.d.ts');
  });

  it('property-tests append/replay equivalence on a real filesystem', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ maxLength: 80 }), { minLength: 1, maxLength: 12 }),
        async (payloadTexts) => {
          const { storage } = await makeRoot();
          const lease = storage.leases.acquire('run-writer:property', 'worker-a', 60_000);
          expect(isStorageError(lease)).toBe(false);
          if (isStorageError(lease)) {
            return;
          }

          const handle = storage.eventLog.openForAppend('run:property', lease);
          expect(isStorageError(handle)).toBe(false);
          if (isStorageError(handle)) {
            return;
          }

          const payloads = payloadTexts.map((payload) => bytes(payload));
          const receipt = storage.eventLog.append(handle, {
            expectedSequence: 1,
            durability: 'durable',
            payloads,
          });

          expect(isStorageError(receipt)).toBe(false);
          if (isStorageError(receipt)) {
            return;
          }
          expect(receipt.kind).toBe('append-receipt');
          expect(receipt.firstSequence).toBe(1);
          expect(receipt.lastSequence).toBe(payloads.length);

          const replay = storage.eventLog.replay('run:property');
          expect(replay.health).toBe('ok');
          expect(replay.records.map((record) => text(record.payload))).toEqual(payloadTexts);
          expect(replay.records.map((record) => record.sequence)).toEqual(payloads.map((_payload, index) => index + 1));
        },
      ),
      { numRuns: 25, seed: 20_260_619 },
    );
  }, 20_000);

  it('reports durable and barrier fsync behavior through append receipts', async () => {
    const operations: string[] = [];
    const { storage } = await makeRoot({
      durabilityObserver: (event) => operations.push(`${event.operation}:${event.path}`),
    });
    const lease = storage.leases.acquire('run-writer:durability', 'worker-a', 60_000);
    expect(isStorageError(lease)).toBe(false);
    if (isStorageError(lease)) {
      return;
    }
    const handle = storage.eventLog.openForAppend('run:durability', lease);
    expect(isStorageError(handle)).toBe(false);
    if (isStorageError(handle)) {
      return;
    }

    const durable = storage.eventLog.append(handle, {
      expectedSequence: 1,
      durability: 'durable',
      payloads: [bytes('durable')],
    });
    expect(isStorageError(durable)).toBe(false);
    if (isStorageError(durable)) {
      return;
    }
    expect(durable.kind).toBe('append-receipt');
    expect(durable.durability).toBe('durable');
    expect(operations.some((operation) => operation.startsWith('fsync-file:'))).toBe(true);

    operations.splice(0);
    const barrier = storage.eventLog.append(handle, {
      expectedSequence: 2,
      durability: 'barrier',
      payloads: [bytes('barrier')],
    });
    expect(isStorageError(barrier)).toBe(false);
    if (isStorageError(barrier)) {
      return;
    }
    expect(barrier.kind).toBe('append-receipt');
    expect(barrier.durability).toBe('barrier');
    expect(operations.some((operation) => operation.startsWith('fsync-file:'))).toBe(true);
    expect(operations.some((operation) => operation.startsWith('fsync-directory:'))).toBe(true);

    const conflict = storage.eventLog.append(handle, {
      expectedSequence: 2,
      durability: 'durable',
      payloads: [bytes('conflict')],
    });
    expectStorageError(conflict, 'sequence-conflict');

    const next = storage.eventLog.append(handle, {
      expectedSequence: 3,
      durability: 'durable',
      payloads: [bytes('next')],
    });
    expect(isStorageError(next)).toBe(false);
    const replay = storage.eventLog.replay('run:durability');
    expect(replay.records.map((record) => text(record.payload))).toEqual(['durable', 'barrier', 'next']);
  });

  it('repairs torn tails and fails closed on interior corruption', async () => {
    const operations: string[] = [];
    const { root, storage } = await makeRoot({
      durabilityObserver: (event) => operations.push(`${event.operation}:${event.path}`),
    });
    const lease = storage.leases.acquire('run-writer:corruption', 'worker-a', 60_000);
    expect(isStorageError(lease)).toBe(false);
    if (isStorageError(lease)) {
      return;
    }
    const handle = storage.eventLog.openForAppend('run:corruption', lease);
    expect(isStorageError(handle)).toBe(false);
    if (isStorageError(handle)) {
      return;
    }
    const append = storage.eventLog.append(handle, {
      expectedSequence: 1,
      durability: 'barrier',
      payloads: [bytes('one'), bytes('two')],
    });
    expect(isStorageError(append)).toBe(false);

    const logFile = await findOnlyFile(root, 'logs');
    await appendFile(logFile, '{"torn":');

    operations.splice(0);
    const repaired = storage.eventLog.replay('run:corruption');
    expect(repaired.health).toBe('log-tail-repaired');
    expect(repaired.records.map((record) => text(record.payload))).toEqual(['one', 'two']);
    expect(operations.some((operation) => operation.startsWith('fsync-file:'))).toBe(true);
    expect(operations.some((operation) => operation === `fsync-directory:${join(root, 'logs')}`)).toBe(true);
    expect(await readFile(logFile, 'utf8')).not.toContain('{"torn":');
    const quarantined = await readdir(join(root, 'logs', 'quarantine'));
    expect(quarantined).toHaveLength(1);

    const originalLines = (await readFile(logFile, 'utf8')).trimEnd().split('\n');
    const firstFrame = JSON.parse(originalLines[0] ?? '{}') as { payloadBase64: string };
    firstFrame.payloadBase64 = Buffer.from('changed').toString('base64');
    originalLines[0] = JSON.stringify(firstFrame);
    await writeFile(logFile, `${originalLines.join('\n')}\n`);

    const corrupt = storage.eventLog.replay('run:corruption');
    expect(corrupt.health).toBe('log-interior-corrupt');
    expectStorageError(storage.eventLog.openForAppend('run:corruption', lease), 'log-interior-corrupt');
    const rejected = storage.eventLog.append(handle, {
      expectedSequence: 3,
      durability: 'durable',
      payloads: [bytes('three')],
    });
    expectStorageError(rejected, 'log-interior-corrupt');
  });

  it('does not repair a torn tail while replaying degraded storage', async () => {
    const { root, clock, storage } = await makeRoot();
    const lease = storage.leases.acquire('run-writer:degraded-replay', 'worker-a', 60_000);
    expect(isStorageError(lease)).toBe(false);
    if (isStorageError(lease)) {
      return;
    }
    const handle = storage.eventLog.openForAppend('run:degraded-replay', lease);
    expect(isStorageError(handle)).toBe(false);
    if (isStorageError(handle)) {
      return;
    }
    const append = storage.eventLog.append(handle, {
      expectedSequence: 1,
      durability: 'barrier',
      payloads: [bytes('one'), bytes('two')],
    });
    expect(isStorageError(append)).toBe(false);

    const logFile = await findOnlyFile(root, 'logs');
    await appendFile(logFile, '{"torn":');
    const generator = new SequenceGenerator();
    const operations: string[] = [];
    const degraded = createFileSystemStorageRoot({
      root,
      clock,
      idGenerator: generator,
      tokenGenerator: generator,
      probe: () => 'network-fs-degraded',
      durabilityObserver: (event) => operations.push(`${event.operation}:${event.path}`),
    });

    const replay = degraded.eventLog.replay('run:degraded-replay');
    expect(replay.health).toBe('network-fs-degraded');
    expect(replay.records.map((record) => text(record.payload))).toEqual(['one', 'two']);
    expect(operations).toEqual([]);
    expect(await readFile(logFile, 'utf8')).toContain('{"torn":');
    expect(await readdir(join(root, 'logs', 'quarantine'))).toEqual([]);
  });

  it('fences stale writers before bytes are appended', async () => {
    const { storage, clock } = await makeRoot();
    const firstLease = storage.leases.acquire('run-writer:fence', 'worker-a', 100);
    expect(isStorageError(firstLease)).toBe(false);
    if (isStorageError(firstLease)) {
      return;
    }
    const staleHandle = storage.eventLog.openForAppend('run:fence', firstLease);
    expect(isStorageError(staleHandle)).toBe(false);
    if (isStorageError(staleHandle)) {
      return;
    }
    const firstAppend = storage.eventLog.append(staleHandle, {
      expectedSequence: 1,
      durability: 'durable',
      payloads: [bytes('first')],
    });
    expect(isStorageError(firstAppend)).toBe(false);

    clock.advance(101);
    const secondLease = storage.leases.acquire('run-writer:fence', 'worker-b', 60_000);
    expect(isStorageError(secondLease)).toBe(false);
    if (isStorageError(secondLease)) {
      return;
    }
    expect(secondLease.epoch).toBe(firstLease.epoch + 1);

    const staleAppend = storage.eventLog.append(staleHandle, {
      expectedSequence: 2,
      durability: 'durable',
      payloads: [bytes('stale')],
    });
    expectStorageError(staleAppend, 'stale-writer-fenced');
    const replay = storage.eventLog.replay('run:fence');
    expect(replay.records.map((record) => text(record.payload))).toEqual(['first']);
  });

  it('retries exclusive guard acquisition after quarantining a stale guard', async () => {
    const { root, storage } = await makeRoot();
    const leaseName = 'story-launch:stale-guard:one';
    await writeFile(
      leaseGuardFile(root, leaseName),
      `${JSON.stringify(guardRecord(leaseName, '2026-06-18T00:00:00.000Z', 'old'))}\n`,
    );

    const lease = storage.leases.acquire(leaseName, 'worker-a', 60_000);
    expect(isStorageError(lease)).toBe(false);
    if (isStorageError(lease)) {
      return;
    }
    expect(lease.epoch).toBe(1);

    const staleEntries = await readdir(join(root, 'leases', 'stale'));
    expect(staleEntries).toHaveLength(1);
    expect(storage.leases.read(leaseName).snapshot?.holder).toBe('worker-a');
  });

  it('does not run lease updates unfenced when a contender wins after stale guard quarantine', async () => {
    let rootPath = '';
    let guardPath = '';
    let injectedContender = false;
    const leaseName = 'story-launch:stale-guard:contended';
    const { root, storage } = await makeRoot({
      durabilityObserver: (event) => {
        if (
          guardPath.length > 0 &&
          !injectedContender &&
          event.operation === 'fsync-directory' &&
          event.path === join(rootPath, 'leases', 'stale')
        ) {
          writeFileSync(
            guardPath,
            `${JSON.stringify(guardRecord(leaseName, '2026-06-20T00:00:00.000Z', 'contender'))}\n`,
            { flag: 'wx' },
          );
          injectedContender = true;
        }
      },
    });
    rootPath = root;
    guardPath = leaseGuardFile(root, leaseName);
    await writeFile(guardPath, `${JSON.stringify(guardRecord(leaseName, '2026-06-18T00:00:00.000Z', 'old'))}\n`);

    const lease = storage.leases.acquire(leaseName, 'worker-a', 60_000);
    expectStorageError(lease, 'lease-unavailable');
    expect(injectedContender).toBe(true);
    expect(storage.leases.read(leaseName).snapshot).toBeUndefined();
  });

  it('stores immutable digested artifacts and redacts through tombstones', async () => {
    const { storage } = await makeRoot({
      redactionHooks: new Map([['mask', () => bytes('redacted')]]),
    });

    const raw = storage.artifacts.put({
      content: bytes('secret'),
      mediaType: 'text/plain',
      retentionClass: 'evidence',
      classification: 'sensitive',
      producer: 'test',
    });
    expect(isStorageError(raw)).toBe(false);
    if (isStorageError(raw)) {
      return;
    }
    expect(raw.digest).toBe(digest(bytes('secret')));
    expect(raw.size).toBe(bytes('secret').byteLength);

    const duplicate = storage.artifacts.put({
      content: bytes('secret'),
      mediaType: 'text/plain',
      retentionClass: 'evidence',
      classification: 'sensitive',
    });
    expect(isStorageError(duplicate)).toBe(false);
    if (isStorageError(duplicate)) {
      return;
    }
    expect(duplicate.id).toBe(raw.id);

    const redacted = storage.artifacts.redact(raw, 'mask');
    expect(isStorageError(redacted)).toBe(false);
    if (isStorageError(redacted)) {
      return;
    }
    expect(redacted.redactionState).toBe('redacted');
    expect(redacted.digest).toBe(digest(bytes('redacted')));

    const original = storage.artifacts.resolve(raw.id);
    expect(isStorageError(original)).toBe(false);
    if (isStorageError(original)) {
      return;
    }
    expect(original.redactionState).toBe('tombstoned');
    expectStorageError(storage.artifacts.get(original, 'redacted'), 'artifact-quarantined');

    const redactedBytes = storage.artifacts.get(redacted, 'redacted');
    expect(isStorageError(redactedBytes)).toBe(false);
    if (isStorageError(redactedBytes)) {
      return;
    }
    expect(text(redactedBytes.bytes)).toBe('redacted');
  });

  it('degrades safely for network-filesystem health and only allows scratch artifacts', async () => {
    const { storage } = await makeRoot({ probe: () => 'network-fs-degraded' });

    expect(storage.health).toBe('network-fs-degraded');
    expectStorageError(storage.leases.acquire('story-launch:a:b:c', 'worker-a', 60_000), 'lease-unavailable');
    const authoritative = storage.artifacts.put({
      content: bytes('authoritative'),
      mediaType: 'text/plain',
      retentionClass: 'evidence',
      classification: 'internal',
    });
    expectStorageError(authoritative, 'network-fs-degraded');

    const scratch = storage.artifacts.putScratch({
      content: bytes('scratch'),
      mediaType: 'text/plain',
      retentionClass: 'scratch',
      classification: 'internal',
    });
    expect(isStorageError(scratch)).toBe(false);
    if (isStorageError(scratch)) {
      return;
    }
    expect(scratch.id.startsWith('scratch:')).toBe(true);
    expectStorageError(storage.artifacts.export({ artifactIds: [scratch.id] }), 'export-incomplete-forbidden');
  });

  it('applies registered redaction before persisting scratch artifact bytes', async () => {
    const { root, storage } = await makeRoot({
      redactionHooks: new Map([['mask', () => bytes('redacted-scratch')]]),
    });

    const scratch = storage.artifacts.putScratch({
      content: bytes('secret-scratch'),
      mediaType: 'text/plain',
      retentionClass: 'scratch',
      classification: 'sensitive',
      redactionHookId: 'mask',
    });
    expect(isStorageError(scratch)).toBe(false);
    if (isStorageError(scratch)) {
      return;
    }

    const redactedBytes = bytes('redacted-scratch');
    expect(scratch.redactionState).toBe('redacted');
    expect(scratch.digest).toBe(digest(redactedBytes));
    expect(scratch.size).toBe(redactedBytes.byteLength);
    expect(await readFile(scratchBlobPath(root, scratch.id), 'utf8')).toBe('redacted-scratch');
  });

  it('rejects scratch artifacts when their requested redaction hook is missing', async () => {
    const { root, storage } = await makeRoot();

    const scratch = storage.artifacts.putScratch({
      content: bytes('secret-scratch'),
      mediaType: 'text/plain',
      retentionClass: 'scratch',
      classification: 'sensitive',
      redactionHookId: 'missing',
    });

    expectStorageError(scratch, 'artifact-quarantined');
    expect(await readdir(join(root, 'artifacts', 'scratch'))).toEqual([]);
  });

  it.each([
    'read-only',
    'unusable',
  ] as const)('propagates %s health and refuses authoritative writes', async (health) => {
    const { storage } = await makeRoot({ probe: () => health });
    const fakeLease = {
      name: 'run-writer:health',
      epoch: 1,
      token: 'token',
      expiresAt: new Date('2026-06-19T01:00:00.000Z'),
    };
    const fakeHandle = {
      logId: 'run:health',
      leaseName: fakeLease.name,
      epoch: fakeLease.epoch,
      token: fakeLease.token,
    };

    expect(storage.health).toBe(health);
    expect(storage.leases.read('run-writer:health').health).toBe(health);
    expectStorageError(storage.leases.acquire('run-writer:health', 'worker-a', 60_000), 'lease-unavailable');
    expectStorageError(storage.eventLog.openForAppend('run:health', fakeLease), 'storage-unavailable');
    expectStorageError(
      storage.eventLog.append(fakeHandle, {
        expectedSequence: 1,
        durability: 'durable',
        payloads: [bytes('event')],
      }),
      'storage-unavailable',
    );
    expectStorageError(
      storage.artifacts.put({
        content: bytes('authoritative'),
        mediaType: 'text/plain',
        retentionClass: 'evidence',
        classification: 'internal',
      }),
      'storage-unavailable',
    );
    expectStorageError(storage.artifacts.export({ logIds: ['run:health'] }), 'export-incomplete-forbidden');
  });

  it('degrades at open when the guarded lease CAS probe cannot be proven', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fnd-02-'));
    tempRoots.push(root);
    const clock = new ManualClock('2026-06-19T00:00:00.000Z');
    const generator = new SequenceGenerator();
    const storage = createFileSystemStorageRoot({
      root,
      clock,
      idGenerator: generator,
      tokenGenerator: generator,
      durabilityObserver: (event) => {
        if (event.operation === 'fsync-directory' && event.path === join(root, 'leases')) {
          throw new Error('lease directory fsync unavailable');
        }
      },
    });

    expect(storage.health).toBe('network-fs-degraded');
    expectStorageError(storage.leases.acquire('story-launch:probe:a:b', 'worker-a', 60_000), 'lease-unavailable');
  });

  it('exports redacted manifests with stable ordering and verifies selected blobs', async () => {
    const operations: string[] = [];
    const { root, storage } = await makeRoot({
      redactionHooks: new Map([['mask', () => bytes('redacted-alpha')]]),
      durabilityObserver: (event) => operations.push(`${event.operation}:${event.path}`),
    });
    const alpha = storage.artifacts.put({
      content: bytes('alpha'),
      mediaType: 'text/plain',
      retentionClass: 'evidence',
      classification: 'sensitive',
    });
    const beta = storage.artifacts.put({
      content: bytes('beta'),
      mediaType: 'text/plain',
      retentionClass: 'report',
      classification: 'internal',
    });
    expect(isStorageError(alpha)).toBe(false);
    expect(isStorageError(beta)).toBe(false);
    if (isStorageError(alpha) || isStorageError(beta)) {
      return;
    }
    const redactedAlpha = storage.artifacts.redact(alpha, 'mask');
    expect(isStorageError(redactedAlpha)).toBe(false);
    if (isStorageError(redactedAlpha)) {
      return;
    }

    const lease = storage.leases.acquire('run-writer:export', 'worker-a', 60_000);
    expect(isStorageError(lease)).toBe(false);
    if (isStorageError(lease)) {
      return;
    }
    const handle = storage.eventLog.openForAppend('run:export', lease);
    expect(isStorageError(handle)).toBe(false);
    if (isStorageError(handle)) {
      return;
    }
    storage.eventLog.append(handle, {
      expectedSequence: 1,
      durability: 'barrier',
      payloads: [bytes('export-event')],
    });

    operations.splice(0);
    const manifest = storage.artifacts.export({ artifactIds: [beta.id, alpha.id], logIds: ['run:export'] });
    expect(isStorageError(manifest)).toBe(false);
    if (isStorageError(manifest)) {
      return;
    }
    expect(manifest.schema).toBe('kit-vnext.storage-export.v1');
    expect(manifest.logs).toEqual([
      {
        logId: 'run:export',
        health: 'ok',
        firstSequence: 1,
        lastSequence: 1,
        recordCount: 1,
      },
    ]);
    expect(manifest.artifacts.map((artifact) => artifact.id)).toEqual([redactedAlpha.id, beta.id]);
    expect(manifest.artifacts.map((artifact) => artifact.redactionState)).toEqual(['redacted', 'raw']);
    expect(
      operations.some(
        (operation) =>
          operation.startsWith(`fsync-file:${join(root, 'artifacts', 'exports')}`) && operation.endsWith('.tmp'),
      ),
    ).toBe(true);
    expect(operations).toContain(`fsync-directory:${join(root, 'artifacts', 'exports')}`);
    expect(operations.some((operation) => operation.endsWith('.json'))).toBe(false);

    const blobPath = await artifactBlobPath(root, beta);
    await writeFile(blobPath, 'tampered');
    expectStorageError(storage.artifacts.export({ artifactIds: [beta.id] }), 'export-incomplete-forbidden');
  });

  it('fails closed on invalid artifact, lease, and append inputs', async () => {
    const { storage, clock } = await makeRoot({
      maxArtifactBytes: 4,
      redactionHooks: new Map([['mask', (content) => content]]),
    });

    expectStorageError(
      storage.artifacts.put({
        content: bytes('abc'),
        mediaType: '',
        retentionClass: 'evidence',
        classification: 'internal',
      }),
      'invalid-input',
    );
    expectStorageError(
      storage.artifacts.put({
        content: bytes('abc'),
        mediaType: 'text/plain',
        retentionClass: 'evidence',
        classification: 'internal',
        redactionHookId: 'missing',
      }),
      'artifact-quarantined',
    );
    const redacted = storage.artifacts.put({
      content: bytes('abc'),
      mediaType: 'text/plain',
      retentionClass: 'evidence',
      classification: 'internal',
      redactionHookId: 'mask',
    });
    expect(isStorageError(redacted)).toBe(false);
    if (isStorageError(redacted)) {
      return;
    }
    expect(redacted.redactionState).toBe('redacted');
    const redactedContent = storage.artifacts.get(redacted, 'redacted');
    expect(isStorageError(redactedContent)).toBe(false);
    if (isStorageError(redactedContent)) {
      return;
    }
    expect(text(redactedContent.bytes)).toBe('abc');
    expectStorageError(
      storage.artifacts.put({
        content: bytes('too-large'),
        mediaType: 'text/plain',
        retentionClass: 'evidence',
        classification: 'internal',
      }),
      'artifact-quarantined',
    );
    expectStorageError(
      storage.artifacts.putScratch({
        content: bytes('too-large'),
        mediaType: 'text/plain',
        retentionClass: 'scratch',
        classification: 'internal',
      }),
      'artifact-quarantined',
    );
    const redactedScratch = storage.artifacts.putScratch({
      content: bytes('abc'),
      mediaType: 'text/plain',
      retentionClass: 'scratch',
      classification: 'internal',
      redactionHookId: 'mask',
    });
    expect(isStorageError(redactedScratch)).toBe(false);
    if (isStorageError(redactedScratch)) {
      return;
    }
    expect(redactedScratch.redactionState).toBe('redacted');
    expectStorageError(storage.artifacts.resolve('scratch:temporary'), 'not-found');
    expectStorageError(
      storage.artifacts.get(
        {
          id: 'artifact:missing',
          digest: digest('missing'),
          size: 7,
          mediaType: 'text/plain',
          retentionClass: 'evidence',
          classification: 'internal',
          redactionState: 'raw',
        },
        'raw',
      ),
      'not-found',
    );

    expectStorageError(storage.leases.acquire('', 'holder', 60_000), 'invalid-input');
    expectStorageError(storage.leases.acquire('lease:bad-ttl', 'holder', 0), 'invalid-input');
    const lease = storage.leases.acquire('lease:valid', 'holder', 60_000);
    expect(isStorageError(lease)).toBe(false);
    if (isStorageError(lease)) {
      return;
    }
    const releasable = storage.leases.acquire('lease:release', 'holder', 60_000);
    expect(isStorageError(releasable)).toBe(false);
    if (isStorageError(releasable)) {
      return;
    }
    expectStorageError(storage.leases.acquire('lease:valid', 'other', 60_000), 'lease-unavailable');
    expectStorageError(storage.leases.renew('lease:valid', lease.epoch, 'wrong-token', 60_000), 'lease-unavailable');
    expectStorageError(storage.leases.release('lease:valid', lease.epoch, 'wrong-token'), 'lease-unavailable');
    expect(isStorageError(storage.leases.renew('lease:valid', lease.epoch, lease.token, 60_000))).toBe(false);
    expect(storage.leases.release('lease:release', releasable.epoch, releasable.token)).toBeUndefined();
    expectStorageError(storage.leases.renew('lease:missing', 1, 'token', 60_000), 'lease-unavailable');
    expect(storage.leases.fence('lease:missing', 1, 'token')).toBe(false);

    const handle = storage.eventLog.openForAppend('run:invalid', lease);
    expect(isStorageError(handle)).toBe(false);
    if (isStorageError(handle)) {
      return;
    }
    expectStorageError(
      storage.eventLog.append(handle, { expectedSequence: 0, durability: 'durable', payloads: [bytes('bad')] }),
      'invalid-input',
    );
    expectStorageError(
      storage.eventLog.append(handle, { expectedSequence: 1, durability: 'durable', payloads: [] }),
      'invalid-input',
    );

    clock.advance(60_001);
    expectStorageError(storage.leases.renew('lease:valid', lease.epoch, lease.token, 60_000), 'lease-unavailable');
  });

  it('returns buffered acknowledgements and rejects sequence conflicts', async () => {
    const { storage } = await makeRoot();
    const lease = storage.leases.acquire('run-writer:buffered', 'worker-a', 60_000);
    expect(isStorageError(lease)).toBe(false);
    if (isStorageError(lease)) {
      return;
    }
    const handle = storage.eventLog.openForAppend('run:buffered', lease);
    expect(isStorageError(handle)).toBe(false);
    if (isStorageError(handle)) {
      return;
    }

    const buffered = storage.eventLog.append(handle, {
      expectedSequence: 1,
      durability: 'buffered',
      payloads: [bytes('buffered')],
    });
    expect(isStorageError(buffered)).toBe(false);
    if (isStorageError(buffered)) {
      return;
    }
    expect(buffered.kind).toBe('non-durable-ack');

    expectStorageError(
      storage.eventLog.append(handle, { expectedSequence: 1, durability: 'durable', payloads: [bytes('conflict')] }),
      'sequence-conflict',
    );
  });

  it('allows explicit raw access to tombstoned artifacts when configured', async () => {
    const { storage } = await makeRoot({
      allowRawTombstoneAccess: true,
      redactionHooks: new Map([['mask', () => bytes('redacted')]]),
    });
    const raw = storage.artifacts.put({
      content: bytes('secret'),
      mediaType: 'text/plain',
      retentionClass: 'evidence',
      classification: 'sensitive',
    });
    expect(isStorageError(raw)).toBe(false);
    if (isStorageError(raw)) {
      return;
    }
    expect(isStorageError(storage.artifacts.redact(raw, 'mask'))).toBe(false);
    const tombstoned = storage.artifacts.resolve(raw.id);
    expect(isStorageError(tombstoned)).toBe(false);
    if (isStorageError(tombstoned)) {
      return;
    }

    const originalBytes = storage.artifacts.get(tombstoned, 'raw');
    expect(isStorageError(originalBytes)).toBe(false);
    if (isStorageError(originalBytes)) {
      return;
    }
    expect(text(originalBytes.bytes)).toBe('secret');
  });

  it('rejects corrupted artifact metadata and missing blobs', async () => {
    const { root, storage } = await makeRoot();
    const first = storage.artifacts.put({
      content: bytes('first'),
      mediaType: 'text/plain',
      retentionClass: 'evidence',
      classification: 'internal',
    });
    const second = storage.artifacts.put({
      content: bytes('second'),
      mediaType: 'text/plain',
      retentionClass: 'evidence',
      classification: 'internal',
    });
    expect(isStorageError(first)).toBe(false);
    expect(isStorageError(second)).toBe(false);
    if (isStorageError(first) || isStorageError(second)) {
      return;
    }

    await unlink(await artifactBlobPath(root, first));
    expectStorageError(storage.artifacts.get(first, 'raw'), 'artifact-quarantined');

    const metadataFiles = await readdir(join(root, 'artifacts', 'metadata'), { withFileTypes: true });
    const metadataPath = join(root, 'artifacts', 'metadata', metadataFiles[0]?.name ?? '');
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as Record<string, unknown>;
    await writeFile(metadataPath, `${JSON.stringify({ ...metadata, recordDigest: 'sha256:wrong' })}\n`);
    expectStorageError(storage.artifacts.resolve(String(metadata.id)), 'not-found');
  });

  it('rejects stale log handles and log appends while degraded', async () => {
    const { storage, clock } = await makeRoot();
    const firstLease = storage.leases.acquire('run-writer:stale-open', 'worker-a', 100);
    expect(isStorageError(firstLease)).toBe(false);
    if (isStorageError(firstLease)) {
      return;
    }
    clock.advance(101);
    expect(isStorageError(storage.leases.acquire('run-writer:stale-open', 'worker-b', 60_000))).toBe(false);
    expectStorageError(storage.eventLog.openForAppend('run:stale-open', firstLease), 'stale-writer-fenced');

    const degraded = await makeRoot({ probe: () => 'read-only' });
    const handle = { logId: 'run:degraded', leaseName: 'lease', epoch: 1, token: 'token' };
    expectStorageError(
      degraded.storage.eventLog.openForAppend('run:degraded', {
        name: 'lease',
        epoch: 1,
        token: 'token',
        expiresAt: new Date('2026-06-19T00:01:00.000Z'),
      }),
      'storage-unavailable',
    );
    expectStorageError(
      degraded.storage.eventLog.append(handle, { expectedSequence: 1, durability: 'durable', payloads: [bytes('x')] }),
      'storage-unavailable',
    );
    expectStorageError(
      degraded.storage.artifacts.put({
        content: bytes('x'),
        mediaType: 'text/plain',
        retentionClass: 'evidence',
        classification: 'internal',
      }),
      'storage-unavailable',
    );
  });

  it('exports empty logs and fails closed on corrupt logs, leases, and tombstone replacement drift', async () => {
    const { root, storage } = await makeRoot({
      allowRawTombstoneAccess: true,
      redactionHooks: new Map([['mask', () => bytes('redacted')]]),
    });

    const lease = storage.leases.acquire('lease:corrupt', 'worker-a', 60_000);
    expect(isStorageError(lease)).toBe(false);
    if (isStorageError(lease)) {
      return;
    }
    await writeFile(leaseRecordFile(root, 'lease:corrupt'), '{"not": "a lease"}\n');
    expect(storage.leases.read('lease:corrupt').health).toBe('unusable');
    expect(storage.leases.fence('lease:corrupt', lease.epoch, lease.token)).toBe(false);

    const emptyExport = storage.artifacts.export({ logIds: ['run:empty'] });
    expect(isStorageError(emptyExport)).toBe(false);
    if (isStorageError(emptyExport)) {
      return;
    }
    expect(emptyExport.logs).toEqual([{ logId: 'run:empty', health: 'ok', recordCount: 0 }]);

    await writeFile(logFile(root, 'run:invalid-json'), '{"kind": "record"}\n');
    expect(storage.eventLog.replay('run:invalid-json').health).toBe('log-tail-repaired');

    const original = storage.artifacts.put({
      content: bytes('secret'),
      mediaType: 'text/plain',
      retentionClass: 'evidence',
      classification: 'sensitive',
      expiresAt: new Date('2026-06-20T00:00:00.000Z'),
    });
    expect(isStorageError(original)).toBe(false);
    if (isStorageError(original)) {
      return;
    }
    const redacted = storage.artifacts.redact(original, 'mask');
    expect(isStorageError(redacted)).toBe(false);
    if (isStorageError(redacted)) {
      return;
    }
    const tombstoned = storage.artifacts.resolve(original.id);
    expect(isStorageError(tombstoned)).toBe(false);
    if (isStorageError(tombstoned)) {
      return;
    }
    const rawManifest = storage.artifacts.export({ artifactIds: [tombstoned.id], includeRawTombstoned: true });
    expect(isStorageError(rawManifest)).toBe(false);
    if (isStorageError(rawManifest)) {
      return;
    }
    expect(rawManifest.artifacts).toMatchObject([{ id: tombstoned.id, redactionState: 'redacted' }]);
    expect(storage.artifacts.export({ artifactIds: [tombstoned.id], includeRawTombstoned: true })).toMatchObject({
      id: rawManifest.id,
    });

    const metadataPath = artifactMetadataFile(root, original.id);
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as Record<string, unknown>;
    const withoutReplacement: Record<string, unknown> = {
      ...metadata,
      replacementId: undefined,
      replacementDigest: undefined,
    };
    const { recordDigest: _recordDigest, ...digestInput } = withoutReplacement;
    await writeFile(
      metadataPath,
      `${JSON.stringify({ ...withoutReplacement, recordDigest: digestJson(digestInput) })}\n`,
    );
    expectStorageError(storage.artifacts.export({ artifactIds: [tombstoned.id] }), 'export-incomplete-forbidden');

    const badReplacement: Record<string, unknown> = { ...metadata, replacementId: 'artifact:missing' };
    const { recordDigest: _badDigest, ...badDigestInput } = badReplacement;
    await writeFile(
      metadataPath,
      `${JSON.stringify({ ...badReplacement, recordDigest: digestJson(badDigestInput) })}\n`,
    );
    expectStorageError(storage.artifacts.export({ artifactIds: [tombstoned.id] }), 'export-incomplete-forbidden');
    expectStorageError(storage.artifacts.export({ artifactIds: ['scratch:temporary'] }), 'export-incomplete-forbidden');
    expectStorageError(storage.artifacts.export({ artifactIds: ['artifact:missing'] }), 'export-incomplete-forbidden');
  });

  it('fails closed when artifact redaction cannot resolve, read, or commit replacement content', async () => {
    const missingHook = await makeRoot();
    const raw = missingHook.storage.artifacts.put({
      content: bytes('secret'),
      mediaType: 'text/plain',
      retentionClass: 'evidence',
      classification: 'sensitive',
    });
    expect(isStorageError(raw)).toBe(false);
    if (isStorageError(raw)) {
      return;
    }
    expectStorageError(missingHook.storage.artifacts.redact(raw, 'missing'), 'artifact-quarantined');

    const missingBlob = await makeRoot({ redactionHooks: new Map([['mask', () => bytes('redacted')]]) });
    const blobRaw = missingBlob.storage.artifacts.put({
      content: bytes('secret'),
      mediaType: 'text/plain',
      retentionClass: 'evidence',
      classification: 'sensitive',
    });
    expect(isStorageError(blobRaw)).toBe(false);
    if (isStorageError(blobRaw)) {
      return;
    }
    await unlink(await artifactBlobPath(missingBlob.root, blobRaw));
    expectStorageError(missingBlob.storage.artifacts.redact(blobRaw, 'mask'), 'artifact-quarantined');

    const oversize = await makeRoot({
      maxArtifactBytes: 3,
      redactionHooks: new Map([['mask', () => bytes('too-large')]]),
    });
    const tooLargeRedaction = oversize.storage.artifacts.put({
      content: bytes('abc'),
      mediaType: 'text/plain',
      retentionClass: 'evidence',
      classification: 'sensitive',
      redactionHookId: 'mask',
    });
    expectStorageError(tooLargeRedaction, 'artifact-quarantined');
  });
});

const artifactBlobPath = async (root: string, ref: ArtifactRef): Promise<string> => {
  const entries = await readdir(join(root, 'artifacts', 'blobs'), { recursive: true, withFileTypes: true });
  const match = entries.find((entry) => entry.isFile() && entry.name === ref.digest);
  if (!match) {
    throw new Error(`missing artifact blob ${ref.digest}`);
  }
  return join(match.parentPath, match.name);
};

const scratchBlobPath = (root: string, id: string): string => join(root, 'artifacts', 'scratch', `${digest(id)}.blob`);
