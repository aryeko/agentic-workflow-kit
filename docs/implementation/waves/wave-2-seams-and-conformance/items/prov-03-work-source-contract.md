---
title: "prov-03 — Work Source contract + mock — implementation charter"
id: "prov-03-contract"
wave: 2
layer: "contracts (providers)"
status: "item: blocked-on-spec"
spec: "docs/design/domains/providers/prov-03-work-source/ (README.md + evidence/)"
---

# prov-03 — Work Source contract + mock

**Purpose.** The seam for *where work comes from* and the **task status authority** (AD-8): task/track
inventory, eligibility, race-safe claim/release, status writes — plus a mock work source. Contract +
mock only; the real Markdown driver is the driver track. (FR-1, FR-11.)

**Spec (normative).** Implement the contract + capability set from
`docs/design/domains/providers/prov-03-work-source/`. The task/track model, eligibility, claim/release
semantics, and status-authority writes are normative. Ambiguous → STOP and surface.

> **BLOCKED on spec reconciliation** — prov-03 has **no `contracts-and-conformance.md`**; `TrackView`,
> `StatusWriteResult`, and `WorkSourceError` are used but never defined. ACs cover the defined surface;
> shape-dependent ACs are deferred until the spec types them (R4). Do not invent shapes.

## Spec surface (manifest)

- **`WorkSource`** — `probeCapabilities`, `listTracks`, `listTasks`, `nextEligible`, `claim`, `release`,
  `writeStatus`.
- **Defined types** — `TaskView` (incl. `status: TaskStatus`, `sourceRecordDigest`, `dependencies`,
  `claim?`), `TaskKey`, `TaskStatus` (`{ native, bucket }`), `StatusBucket`
  (`eligible|inProgress|complete|blocked|unknown`), `Claim` (incl. `epoch`, `expiresAt`), `SpecRef`,
  `TaskSnapshot`, `ClaimResult` (`{ task, snapshotRef: ArtifactRef, snapshotDigest }`).
- **Capability set** — `supportsTracks`, `supportsClaim`, `supportsStatusWrite`, `supportsDependencies`.
  Attestation = w2-1 `CapabilityAttestation`.
- **Failure tokens (owned here, §8)** — `work-source-unavailable`, `track-malformed`,
  `dependency-unresolved`, `status-bucket-unknown`, `claim-conflict`, `claim-lock-unavailable`,
  `snapshot-artifact-unavailable`, `status-write-unavailable`, `status-authority-conflict`.
- **UNDEFINED (blocking):** `TrackView` (return of `listTracks`), `StatusWriteResult` (return of
  `writeStatus`), `WorkSourceError` (error branch of every method).

## Responsibilities (in scope)

- The Work Source contract + capability set + race-safe claim/release + status-write authority.
- A **mock work source** with adversarial cases (claim race, stale status, eligibility flip, malformed
  track, degraded fnd-02 lease/artifact) + conformance cases.

## Out of scope

The real Markdown driver + fixtures→executable (driver track); run-activity authority (the event log,
core-01 — keep the two authorities separate per FR-11); cross-project routing (out of v1).

## Requirements owned

FR-1 (task intake) and FR-11 (two authorities separated); NFR-EXT, NFR-TEST; **plus full prov-03
contract spec compliance.**

## Dependencies & frozen contracts

Depends on `fnd-02` (lease + artifact store for claim/snapshot; `ArtifactRef` cited verbatim), `w2-1`.
Consumed by core-06 and the launch/task-snapshot path of core-01. Must NOT depend on core/edge/drivers/SDK.

## Libraries

`zod`, `conformance-kit`, `fast-check`. **No real Markdown driver, no FS-format coupling** (driver track).

## Acceptance criteria (the shared rubric — defined surface only)

- **AC-1** `listTasks` returns `TaskView[]` whose every `status.bucket` is one of the five `StatusBucket`
  literals; a native status with no `statusBuckets` mapping → `bucket: "unknown"`, and that task is
  excluded from `nextEligible`. — *README §4 (`status-bucket-unknown`).*
- **AC-2** `nextEligible` returns `null` (not an error) when nothing is eligible; it returns a task only
  when `status.bucket === "eligible"` and every dependency is `complete`. — *README §4 (dependency gating).*
- **AC-3** `claim` takes `expectedRecordDigest`; if the record changed since `listTasks`, it returns
  `claim-conflict` and does not claim. — *README §4 (digest compare).*
- **AC-4 (race-safe, property)** under concurrent `claim` on one task, **exactly one** caller gets a
  `ClaimResult`; all others get `claim-conflict` or `claim-lock-unavailable`; the task never carries two
  active claims. — *README §4; evidence (concurrent claim race).*
- **AC-5** `ClaimResult.snapshotRef` points to a `TaskSnapshot` write-once artifact (fnd-02) with `task`,
  `sourcePath`, `sourceRevision`, `sourceBytesDigest`, `rawExcerptDigest`, `createdAt`; caller-supplied
  `sourceRevision` is preserved verbatim (the Work Source does not gather git state). — *README §4.*
