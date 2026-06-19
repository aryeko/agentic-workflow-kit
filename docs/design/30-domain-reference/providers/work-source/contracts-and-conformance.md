---
title: "Work Source - contracts and conformance"
status: draft
last-reviewed: 2026-06-19
---

# Contracts and conformance

This file holds the typed contract details and conformance targets for
`docs/design/domains/providers/prov-03-work-source/README.md`. It is split out because the type
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

// Minimal reconciliation shape for a verified status write. writeStatus already accepts
// evidenceRef?: ArtifactRef and note? as inputs (see WorkSource.writeStatus); this result reports
// only the verified post-write facts. It deliberately adds no audit-citation field — see Q2 below.
type StatusWriteResult = {
  written: boolean;
  updatedRecordDigest: string;
  evidenceRef?: ArtifactRef;
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
    evidenceRef?: ArtifactRef; note?: string }): StatusWriteResult | WorkSourceError;
}
```

Capabilities are attested by `probeCapabilities`, not declarations: `supportsTracks` enumerates Tracks
and detects malformed Track files; `supportsClaim` acquires a Track lease, performs digest-checked
claim, and rejects stale writes; `supportsStatusWrite` writes and verifies status under the same
precondition model; `supportsDependencies` parses simple `TaskKey` dependencies and excludes
incomplete dependencies.

`CapabilityAttestation` is the shared attestation type owned by the conformance kit and shared
contract types (w2-1); it is referenced here, not redefined. As in the rest of the providers layer,
consumers qualify attestations by provider so a `WorkSourceCapability` is never confused with a
same-named capability from another seam.

`ArtifactRef` is the fnd-02 artifact reference, defined in
`../../foundation/fnd-02-storage-and-artifacts/README.md`. It is used here for `ClaimResult.snapshotRef`
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

## Open questions

Q2 (FR-11 two-authorities boundary) is a genuine design decision and is **not** resolved by this
contract. It is recorded here verbatim and `StatusWriteResult` is defined without a new audit-citation
field pending its resolution.

> **Q2 (blocking, FR-11 boundary).** The spec says `writeStatus` "may cite a run id and snapshot ref
> for audit." Pin whether prov-03 writes that citation into the task record (and the exact
> field/format) or the control plane records it as a run event — this touches the two-authorities
> boundary.

The two options under decision are:

- **Option A — Work Source records the citation.** prov-03 writes the run id and snapshot ref into the
  Task record as Task metadata; this would require a typed audit-citation field on the status-write
  input and/or `StatusWriteResult` (field name and format to be defined).
- **Option B — Control plane records the citation.** prov-03 writes only the status (with optional
  `evidenceRef`/`note` it already accepts), and the Control plane records the run id and snapshot ref
  as a run event in the Event log; `StatusWriteResult` stays as defined above with no audit-citation
  field.

Status: **pending design-owner decision — blocking for prov-03 dispatch.**
