# fnd-02 Storage & Artifacts — typed contract (DRAFT)

> **Status:** DRAFT proposal for Wave-1 task T4. Not a corpus file. Authored read-only from
> `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md` (the fnd-02 deep spec).
> Every type below cites the README section its prose semantics derive from. Where the fnd-02 README
> section 5 already declares a type verbatim, this draft reproduces it unchanged and adds the prose
> citation; where a type is prose-only in the README (sections 4/6/8) it is newly typed here and
> flagged **[newly typed]**.
>
> All section numbers (`§N`) refer to the fnd-02 README unless prefixed otherwise.

---

## A. Primitive enums

```ts
// §5 (declared) + §4 "Event-log persistence" buffered/durable/barrier prose.
// "buffered writes framed bytes and a trailer but does not fsync"; "durable ... fsyncs the log file";
// "barrier first flushes or discards prior buffered bytes ... then fsyncs the log file and directory".
type DurabilityClass = "buffered" | "durable" | "barrier";

// §5 (declared) + §4 "Network filesystem degradation" + §8 "Failure & degraded modes".
// "ok" is the healthy baseline; the rest are the corruption/degrade states the store can report
// through replay/read: tail repaired (§4 tail corruption), interior corrupt (§4 interior corruption),
// network-fs-degraded (§4 network degradation), read-only (§4 interior → "mark read-only"),
// unusable (§4 "flips the root to degraded/unusable health").
type StorageHealth =
  | "ok"
  | "log-tail-repaired"
  | "log-interior-corrupt"
  | "network-fs-degraded"
  | "read-only"
  | "unusable";
```

---

## B. Lease primitive

```ts
// §5 (declared). Returned ONLY from acquire/renew (§4 lease: "acquire and renew return a
// LeaseCapability containing the token secret"). Carries the live token secret.
type LeaseCapability = {
  name: string;
  epoch: number;
  token: string;
  expiresAt: Date;
};

// §5 (declared) + §4 lease: "persisted records and read snapshots expose only tokenDigest" and the
// on-disk record JSON "{ name, epoch, holder, tokenDigest, acquiredAt, expiresAt, recordDigest }".
// The snapshot is the read-time projection of that record MINUS the secret. §6 confirms the snapshot
// surface: "LeaseSnapshot name, holder, epoch, token digest, and expiry".
// NOTE: §6 lists exactly {name, holder, epoch, tokenDigest, expiry}; acquiredAt/recordDigest are
// record-internal and NOT part of the consumer-facing snapshot. See draft note D-1.
type LeaseSnapshot = {
  name: string;
  epoch: number;
  holder: string;
  tokenDigest: string;
  expiresAt: Date;
};
```

---

## C. Event-log persistence

