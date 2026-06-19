import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { canonicalJson, sha256Bytes, sha256Json, toBytes } from './digest.js';
import { healthToErrorCode, storageError } from './errors.js';
import {
  blobPath,
  fsyncDirectory,
  fsyncFile,
  metadataPath,
  readTextIfExists,
  storageKey,
  writeFileAtomicDurable,
  type StoragePaths,
} from './fs-utils.js';
import { isStorageError } from './types.js';
import type { StorageRootState } from './state.js';
import type {
  ArtifactBytes,
  ArtifactInput,
  ArtifactRef,
  ArtifactStore,
  EventLogStore,
  ExportManifest,
  ExportManifestArtifact,
  ExportManifestLog,
  ExportSelection,
  FileSystemStorageRootOptions,
  ScratchArtifactRef,
  StorageError,
} from './types.js';
import { artifactMetadataSchema, type ArtifactMetadata } from './validation.js';

export class FileSystemArtifactStore implements ArtifactStore {
  constructor(
    private readonly paths: StoragePaths,
    private readonly state: StorageRootState,
    private readonly logs: EventLogStore,
    private readonly options: FileSystemStorageRootOptions,
  ) {}

  put(input: ArtifactInput): ArtifactRef | StorageError {
    if (!this.state.authoritativeWritesAvailable()) {
      return storageError(
        healthToErrorCode(this.state.health),
        'authoritative artifact writes are unavailable',
        this.state.health,
      );
    }
    return this.putAuthoritative(input, input.redactionHookId === undefined ? 'raw' : 'redacted');
  }

  putScratch(input: ArtifactInput): ScratchArtifactRef | StorageError {
    const hook =
      input.redactionHookId === undefined ? undefined : this.options.redactionHooks?.get(input.redactionHookId);
    if (input.redactionHookId !== undefined && hook === undefined) {
      return storageError('artifact-quarantined', 'scratch redaction hook is not registered', this.state.health, {
        hookId: input.redactionHookId,
      });
    }
    const content = hook === undefined ? toBytes(input.content) : hook(toBytes(input.content));
    if (content.byteLength > (this.options.maxArtifactBytes ?? Number.MAX_SAFE_INTEGER)) {
      return storageError('artifact-quarantined', 'scratch artifact exceeds size limit', this.state.health);
    }
    const digest = sha256Bytes(content);
    const id = `scratch:${this.options.idGenerator.nextId('scratch-artifact')}`;
    const path = join(this.paths.artifactScratch, `${storageKey(id)}.blob`);
    try {
      writeFileSync(path, content);
    } catch {
      return storageError('artifact-quarantined', 'scratch artifact could not be written', this.state.health, { id });
    }
    return {
      id,
      digest,
      size: content.byteLength,
      mediaType: input.mediaType,
      classification: input.classification,
      redactionState: input.redactionHookId === undefined ? 'raw' : 'redacted',
    };
  }

  resolve(id: string): ArtifactRef | StorageError {
    if (id.startsWith('scratch:')) {
      return storageError('not-found', 'scratch artifact refs are not authoritative', this.state.health, { id });
    }
    const metadata = this.readMetadata(id);
    if (metadata instanceof Error || metadata === undefined) {
      return storageError('not-found', 'artifact metadata was not found', this.state.health, { id });
    }
    return refFromMetadata(metadata);
  }

  get(ref: ArtifactRef, mode: 'redacted' | 'raw'): ArtifactBytes | StorageError {
    const resolved = this.resolve(ref.id);
    if (isStorageError(resolved)) {
      return resolved;
    }
    if (resolved.redactionState === 'tombstoned') {
      if (mode !== 'raw' || this.options.allowRawTombstoneAccess !== true) {
        return storageError(
          'artifact-quarantined',
          'tombstoned original cannot be read in this mode',
          this.state.health,
          {
            id: resolved.id,
          },
        );
      }
    }
    const content = this.readVerifiedBlob(resolved);
    if (content instanceof Error) {
      return storageError('artifact-quarantined', content.message, this.state.health, { id: resolved.id });
    }
    return { ref: resolved, bytes: content, verifiedDigest: sha256Bytes(content) };
  }

