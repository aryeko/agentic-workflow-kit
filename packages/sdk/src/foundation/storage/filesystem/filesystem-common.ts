import type {
  ArtifactInput,
  ArtifactMetadataRecord,
  ArtifactRef,
  ArtifactTombstoneRecord,
  ExportManifestLogRange,
} from '../artifacts/index.js';
import type { StorageError } from '../errors/index.js';
import type {
  AppendBatch,
  ByteRange,
  EventLogLeaseBinding,
  LogHandle,
  NonDurableAck,
  StoredRecord,
} from '../event-log/index.js';
import type { StorageHealth } from '../health/index.js';
import type { FilesystemProbe, FilesystemProbeResult, OpenFilesystemStorageOptions } from './filesystem-types.js';

const textEncoder = new TextEncoder();

export const DEFAULT_RECORD_FRAME_OVERHEAD_BYTES = 16;
export const DEFAULT_COMMIT_TRAILER_BYTES = 8;

export const LOGS_DIRECTORY = '/logs';
export const LEASES_DIRECTORY = '/leases';
export const PROBES_DIRECTORY = '/.probes';
export const QUARANTINE_DIRECTORY = '/quarantine';
export const ARTIFACTS_DIRECTORY = '/artifacts';
export const ARTIFACT_BLOBS_DIRECTORY = '/artifacts/blobs';
export const ARTIFACT_METADATA_DIRECTORY = '/artifacts/meta';
export const ARTIFACT_SCRATCH_DIRECTORY = '/artifacts/scratch';
export const ARTIFACT_SCRATCH_METADATA_DIRECTORY = '/artifacts/scratch-meta';
export const ARTIFACT_TOMBSTONES_DIRECTORY = '/artifacts/tombstones';

export type WriterBinding = {
  readonly leaseName: string;
  readonly epoch: number;
  readonly token: string;
  readonly isCurrent?: () => boolean;
};

export type LogState = {
  readonly committed: readonly StoredRecord[];
  readonly buffered: readonly StoredRecord[];
  readonly currentWriter?: WriterBinding;
  readonly nextSequence: number;
  readonly nextByteOffset: number;
  readonly interiorCorrupt: boolean;
};

export type SerializedStoredRecord = {
  readonly sequence: number;
  readonly writerEpoch: number;
  readonly leaseName: string;
  readonly payloadLength: number;
  readonly payloadDigest: string;
  readonly frameDigest: string;
  readonly byteRange: ByteRange;
  readonly payloadBase64: string;
};

export type SerializedLogState = {
  readonly committed: readonly SerializedStoredRecord[];
  readonly interiorCorrupt: boolean;
};

export type SerializedLeaseRecord = {
  readonly name: string;
  readonly epoch: number;
  readonly holder: string;
  readonly tokenDigest: string;
  readonly expiresAt: string;
};

export type LeaseRecord = {
  readonly name: string;
  readonly epoch: number;
  readonly holder: string;
  readonly tokenDigest: string;
  readonly expiresAt: Date;
};

export type ArtifactEntry = {
  readonly metadata: ArtifactMetadataRecord;
  readonly originalDigest: string;
  readonly replacementId?: string;
};

export type FilesystemController = {
  getHealth(): StorageHealth;
  getProbeResults(): readonly FilesystemProbeResult[];
  degrade(quarantinePath?: string): void;
  listQuarantinedEntries(): readonly string[];
};

export const cloneBytes = (bytes: Uint8Array): Uint8Array => Uint8Array.from(bytes);

export const cloneDate = (value: Date): Date => new Date(value.getTime());

const encodeBase64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');

const decodeBase64 = (value: string): Uint8Array => new Uint8Array(Buffer.from(value, 'base64'));

export const encodePathComponent = (value: string): string => encodeURIComponent(value);

const joinBytes = (chunks: readonly Uint8Array[]): Uint8Array => {
  const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const bytes = new Uint8Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
};

const encodeNumber = (value: number): Uint8Array => textEncoder.encode(String(value));

