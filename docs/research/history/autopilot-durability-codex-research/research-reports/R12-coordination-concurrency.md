# R12 - Distributed Coordination and Concurrency

## Executive Recommendation

Adopt a fenced lease model with explicit resource identities: one leased writer per run, one per-story launch lease across the repo, tracker-row claims as the work authority, and lease epochs on every state-writing event. Confidence: medium-high for local multi-process orchestration; lower for network filesystems and multi-host use without an external coordinator.

## Sources Checked

- Local: `docs/autopilot-durability-codex-research/README.md`, checked 2026-06-18, defines this lane's required report shape and research scope.
- Local: `docs/autopilot-durability/design/00-overview.md`, checked 2026-06-18, defines the vNext spine: event-sourced run state, single leased writer, writer identity, sequence numbers, and stale-writer fencing.
- Local: `docs/autopilot-durability/design/04-run-state-and-recovery.md`, checked 2026-06-18, defines duplicate-launch clearing, in-band recovery, single tracker authority, and no manual artifact edits.
- Local: `references/tracker-contract.md`, checked 2026-06-18, states the current tracker is the source of truth and row claims are serialized with a local lock.
- Local: `packages/orchestrator/src/tracks/trackerClaimer.ts`, checked 2026-06-18, current claim lock uses `wx` creation, PID metadata, stale reclaim, and reclaim intent serialization.
- Local: `packages/orchestrator/src/runner/DuplicateLaunchGuard.ts`, checked 2026-06-18, current duplicate-launch guard scans active in-memory children and prior launch artifacts.
- Local: `packages/orchestrator/src/runner/RunJournal.ts` and `packages/orchestrator/src/artifacts/FileArtifactStore.ts`, checked 2026-06-18, current run artifacts are independently written JSON files plus append-only events without cross-process writer fencing.
- SQLite: [Isolation In SQLite](https://sqlite.org/isolation.html), page last updated 2022-04-18, checked 2026-06-18. SQLite provides serializable transactions by serializing writes; only one writer can commit at a time.
- SQLite: [Write-Ahead Logging](https://sqlite.org/wal.html), checked 2026-06-18. WAL permits concurrent readers and one writer, but it requires same-host shared memory and does not work over network filesystems.
- Node.js: [File system API, v26.3.1](https://nodejs.org/api/fs.html), checked 2026-06-18. `O_EXCL`/`'x'` fails if the path exists, but Node documents network filesystem caveats.
- Node.js: [SQLite API, v26.3.1](https://nodejs.org/api/sqlite.html), checked 2026-06-18. `node:sqlite` exists as a release-candidate built-in module and supports file-backed databases plus a busy timeout.
- Kubernetes: [Lease API reference](https://kubernetes.io/docs/reference/kubernetes-api/coordination/lease-v1/), checked 2026-06-18. Lease fields provide a useful coordination shape: holder identity, acquire time, renew time, duration, and transition count.
- Kubernetes: [Leases concept](https://kubernetes.io/docs/concepts/architecture/leases/), checked 2026-06-18. Kubernetes uses Lease objects for leader election and coordination among multiple component instances.
- Git: [api-lockfile](https://git-scm.com/docs/api-lockfile), checked 2026-06-18. Git's lockfile API uses `O_CREAT|O_EXCL`, writes to a lockfile, then atomically renames to commit while readers see old or new content.
- Git: [git-update-ref](https://git-scm.com/docs/git-update-ref), checked 2026-06-18. Git reference transactions verify expected old values, lock refs, and either commit or abort queued updates.
- proper-lockfile: [README](https://github.com/moxystudio/node-proper-lockfile), checked 2026-06-18. Used as ecosystem evidence for mkdir-plus-mtime stale locks and for documented compromised-lock caveats.

## Findings

The draft vNext design already has the right invariants: event logs are the authored run state, projections derive `state`/`summary`/`metrics`/`launch`, and a single leased writer appends events with monotonic `seq`, `writerId`, and lease epoch. R12 should make those invariants concrete across run launch, child launch, tracker claim, stale recovery, and concurrent writer rejection.

The current implementation is partially coordinated but not fenced end-to-end. Tracker row claims are serialized with a local lock and verified by re-reading the tracker row. Duplicate-launch detection scans in-memory active children plus launch JSON artifacts. Run events are appended through an in-process queue, which protects one Node process but does not reject another process writing the same run concurrently. `state.json`, `summary.json`, `metrics.live.json`, launch JSON, and child results are still authored files rather than projections.

SQLite is a strong fit for a local coordination ledger because it gives cross-process transactions, serializable isolation, one writer at a time, and readers that only see committed state. WAL mode improves read/write concurrency on a single host, but it is not a network-filesystem solution. Node now exposes a built-in `node:sqlite` module, but in v26.3.1 it is still marked release candidate, so depending on it is a product/version decision rather than a universally safe default.

Filesystem locks can work for local coordination when built carefully, and the repo already uses them. The standard pattern is exclusive create, write metadata, and rename for atomic replacement. The weak points are stale locks, manual removal, mismatched stale thresholds, network filesystems, PID reuse, and processes that can no longer renew but are still doing useful work. Node specifically warns that exclusive create may not work on network filesystems. A filesystem backend must therefore fail closed on ambiguous stale state.

Leases are the right conceptual model, not bare locks. A bare lock says "someone holds this"; a lease says "this holder may act until `renewTime + leaseDuration`, under epoch N." Kubernetes Lease fields map well to this problem: holder identity, acquire time, renew time, duration, and transition count. Workflow-kit also needs fencing: a stale holder may still wake up, so writes must be rejected when the holder's epoch is no longer current.

Tracker authority and run-state authority are different and should remain different. The tracker decides story eligibility, ownership, and completion status. The run event log decides what the autopilot did, what child is active, whether a run is terminal, and why recovery is allowed or blocked. Coordination leases are admission control and fencing, not completion authority.

## Options

Option A: Filesystem lease backend using lock directories or `wx` lock files.

This is closest to the current implementation. It can reuse the existing tracker-claimer approach: owner metadata, random token, process identity, created/renewed timestamps, stale threshold, and serialized stale reclaim. It avoids new runtime dependencies and works with the package's current TypeScript/Node distribution. It cannot provide strong guarantees on network filesystems, cannot rely on PID checks across hosts, and needs careful fencing in event append code to prevent a stale writer from appending after another process has recovered the run.

Option B: SQLite coordination ledger under `.workflow/run-state/coordination.sqlite`.

This gives durable transactions for leases, launch reservations, writer epochs, and concurrency slots. It can enforce unique active leases with constraints, run CAS-style updates in `BEGIN IMMEDIATE` transactions, and atomically allocate sequence/epoch numbers. It still needs tracker file locks for markdown row mutation, and it should not make SQLite the source of truth for story completion. It cannot be treated as safe on network filesystems, and `node:sqlite` is release candidate in current Node docs, so workflow-kit must either gate this backend by capability probe or add a stable dependency.

Option C: External coordinator such as GitHub, Kubernetes Lease, Redis, Postgres, or etcd.

This is strongest for real multi-host distributed orchestration. It enables true compare-and-swap, server-side leases, and shared concurrency limits. It is too heavy for the default OSS local plugin because it introduces setup, credentials, availability, and policy questions. It should remain a future backend for hosted/remote runners, not the default local answer.

## Recommendation

Implement a coordinator abstraction with a local default backend and strict lease semantics. The first production backend can be filesystem-based if dependency minimization wins, but the model should be designed so a SQLite backend can replace it without changing run semantics.

The model should define these resources:

- `repo-scheduler`: optional repo-wide scheduler lease for `run-eligible` admission and global concurrent-run coordination.
- `run-writer:<runId>`: exactly one event writer for a run, with `writerId`, `leaseEpoch`, `seqNext`, `renewedAt`, and `terminalFencedAt`.
- `story-launch:<storyId>`: exactly one active child launch reservation across all runs, with expected branch, expected worktree, owning run, launch id, child pid/session linkage if known, and lease epoch.
- `concurrency-slot:<scope>:<slot>`: bounded leases for repo-wide or track-wide child limits when policy needs more than per-run `maxParallel`.
- `tracker-file:<path>`: short critical-section lock only for markdown read-modify-write, not for long child execution.

Use this acquisition order for child launch:

1. Acquire or renew `run-writer:<runId>`. If another live writer owns it, fail closed.
2. Acquire `story-launch:<storyId>` with a new lease epoch. If an active non-stale lease exists, block as duplicate active child.
3. Under the tracker file lock, re-read the row, verify eligibility and owner, write the tracker claim, and re-read to verify.
4. Append `story-claimed` and `child-launch-reserved` through the run writer. The append call must verify the writer lease epoch immediately before writing and stamp `{writerId, leaseEpoch, seq}`.
5. Spawn the child. Append `child-spawned` with pid/process-group/session linkage as soon as available.
6. Renew the story launch lease from real child progress and supervisor heartbeat. Progress updates may update a lease projection, but important state transitions must be events.
7. On child terminal, append `child-terminal`, release the story launch lease, then update tracker status through the tracker lock only after independent completion gates pass.

Every append must be fenced. The event append API should require `expectedWriterId`, `expectedLeaseEpoch`, and `expectedNextSeq`; it should reject if the run is terminal, the lease epoch has changed, or the contiguous sequence prefix does not match. A stale supervisor that wakes after recovery can then fail to append rather than rewriting recovered state.

Recovery should be a lease transition, not lock deletion. A process may reclaim `run-writer` or `story-launch` only after evidence says the prior holder is stale. Evidence should include lease expiry, no recent event-log progress, no owned live child or an owned child that has been terminated and reaped, and tracker row state. If evidence is incomplete, recovery emits a blocked event or parks for operator action. Reclaim increments the lease epoch and appends a `lease-reclaimed` or `stale-launch-cleared` event before launching anything new.

The tracker remains authoritative for claim and completion. A story launch lease without a matching tracker claim is only a stale reservation candidate. A tracker claim without a live launch lease is an in-band recovery case. A child result without tracker completion is evidence, not authority. Completion should update the tracker only after the completion gate verifies worktree diff, tests, PR/CI/review state, and no conflicting owner.

## Tradeoffs and Risks

Adding a coordination abstraction increases implementation complexity, but it removes a larger class of recovery bugs: duplicate launches, stale-supervisor writes, conflicting active children, and manual artifact repair.

Filesystem leases are dependency-light but operationally weaker. They require conservative stale thresholds, renewal timers, owner metadata, reclaim serialization, and fail-closed handling for network filesystems, PID ambiguity, and compromised locks.

SQLite gives cleaner cross-process CAS and uniqueness constraints, but introduces backend/version decisions. `node:sqlite` is a release candidate in Node v26.3.1; using it by default may be premature for a package that supports Node 24+. Adding a separate SQLite package would add native/build or supply-chain surface unless carefully selected.

Long-lived leases can falsely expire during machine sleep, long GC pauses, overloaded disks, or suspended processes. Expiry must not by itself authorize duplicate launch. It should only authorize a recovery classification step.

Tracker markdown and coordination state cannot be updated in one universal transaction. The system must tolerate partial progress: lease acquired but tracker unclaimed, tracker claimed but launch not spawned, child spawned but session linkage missing, terminal child but release failed. These become named recovery states with deterministic repair.

Repo-wide concurrency slots may surprise users running multiple CLI sessions intentionally. The config should distinguish per-run `maxParallel` from repo-wide `maxActiveChildren`, and the default should fail closed only for same-story/branch/worktree conflicts. Broader repo-wide limits should be explicit policy.

## Fallback and Degraded Modes

If the preferred coordinator backend cannot acquire a reliable lease, disable new launches and return a typed `coordination_unavailable` blocker with the contested resource and holder metadata.

If the filesystem appears to be a network mount or lock behavior fails a startup probe, force `maxParallel=1`, disable auto-recovery/relaunch, and require operator confirmation for stale-lease clearing. Do not rely on `O_EXCL` or PID checks as a multi-host guarantee.

If a stale lease has expired but the prior child may still be alive or unowned, enter observe-only recovery. Do not relaunch. Surface the prior holder, launch id, expected branch/worktree, last event, last heartbeat, and recommended manual action.

If a tracker row and story-launch lease disagree, prefer the tracker for story ownership and block launch until reconciliation. Examples: if tracker owner is another owner, do not claim; if tracker owner is this run but lease is missing, classify as `claim-without-launch`; if lease exists but tracker is unowned, classify as `orphan-launch-reservation`.

If the run writer lease is superseded, a stale writer must stop after its next rejected append. It should not attempt to reacquire automatically unless it enters the formal recovery path and can prove no newer writer is active.

If no coordination backend is available at all, retain current tracker file locking for single-story interactive flows, but disable `run-eligible` multi-child launch and any automatic stale launch clearing.

## Validation Spikes

Build a deterministic fake coordinator and run property tests for lease acquisition, renewal, expiry, epoch changes, stale writer rejection, terminal fencing, and concurrent appends.

Stress test 20 parallel Node processes racing to claim the same story. Expected result: one tracker claim, one story-launch lease, one `child-launch-reserved` event, and all losers return typed duplicate/claim-blocked results.

Stress test parallel claims for different stories in the same tracker. Expected result: all eligible rows may be claimed up to configured concurrency, no row overwrites another, and the tracker remains parseable.

Simulate stale writer wake-up: writer A appends events, writer B reclaims after A is stale and appends terminal recovery, then A tries to append. Expected result: A's write is rejected by epoch/terminal fencing.

Crash at every step in the launch sequence: after story lease, after tracker claim, after launch reservation, after spawn, after session linkage, after child terminal, and after tracker completion. Expected result: each state is classifiable and either auto-recoverable or operator-required without manual file edits.

Probe filesystem lock behavior in the real supported environments: macOS local APFS, Linux local ext4/APFS-equivalent where available, GitHub Actions runner filesystem, and a network mount if available. Expected result: backend advertises capability and degraded mode accurately.

Prototype a SQLite backend with `BEGIN IMMEDIATE`, lease rows, unique active story leases, monotonic writer epochs, and busy timeout. Validate whether Node 24/25/26 `node:sqlite` support is acceptable or whether a dependency would be required.

## Open Questions

Should vNext introduce a repo-wide `maxActiveChildren` separate from per-run `orchestrator.maxParallel`, or should only same-story/branch/worktree conflicts be global by default?

Should the first backend be filesystem-only to avoid a new dependency, or should a SQLite backend be prioritized because it simplifies correctness and testing?

What stale thresholds should be policy defaults for launch reservation, child progress, writer heartbeat, and tracker claim locks, especially across machine sleep?

Should stale-lease clearing require an explicit `workflow_run_control` operation in all cases, or may the runner auto-clear specific safe classes such as "reservation never spawned and no tracker claim"?

How should hosted or multi-host orchestration be exposed later: as a GitHub-backed coordinator, Kubernetes Lease backend, or an external database backend?

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../../README.md) · **← Prev:** [R11 - Config, Policy, and Migration](./R11-config-policy-migration.md) · **Next →:** [Runtime and control recommendations](../post-research-design-recommendations/01-runtime-control.md)

<!-- /DOCS-NAV -->