  redact(ref: ArtifactRef, hookId: string): ArtifactRef | StorageError {
    const hook = this.options.redactionHooks?.get(hookId);
    if (hook === undefined) {
      return storageError('artifact-quarantined', 'redaction hook is not registered', this.state.health, { hookId });
    }
    const resolved = this.resolve(ref.id);
    if (isStorageError(resolved)) {
      return resolved;
    }
    const currentContent = this.readVerifiedBlob(resolved);
    if (currentContent instanceof Error) {
      return storageError('artifact-quarantined', currentContent.message, this.state.health, { id: resolved.id });
    }
    const redacted = this.putAuthoritative(
      {
        content: hook(currentContent, resolved),
        mediaType: resolved.mediaType,
        retentionClass: resolved.retentionClass,
        classification: resolved.classification,
      },
      'redacted',
    );
    if (isStorageError(redacted)) {
      return redacted;
    }

    const tombstone = {
      schema: 'kit-vnext.artifact-tombstone.v1',
      originalId: resolved.id,
      originalDigest: resolved.digest,
      replacementId: redacted.id,
      replacementDigest: redacted.digest,
      hookId,
      createdAt: this.options.clock.now().toISOString(),
    };
    try {
      appendFileSync(this.paths.tombstones, `${JSON.stringify(tombstone)}\n`);
      fsyncFile(this.paths.tombstones, this.options.durabilityObserver);
      fsyncDirectory(dirname(this.paths.tombstones), this.options.durabilityObserver);
      const originalMetadata = this.readMetadata(resolved.id);
      if (originalMetadata instanceof Error || originalMetadata === undefined) {
        return storageError(
          'artifact-quarantined',
          'original metadata disappeared during redaction',
          this.state.health,
          {
            id: resolved.id,
          },
        );
      }
      this.writeMetadata({
        ...withoutMetadataDigest(originalMetadata),
        redactionState: 'tombstoned',
        replacementId: redacted.id,
        replacementDigest: redacted.digest,
      });
    } catch {
      this.state.mark('network-fs-degraded');
      return storageError('artifact-quarantined', 'redaction tombstone could not be committed', this.state.health, {
        id: resolved.id,
      });
    }

    return redacted;
  }

  export(selection: ExportSelection): ExportManifest | StorageError {
    if (!this.state.authoritativeWritesAvailable()) {
      return storageError(
        'export-incomplete-forbidden',
        'exports are unavailable while storage is degraded',
        this.state.health,
      );
    }

    const artifacts = this.resolveExportArtifacts(selection);
    if (artifacts instanceof Error) {
      return storageError('export-incomplete-forbidden', artifacts.message, this.state.health);
    }
    const logs = [...(selection.logIds ?? [])].sort().map((logId): ExportManifestLog => {
      const replay = this.logs.replay(logId);
      const first = replay.records[0]?.sequence;
      const last = replay.records.at(-1)?.sequence;
      return {
        logId,
        health: replay.health,
        ...(first === undefined ? {} : { firstSequence: first }),
        ...(last === undefined ? {} : { lastSequence: last }),
        recordCount: replay.records.length,
      };
    });
    if (logs.some((log) => log.health === 'log-interior-corrupt' || log.health === 'unusable')) {
      return storageError('export-incomplete-forbidden', 'selected log cannot be verified', this.state.health);
    }

    const manifestBase = {
      schema: 'kit-vnext.storage-export.v1' as const,
      createdAt: this.options.clock.now().toISOString(),
      storageHealth: this.state.health,
      logs,
      artifacts,
    };
    const digest = sha256Json(manifestBase);
    const id = `export:sha256:${digest}`;
    const manifest: ExportManifest = { ...manifestBase, id, digest };
    const exportPath = join(this.paths.artifactExports, `${storageKey(id)}.json`);
    if (!existsSync(exportPath)) {
      try {
        writeFileAtomicDurable(
          exportPath,
          `${canonicalJson(manifest)}\n`,
          join(this.paths.artifactExports, `${storageKey(id)}.${this.options.idGenerator.nextId('export')}.tmp`),
          this.options.durabilityObserver,
        );
      } catch {
        this.state.mark('network-fs-degraded');
        return storageError(
          'export-incomplete-forbidden',
          'export manifest could not be committed',
          this.state.health,
          { id },
        );
      }
    }
    return manifest;
  }