const encodeString = (value: string): Uint8Array => textEncoder.encode(value);

const buildFrameSeed = (
  binding: WriterBinding,
  sequence: number,
  payload: Uint8Array,
  byteRange: ByteRange,
): Uint8Array =>
  joinBytes([
    encodeString('seq:'),
    encodeNumber(sequence),
    encodeString('|epoch:'),
    encodeNumber(binding.epoch),
    encodeString('|lease:'),
    encodeString(binding.leaseName),
    encodeString('|start:'),
    encodeNumber(byteRange.start),
    encodeString('|end:'),
    encodeNumber(byteRange.end),
    encodeString('|payload:'),
    payload,
  ]);

const buildTrailerSeed = (lastSequence: number, durability: AppendBatch['durability']): Uint8Array =>
  joinBytes([
    encodeString('commit:'),
    encodeNumber(lastSequence),
    encodeString('|durability:'),
    encodeString(durability),
  ]);

export const createStorageError = (
  code: StorageError['code'],
  health: StorageHealth,
  message: string,
): StorageError => ({
  code,
  health,
  message,
});

export const buildBufferedAck = (expectedSequence: number): NonDurableAck => ({
  acknowledged: true,
  durability: 'buffered',
  expectedSequence,
});

export const emptyLogState = (): LogState => ({
  committed: [],
  buffered: [],
  nextSequence: 1,
  nextByteOffset: 0,
  interiorCorrupt: false,
});

export const logFilePath = (logId: string): string => `${LOGS_DIRECTORY}/${encodePathComponent(logId)}.json`;

export const leaseFilePath = (name: string): string => `${LEASES_DIRECTORY}/${encodePathComponent(name)}.json`;

export const leaseGuardPath = (name: string): string => `${LEASES_DIRECTORY}/${encodePathComponent(name)}.guard.json`;

export const artifactMetadataPath = (id: string): string =>
  `${ARTIFACT_METADATA_DIRECTORY}/${encodePathComponent(id)}.json`;

export const artifactBlobPath = (digest: string): string => `${ARTIFACT_BLOBS_DIRECTORY}/${digest}.bin`;

export const scratchMetadataPath = (id: string): string =>
  `${ARTIFACT_SCRATCH_METADATA_DIRECTORY}/${encodePathComponent(id)}.json`;

export const scratchBlobPath = (digest: string): string => `${ARTIFACT_SCRATCH_DIRECTORY}/${digest}.bin`;

export const tombstonePath = (id: string): string => `${ARTIFACT_TOMBSTONES_DIRECTORY}/${encodePathComponent(id)}.json`;

const containingDirectory = (path: string): string => {
  const segments = path.split('/');
  const directory = segments.slice(0, -1).join('/');
  return directory.length === 0 ? '/' : directory;
};

const toSerializedRecord = (record: StoredRecord): SerializedStoredRecord => ({
  sequence: record.sequence,
  writerEpoch: record.writerEpoch,
  leaseName: record.leaseName,
  payloadLength: record.payloadLength,
  payloadDigest: record.payloadDigest,
  frameDigest: record.frameDigest,
  byteRange: { ...record.byteRange },
  payloadBase64: encodeBase64(record.payload),
});

const fromSerializedRecord = (record: SerializedStoredRecord): StoredRecord => ({
  sequence: record.sequence,
  writerEpoch: record.writerEpoch,
  leaseName: record.leaseName,
  payloadLength: record.payloadLength,
  payloadDigest: record.payloadDigest,
  frameDigest: record.frameDigest,
  byteRange: { ...record.byteRange },
  payload: decodeBase64(record.payloadBase64),
});

export const serializeJson = (value: unknown): Uint8Array => textEncoder.encode(JSON.stringify(value));

export const parseJson = <T>(bytes: Uint8Array | undefined): T | undefined => {
  if (bytes === undefined) {
    return undefined;
  }

  return JSON.parse(Buffer.from(bytes).toString('utf8')) as T;
};

