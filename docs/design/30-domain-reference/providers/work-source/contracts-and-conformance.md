---
title: "Work Source - contracts and conformance"
status: draft
last-reviewed: 2026-06-19
---

# Contracts and conformance

This file holds the typed contract details and conformance targets for
`design/30-domain-reference/providers/work-source/README.md`. It is split out because the type
catalog and driver conformance matrix are cohesive detail. It transcribes the contract that lives in
the README (§4 task model, §5 interface + types, §8 failure tokens, §9 testing) into a single typed
form and defines the three types the README references but does not yet declare: `TrackView`,
`StatusWriteResult`, and `WorkSourceError`.

## Contract types

```ts
type StatusBucket = "eligible" | "inProgress" | "complete" | "blocked" | "unknown";
// Source-owned, deterministic native-label -> bucket mapping. "unknown" is never a target bucket:
// labels with no mapping resolve to "unknown" implicitly (see status-bucket-unknown).
type StatusBuckets = Record<Exclude<StatusBucket, "unknown">, string[]>;

type WorkSourceCapability =
  | "supportsTracks" | "supportsClaim" | "supportsStatusWrite" | "supportsDependencies";

interface WorkSourceProbeScope {
  driverId: string;
  driverVersion: string;
  platform: string;
  sourceKind: "markdown" | "mock";
  freshnessKey: string;
  capabilities: WorkSourceCapability[];
  trackIds?: string[];
  at: string;
}

type TaskKey = { workSourceId: string; trackId: string; taskId: string };
type SpecRef = { kind: "path" | "url"; ref: string; label?: string; declaredDigest?: string };
type TaskStatus = { native: string; bucket: StatusBucket };
type Claim = { runId: string; holder: string; claimedAt: string; expiresAt: string; epoch: number };
type TaskView = {
  key: TaskKey; title: string; status: TaskStatus; target: { project: string };
  spec: { inline?: string; refs: SpecRef[] }; dependencies: TaskKey[]; claim?: Claim;
  sourceRecordDigest: string;
};

// Track-level inventory returned by listTracks. Mirrors the per-Track shape proven by the markdown
// and mock fixtures: one workSourceId + trackId, the source-owned statusBuckets mapping, the Track's
// member task keys, and the source record digest used as the locking precondition for the Track.
type TrackView = {
  trackId: string;
  workSourceId: string;
  statusBuckets: StatusBuckets;
  taskKeys: TaskKey[];
  sourceRecordDigest: string;
};

type TaskSnapshot = {
  task: TaskView; sourcePath: string; sourceRevision: string;
  sourceBytesDigest: string; inlineSpecDigest?: string; rawExcerptDigest: string; createdAt: string;
};

type ClaimResult = { task: TaskView; snapshotRef: ArtifactRef; snapshotDigest: string };

// Audit citation written as task metadata alongside a status update (AD-17, Option A).
// This is NOT run truth; the run event log remains the authority for run activity.
type AuditCitation = {
  runId: string;
  taskSnapshotRef: string;       // ArtifactRef.id — opaque; the artifact store resolves it
  statusEvidenceRef?: string;    // ArtifactRef.id
};

// Reconciliation shape for a verified status write. writeStatus accepts evidenceRef?: ArtifactRef
// and note? as inputs (see WorkSource.writeStatus); this result reports the verified post-write
// facts and carries the audit citation written as task metadata (AD-17).
type StatusWriteResult = {
  written: boolean;
  updatedRecordDigest: string;
  evidenceRef?: ArtifactRef;
  auditCitation?: AuditCitation;
  at: string;
};

// Discriminated union covering every failure token in README §8 (verbatim tokens as `kind`).
type WorkSourceError =
  | { kind: "work-source-unavailable"; message: string; sourceRef?: string }
  | { kind: "track-malformed"; trackId: string; diagnostic: string }
  | { kind: "dependency-unresolved"; task: TaskKey; dependency: TaskKey;
      reason: "missing" | "malformed" | "blocked" | "unknown" | "incomplete" }
  | { kind: "status-bucket-unknown"; task: TaskKey; nativeStatus: string }
  | { kind: "claim-conflict"; task: TaskKey; expectedRecordDigest: string; observedRecordDigest: string;
      expectedEpoch?: number; observedEpoch?: number }
  | { kind: "claim-lock-unavailable"; task: TaskKey; leaseKey: string; priorClaim?: Claim }
  | { kind: "snapshot-artifact-unavailable"; task: TaskKey; diagnostic: string }
  | { kind: "status-write-unavailable"; task: TaskKey; diagnostic: string }
  | { kind: "status-authority-conflict"; task: TaskKey; expectedRecordDigest?: string;
      observedRecordDigest: string };

interface WorkSource {
  probeCapabilities(scope: WorkSourceProbeScope): CapabilityAttestation[];
  listTracks(): TrackView[] | WorkSourceError;
  listTasks(trackId: string): TaskView[] | WorkSourceError;
  nextEligible(input: { trackIds?: string[]; targetProject?: string }): TaskView | null | WorkSourceError;
  claim(input: { task: TaskKey; runId: string; holder: string; ttlMs: number;
    expectedRecordDigest: string; sourceRevision: string }): ClaimResult | WorkSourceError;
  release(input: { task: TaskKey; runId: string; reason: string; expectedEpoch: number }): void | WorkSourceError;
  writeStatus(input: { task: TaskKey; status: TaskStatus; expectedRecordDigest: string;
    evidenceRef?: ArtifactRef; note?: string;
    auditCitation?: AuditCitation }): StatusWriteResult | WorkSourceError;
}
```