  private putAuthoritative(input: ArtifactInput, state: 'raw' | 'redacted'): ArtifactRef | StorageError {
    if (input.mediaType.length === 0 || input.retentionClass.length === 0 || input.classification.length === 0) {
      return storageError(
        'invalid-input',
        'artifact media type, retention class, and classification are required',
        this.state.health,
      );
    }

    const hook =
      input.redactionHookId === undefined ? undefined : this.options.redactionHooks?.get(input.redactionHookId);
    if (input.redactionHookId !== undefined && hook === undefined) {
      return storageError('artifact-quarantined', 'pre-store redaction hook is not registered', this.state.health, {
        hookId: input.redactionHookId,
      });
    }
    const content = hook === undefined ? toBytes(input.content) : hook(toBytes(input.content));
    if (content.byteLength > (this.options.maxArtifactBytes ?? Number.MAX_SAFE_INTEGER)) {
      return storageError('artifact-quarantined', 'artifact exceeds size limit', this.state.health);
    }

    const digest = sha256Bytes(content);
    const id = `artifact:sha256:${digest}`;
    const existing = this.readMetadata(id);
    if (!(existing instanceof Error) && existing !== undefined) {
      return refFromMetadata(existing);
    }

    try {
      this.publishBlob(content, digest);
      return this.writeMetadata({
        schema: 'kit-vnext.artifact-metadata.v1',
        id,
        digest,
        size: content.byteLength,
        mediaType: input.mediaType,
        retentionClass: input.retentionClass,
        classification: input.classification,
        redactionState: state,
        ...(input.producer === undefined ? {} : { producer: input.producer }),
        createdAt: this.options.clock.now().toISOString(),
        ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt.toISOString() }),
      });
    } catch {
      this.state.mark('network-fs-degraded');
      return storageError('artifact-quarantined', 'artifact could not be committed', this.state.health, { id });
    }
  }

  private publishBlob(content: Uint8Array, digest: string): void {
    const destination = blobPath(this.paths, digest);
    mkdirSync(dirname(destination), { recursive: true });
    if (existsSync(destination)) {
      const existing = readFileSync(destination);
      if (sha256Bytes(existing) !== digest) {
        throw new Error('existing blob digest mismatch');
      }
      return;
    }

    const tempPath = join(this.paths.artifactTmp, `${digest}.${this.options.idGenerator.nextId('artifact-blob')}.tmp`);
    writeFileSync(tempPath, content);
    fsyncFile(tempPath, this.options.durabilityObserver);
    renameSync(tempPath, destination);
    fsyncDirectory(dirname(destination), this.options.durabilityObserver);
    try {
      unlinkSync(tempPath);
    } catch {
      // temp was renamed into place
    }
  }

  private readMetadata(id: string): ArtifactMetadata | undefined | Error {
    const path = metadataPath(this.paths, id);
    const text = readTextIfExists(path);
    if (text === undefined) {
      return undefined;
    }
    try {
      const parsed = artifactMetadataSchema.parse(JSON.parse(text));
      if (sha256Json(withoutMetadataDigest(parsed)) !== parsed.recordDigest) {
        return new Error('artifact metadata digest mismatch');
      }
      return parsed;
    } catch (error) {
      return error instanceof Error ? error : new Error('artifact metadata is invalid');
    }
  }

  private writeMetadata(metadata: Omit<ArtifactMetadata, 'recordDigest'>): ArtifactRef {
    const complete = { ...metadata, recordDigest: sha256Json(metadata) };
    const path = metadataPath(this.paths, complete.id);
    const tempPath = join(
      this.paths.artifactMetadata,
      `${storageKey(complete.id)}.${this.options.idGenerator.nextId('metadata')}.tmp`,
    );
    writeFileSync(tempPath, `${JSON.stringify(complete)}\n`);
    fsyncFile(tempPath, this.options.durabilityObserver);
    renameSync(tempPath, path);
    fsyncDirectory(this.paths.artifactMetadata, this.options.durabilityObserver);
    return refFromMetadata(complete);
  }

  private readVerifiedBlob(ref: ArtifactRef): Uint8Array | Error {
    const path = blobPath(this.paths, ref.digest);
    if (!existsSync(path)) {
      return new Error('artifact blob is missing');
    }
    const content = readFileSync(path);
    if (sha256Bytes(content) !== ref.digest || content.byteLength !== ref.size) {
      return new Error('artifact blob failed digest verification');
    }
    return content;
  }

  private resolveExportArtifacts(selection: ExportSelection): readonly ExportManifestArtifact[] | Error {
    const selected = new Map<string, ExportManifestArtifact>();
    for (const id of selection.artifactIds ?? []) {
      if (id.startsWith('scratch:')) {
        return new Error('scratch artifacts cannot be exported');
      }
      const resolved = this.resolve(id);
      if (isStorageError(resolved)) {
        return new Error(`artifact ${id} cannot be resolved`);
      }
      const exportRef =
        resolved.redactionState === 'tombstoned' && selection.includeRawTombstoned !== true
          ? this.resolveReplacement(resolved)
          : resolved;
      if (exportRef instanceof Error) {
        return exportRef;
      }
      const content = this.readVerifiedBlob(exportRef);
      if (content instanceof Error) {
        return content;
      }
      selected.set(exportRef.id, {
        id: exportRef.id,
        digest: exportRef.digest,
        size: exportRef.size,
        mediaType: exportRef.mediaType,
        retentionClass: exportRef.retentionClass,
        classification: exportRef.classification,
        redactionState: exportRef.redactionState === 'tombstoned' ? 'redacted' : exportRef.redactionState,
      });
    }
    return [...selected.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  private resolveReplacement(ref: ArtifactRef): ArtifactRef | Error {
    const metadata = this.readMetadata(ref.id);
    if (metadata instanceof Error || metadata?.replacementId === undefined) {
      return new Error('tombstoned artifact replacement is missing');
    }
    const replacement = this.resolve(metadata.replacementId);
    if (isStorageError(replacement)) {
      return new Error('tombstoned artifact replacement cannot be resolved');
    }
    return replacement;
  }
}

const refFromMetadata = (metadata: ArtifactMetadata): ArtifactRef => ({
  id: metadata.id,
  digest: metadata.digest,
  size: metadata.size,
  mediaType: metadata.mediaType,
  retentionClass: metadata.retentionClass,
  classification: metadata.classification,
  redactionState: metadata.redactionState,
});

const withoutMetadataDigest = (
  metadata: Omit<ArtifactMetadata, 'recordDigest'> | ArtifactMetadata,
): Omit<ArtifactMetadata, 'recordDigest'> => {
  const { recordDigest: _recordDigest, ...rest } = metadata as ArtifactMetadata;
  return rest;
};
