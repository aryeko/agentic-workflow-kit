import type { StorageError } from '../errors/index.js';
import type { EventLogStore } from '../event-log/index.js';
import { requireAuthoritativeStorageOperation } from '../health/index.js';
import type { StorageHealth } from '../health/index.js';
import { createFilesystemArtifactStore } from './filesystem-artifact-store.js';
import type { FilesystemStorage, OpenFilesystemStorageOptions } from './filesystem-types.js';
import {
  ARTIFACTS_DIRECTORY,
  ARTIFACT_BLOBS_DIRECTORY,
  ARTIFACT_METADATA_DIRECTORY,
  ARTIFACT_SCRATCH_DIRECTORY,
  ARTIFACT_SCRATCH_METADATA_DIRECTORY,
  ARTIFACT_TOMBSTONES_DIRECTORY,
  DEFAULT_COMMIT_TRAILER_BYTES,
  LEASES_DIRECTORY,
  LOGS_DIRECTORY,
  QUARANTINE_DIRECTORY,
  allocateRecords,
  buildBufferedAck,
  collectReceiptFrameDigest,
  collectReceiptPayloadDigest,
  committedTailPosition,
  createStorageError,
  encodePathComponent,
  loadLogState,
  openFilesystemController,
  persistLogState,
  replayHealthForLog,
  runProbes,
  writerBindingFor,
  writerBindingMatchesLease,
  writerIsCurrent,
  writerMatches,
  type LogState,
  type WriterBinding,
} from './filesystem-common.js';
import { createFilesystemLeaseStore } from './filesystem-lease-store.js';