export const committedTailPosition = (
  committed: readonly StoredRecord[],
): {
  readonly nextSequence: number;
  readonly nextByteOffset: number;
} => {
  const lastCommitted = committed[committed.length - 1];
  if (lastCommitted === undefined) {
    return { nextSequence: 1, nextByteOffset: 0 };
  }

  return {
    nextSequence: lastCommitted.sequence + 1,
    nextByteOffset: lastCommitted.byteRange.end,
  };
};

export const replayHealthForLog = (storeHealth: StorageHealth, logState: LogState): StorageHealth => {
  if (storeHealth !== 'ok') {
    return storeHealth;
  }

  return logState.interiorCorrupt ? 'log-interior-corrupt' : 'ok';
};

export const collectReceiptPayloadDigest = (
  records: readonly StoredRecord[],
  digestBytes: OpenFilesystemStorageOptions['digestBytes'],
): string => digestBytes(joinBytes(records.map((record) => cloneBytes(record.payload))));

export const collectReceiptFrameDigest = (
  records: readonly StoredRecord[],
  durability: AppendBatch['durability'],
  digestBytes: OpenFilesystemStorageOptions['digestBytes'],
): string =>
  digestBytes(
    joinBytes([
      ...records.map((record) =>
        joinBytes([
          encodeNumber(record.sequence),
          encodeString(':'),
          encodeString(record.frameDigest),
          encodeString('|'),
        ]),
      ),
      buildTrailerSeed(records[records.length - 1].sequence, durability),
    ]),
  );

export const collectInputBytes = async (content: ArtifactInput['content']): Promise<Uint8Array> => {
  if (content instanceof Uint8Array) {
    return cloneBytes(content);
  }

  const reader = content.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }
    chunks.push(cloneBytes(chunk.value));
    size += chunk.value.byteLength;
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

export const createByteStream = (bytes: Uint8Array): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(cloneBytes(bytes));
      controller.close();
    },
  });

export const compareOptionalDates = (left?: Date, right?: Date): boolean =>
  left?.toISOString() === right?.toISOString();

export const readArtifactEntries = (backend: OpenFilesystemStorageOptions['backend']): Map<string, ArtifactEntry> => {
  const entries = new Map<string, ArtifactEntry>();
  for (const path of backend.listFiles(ARTIFACT_METADATA_DIRECTORY)) {
    const parsed = parseJson<ArtifactEntry>(backend.readFile(path));
    if (parsed !== undefined) {
      entries.set(parsed.metadata.id, {
        metadata: {
          ...parsed.metadata,
          createdAt: new Date(parsed.metadata.createdAt),
          expiry: parsed.metadata.expiry === undefined ? undefined : new Date(parsed.metadata.expiry),
        },
        originalDigest: parsed.originalDigest,
        replacementId: parsed.replacementId,
      });
    }
  }
  return entries;
};

export const readScratchEntries = (backend: OpenFilesystemStorageOptions['backend']): Map<string, ArtifactEntry> => {
  const entries = new Map<string, ArtifactEntry>();
  for (const path of backend.listFiles(ARTIFACT_SCRATCH_METADATA_DIRECTORY)) {
    const parsed = parseJson<ArtifactEntry>(backend.readFile(path));
    if (parsed !== undefined) {
      entries.set(parsed.metadata.id, {
        metadata: {
          ...parsed.metadata,
          createdAt: new Date(parsed.metadata.createdAt),
          expiry: parsed.metadata.expiry === undefined ? undefined : new Date(parsed.metadata.expiry),
        },
        originalDigest: parsed.originalDigest,
        replacementId: parsed.replacementId,
      });
    }
  }
  return entries;
};

export const readTombstones = (backend: OpenFilesystemStorageOptions['backend']): ArtifactTombstoneRecord[] =>
  backend
    .listFiles(ARTIFACT_TOMBSTONES_DIRECTORY)
    .map((path) => parseJson<ArtifactTombstoneRecord>(backend.readFile(path)))
    .filter((value): value is ArtifactTombstoneRecord => value !== undefined)
    .map((value) => ({
      ...value,
      createdAt: new Date(value.createdAt),
    }));

