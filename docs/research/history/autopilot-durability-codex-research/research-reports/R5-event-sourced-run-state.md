# R5 - Event-Sourced Run State

## Executive Recommendation

Adopt a local, filesystem-backed event store where `events.ndjson` is the only authored run-state record, protected by a single leased writer, monotonic sequence numbers, writer epochs, per-event integrity metadata, and deterministic projections for `state`, `launch`, `metrics`, and `summary`. Confidence: high for the model and invariants; medium for the exact Node.js fsync/locking implementation until fault-injection spikes prove it on macOS and Linux.

## Sources Checked

- Local charter: `docs/autopilot-durability-codex-research/README.md`, checked 2026-06-18. Defines R5 scope and required report structure.
- Local design spine: `docs/autopilot-durability/design/00-overview.md`, checked 2026-06-18. Establishes event log as source of truth and projections as derived state.
- Local D2 lifecycle design: `docs/autopilot-durability/design/02-lifecycle-and-control-plane.md`, checked 2026-06-18. Defines owned child, session linkage, terminal emission, and no stale post-terminal writes.
- Local D4 recovery design: `docs/autopilot-durability/design/04-run-state-and-recovery.md`, checked 2026-06-18. Defines recovery as an event-driven stage and lists stale-state failures to prevent.
- Local current implementation: `packages/orchestrator/src/artifacts/FileArtifactStore.ts` and `packages/orchestrator/src/runner/RunJournal.ts`, checked 2026-06-18. Shows current atomic rename for snapshots, queued in-process appends, independent `state`/`metrics`/`launch`/`summary` writes, and stale `updateChildLaunch` behavior.
- Linux `open(2)` and `write(2)`, man7.org, checked 2026-06-18. Documents `O_APPEND` atomic offset+write behavior, NFS caveat, and partial write behavior. <https://man7.org/linux/man-pages/man2/open.2.html>, <https://man7.org/linux/man-pages/man2/write.2.html>
- Linux `fsync(2)`, man7.org, checked 2026-06-18. Documents file flush semantics and the need to fsync the containing directory for directory entries. <https://man7.org/linux/man-pages/man2/fsync.2.html>
- Linux `rename(2)`, man7.org, checked 2026-06-18. Documents atomic replacement semantics. <https://man7.org/linux/man-pages/man2/rename.2.html>
- Linux `flock(2)`, man7.org, checked 2026-06-18. Documents advisory exclusive locks and lock release on descriptor close. <https://man7.org/linux/man-pages/man2/flock.2.html>
- Apple `fsync(2)` and `fcntl(2)` man pages, checked 2026-06-18. Documents weaker drive-flush behavior for `fsync` and `F_FULLFSYNC` for stricter ordering on macOS. <https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/fsync.2.html>, <https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/fcntl.2.html>
- SQLite atomic commit documentation, checked 2026-06-18. Provides a mature reference for crash-safe update sequencing, journaling, and filesystem caveats. <https://www.sqlite.org/atomiccommit.html>
- PostgreSQL WAL documentation, checked 2026-06-18. Confirms the standard WAL rule: durable log first, derived data later. <https://www.postgresql.org/docs/current/wal-intro.html>
- Microsoft Azure Event Sourcing pattern, checked 2026-06-18. Defines append-only event ingestion plus materialized views/projections. <https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing>
- EventStoreDB/Kurrent append docs, checked 2026-06-18. Documents expected revision checks as optimistic concurrency control. <https://docs.kurrent.io/clients/golang/legacy/v4.2/appending-events>
- ZooKeeper recipes, checked 2026-06-18. Documents ordered ephemeral sequence nodes for lock/election coordination and herd-effect avoidance. <https://zookeeper.apache.org/doc/r3.1.2/recipes.html>
- Node.js `fs` docs, checked against v26.3.1 docs on 2026-06-18. Documents append behavior and the `flush` option default. <https://nodejs.org/api/fs.html>
- `proper-lockfile` design notes, checked 2026-06-18. Practical Node lock implementation using atomic `mkdir` plus mtime heartbeats, with explicit stale-lock caveats. <https://github.com/moxystudio/node-proper-lockfile>
- RFC 7464 JSON Text Sequences, checked 2026-06-18. Provides an authoritative pattern for recovering from truncated sequence elements. <https://datatracker.ietf.org/doc/html/rfc7464>

## Findings

Facts from sources:

- Append-only logs are the durable standard for crash recovery. PostgreSQL states the core WAL rule: log records are flushed before the corresponding data-file changes; after a crash, data can be reconstructed from the log. SQLite's atomic commit design is the same family of approach: make the commit record durable enough that recovery can decide old state vs new state.
- Event sourcing and CQRS materialized views fit the workflow-kit problem. Azure's pattern describes append-only ingestion with query-optimized projections. This maps directly to `state`, `launch`, `metrics`, and `summary`: they are read models, not authorities.
- `O_APPEND` protects the file offset and write as one atomic operation on normal POSIX-like local filesystems, but not all filesystems are equal. The Linux man page explicitly warns about NFS append races. Local orchestration should therefore document "local filesystem required" for full autonomy and degrade on network filesystems.
- `write()` can complete only part of the requested buffer. A durable event writer must use an API that reports errors, must verify the whole serialized event was written, and must treat partial/torn records as recovery cases.
- `rename()` gives atomic replacement visibility, but not full durability by itself. On Linux, fsyncing the file does not guarantee the containing directory entry is durable; the directory must also be fsynced. This matters for projection snapshots and lock/epoch files.
- macOS needs special care. Apple's docs state that `fsync()` may not force drive-level ordering in the way databases need; `F_FULLFSYNC` asks the drive to flush buffered data and is the stricter option where available.
- File locks alone are not a correctness proof. `flock()` is advisory and process/descriptor-scoped. Node's standard library does not expose a portable `flock`; `proper-lockfile` uses atomic `mkdir` plus mtime heartbeats but documents compromised-lock cases. A stale writer can still write if the write path does not also check a fencing token.
- Event stores commonly use expected revision/expected sequence checks for optimistic concurrency. EventStoreDB exposes `expectedRevision`; ZooKeeper recipes rely on monotonically increasing sequence nodes for ordered coordination. Local workflow-kit should do the same with `seq` and `writerEpoch`.
- Current workflow-kit artifacts still have multiple authorities. `RunJournal.writeState`, `writeLiveMetrics`, `writeRuntimeArtifacts`, and `recordChildLaunch` write independent JSON snapshots. `RunJournal.updateChildLaunch` rewrites a full launch record from an in-memory base. `FileArtifactStore` serializes appends only inside one process and does not currently fsync appended events or renamed snapshots.
- Current tolerant JSON readers are useful for not crashing, but tolerance is not the same as recovery. Silently returning `null` for corrupt `launch.json` or `state.json` can avoid an exception while still losing evidence. In vNext, malformed legacy snapshots should become evidence events or migration warnings, not state.

Interpretation for workflow-kit:

- The design docs are directionally correct: an event log as single source of truth is the right model. The missing part is a concrete commit protocol that makes the log authoritative under crash, concurrent supervisors, stale writers, and malformed tails.
- A single writer lock is necessary for normal operation, but the safety invariant must be enforced by projections too. Every event needs `writerId`, `writerEpoch`, `seq`, and integrity metadata so readers can fence stale writes after a lease transfer or terminal event.
- Projections may still be written to disk for UX and compatibility, but they must be rebuildable caches with `sourceRunId`, `projectionVersion`, `throughSeq`, `throughHash`, and `generatedAt`. A projection missing those fields should be treated as legacy/untrusted.

## Options

### Option 1 - Filesystem event store with fenced writer and derived projections

Keep `events.ndjson` as the durable run log, but introduce a `RunEventStore` abstraction:

- `acquireWriter(runId)` obtains a per-run writer lease, records `{writerId, writerEpoch, acquiredAt, pid, hostname}`, and heartbeats while active.
- `append(event)` validates the lease, allocates `seq = lastCommittedSeq + 1`, stamps `writerId`, `writerEpoch`, `eventId`, `prevHash`, `eventHash`, writes one newline-terminated JSON record, fsyncs by durability class, and only then notifies subscribers.
- `project(log)` parses a contiguous valid prefix and derives all read models from that prefix.
- `writeProjection(name, value)` writes a temp file, fsyncs it, atomically renames it, and fsyncs the containing directory. Projection files are caches, not authority.

Enables:

- Human-readable artifacts.
- Small local implementation with no service dependency.
- Direct migration from current `events.ndjson`.
- Compatible CLI/MCP tools that can still tail a log.

Cannot do by itself:

- Make network filesystems safe.
- Prevent arbitrary code that bypasses `RunEventStore` from appending garbage.
- Guarantee drive-level durability on every macOS storage stack without a native `F_FULLFSYNC` path.

### Option 2 - SQLite-backed event store with JSON exports

Use SQLite WAL/rollback semantics as the authoritative store and export `events.ndjson`, `state.json`, `metrics.live.json`, `summary.json`, and launch views as generated artifacts.

Enables:

- Mature local transactions, locking, sequence allocation, and crash recovery.
- Simpler stale-writer rejection through database constraints on `(run_id, seq)` and writer epoch state.
- Easier multi-projection transactions if projections are tables.

Cannot do:

- Preserve the current "artifact directory is the database" model without an export step.
- Avoid SQLite/macOS durability configuration questions; SQLite itself has filesystem and sync-mode tradeoffs.
- Remain as easy to inspect and repair with ordinary text tools.

### Option 3 - Harden current snapshot model

Keep independently authored `state.json`, `metrics.live.json`, launch files, and `summary.json`, but make writes atomic and add locking.

Enables:

- Smaller diff.
- Less migration work.

Cannot do:

- Eliminate divergence structurally. Independent authorities can still disagree.
- Provide a complete audit trail.
- Safely reject stale writes after recovery unless every snapshot writer is rewritten into a transaction protocol, which effectively recreates event sourcing poorly.

## Recommendation

Choose Option 1 for vNext. It matches the existing durability design, keeps local artifacts inspectable, and avoids a database migration while borrowing the essential correctness properties from WAL/event-store systems.

The model should be:

1. `events.ndjson` is the only authored lifecycle state.
2. Every state-changing operation is a command that appends events; no supported command edits `state.json`, `launch.json`, `metrics.live.json`, or `summary.json` directly.
3. `state`, `launch`, `metrics`, and `summary` are deterministic projections, rebuilt from the same committed event prefix.
4. The event writer is single-writer in the common case and fenced in the abnormal case.
5. Terminal lifecycle events close the run to ordinary writers. Later writes are accepted only if they are explicit, whitelisted post-terminal events such as `analysis-completed` or `operator-reconciliation`, with a new authority and provenance.

Recommended event envelope:

```json
{
  "schemaVersion": 1,
  "runId": "run-...",
  "seq": 42,
  "eventId": "uuid",
  "type": "child-session-linked",
  "topic": "launch",
  "level": "info",
  "storyId": "AWK01",
  "recordedAt": "2026-06-18T00:00:00.000Z",
  "eventAt": "2026-06-18T00:00:00.000Z",
  "writerId": "host:pid:uuid",
  "writerEpoch": 3,
  "prevHash": "sha256:...",
  "eventHash": "sha256:...",
  "data": {}
}
```

Recommended append protocol:

1. Acquire the per-run writer lease before launch or recovery. The lease contains `runId`, `writerId`, `writerEpoch`, `pid`, `hostname`, `startedAt`, `heartbeatAt`, and `capabilities`.
2. Allocate `writerEpoch` under a lock and persist it with atomic temp-write, fsync, rename, and directory fsync. Epochs only increase.
3. On writer start, read the event log and compute the last committed projection prefix. If the log has a malformed tail, record it in a recovery report and truncate/quarantine only while holding the writer lease.
4. For each append, re-check the current lease epoch, assign the next `seq`, compute `prevHash` from the previous committed event, write exactly one newline-terminated JSON object with no embedded literal newlines, and verify the write completed.
5. Fsync policy: fsync every lifecycle/control/approval/linkage/terminal/recovery event. Progress events may batch fsync in a later optimization, but vNext should start with fsync-every-event because autopilot event volume is low and correctness is the current failure mode.
6. Notify subscriptions only after the event is durable enough for its class.

Recommended projection protocol:

- Projection functions consume only committed events.
- A committed event must be valid JSON, newline-terminated, match the run id, pass schema validation, have expected `seq`, match `prevHash`, and be allowed under the current writer epoch and lifecycle state.
- A malformed final line is ignored as an uncommitted tail and surfaced as `logTailMalformed`.
- A malformed non-tail line, hash break, sequence gap, or duplicate sequence in the active epoch is `logCorrupt` and blocks autonomous recovery/merge.
- A late stale-writer line after lease supersession or terminal close is rejected from projections and surfaced as `staleWriterRejected`.
- Each projection file includes:

```json
{
  "projectionVersion": 1,
  "source": {
    "runId": "run-...",
    "eventLog": "events.ndjson",
    "throughSeq": 42,
    "throughHash": "sha256:...",
    "generatedAt": "2026-06-18T00:00:00.000Z"
  },
  "data": {}
}
```

To preserve compatibility, existing tools can continue reading top-level `state.json`, `metrics.live.json`, and `summary.json`, but the writer of those files must be the projection engine, not business logic. A compatibility helper can unwrap `data` for old clients only if it verifies the projection header first.

Recommended derived views:

- `state`: lifecycle state, active story set, blocked reason, terminal state, recovery classification, control status, and claim state. It is derived from launch/control/progress/result/recovery/terminal events.
- `launch`: per-story launch view derived from `story-claimed`, `child-launch-requested`, `child-process-spawned`, `child-session-linked`, `ownership-classified`, `child-resume-requested`, and `child-terminated`. Session linkage is monotonic: once a valid `child-session-linked` event exists, no later stale launch record can null it.
- `metrics`: derived from progress and telemetry events. Metrics sourced from session logs should be represented as `metrics-observed` or `metrics-unavailable` events, or as projection-time enrichments clearly marked with `unavailableReason`; they must not rewrite lifecycle state.
- `summary`: derived from `state`, `metrics`, completion-gate events, reviewer/CI evidence events, and analysis events. It should never parse child prose as authority.

Terminal-state invariants:

- A run may have one terminal lifecycle event in the active writer epoch: `run-succeeded`, `run-blocked`, `run-aborted`, or `run-failed`.
- A terminal event must state why all active children are no longer active: completed, terminated and reaped, unowned-observe-only, or operator-required.
- After a terminal event, no ordinary progress, launch, claim, or state mutation from the same child lifecycle can affect projections.
- Post-terminal events are limited to analysis and explicit reconciliation. Reconciliation must include `{by, reason, evidenceRef, previousThroughSeq}` and cannot hide the original terminal event.
- Auto-merge and auto-recover gates must require `projection.coherent == true`, no malformed non-tail events, no open active child without terminal disposition, and no stale-writer rejection that touches the target story after the relevant gate evidence.

Local filesystem concurrency:

- Use one per-run writer lease plus separate per-story claim locks. Do not rely on in-process promise queues; they do not protect against another supervisor process.
- Prefer a vetted lock implementation or a tiny native helper over ad hoc locking. In pure Node, an atomic `mkdir` lock with heartbeat metadata is practical, but stale-lock reclamation must be conservative.
- Treat `flock`/`mkdir` as admission control, not the only safety mechanism. `writerEpoch` is the fencing token. Projections reject stale epochs.
- Lease stealing is allowed only when the previous process is confirmed dead, or the heartbeat is stale and recovery evidence proves no owned live child remains, or a human explicitly chooses takeover. Stealing emits `writer-superseded` and `writer-acquired`.
- On network filesystems or unknown lock semantics, disable unattended run, auto-recover, and auto-merge. Observe and report only.

Migration:

- For a legacy run with `events.ndjson`, rebuild projections from the valid prefix and emit a migration report listing malformed lines, missing sequence fields, inferred sequence, and ignored snapshot disagreements.
- For legacy `state.json`, `metrics.live.json`, `summary.json`, and `children/*.launch.json`, import them only as `legacy-artifact-observed` evidence with parse status, mtime, size, sha256, and selected fields. Do not let them override event-derived state.
- If no event log exists, mark the run `legacy-read-only`. Generate a best-effort report for humans, but do not allow vNext control/recovery commands to mutate it as if it were coherent.
- During rollout, projection writers can emit both vNext projected files and old artifact shapes, but old shapes must be generated from the projection, never from runtime memory.

## Tradeoffs and Risks

- Performance: fsync on every important event is slower than buffered append. For autopilot, this is acceptable; event volume is low and stale/corrupt state is currently more expensive than latency.
- macOS durability: strict drive flush may require native `fcntl(F_FULLFSYNC)`. Node's portable APIs may not expose all desired guarantees. Without a native path, the kit should document the weaker guarantee and keep autonomous powers gated.
- Complexity: event envelopes, projection metadata, hash chains, and writer leases add implementation weight. The payoff is that recovery, analysis, and subscriptions all use one substrate.
- Compatibility: old tools expect simple JSON snapshots. A compatibility layer is needed while consumers migrate to projection-aware reads.
- Human readability: hash and sequence metadata add noise to each line. This is acceptable if `wk run status` and `wk analyze-run` render concise projections.
- Lock compromise: a user can delete lock directories or manually edit logs. The system cannot prevent all local tampering; it can detect broken sequence/hash/epoch invariants and fail closed.
- Filesystem scope: local POSIX/APFS/ext4-style filesystems are reasonable targets. Network filesystems, synced folders, and cloud-drive directories should be treated as degraded unless tested.