```ts
// §5 (declared) + §4 "openForAppend(logId, leaseCapability) mints an opaque LogHandle bound to lease
// name, epoch, and token". Opaque to callers; carries the binding fnd-02 re-validates on append.
type LogHandle = {
  logId: string;
  leaseName: string;
  epoch: number;
  token: string;
};

// §5 (declared) + §4: "append validates ... validates expectedSequence, writes a framed batch with a
// commit trailer, applies durability". payloads are opaque bytes ("treats core-01 event payloads as
// opaque bytes").
type AppendBatch = {
  expectedSequence: number;
  durability: DurabilityClass;
  payloads: Uint8Array[];
};

// [newly typed] §4: durable/barrier "returns an AppendReceipt"; §6 data-authored: "AppendReceipt
// sequence range, epoch, lease name, byte range, digest, and durability". §7 diagram shows
// AppendReceipt(lastSequence, epoch). Byte range and digests are the physical frame evidence.
type AppendReceipt = {
  firstSequence: number;
  lastSequence: number;
  writerEpoch: number;
  leaseName: string;
  durability: DurabilityClass;
  byteRange: { start: number; end: number };
  payloadDigest: string;
  frameDigest: string;
};

// [newly typed] §4: "buffered ... returns only NonDurableAck. It may disappear after crash". §6:
// "NonDurableAck for non-authoritative buffered writes". Acknowledges acceptance without durability.
type NonDurableAck = {
  acknowledged: true;
  durability: "buffered";
  expectedSequence: number;
};

// [newly typed] §4 frame metadata: "adds physical frame metadata: sequence, writerEpoch, lease name,
// payload length, payload digest, frame digest, and byte range" over opaque payload bytes. §6:
// "StoredRecord frame metadata plus opaque bytes". Yielded by replay.
type StoredRecord = {
  sequence: number;
  writerEpoch: number;
  leaseName: string;
  payloadLength: number;
  payloadDigest: string;
  frameDigest: string;
  byteRange: { start: number; end: number };
  payload: Uint8Array;
};

// §5 (declared). openForAppend / append / replay. append returns the durable receipt OR a
// NonDurableAck (buffered) OR a StorageError. replay yields physical records + current health (§4
// corruption handling drives health).
interface EventLogStore {
  openForAppend(logId: string, lease: LeaseCapability): LogHandle | StorageError;
  append(handle: LogHandle, batch: AppendBatch): AppendReceipt | NonDurableAck | StorageError;
  replay(logId: string): { records: StoredRecord[]; health: StorageHealth };
}
```

---

## D. Lease store

```ts
// §5 (declared) + §4 lease primitive. acquire "increments the monotonic epoch"; renew/release
// "require the current epoch and token"; read returns "{ snapshot?, health }" (snapshot absent when
// no live record); fence(name, epoch, token) "is true only for the current unexpired epoch and
// matching token digest".
interface LeaseStore {
  acquire(name: string, holder: string, ttlMs: number): LeaseCapability | StorageError;
  renew(name: string, epoch: number, token: string, ttlMs: number): LeaseCapability | StorageError;
  release(name: string, epoch: number, token: string): void | StorageError;
  read(name: string): { snapshot?: LeaseSnapshot; health: StorageHealth };
  fence(name: string, epoch: number, token: string): boolean;
}
```

---

## E. Artifact store

