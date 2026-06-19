import { readdir, readFile, rm, writeFile, appendFile, mkdtemp } from 'node:fs/promises';
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
  });

  it('repairs torn tails and fails closed on interior corruption', async () => {
    const { root, storage } = await makeRoot();
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

    const repaired = storage.eventLog.replay('run:corruption');
    expect(repaired.health).toBe('log-tail-repaired');
    expect(repaired.records.map((record) => text(record.payload))).toEqual(['one', 'two']);

    const originalLines = (await readFile(logFile, 'utf8')).trimEnd().split('\n');
    const firstFrame = JSON.parse(originalLines[0] ?? '{}') as { payloadBase64: string };
    firstFrame.payloadBase64 = Buffer.from('changed').toString('base64');
    originalLines[0] = JSON.stringify(firstFrame);
    await writeFile(logFile, `${originalLines.join('\n')}\n`);

    const corrupt = storage.eventLog.replay('run:corruption');
    expect(corrupt.health).toBe('log-interior-corrupt');
    const rejected = storage.eventLog.append(handle, {
      expectedSequence: 3,
      durability: 'durable',
      payloads: [bytes('three')],
    });
    expectStorageError(rejected, 'log-interior-corrupt');
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
    const { root, storage } = await makeRoot({
      redactionHooks: new Map([['mask', () => bytes('redacted-alpha')]]),
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

    const blobPath = await artifactBlobPath(root, beta);
    await writeFile(blobPath, 'tampered');
    expectStorageError(storage.artifacts.export({ artifactIds: [beta.id] }), 'export-incomplete-forbidden');
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