## Fallback and Degraded Modes

- Cannot acquire writer lease: refuse launch/recovery and show the current lease owner, heartbeat age, pid, host, and recommended action.
- Lease stale but live child uncertain: append nothing automatically; require operator takeover or observe-only classification.
- Malformed trailing event: ignore the tail for projection, mark `logTailMalformed`, and let the next lease holder quarantine/truncate only after recording recovery evidence.
- Malformed non-tail event, sequence gap, duplicate active-epoch sequence, or hash mismatch: mark `logCorrupt`, disable auto-recover/auto-merge, and require operator repair.
- Stale writer event after supersession or terminal: reject from projections, record `staleWriterRejected`, and keep the run terminal/recovered state intact.
- Projection file missing or corrupt: rebuild from the event log. If rebuild succeeds, rewrite the projection. If rebuild fails, report log corruption; never use the corrupt projection as authority.
- Filesystem lacks required locking/durability capability: run in control-degraded/observe-only mode; no unattended run, auto-recover, or auto-merge.
- Legacy run without usable events: read-only legacy analysis only.

## Validation Spikes

- Crash append spike: kill the process after write before fsync, after fsync before notification, and during projection rename. Reboot simulation should yield either the old projection or a rebuildable event prefix, never half state.
- Malformed tail spike: append a truncated JSON event at the end of `events.ndjson`; status should project through the previous valid event, surface `logTailMalformed`, and continue only after safe quarantine.
- Non-tail corruption spike: corrupt an interior event; projection should stop/fail closed and block autonomous recovery/merge.
- Concurrent supervisors spike: start two supervisors for one run. Exactly one should acquire the writer lease; if a stale writer appends anyway, projections should reject by epoch.
- Terminal invariant spike: emit terminal, then simulate delayed progress/control writes from the old writer. `state` and `summary` must remain terminal with stale writes reported, not applied.
- Launch monotonicity spike: replay `child-session-linked`, then a stale launch snapshot with `sessionId: null`. The launch projection must retain the session id.
- Projection divergence property test: generate random valid event sequences and assert `state`, `launch`, `metrics`, and `summary` all report the same `throughSeq`/`throughHash` and no contradictory lifecycle status.
- Legacy migration spike: feed captured 0.7.0 run directories with disagreeing `state.json` and `metrics.live.json`. The importer should produce a projection plus warnings, not choose one snapshot as truth.
- macOS/Linux durability spike: verify the selected Node/native sync path performs file fsync and directory fsync, and use `F_FULLFSYNC` where available on macOS for strict mode.
- Network filesystem probe: run append/lock tests on a known network/synced path and confirm capability gates degrade.

## Open Questions

- Should vNext require a native filesystem helper for `flock`, directory fsync, and macOS `F_FULLFSYNC`, or accept a pure Node implementation with a documented weaker durability class?
- Should progress events be fsynced immediately in v1, or batched behind a clear `durabilityClass: buffered` field? Safety argues for immediate fsync first.
- What post-terminal events are allowed to change user-visible status? My recommendation is analysis and explicit reconciliation only, but product owners should confirm.
- Should projection files keep the old top-level shape for compatibility, or move to `{source, data}` with compatibility unwrapping at API boundaries?
- Should the event log remain NDJSON or move to RFC 7464 JSON text sequences for better recovery from truncated records? NDJSON is simpler and already used, but RFC 7464 has stronger resynchronization semantics.
- How much legacy inference is acceptable for old runs with no event log? Recommendation: no writable migration, only read-only reports.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../../README.md) · **← Prev:** [R4 - Sandbox, Dependency Install, and Supply Chain](./R4-sandbox-dependency-supply-chain.md) · **Next →:** [R6 - Worker Supervision and Liveness](./R6-worker-supervision-liveness.md)

<!-- /DOCS-NAV -->
