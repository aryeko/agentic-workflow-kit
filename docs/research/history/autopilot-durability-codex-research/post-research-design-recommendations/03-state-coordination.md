---
title: State and coordination recommendations
status: post-research recommendation draft
last-reviewed: 2026-06-18
sources: [R5, R12]
---

# State and coordination

## Problem

The old run state had several independently authored files. A stale writer could overwrite recovered state,
`launch.json` could lose a known session id, and duplicate-launch clearing required manual artifact edits.
Local orchestration also needs to prevent multiple parents from claiming the same story or writing the same
run.

## Recommendation

Use an event-sourced run store plus fenced leases:

- `events.ndjson` is the only authored lifecycle state;
- `state`, `launch`, `metrics`, `summary`, analysis, and reports are projections;
- each run has one leased writer with writer epoch and sequence numbers;
- each story launch has a repo-wide launch lease;
- every append is fenced by expected writer id, lease epoch, and next sequence;
- stale writers are rejected by projections and surfaced as evidence.

Sources: [R5](../research-reports/R5-event-sourced-run-state.md),
[R12](../research-reports/R12-coordination-concurrency.md).

## Event envelope

Recommended event fields:

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

Committed events must be newline-terminated, valid JSON, schema-valid, contiguous by `seq`, hash-linked,
and allowed by lifecycle state.

## Append protocol

1. Acquire writer lease.
2. Allocate or verify writer epoch.
3. Read current valid log prefix and last hash.
4. Re-check lease immediately before append.
5. Assign next sequence.
6. Write one complete JSON line.
7. Flush according to durability class.
8. Notify subscriptions only after the event is durable.

Lifecycle, linkage, approval, control, terminal, and recovery events should be fsynced in vNext. Progress
events can be optimized later only if marked with a weaker durability class.

## Projection protocol

Projection files are caches. Each projection records:

- source run id;
- event log path;
- through sequence;
- through hash;
- projection version;
- generated time.

If projection files are missing or corrupt, rebuild them from the event log. If the event log is corrupt,
fail closed; do not choose one stale snapshot as authority.

## Coordination resources

Recommended resources:

| Resource | Purpose |
|---|---|
| `repo-scheduler` | optional repo-wide `run-eligible` admission |
| `run-writer:<runId>` | exactly one event writer for a run |
| `story-launch:<storyId>` | exactly one active child launch reservation across the repo |
| `concurrency-slot:<scope>:<slot>` | repo/track child limits |
| `tracker-file:<path>` | short critical-section lock for markdown read/write |

Tracker authority and run-state authority remain separate. The tracker decides story ownership/status;
the run log records what the autopilot did and why.

## Launch sequence

1. Acquire `run-writer:<runId>`.
2. Acquire `story-launch:<storyId>`.
3. Lock tracker file, re-read row, verify eligibility, write claim, re-read to verify.
4. Append `story-claimed` and `child-launch-reserved`.
5. Spawn child and append `child-spawned`.
6. Append `child-session-linked` as soon as session identity exists.
7. Renew leases only from real supervision evidence.
8. Release launch lease only after terminal/recovery disposition is recorded.

## Corruption and stale-writer behavior

| Condition | Behavior |
|---|---|
| malformed trailing line | ignore as uncommitted tail, surface warning |
| malformed interior line | `logCorrupt`, block autonomous recovery/merge |
| sequence gap/hash mismatch | `logCorrupt`, operator repair |
| stale writer after supersession | reject from projections, report writer identity |
| late event after terminal | ignored unless whitelisted post-terminal analysis/reconciliation |
| network filesystem/unknown lock semantics | degrade: no unattended run, auto-recover, or auto-merge |

## Backend options

Filesystem-backed event store is the recommended first implementation because it fits current artifacts and
keeps reports inspectable. SQLite is a strong future coordination backend, but should be gated by Node/version
and packaging decisions. External coordinators are future hosted-runner work, not the default local plugin.

## Validation spikes

- Concurrent supervisors race to write the same run.
- Twenty processes race to claim the same story.
- Writer A stalls, writer B recovers, writer A appends late.
- Crash after each launch step.
- Legacy artifact migration from divergent 0.7.0 runs.
- Network filesystem capability probe.
