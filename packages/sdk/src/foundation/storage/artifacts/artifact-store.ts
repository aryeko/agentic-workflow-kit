import { STORAGE_ERROR_CODES, type StorageError } from '../errors/index.js';
import { requireAuthoritativeStorageOperation, type StorageHealth } from '../health/index.js';
import {
  createArtifactId,
  createArtifactRef,
  createArtifactTombstoneRecord,
  createScratchArtifactId,
  createScratchArtifactRef,
  isScratchArtifactRef,
  toArtifactMetadataRecord,
  type ArtifactMetadataRecord,
  type ArtifactTombstoneRecord,
} from './artifact-evidence.js';
import type {
  ArtifactInput,
  ArtifactRef,
  ArtifactStore,
  ArtifactStream,
  ExportLogRangeSelection,
  ExportManifest,
  ExportManifestLogRange,
  ScratchArtifactRef,
} from './artifact-types.js';
import type { ArtifactRedactionHookRegistry } from './redaction-hooks.js';

type ArtifactDigestFn = (bytes: Uint8Array) => string;

type LogRangeResolution = {
  readonly frameDigest: string;
};

export type CreateInMemoryArtifactStoreOptions = {
  readonly digestBytes: ArtifactDigestFn;
  readonly now: () => Date;
  readonly health: () => StorageHealth;
  readonly sizeLimitBytes?: number;
  readonly classificationPolicy?: (classification: string) => boolean;
  readonly redactionHooks?: ArtifactRedactionHookRegistry;
  readonly resolveLogRange?: (range: ExportLogRangeSelection) => LogRangeResolution | StorageError | undefined;
};

type StoredArtifact = {
  readonly input: ArtifactInput;
  readonly bytes?: Uint8Array;
  readonly originalDigest: string;
  readonly replacementId?: string;
  readonly metadata: ArtifactMetadataRecord;
};

export interface InMemoryArtifactStore extends ArtifactStore {
  readArtifactMetadataRecord(id: string): ArtifactMetadataRecord | undefined;
  readArtifactTombstones(): readonly ArtifactTombstoneRecord[];
  debugCorruptArtifactBytes(id: string, bytes: Uint8Array): void;
  debugDeleteArtifactBytes(id: string): void;
}

const createStorageError = (code: StorageError['code'], health: StorageHealth, message: string): StorageError => {
  if (!STORAGE_ERROR_CODES.includes(code)) {
    throw new Error(`Unknown storage error code: ${code}`);
  }

  return { code, health, message };
};

const cloneBytes = (bytes: Uint8Array): Uint8Array => Uint8Array.from(bytes);

const createByteStream = (bytes: Uint8Array): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(cloneBytes(bytes));
      controller.close();
    },
  });

const collectInputBytes = (content: ArtifactInput['content']): Uint8Array | undefined => {
  if (content instanceof Uint8Array) {
    return cloneBytes(content);
  }

  return undefined;
};

const compareOptionalDates = (left?: Date, right?: Date): boolean => {
  if (left === undefined || right === undefined) {
    return left === right;
  }

  return left.toISOString() === right.toISOString();
};

const sameAuthoritativeMetadata = (artifact: StoredArtifact, input: ArtifactInput): boolean =>
  artifact.metadata.mediaType === input.mediaType &&
  artifact.metadata.retentionClass === input.retentionClass &&
  artifact.metadata.classification === input.classification &&
  artifact.metadata.producer === input.producer &&
  compareOptionalDates(artifact.metadata.expiry, input.expiry);

const sortArtifacts = (left: ArtifactRef, right: ArtifactRef): number => left.id.localeCompare(right.id);

const sortLogRanges = (left: ExportManifestLogRange, right: ExportManifestLogRange): number =>
  left.logId.localeCompare(right.logId) ||
  left.fromSequence - right.fromSequence ||
  left.toSequence - right.toSequence ||
  left.frameDigest.localeCompare(right.frameDigest);

const isStorageError = <T>(value: StorageError | T): value is StorageError =>
  typeof value === 'object' && value !== null && 'code' in value;

export const collectArtifactStreamBytes = async (stream: ArtifactStream): Promise<Uint8Array> => {
  const reader = stream.bytes.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }

    size += chunk.value.byteLength;
    chunks.push(chunk.value);
  }

  const output = new Uint8Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output;
};