- **AC-6** `release` frees the claim when `expectedEpoch` matches `Claim.epoch` (task re-eligible after);
  a stale epoch returns `claim-conflict` and leaves the claim. — *README §4/§8.*
- **AC-7 (two authorities, FR-11/AD-8)** `writeStatus` is the **sole** task-status authority and **never
  appends to the run event log**; a spy asserts no event-log append on any `WorkSource` method. — *README §4; architecture.md §5; AD-8.*
- **AC-8** `writeStatus` with a stale/absent `expectedRecordDigest` returns `status-authority-conflict`
  and leaves status unchanged. — *README §8.*
- **AC-9** `probeCapabilities` returns a `CapabilityAttestation[]` for all four capabilities; a negative
  `supportsClaim` makes the claim path treated as incapable (intake disabled), not degraded. — *README §5; architecture.md §3.*
- **AC-10** a degraded fnd-02 lease during `claim` → `claim-lock-unavailable` + negative `supportsClaim`;
  an fnd-02 artifact-store failure during `claim` → `snapshot-artifact-unavailable` and the claim is
  refused (no partial claim persisted). — *README §8.*
- **AC-11 (deferred — blocked)** the schemas for `listTracks` → `TrackView[]`, `writeStatus` →
  `StatusWriteResult`, and the `WorkSourceError` union validate via Zod/JSON-Schema. *Cannot be finalized
  until these types are defined in the spec (Open questions Q1).*

## Failure & degraded outcomes (first-class)

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `claim-conflict` | record/epoch precondition changed before mutation | claim/release not applied; task unchanged | AC-3, AC-6 |
| `claim-lock-unavailable` | fnd-02 lease unavailable / expired-claim replace without lease | claim refused; `supportsClaim` negative | AC-4, AC-10 |
| `snapshot-artifact-unavailable` | fnd-02 artifact write fails during claim | claim refused; no partial claim | AC-10 |
| `status-authority-conflict` | `writeStatus` without a current matching digest | write rejected; status unchanged | AC-8 |
| `status-bucket-unknown` | native status unmapped/ambiguous | `bucket: "unknown"`; task ineligible | AC-1 |
| `dependency-unresolved` | dependency missing/blocked/unknown/incomplete | task ineligible; `nextEligible` skips | AC-2 |
| `track-malformed` | deterministic parse fails (bad YAML, dup ids) | track/task ineligible + diagnostic; other tracks unaffected | AC-1 (malformed fixture) |
| `work-source-unavailable` | source root/track file unreadable | intake fails closed; no partial result | AC-1 |
| `status-write-unavailable` | status write unverifiable after mutation | `supportsStatusWrite` negative; caller must not mark complete | AC-9 |
| `stale-status` / `eligibility-flip` (adversarial) | view stale / status changed between `nextEligible` and `claim` | subsequent `claim` detects digest mismatch → `claim-conflict`; never double-claimed | AC-3, AC-4 |

## Quality bar

- Coverage ≥ 90% lines/branches (aim 95%), enforced by
  `vitest run --coverage --coverage.thresholds.lines=90 --coverage.thresholds.branches=90` (paste it).
- Required tests (catalogue): bucket mapping incl. unknown (AC-1); dependency gating + `null` (AC-2);
  stale-digest claim (AC-3); the concurrent-claim single-winner **property** (AC-4); snapshot fields +
  `sourceRevision` passthrough (AC-5); release correct/stale epoch (AC-6); the no-event-log-append spy
  (AC-7); stale-digest writeStatus (AC-8); capability positive/negative (AC-9); degraded lease + artifact
  (AC-10).
- File ≤ 800 lines; clock/id injected; no SDK / FS-format coupling.

## Required reading

This domain's spec (`README.md` + `evidence/`); `decisions.md` AD-8; `architecture.md` §5 (two
authorities); `dependency-policy.md`; `testing-policy.md`; `fnd-02`'s `ArtifactRef` + lease; `w2-1`.
Nothing else.

## Deliverable

The Work Source contract package + mock, passing the conformance kit; race-safe claim provable on the
mock; the evidence pack (test-per-AC, coverage). **Plus** the typed `TrackView` / `StatusWriteResult` /
`WorkSourceError` once the spec is amended.

## Boundaries

Contract + mock only; do not bake in the Markdown file format (that's the driver). If the
status-authority vs event-log boundary is ambiguous, **STOP and surface**.

## Open questions / spec reconciliation required (blocking — close before dispatch)

- **Q1 (blocking).** prov-03 has **no `contracts-and-conformance.md`**. Add one that defines `TrackView`,
  `StatusWriteResult`, and the `WorkSourceError` discriminated union (with its variant set).
- **Q2 (blocking, FR-11 boundary).** The spec says `writeStatus` "may cite a run id and snapshot ref for
  audit." Pin whether prov-03 writes that citation into the task record (and the exact field/format) or
  the control plane records it as a run event — this touches the two-authorities boundary.
- **Q3.** `CapabilityAttestation` freshness/expiry re-probe mechanics are a core-02 concern; confirm the
  mock only simulates expiry, it does not own re-probe.