```ts
// §5 (declared). id is "the canonical string reference carried by consuming event envelopes" (§4
// artifact store + §6). redactionState includes "tombstoned" because post-store redaction writes a
// tombstone from original→replacement digest (§4) and "tombstoned originals" are denied on normal read.
type ArtifactRef = {
  id: string;
  digest: string;
  size: number;
  mediaType: string;
  retentionClass: string;
  classification: string;
  redactionState: "raw" | "redacted" | "tombstoned";
};

// §5 (declared) + §4 network degradation: "only putScratch may return ScratchArtifactRef, which is
// barred from evidence, export, gates, and retention policy". No retentionClass field (degraded
// output is non-authoritative and policy-exempt); redactionState cannot be "tombstoned".
type ScratchArtifactRef = {
  id: string;
  digest: string;
  size: number;
  mediaType: string;
  classification: string;
  redactionState: "raw" | "redacted";
};

// [newly typed] §4 artifact store: "Writers stream to a temp file, compute digest and size, enforce
// size limits"; "Metadata records media type, size, ... retention class, classification". §10:
// "writes should name retention explicitly". The producing domain supplies content + metadata intent.
type ArtifactInput = {
  content: ReadableStream<Uint8Array> | Uint8Array;
  mediaType: string;
  retentionClass: string;       // §4 "Every write names a retention class"
  classification: string;       // §4 metadata "classification"
  expiry?: Date;                // §4 "optional expiry"
  producer: string;             // §4 metadata "producer"
};

// [newly typed] §5 get(ref, mode) returns ArtifactStream. §4: reads "deny tombstoned originals unless
// raw access is explicitly requested". The stream carries verified bytes plus the resolved ref.
type ArtifactStream = {
  ref: ArtifactRef;
  bytes: ReadableStream<Uint8Array>;
};

// [newly typed] §4 export: "Export creates a write-once, redacted-by-default manifest with stable
// ordering, log health, artifact refs, digests, and sizes". The selection names what to include.
type ExportSelection = {
  artifactIds: string[];
  logRanges?: Array<{ logId: string; fromSequence: number; toSequence: number }>;
  mode?: "redacted" | "raw";    // §4 "redacted-by-default"
};

// [newly typed] §4 export + §6: "ExportManifest stable log ranges and artifact refs with digests and
// redaction mode". §4 "refuses if any selected blob fails digest verification" → see StorageError
// export-incomplete-forbidden.
type ExportManifest = {
  createdAt: Date;
  redactionMode: "redacted" | "raw";
  logHealth: StorageHealth;
  artifacts: Array<{ id: string; digest: string; size: number; redactionState: ArtifactRef["redactionState"] }>;
  logRanges: Array<{ logId: string; fromSequence: number; toSequence: number; frameDigest: string }>;
};

// §5 (declared). put/putScratch/resolve/get/redact/export. resolve(id) maps the opaque id string back
// to a ref (§6: "Consumers resolve those strings through ArtifactStore.resolve(id)"). redact returns a
// NEW ref (§4 post-store redaction "creates a new redacted artifact").
interface ArtifactStore {
  put(input: ArtifactInput): ArtifactRef | StorageError;
  putScratch(input: ArtifactInput): ScratchArtifactRef | StorageError;
  resolve(id: string): ArtifactRef | StorageError;
  get(ref: ArtifactRef, mode: "redacted" | "raw"): ArtifactStream | StorageError;
  redact(ref: ArtifactRef, hookId: string): ArtifactRef | StorageError;
  export(selection: ExportSelection): ExportManifest | StorageError;
}
```

---

## F. Failure tokens

```ts
// [newly typed] §8 "Failure & degraded modes" enumerates the exact tokens; this unionizes them and
// the §4 corruption tokens (log-tail-repaired/log-interior-corrupt) that surface as health AND can be
// returned as errors on append.
type StorageErrorCode =
  | "stale-writer-fenced"          // §8: lease name/epoch/token not current; rejected before write
  | "lease-unavailable"            // §8: lock guarantees not proven
  | "log-tail-repaired"            // §4/§8: incomplete tail quarantined; replay continues
  | "log-interior-corrupt"         // §4/§8: committed history incoherent; append refused
  | "artifact-quarantined"         // §8: digest/redaction/classification/size check failed
  | "export-incomplete-forbidden"  // §8: selected blob/log range cannot be verified
  | "network-fs-degraded";         // §8: authoritative append/lease/evidence/export unavailable

// [newly typed] structural shape for the above; §8 names tokens, not field layout. retryable mirrors
// the §4 degrade semantics (degraded modes "fail closed" / "remain readable").
type StorageError = {
  code: StorageErrorCode;
  message: string;
  health: StorageHealth;
};
```

---

## G. core-06 lease-evidence sub-shape (AC3)

core-06's `RecoveryEvidenceSnapshot.leases` field (recovery-model.md §"Classifier types") is exactly:

```ts
leases: { runWriter?: LeaseSnapshot; storyLaunch?: LeaseSnapshot; leaseHealth: StorageHealth };
```

This consumes **only** `LeaseSnapshot` (§B above) and `StorageHealth` (§A above) from fnd-02 — no
other fnd-02 type. Both `runWriter?` and `storyLaunch?` are optional because a lease may be absent;
`leaseHealth` carries the §4 "missing, stale, or degraded lease guarantees" signal that drives the
`lease-unavailable` recovery state (recovery-model.md rule 3). The `LeaseSnapshot` fields core-06 reads
are `name`, `epoch`, `holder`, `tokenDigest`, `expiresAt` — the full snapshot surface, no more, no
fewer (see AC3 in the proposal).