Capabilities are attested by `probeCapabilities`, not declarations: `supportsTracks` enumerates Tracks
and detects malformed Track files; `supportsClaim` acquires a Track lease, performs digest-checked
claim, and rejects stale writes; `supportsStatusWrite` writes and verifies status under the same
precondition model; `supportsDependencies` parses simple `TaskKey` dependencies and excludes
incomplete dependencies.

`CapabilityAttestation` is the shared attestation type owned by the **SDK** (AD-16); it is
referenced here, not redefined. Testkit imports and validates the SDK type; it does not own or
redefine it. As in the rest of the providers layer, consumers qualify attestations by provider so a
`WorkSourceCapability` is never confused with a same-named capability from another seam.

`ArtifactRef` is the fnd-02 artifact reference, defined in
`../../foundation/storage-and-artifacts/README.md`. It is used here for `ClaimResult.snapshotRef`
(the `TaskSnapshot` write-once artifact) and for the `evidenceRef?` carried into and out of
`writeStatus`. `TaskSnapshot` is produced at claim time and stored as a write-once artifact through
fnd-02; Work Source does not gather local git state, so the caller passes `sourceRevision` and it is
preserved verbatim in the snapshot.

## Consumed Foundation dependencies

Consumed Foundation contract: fnd-02 `LeaseStore` for fenced Track mutation
(`work-source:<workSourceId>:<trackId>`) and `ArtifactStore` for the `TaskSnapshot`, parse
diagnostics, and probe evidence. This design introduces no dependency on the Control plane or concrete
consumers. Work Source is authoritative for Task status, claim metadata, Track membership, and
source-native dependency state; the Event log is authoritative for Run activity, and the two
authorities never cross-write.

## Capability set

| Capability | Positive evidence | Negative / absent evidence |
|---|---|---|
| `supportsTracks` | Enumerates Tracks and surfaces a deterministic diagnostic for malformed Track files. | A Track that cannot be parsed returns `track-malformed`; an unreadable source returns `work-source-unavailable`. |
| `supportsClaim` | Acquires the Track lease, performs a digest-checked claim, and rejects stale writes. | A degraded or unavailable fnd-02 lease returns `claim-lock-unavailable` and the capability is treated as absent; unattended task intake is disabled. |
| `supportsStatusWrite` | Writes and verifies status under the digest precondition. | An unverifiable status write returns `status-write-unavailable` and the capability is absent; the run may settle in the Event log but the Task must not be marked complete. |
| `supportsDependencies` | Parses simple `TaskKey` dependencies and excludes incomplete dependencies from eligibility. | When absent, dependent Tasks are not considered eligible; an unresolved dependency returns `dependency-unresolved`. |

Capability gates treat stale, absent, or negative Work Source attestations as capability absent.

## Conformance targets

Markdown (real) driver conformance:

- Enumerates Tracks from one `kit-work-source` block per tracker file and Tasks from each `kit-task`
  block, returning stable `TaskKey` identity across rereads.
- Maps each native status through the Track's deterministic `statusBuckets`; an unmapped label resolves
  to `unknown`, makes the Task ineligible, and produces `status-bucket-unknown`.
- Gates eligibility on simple `TaskKey` dependencies; a missing, malformed, blocked, unknown, or
  incomplete dependency returns `dependency-unresolved` and the dependent Task is ineligible.
- Acquires the fnd-02 Track lease, rereads the file, compares source and record digests, edits only the
  Task YAML block, fsyncs, rereads, and verifies the post-write digest; a changed precondition returns
  `claim-conflict` (claim/release) or `status-authority-conflict` (status write).
- Produces a `TaskSnapshot` write-once artifact at claim time and refuses the claim with
  `snapshot-artifact-unavailable` when the artifact cannot be stored.
- Honors claim expiry; replacing an expired claim requires the Track lease and returns a diagnostic
  naming the prior claim.
- Attests each capability only from a successful probe, qualified by driver version, platform, and
  freshness key.

Mock driver conformance:

- Implements the same interfaces against an in-memory or fixture-provided backlog of Tracks and Tasks
  with deterministic outputs.
- Emits positive and negative attestations for every capability.
- Injects the same failure points as the Markdown driver — concurrent claim races, stale TaskViews,
  omitted signals, delayed writes, and false (lied-about) status writes — so the Control plane and the
  Capability & Safety gates prove fail-closed behavior, each yielding a named `WorkSourceError`.

## Resolved decisions

**Q2 (FR-11 two-authorities boundary) — RESOLVED to Option A (AD-17).**

`writeStatus` MAY accept an `auditCitation` on input and the Work Source writes it as **task
metadata** alongside the status update. `StatusWriteResult` carries the `auditCitation?` field to
confirm what was written. This citation (run id + task snapshot ref + optional status-evidence ref)
is task metadata only — it is **not run truth**. The run event log (AD-6) remains the sole authority
for run activity. The two-authorities boundary is preserved: task status and task-level audit citation
live in the Work Source; run events live in the event log, and neither cross-writes the other.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Work Source](./README.md) · **← Prev:** [Work Source](./README.md) · **Next →:** [Execution Host](../execution-host/README.md)

<!-- /DOCS-NAV -->
