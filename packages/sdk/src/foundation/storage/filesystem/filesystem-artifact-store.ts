import {
  createArtifactRef,
  createArtifactTombstoneRecord,
  createScratchArtifactRef,
  isScratchArtifactRef,
  toArtifactMetadataRecord,
  type ArtifactInput,
  type ArtifactMetadataRecord,
  type ArtifactRef,
  type ArtifactStore,
  type ArtifactTombstoneRecord,
  type ExportManifest,
  type ExportManifestLogRange,
} from '../artifacts/index.js';
import type { StorageError } from '../errors/index.js';
import type { StorageHealth } from '../health/index.js';
import type { OpenFilesystemStorageOptions } from './filesystem-types.js';
import {
  ARTIFACT_BLOBS_DIRECTORY,
  QUARANTINE_DIRECTORY,
  artifactBlobPath,
  artifactMetadataPath,
  cloneBytes,
  collectInputBytes,
  compareOptionalDates,
  createByteStream,
  createStorageError,
  encodePathComponent,
  readArtifactEntries,
  readScratchEntries,
  readTombstones,
  scratchBlobPath,
  scratchMetadataPath,
  serializeJson,
  sortArtifacts,
  sortLogRanges,
  tombstonePath,
  writeTempThenRename,
  type ArtifactEntry,
  type FilesystemController,
} from './filesystem-common.js';

type GuardAuthoritativeArtifact = (operation: 'evidence-ref' | 'export') => true | StorageError;

type ResolvedLogRange = ExportManifestLogRange | StorageError | undefined;
type ExportArtifactSelection = {
  readonly manifestId: string;
  readonly artifact: ArtifactRef;
};

export type CreateFilesystemArtifactStoreOptions = {
  readonly backend: OpenFilesystemStorageOptions['backend'];
  readonly controller: FilesystemController;
  readonly currentHealth: () => StorageHealth;
  readonly guardAuthoritative: GuardAuthoritativeArtifact;
  readonly digestBytes: OpenFilesystemStorageOptions['digestBytes'];
  readonly now: () => Date;
  readonly resolveLogRange: (
    range: Readonly<{ logId: string; fromSequence: number; toSequence: number }>,
  ) => ResolvedLogRange;
  readonly sizeLimitBytes?: number;
  readonly classificationPolicy?: (classification: string) => boolean;
  readonly redactionHooks?: OpenFilesystemStorageOptions['redactionHooks'];
};