export const openFilesystemController = (initialProbeResults: FilesystemProbeResult[]): FilesystemController => {
  let health: StorageHealth = initialProbeResults.every((probe) => probe.ok) ? 'ok' : 'network-fs-degraded';
  const quarantineEntries = new Set<string>();

  return {
    getHealth() {
      return health;
    },

    getProbeResults() {
      return [...initialProbeResults];
    },

    degrade(quarantinePath) {
      health = 'network-fs-degraded';
      if (quarantinePath !== undefined) {
        quarantineEntries.add(quarantinePath);
      }
    },

    listQuarantinedEntries() {
      return [...quarantineEntries].sort();
    },
  };
};

export const writeTempThenRename = (
  backend: OpenFilesystemStorageOptions['backend'],
  path: string,
  bytes: Uint8Array,
): void => {
  const tempPath = `${path}.tmp`;
  backend.writeFile(tempPath, bytes);
  backend.fsyncFile(tempPath);
  backend.rename(tempPath, path);
  backend.fsyncDirectory(containingDirectory(path));
};

export const runProbes = (
  backend: OpenFilesystemStorageOptions['backend'],
  options: OpenFilesystemStorageOptions,
): FilesystemProbeResult[] => {
  backend.ensureDirectory(PROBES_DIRECTORY);
  backend.setPhase?.('probe');

  const probeResults: FilesystemProbeResult[] = [];
  const recordProbe = (probe: FilesystemProbe, action: () => void): void => {
    try {
      action();
      probeResults.push({ probe, ok: true });
    } catch {
      probeResults.push({ probe, ok: false });
    }
  };

  recordProbe('atomic-rename', () => {
    const fromPath = `${PROBES_DIRECTORY}/atomic-rename.from`;
    const toPath = `${PROBES_DIRECTORY}/atomic-rename.to`;
    backend.writeFile(fromPath, encodeString('probe'));
    backend.fsyncFile(fromPath);
    backend.rename(fromPath, toPath);
    backend.fsyncDirectory(PROBES_DIRECTORY);
    backend.remove(toPath);
  });

  recordProbe('exclusive-create', () => {
    const path = `${PROBES_DIRECTORY}/exclusive-create.txt`;
    backend.writeExclusive(path, encodeString('probe'));
    let duplicateFailed = false;
    try {
      backend.writeExclusive(path, encodeString('probe'));
    } catch {
      duplicateFailed = true;
    }
    backend.remove(path);
    if (!duplicateFailed) {
      throw new Error('Exclusive create was not exclusive.');
    }
  });

  recordProbe('file-fsync', () => {
    const path = `${PROBES_DIRECTORY}/file-fsync.txt`;
    backend.writeFile(path, encodeString('probe'));
    backend.fsyncFile(path);
    backend.remove(path);
  });

  recordProbe('directory-fsync', () => {
    backend.fsyncDirectory(PROBES_DIRECTORY);
  });

  recordProbe('lease-cas', () => {
    const name = '__probe__lease-cas';
    const guardPath = leaseGuardPath(name);
    const recordPath = leaseFilePath(name);
    const currentNow = options.now?.() ?? new Date();
    const token = options.createToken?.() ?? 'probe-token';
    const record: SerializedLeaseRecord = {
      name,
      epoch: 1,
      holder: 'probe',
      tokenDigest: options.digestToken(token),
      expiresAt: new Date(currentNow.getTime() + 1_000).toISOString(),
    };
    backend.writeExclusive(
      guardPath,
      serializeJson({ name, guardExpiresAt: new Date(currentNow.getTime() + 1_000).toISOString() }),
    );
    backend.fsyncFile(guardPath);
    backend.fsyncDirectory(LEASES_DIRECTORY);
    writeTempThenRename(backend, recordPath, serializeJson(record));
    backend.remove(guardPath);
    backend.fsyncDirectory(LEASES_DIRECTORY);
    backend.remove(recordPath);
  });

  backend.setPhase?.('runtime');
  return probeResults;
};