export const openFilesystemStorage = (options: OpenFilesystemStorageOptions): FilesystemStorage => {
  options.backend.ensureDirectory(LOGS_DIRECTORY);
  options.backend.ensureDirectory(LEASES_DIRECTORY);
  options.backend.ensureDirectory(QUARANTINE_DIRECTORY);
  options.backend.ensureDirectory(ARTIFACTS_DIRECTORY);
  options.backend.ensureDirectory(ARTIFACT_BLOBS_DIRECTORY);
  options.backend.ensureDirectory(ARTIFACT_METADATA_DIRECTORY);
  options.backend.ensureDirectory(ARTIFACT_SCRATCH_DIRECTORY);
  options.backend.ensureDirectory(ARTIFACT_SCRATCH_METADATA_DIRECTORY);
  options.backend.ensureDirectory(ARTIFACT_TOMBSTONES_DIRECTORY);

  const probeResults = runProbes(options.backend, options);
  const controller = openFilesystemController(probeResults);

  const now = options.now ?? (() => new Date());
  const createToken = options.createToken ?? (() => crypto.randomUUID());
  const logCache = new Map<string, LogState>();

  const currentHealth = (): StorageHealth => controller.getHealth();

  const guardAuthoritative = (operation: 'append' | 'lease' | 'evidence-ref' | 'export'): true | StorageError => {
    const availability = requireAuthoritativeStorageOperation(currentHealth(), operation);
    return availability.ok ? true : availability.error;
  };

  const getLogState = (logId: string): LogState => {
    const cached = logCache.get(logId);
    if (cached !== undefined) {
      return cached;
    }
    const loaded = loadLogState(options.backend, logId);
    logCache.set(logId, loaded);
    return loaded;
  };

  const setLogState = (logId: string, logState: LogState): void => {
    logCache.set(logId, logState);
  };

  const eventLogStore: EventLogStore = {
    openForAppend(logId, lease) {
      const availability = guardAuthoritative('append');
      if (availability !== true) {
        return availability;
      }

      const logState = getLogState(logId);
      const nextLogState = writerBindingMatchesLease(logState.currentWriter, lease)
        ? { ...logState, currentWriter: writerBindingFor(lease) }
        : {
            ...logState,
            buffered: [],
            ...committedTailPosition(logState.committed),
            currentWriter: writerBindingFor(lease),
          };
      setLogState(logId, nextLogState);

      return {
        logId,
        leaseName: lease.name,
        epoch: lease.epoch,
        token: lease.token,
      };
    },

    append(handle, batch) {
      const availability = guardAuthoritative('append');
      if (availability !== true) {
        return availability;
      }

      const logState = getLogState(handle.logId);
      const replayHealth = replayHealthForLog(currentHealth(), logState);
      if (logState.interiorCorrupt) {
        return createStorageError(
          'log-interior-corrupt',
          replayHealth,
          `Committed history is incoherent for log ${handle.logId}; append is read-only.`,
        );
      }
      if (handle.leaseName.length === 0 || handle.token.length === 0) {
        return createStorageError(
          'stale-writer-fenced',
          replayHealth,
          'Append handle must include a lease name and token before bytes can be appended.',
        );
      }
      if (!writerMatches(logState.currentWriter, handle)) {
        return createStorageError(
          'stale-writer-fenced',
          replayHealth,
          `Append handle no longer matches the current lease binding for log ${handle.logId}.`,
        );
      }
      if (batch.payloads.length === 0) {
        return createStorageError(
          'stale-writer-fenced',
          replayHealth,
          `Append batch for log ${handle.logId} must contain at least one payload.`,
        );
      }
      if (batch.expectedSequence !== logState.nextSequence) {
        return createStorageError(
          'stale-writer-fenced',
          replayHealth,
          `Expected sequence ${batch.expectedSequence} does not match next append sequence ${logState.nextSequence} for log ${handle.logId}.`,
        );
      }

      const binding = logState.currentWriter as WriterBinding;
      if (!writerIsCurrent(binding)) {
        return createStorageError(
          'stale-writer-fenced',
          replayHealth,
          `Append handle is no longer backed by a current lease for log ${handle.logId}.`,
        );
      }

      const allocated = allocateRecords(logState, binding, batch.payloads, options.digestBytes);
      if (batch.durability === 'buffered') {
        setLogState(handle.logId, {
          ...logState,
          buffered: [...logState.buffered, ...allocated.records],
          nextSequence: allocated.nextSequence,
          nextByteOffset: allocated.nextByteOffset,
        });
        return buildBufferedAck(batch.expectedSequence);
      }

      const durableRecords = [...logState.buffered, ...allocated.records];
      const nextLogState: LogState = {
        ...logState,
        committed: [...logState.committed, ...durableRecords],
        buffered: [],
        nextSequence: allocated.nextSequence,
        nextByteOffset: allocated.nextByteOffset,
      };

      try {
        persistLogState(options.backend, handle.logId, nextLogState);
      } catch {
        controller.degrade(`${QUARANTINE_DIRECTORY}/logs/${encodePathComponent(handle.logId)}.json`);
        setLogState(handle.logId, {
          ...logState,
          buffered: [],
          currentWriter: undefined,
          ...committedTailPosition(logState.committed),
        });
        return createStorageError(
          'network-fs-degraded',
          controller.getHealth(),
          'Authoritative append is unavailable while storage health is network-fs-degraded.',
        );
      }

      setLogState(handle.logId, nextLogState);
      const firstRecord = durableRecords[0];
      const lastRecord = durableRecords[durableRecords.length - 1];
      return {
        firstSequence: firstRecord.sequence,
        lastSequence: lastRecord.sequence,
        writerEpoch: handle.epoch,
        leaseName: handle.leaseName,
        durability: batch.durability,
        byteRange: {
          start: firstRecord.byteRange.start,
          end: lastRecord.byteRange.end + DEFAULT_COMMIT_TRAILER_BYTES,
        },
        payloadDigest: collectReceiptPayloadDigest(durableRecords, options.digestBytes),
        frameDigest: collectReceiptFrameDigest(durableRecords, batch.durability, options.digestBytes),
      };
    },

    replay(logId) {
      const logState = getLogState(logId);
      return {
        health: replayHealthForLog(currentHealth(), logState),
        records: logState.committed.map((record) => ({
          ...record,
          byteRange: { ...record.byteRange },
          payload: Uint8Array.from(record.payload),
        })),
      };
    },
  };

  const leaseStore = createFilesystemLeaseStore({
    backend: options.backend,
    controller,
    currentHealth,
    guardAuthoritative: () => guardAuthoritative('lease'),
    digestToken: options.digestToken,
    createToken,
    now,
  });

  const { artifactStore, debug } = createFilesystemArtifactStore({
    backend: options.backend,
    controller,
    currentHealth,
    guardAuthoritative: (operation) => guardAuthoritative(operation),
    digestBytes: options.digestBytes,
    now,
    resolveLogRange: (range) => {
      const logState = getLogState(range.logId);
      const selected = logState.committed.filter(
        (record) => record.sequence >= range.fromSequence && record.sequence <= range.toSequence,
      );
      if (selected.length !== range.toSequence - range.fromSequence + 1) {
        return undefined;
      }
      return {
        ...range,
        frameDigest: collectReceiptFrameDigest(selected, 'durable', options.digestBytes),
      };
    },
    sizeLimitBytes: options.sizeLimitBytes,
    classificationPolicy: options.classificationPolicy,
    redactionHooks: options.redactionHooks,
  });

  return {
    eventLogStore,
    leaseStore,
    artifactStore,
    getHealth() {
      return controller.getHealth();
    },
    getProbeResults() {
      return controller.getProbeResults();
    },
    debug: {
      listQuarantinedEntries() {
        return controller.listQuarantinedEntries();
      },
      listFiles: debug.listFiles,
      corruptArtifact: debug.corruptArtifact,
      readTombstones: debug.readTombstones,
    },
  };
};