export const createFilesystemArtifactStore = ({
  backend,
  controller,
  currentHealth,
  guardAuthoritative,
  digestBytes,
  now,
  resolveLogRange,
  sizeLimitBytes,
  classificationPolicy,
  redactionHooks,
}: CreateFilesystemArtifactStoreOptions): {
  readonly artifactStore: ArtifactStore;
  readonly debug: {
    listFiles(prefix?: string): readonly string[];
    corruptArtifact(id: string, bytes: Uint8Array): void;
    readTombstones(): readonly ArtifactTombstoneRecord[];
  };
} => {
  const artifactEntries = readArtifactEntries(backend);
  const scratchEntries = readScratchEntries(backend);
  const tombstones = readTombstones(backend);

  const validateContent = (bytes: Uint8Array, classification: string): true | StorageError => {
    if (sizeLimitBytes !== undefined && bytes.byteLength > sizeLimitBytes) {
      return createStorageError(
        'artifact-quarantined',
        currentHealth(),
        'Artifact size exceeded the configured limit.',
      );
    }
    if (classificationPolicy !== undefined && !classificationPolicy(classification)) {
      return createStorageError('artifact-quarantined', currentHealth(), 'Artifact classification failed validation.');
    }
    return true;
  };

  const verifyIntegrity = (entry: ArtifactEntry): true | StorageError => {
    const bytes = backend.readFile(artifactBlobPath(entry.originalDigest));
    if (bytes === undefined) {
      return createStorageError(
        'artifact-quarantined',
        currentHealth(),
        `Artifact ${entry.metadata.id} failed digest verification.`,
      );
    }
    const digest = digestBytes(bytes);
    if (digest !== entry.originalDigest) {
      return createStorageError(
        'artifact-quarantined',
        currentHealth(),
        `Artifact ${entry.metadata.id} failed digest verification.`,
      );
    }
    return true;
  };

  const sameMetadata = (entry: ArtifactEntry, input: ArtifactInput): boolean =>
    entry.metadata.mediaType === input.mediaType &&
    entry.metadata.retentionClass === input.retentionClass &&
    entry.metadata.classification === input.classification &&
    entry.metadata.producer === input.producer &&
    compareOptionalDates(entry.metadata.expiry, input.expiry);

  const quarantineArtifact = (quarantinePath: string, message: string): StorageError => {
    controller.degrade(quarantinePath);
    return createStorageError('artifact-quarantined', controller.getHealth(), message);
  };

  const publishArtifact = (
    input: ArtifactInput,
    bytes: Uint8Array,
    redactionState: ArtifactMetadataRecord['redactionState'],
  ): ArtifactRef | StorageError => {
    const validation = validateContent(bytes, input.classification);
    if (validation !== true) {
      return validation;
    }

    const digest = digestBytes(bytes);
    const id = `artifact:sha256:${digest}`;
    const existing = artifactEntries.get(id);
    if (existing !== undefined) {
      if (!sameMetadata(existing, input)) {
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
      if (existing.metadata.redactionState === 'tombstoned' && redactionState === 'raw') {
        return createStorageError(
          'artifact-quarantined',
          currentHealth(),
          `Artifact ${id} is tombstoned and cannot be republished as raw evidence.`,
        );
      }
      return createArtifactRef(existing.metadata);
    }

    const metadata = toArtifactMetadataRecord(
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
      now(),
      redactionState,
      true,
    );

    const tempPath = `${ARTIFACT_BLOBS_DIRECTORY}/${digest}.tmp`;
    try {
      backend.writeFile(tempPath, bytes);
      backend.fsyncFile(tempPath);
      if (!backend.exists(artifactBlobPath(digest))) {
        backend.writeExclusive(artifactBlobPath(digest), bytes);
        backend.fsyncFile(artifactBlobPath(digest));
        backend.fsyncDirectory(ARTIFACT_BLOBS_DIRECTORY);
      }
      backend.remove(tempPath);
      writeTempThenRename(
        backend,
        artifactMetadataPath(id),
        serializeJson({
          metadata,
          originalDigest: digest,
        } satisfies ArtifactEntry),
      );
    } catch {
      return quarantineArtifact(
        `${QUARANTINE_DIRECTORY}/artifacts/${digest}.partial`,
        'Artifact publish left partial output in quarantine.',
      );
    }

    artifactEntries.set(id, {
      metadata,
      originalDigest: digest,
    });
    return createArtifactRef(metadata);
  };

  const resolveExportArtifact = (
    entry: ArtifactEntry,
    mode: 'redacted' | 'raw',
  ): ExportArtifactSelection | StorageError => {
    if (mode === 'raw' || entry.metadata.redactionState !== 'tombstoned') {
      const integrity = verifyIntegrity(entry);
      if (integrity !== true) {
        return createStorageError(
          'export-incomplete-forbidden',
          currentHealth(),
          `Artifact ${entry.metadata.id} could not be verified for export.`,
        );
      }

      return {
        manifestId: entry.metadata.id,
        artifact: createArtifactRef(entry.metadata),
      };
    }

    if (entry.replacementId === undefined) {
      return createStorageError(
        'export-incomplete-forbidden',
        currentHealth(),
        `Artifact ${entry.metadata.id} could not be verified for export.`,
      );
    }
    const replacement = artifactEntries.get(entry.replacementId);
    if (replacement === undefined) {
      return createStorageError(
        'export-incomplete-forbidden',
        currentHealth(),
        `Artifact ${entry.metadata.id} could not be verified for export.`,
      );
    }
    const replacementIntegrity = verifyIntegrity(replacement);
    if (replacementIntegrity !== true) {
      return createStorageError(
        'export-incomplete-forbidden',
        currentHealth(),
        `Artifact ${entry.metadata.id} could not be verified for export.`,
      );
    }

    return {
      manifestId: entry.metadata.id,
      artifact: createArtifactRef(replacement.metadata),
    };
  };

  const updateRedactionMetadata = (entry: ArtifactEntry, replacementId: string): ArtifactEntry => ({
    metadata: {
      ...entry.metadata,
      redactionState: 'tombstoned',
    },
    originalDigest: entry.originalDigest,
    replacementId,
  });

  const persistRedactionState = (
    originalRef: ArtifactRef,
    updatedEntry: ArtifactEntry,
    redacted: ArtifactRef,
    hookId: string,
  ): StorageError | undefined => {
    try {
      writeTempThenRename(backend, artifactMetadataPath(originalRef.id), serializeJson(updatedEntry));
    } catch {
      return quarantineArtifact(
        `${QUARANTINE_DIRECTORY}/artifacts/${encodePathComponent(originalRef.id)}.redaction-meta.partial`,
        'Artifact redaction left partial output in quarantine.',
      );
    }

    artifactEntries.set(originalRef.id, updatedEntry);

    const tombstone = createArtifactTombstoneRecord(createArtifactRef(updatedEntry.metadata), redacted, hookId, now());
    try {
      writeTempThenRename(backend, tombstonePath(originalRef.id), serializeJson(tombstone));
    } catch {
      return quarantineArtifact(
        `${QUARANTINE_DIRECTORY}/artifacts/${encodePathComponent(originalRef.id)}.tombstone.partial`,
        'Artifact redaction left partial output in quarantine.',
      );
    }

    tombstones.push(tombstone);
    return undefined;
  };

  const artifactStore: ArtifactStore = {
    async put(input) {
      const availability = guardAuthoritative('evidence-ref');
      if (availability !== true) {
        return availability;
      }

      const bytes = await collectInputBytes(input.content);
      return publishArtifact(input, bytes, 'raw');
    },

    async putScratch(input) {
      if (currentHealth() !== 'network-fs-degraded') {
        return createStorageError(
          'network-fs-degraded',
          currentHealth(),
          `Scratch artifacts are available only while storage health is ${currentHealth()}.`,
        );
      }

      const bytes = await collectInputBytes(input.content);
      const validation = validateContent(bytes, input.classification);
      if (validation !== true) {
        return validation;
      }

      const digest = digestBytes(bytes);
      const id = `scratch:sha256:${digest}`;
      const existing = scratchEntries.get(id);
      if (existing !== undefined) {
        return createScratchArtifactRef(existing.metadata);
      }

      const metadata = toArtifactMetadataRecord(
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
        now(),
        'raw',
        false,
      );

      backend.writeFile(scratchBlobPath(digest), bytes);
      writeTempThenRename(
        backend,
        scratchMetadataPath(id),
        serializeJson({
          metadata,
          originalDigest: digest,
        } satisfies ArtifactEntry),
      );
      scratchEntries.set(id, {
        metadata,
        originalDigest: digest,
      });
      return createScratchArtifactRef(metadata);
    },

    resolve(id) {
      if (id.startsWith('scratch:sha256:')) {
        return createStorageError(
          'network-fs-degraded',
          currentHealth(),
          `Scratch artifact ${id} cannot satisfy authoritative artifact resolution.`,
        );
      }

      const entry = artifactEntries.get(id);
      if (entry === undefined) {
        return createStorageError('artifact-quarantined', currentHealth(), `Artifact ${id} could not be resolved.`);
      }

      return createArtifactRef(entry.metadata);
    },

    get(ref, mode) {
      const entry = artifactEntries.get(ref.id);
      if (entry === undefined) {
        return createStorageError('artifact-quarantined', currentHealth(), `Artifact ${ref.id} could not be resolved.`);
      }

      const integrity = verifyIntegrity(entry);
      if (integrity !== true) {
        return integrity;
      }

      if (entry.metadata.redactionState === 'tombstoned' && mode === 'redacted') {
        return createStorageError(
          'artifact-quarantined',
          currentHealth(),
          `Artifact ${ref.id} is tombstoned and unavailable for redacted reads.`,
        );
      }

      return {
        ref: createArtifactRef(entry.metadata),
        bytes: createByteStream(backend.readFile(artifactBlobPath(entry.originalDigest)) as Uint8Array),
      };
    },

    redact(ref, hookId) {
      const availability = guardAuthoritative('evidence-ref');
      if (availability !== true) {
        return availability;
      }

      const entry = artifactEntries.get(ref.id);
      if (entry === undefined) {
        return createStorageError('artifact-quarantined', currentHealth(), `Artifact ${ref.id} could not be resolved.`);
      }

      const integrity = verifyIntegrity(entry);
      if (integrity !== true) {
        return integrity;
      }

      const bytes = backend.readFile(artifactBlobPath(entry.originalDigest)) as Uint8Array;

      const hook = redactionHooks?.[hookId];
      if (hook === undefined) {
        return createStorageError(
          'artifact-quarantined',
          currentHealth(),
          `Redaction hook ${hookId} could not be applied.`,
        );
      }

      const redaction = hook({
        hookId,
        artifact: entry.metadata,
        bytes: cloneBytes(bytes),
      });

      const redacted = publishArtifact(
        {
          content: redaction.content,
          mediaType: redaction.mediaType ?? entry.metadata.mediaType,
          retentionClass: redaction.retentionClass ?? entry.metadata.retentionClass,
          classification: redaction.classification ?? entry.metadata.classification,
          expiry: redaction.expiry ?? entry.metadata.expiry,
          producer: redaction.producer ?? entry.metadata.producer,
        },
        redaction.content,
        'redacted',
      );

      if ('code' in redacted) {
        return redacted;
      }
      if (redacted.id === ref.id || isScratchArtifactRef(redacted)) {
        return createStorageError(
          'artifact-quarantined',
          currentHealth(),
          `Redaction hook ${hookId} did not produce a new artifact.`,
        );
      }

      const updatedEntry = updateRedactionMetadata(entry, redacted.id);
      const persisted = persistRedactionState(ref, updatedEntry, redacted, hookId);
      if (persisted !== undefined) {
        return persisted;
      }

      return redacted;
    },

    export(selection) {
      const availability = guardAuthoritative('export');
      if (availability !== true) {
        return availability;
      }

      const redactionMode = selection.mode ?? 'redacted';
      const artifacts: ExportArtifactSelection[] = [];

      for (const artifactId of selection.artifactIds) {
        const entry = artifactEntries.get(artifactId);
        if (entry === undefined) {
          return createStorageError(
            'export-incomplete-forbidden',
            currentHealth(),
            `Artifact ${artifactId} could not be verified for export.`,
          );
        }

        const exportArtifact = resolveExportArtifact(entry, redactionMode);
        if ('code' in exportArtifact) {
          return exportArtifact;
        }
        artifacts.push(exportArtifact);
      }

      const logRanges: ExportManifestLogRange[] = [];
      for (const range of selection.logRanges ?? []) {
        const resolved = resolveLogRange(range);
        if (resolved === undefined || 'code' in resolved) {
          return createStorageError(
            'export-incomplete-forbidden',
            currentHealth(),
            `Log range ${range.logId}:${range.fromSequence}-${range.toSequence} could not be verified for export.`,
          );
        }
        logRanges.push(resolved);
      }

      return {
        createdAt: now(),
        redactionMode,
        logHealth: currentHealth(),
        artifacts: artifacts
          .sort(
            (left, right) =>
              left.manifestId.localeCompare(right.manifestId) || sortArtifacts(left.artifact, right.artifact),
          )
          .map(({ manifestId, artifact }) => ({
            id: manifestId,
            digest: artifact.digest,
            size: artifact.size,
            redactionState: artifact.redactionState,
          })),
        logRanges: logRanges.sort(sortLogRanges),
      } satisfies ExportManifest;
    },
  };

  return {
    artifactStore,
    debug: {
      listFiles(prefix) {
        return backend.listFiles(prefix);
      },

      corruptArtifact(id, bytes) {
        const entry = artifactEntries.get(id);
        if (entry === undefined) {
          return;
        }
        backend.corruptFile(artifactBlobPath(entry.originalDigest), bytes);
      },

      readTombstones() {
        return [...tombstones];
      },
    },
  };
};