export const loadLogState = (backend: OpenFilesystemStorageOptions['backend'], logId: string): LogState => {
  const parsed = parseJson<SerializedLogState>(backend.readFile(logFilePath(logId)));
  if (parsed === undefined) {
    return emptyLogState();
  }

  const committed = parsed.committed.map(fromSerializedRecord);
  const tail = committedTailPosition(committed);
  return {
    committed,
    buffered: [],
    nextSequence: tail.nextSequence,
    nextByteOffset: tail.nextByteOffset,
    interiorCorrupt: parsed.interiorCorrupt,
  };
};

export const persistLogState = (
  backend: OpenFilesystemStorageOptions['backend'],
  logId: string,
  logState: LogState,
): void => {
  writeTempThenRename(
    backend,
    logFilePath(logId),
    serializeJson({
      committed: logState.committed.map(toSerializedRecord),
      interiorCorrupt: logState.interiorCorrupt,
    } satisfies SerializedLogState),
  );
};

export const parseLeaseRecord = (bytes: Uint8Array | undefined): LeaseRecord | undefined => {
  const parsed = parseJson<SerializedLeaseRecord>(bytes);
  if (parsed === undefined) {
    return undefined;
  }

  return {
    ...parsed,
    expiresAt: new Date(parsed.expiresAt),
  };
};

export const isExpired = (record: LeaseRecord, now: Date): boolean => record.expiresAt.getTime() <= now.getTime();

export const writerBindingFor = (lease: EventLogLeaseBinding): WriterBinding => ({
  leaseName: lease.name,
  epoch: lease.epoch,
  token: lease.token,
  isCurrent: lease.isCurrent,
});

export const writerMatches = (binding: WriterBinding | undefined, handle: LogHandle): boolean =>
  binding !== undefined &&
  binding.leaseName === handle.leaseName &&
  binding.epoch === handle.epoch &&
  binding.token === handle.token;

export const writerIsCurrent = (binding: WriterBinding): boolean => binding.isCurrent?.() ?? true;

export const writerBindingMatchesLease = (binding: WriterBinding | undefined, lease: EventLogLeaseBinding): boolean =>
  binding !== undefined &&
  binding.leaseName === lease.name &&
  binding.epoch === lease.epoch &&
  binding.token === lease.token;

export const allocateRecords = (
  logState: LogState,
  binding: WriterBinding,
  payloads: readonly Uint8Array[],
  digestBytes: OpenFilesystemStorageOptions['digestBytes'],
): {
  readonly records: readonly StoredRecord[];
  readonly nextSequence: number;
  readonly nextByteOffset: number;
} => {
  let nextSequence = logState.nextSequence;
  let nextByteOffset = logState.nextByteOffset;
  const records: StoredRecord[] = [];

  for (const payloadInput of payloads) {
    const payload = cloneBytes(payloadInput);
    const byteRange = {
      start: nextByteOffset,
      end: nextByteOffset + DEFAULT_RECORD_FRAME_OVERHEAD_BYTES + payload.byteLength,
    };
    records.push({
      sequence: nextSequence,
      writerEpoch: binding.epoch,
      leaseName: binding.leaseName,
      payloadLength: payload.byteLength,
      payloadDigest: digestBytes(payload),
      frameDigest: digestBytes(buildFrameSeed(binding, nextSequence, payload, byteRange)),
      byteRange,
      payload,
    });
    nextSequence += 1;
    nextByteOffset = byteRange.end;
  }

  return { records, nextSequence, nextByteOffset };
};

export const sortArtifacts = (left: ArtifactRef, right: ArtifactRef): number => left.id.localeCompare(right.id);

export const sortLogRanges = (left: ExportManifestLogRange, right: ExportManifestLogRange): number =>
  left.logId.localeCompare(right.logId) ||
  left.fromSequence - right.fromSequence ||
  left.toSequence - right.toSequence ||
  left.frameDigest.localeCompare(right.frameDigest);