export const createInMemoryArtifactStore = (options: CreateInMemoryArtifactStoreOptions): InMemoryArtifactStore => {
  const authoritativeArtifacts = new Map<string, StoredArtifact>();
  const scratchArtifacts = new Map<string, StoredArtifact>();
  const tombstones: ArtifactTombstoneRecord[] = [];

  const currentHealth = (): StorageHealth => options.health();

  const rejectUnsupportedStream = (): StorageError =>
    createStorageError(
      'artifact-quarantined',
      currentHealth(),
      'Artifact content streams are unsupported by the in-memory default store.',
    );

  const verifyIntegrity = (artifact: StoredArtifact): StorageError | true => {
    if (artifact.bytes === undefined) {
      return createStorageError(
        'artifact-quarantined',
        currentHealth(),
        `Artifact ${artifact.metadata.id} failed digest verification.`,
      );
    }

    const digest = options.digestBytes(artifact.bytes);
    if (digest !== artifact.originalDigest) {
      return createStorageError(
        'artifact-quarantined',
        currentHealth(),
        `Artifact ${artifact.metadata.id} failed digest verification.`,
      );
    }

    return true;
  };

  const resolveExportArtifact = (artifact: StoredArtifact, mode: 'redacted' | 'raw'): ArtifactRef | StorageError => {
    if (mode === 'raw' || artifact.metadata.redactionState !== 'tombstoned') {
      const integrity = verifyIntegrity(artifact);
      if (integrity !== true) {
        return createStorageError(
          'export-incomplete-forbidden',
          currentHealth(),
          `Artifact ${artifact.metadata.id} could not be verified for export.`,
        );
      }

      return createArtifactRef(artifact.metadata);
    }

    if (artifact.replacementId === undefined) {
      return createStorageError(
        'export-incomplete-forbidden',
        currentHealth(),
        `Artifact ${artifact.metadata.id} redaction replacement could not be verified for export.`,
      );
    }

    const replacement = authoritativeArtifacts.get(artifact.replacementId);
    if (replacement === undefined) {
      return createStorageError(
        'export-incomplete-forbidden',
        currentHealth(),
        `Artifact ${artifact.metadata.id} redaction replacement could not be verified for export.`,
      );
    }

    const replacementIntegrity = verifyIntegrity(replacement);
    if (replacementIntegrity !== true) {
      return createStorageError(
        'export-incomplete-forbidden',
        currentHealth(),
        `Artifact ${artifact.metadata.id} redaction replacement could not be verified for export.`,
      );
    }

    return createArtifactRef(replacement.metadata);
  };

  const validateContent = (bytes: Uint8Array, classification: string): StorageError | true => {
    if (options.sizeLimitBytes !== undefined && bytes.byteLength > options.sizeLimitBytes) {
      return createStorageError(
        'artifact-quarantined',
        currentHealth(),
        'Artifact size exceeded the configured limit.',
      );
    }

    if (options.classificationPolicy !== undefined && !options.classificationPolicy(classification)) {
      return createStorageError('artifact-quarantined', currentHealth(), 'Artifact classification failed validation.');
    }

    return true;
  };

  const putAuthoritativeArtifact = (
    input: ArtifactInput,
    bytes: Uint8Array,
    redactionState: ArtifactMetadataRecord['redactionState'],
  ): ArtifactRef | StorageError => {
    const validation = validateContent(bytes, input.classification);
    if (validation !== true) {
      return validation;
    }

    const digest = options.digestBytes(bytes);
    const id = createArtifactId(digest);
    const existing = authoritativeArtifacts.get(id);
    if (existing !== undefined) {
      if (!sameAuthoritativeMetadata(existing, input)) {
        return createStorageError(
          'artifact-quarantined',
          currentHealth(),
          `Artifact ${id} failed metadata validation.`,
        );
      }

      const integrity = verifyIntegrity(existing);
      if (integrity !== true) {
        return integrity;
      }

      return createArtifactRef(existing.metadata);
    }

    const record = toArtifactMetadataRecord(
      {
        id,
        digest,
        size: bytes.byteLength,
        mediaType: input.mediaType,
        retentionClass: input.retentionClass,
        classification: input.classification,
        redactionState,
      },
      input,
      digest,
      bytes.byteLength,
      options.now(),
      redactionState,
      true,
    );

    authoritativeArtifacts.set(id, {
      bytes: cloneBytes(bytes),
      input,
      originalDigest: digest,
      metadata: record,
    });

    return createArtifactRef(record);
  };

  const putScratchArtifact = (input: ArtifactInput, bytes: Uint8Array): ScratchArtifactRef | StorageError => {
    const validation = validateContent(bytes, input.classification);
    if (validation !== true) {
      return validation;
    }

    const digest = options.digestBytes(bytes);
    const id = createScratchArtifactId(digest);
    const existing = scratchArtifacts.get(id);
    if (existing !== undefined) {
      return createScratchArtifactRef(existing.metadata);
    }

    const record = toArtifactMetadataRecord(
      {
        id,
        digest,
        size: bytes.byteLength,
        mediaType: input.mediaType,
        classification: input.classification,
        redactionState: 'raw',
      },
      input,
      digest,
      bytes.byteLength,
      options.now(),
      'raw',
      false,
    );

    scratchArtifacts.set(id, {
      bytes: cloneBytes(bytes),
      input,
      originalDigest: digest,
      metadata: record,
    });

    return createScratchArtifactRef(record);
  };

  return {
    put(input) {
      const operation = requireAuthoritativeStorageOperation(currentHealth(), 'evidence-ref');
      if (!operation.ok) {
        return operation.error;
      }

      const bytes = collectInputBytes(input.content);
      if (bytes === undefined) {
        return rejectUnsupportedStream();
      }

      return putAuthoritativeArtifact(input, bytes, 'raw');
    },

    putScratch(input) {
      const health = currentHealth();
      if (health !== 'network-fs-degraded') {
        return createStorageError(
          'network-fs-degraded',
          health,
          'Scratch artifacts are available only while storage health is network-fs-degraded.',
        );
      }

      const bytes = collectInputBytes(input.content);
      if (bytes === undefined) {
        return rejectUnsupportedStream();
      }

      return putScratchArtifact(input, bytes);
    },

    resolve(id) {
      if (scratchArtifacts.has(id) || id.startsWith('scratch:sha256:')) {
        return createStorageError(
          'network-fs-degraded',
          currentHealth(),
          `Scratch artifact ${id} cannot satisfy authoritative artifact resolution.`,
        );
      }

      const artifact = authoritativeArtifacts.get(id);
      if (artifact === undefined) {
        return createStorageError('artifact-quarantined', currentHealth(), `Artifact ${id} could not be resolved.`);
      }

      return createArtifactRef(artifact.metadata);
    },

    get(ref, mode) {
      const artifact = authoritativeArtifacts.get(ref.id);
      if (artifact === undefined) {
        return createStorageError('artifact-quarantined', currentHealth(), `Artifact ${ref.id} could not be resolved.`);
      }

      const integrity = verifyIntegrity(artifact);
      if (integrity !== true) {
        return integrity;
      }

      if (artifact.metadata.redactionState === 'tombstoned' && mode === 'redacted') {
        return createStorageError(
          'artifact-quarantined',
          currentHealth(),
          `Artifact ${ref.id} is tombstoned and unavailable for redacted reads.`,
        );
      }

      if (artifact.bytes === undefined) {
        return createStorageError(
          'artifact-quarantined',
          currentHealth(),
          `Artifact ${ref.id} failed digest verification.`,
        );
      }

      return {
        ref: createArtifactRef(artifact.metadata),
        bytes: createByteStream(artifact.bytes),
      };
    },

    redact(ref, hookId) {
      const operation = requireAuthoritativeStorageOperation(currentHealth(), 'evidence-ref');
      if (!operation.ok) {
        return operation.error;
      }

      const artifact = authoritativeArtifacts.get(ref.id);
      if (artifact === undefined) {
        return createStorageError('artifact-quarantined', currentHealth(), `Artifact ${ref.id} could not be resolved.`);
      }

      const integrity = verifyIntegrity(artifact);
      if (integrity !== true) {
        return integrity;
      }

      if (artifact.bytes === undefined) {
        return createStorageError(
          'artifact-quarantined',
          currentHealth(),
          `Artifact ${ref.id} failed digest verification.`,
        );
      }

      const hook = options.redactionHooks?.[hookId];
      if (hook === undefined) {
        return createStorageError(
          'artifact-quarantined',
          currentHealth(),
          `Redaction hook ${hookId} could not be applied.`,
        );
      }

      const redaction = hook({
        hookId,
        artifact: artifact.metadata,
        bytes: cloneBytes(artifact.bytes),
      });

      const redactedInput: ArtifactInput = {
        content: redaction.content,
        mediaType: redaction.mediaType ?? artifact.metadata.mediaType,
        retentionClass: redaction.retentionClass ?? artifact.metadata.retentionClass,
        classification: redaction.classification ?? artifact.metadata.classification,
        expiry: redaction.expiry ?? artifact.metadata.expiry,
        producer: redaction.producer ?? artifact.metadata.producer,
      };

      const published = putAuthoritativeArtifact(redactedInput, redaction.content, 'redacted');
      if ('code' in published) {
        return published;
      }

      if (published.id === ref.id || isScratchArtifactRef(published)) {
        return createStorageError(
          'artifact-quarantined',
          currentHealth(),
          `Redaction hook ${hookId} did not produce a new artifact.`,
        );
      }

      const updatedMetadata: ArtifactMetadataRecord = {
        ...artifact.metadata,
        redactionState: 'tombstoned',
      };

      authoritativeArtifacts.set(ref.id, {
        ...artifact,
        metadata: updatedMetadata,
        replacementId: published.id,
      });
      tombstones.push(
        createArtifactTombstoneRecord(createArtifactRef(updatedMetadata), published, hookId, options.now()),
      );

      return published;
    },

    export(selection) {
      const operation = requireAuthoritativeStorageOperation(currentHealth(), 'export');
      if (!operation.ok) {
        return operation.error;
      }

      const redactionMode = selection.mode ?? 'redacted';
      const artifacts: ArtifactRef[] = [];
      for (const artifactId of selection.artifactIds) {
        const artifact = authoritativeArtifacts.get(artifactId);
        if (artifact === undefined) {
          return createStorageError(
            'export-incomplete-forbidden',
            currentHealth(),
            `Artifact ${artifactId} could not be verified for export.`,
          );
        }

        const exportArtifact = resolveExportArtifact(artifact, redactionMode);
        if (isStorageError(exportArtifact)) {
          return exportArtifact;
        }

        artifacts.push(exportArtifact);
      }

      const logRanges: ExportManifestLogRange[] = [];
      for (const range of selection.logRanges ?? []) {
        const resolved = options.resolveLogRange?.(range);
        if (resolved === undefined || isStorageError(resolved)) {
          return createStorageError(
            'export-incomplete-forbidden',
            currentHealth(),
            `Log range ${range.logId}:${range.fromSequence}-${range.toSequence} could not be verified for export.`,
          );
        }

        logRanges.push({
          ...range,
          frameDigest: resolved.frameDigest,
        });
      }

      const manifest: ExportManifest = {
        createdAt: options.now(),
        redactionMode,
        logHealth: currentHealth(),
        artifacts: artifacts.sort(sortArtifacts).map((artifact) => ({
          id: artifact.id,
          digest: artifact.digest,
          size: artifact.size,
          redactionState: artifact.redactionState,
        })),
        logRanges: logRanges.sort(sortLogRanges),
      };

      return manifest;
    },

    readArtifactMetadataRecord(id) {
      const artifact = authoritativeArtifacts.get(id) ?? scratchArtifacts.get(id);
      return artifact?.metadata;
    },

    readArtifactTombstones() {
      return [...tombstones];
    },

    debugCorruptArtifactBytes(id, bytes) {
      const artifact = authoritativeArtifacts.get(id);
      if (artifact === undefined) {
        return;
      }

      authoritativeArtifacts.set(id, {
        ...artifact,
        bytes: cloneBytes(bytes),
      });
    },

    debugDeleteArtifactBytes(id) {
      const artifact = authoritativeArtifacts.get(id);
      if (artifact === undefined) {
        return;
      }

      authoritativeArtifacts.set(id, {
        ...artifact,
        bytes: undefined,
      });
    },
  };
};
