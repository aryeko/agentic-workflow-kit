# Spawned Sessions

The tracker records all 14 stories as `done`. Normalized events record 30 spawned workers/reviewers
and 18 review-completion events. Because normalized `worker_spawned` events did not include `storyId`,
per-story timing below is reconstructed by joining stable worker ids and aliases from the
tracker/transcript to event timestamps.

There is one alias consistency issue: for several later stories, the executed tracker records final
aliases such as Lovelace/Turing, Shannon/Hopper, and Lamport/Dijkstra, while normalized event summaries
for the same stable worker ids show aliases Harvey/Ohm, McClintock/Rawls, and Planck/Hegel. Agent ids
align; aliases drifted. This is an observability defect and is why the report treats agent ids and
story rows as stronger evidence than nicknames.

## Story Outcomes

| Story | Wave | Reconstructed session window | Duration | Review rounds | Outcome |
|---|---:|---|---:|---:|---|
| `core-01-s1-event-contracts` | 1 | 16:51 to 17:14 | 23m | 1 | Approved; SDK root `Result` export made explicit. |
| `core-02-s1-capability-registry` | 1 | 16:51 to 17:17 | 26m | 2 | Freeze finding fixed. |
| `core-01-s2-replay-and-corruption` | 2 | 17:21 to 17:45 | 24m | 2 | Missing `RunAppendRejected.failureCode` fixed. |
| `core-01-s3-lifecycle-and-linkage` | 2 | 17:21 to 17:43 | 22m | 1 | Coordinator fixed terminal-state membership typing. |
| `core-02-s2-gate-evaluator` | 2 then repaired | 17:21 to 19:07 | 106m | 2 | Initial source-contract blocker verified; later repaired, implemented, and reviewed. |
| `core-07-s1-telemetry-and-metrics` | 2 | 17:21 to 17:53 | 32m | 2 | Freeze finding fixed. |
| `edge-01-s1-operator-command-contract` | 2 | 17:22 to 17:51 | 29m | 1 | Approved. |
| `core-01-s5-projections` | 3 | 18:02 to 18:16 | 14m | 1 | Coordinator fixed reverse scan and launch guards before review. |
| `core-01-s6-cursor-wait` | 3 | 18:02 to 18:10 | 8m | 1 | Approved. |
| `core-07-s2-analyzer` | 3 | 18:02 to 18:25 | 22m | 3 | Public import and coverage findings fixed. |
| `edge-01-s2-cli-mcp-parity-smoke` | 3 | 18:03 to 18:23 | 21m | 2 | Public testkit import fixed. |
| `core-02-s3-gate-record-durability` | 3 after repair | 19:09 to 19:18 | 9m | 1 | Approved. |
| `core-01-s4-run-event-log-and-writer` | 4 | 19:19 to 19:50 | 31m | 2 | Epoch, rejection, and lost-ack re-fencing findings fixed. |
| `core-07-s3-analysis-records-and-reports` | 4 | 19:52 to 20:18 | 26m | 1 | Pre-review type fixes; reviewer accepted async/options surface and reconstructed keying. |

## Review-Round Distribution

| Rounds | Story count |
|---:|---:|
| 1 | 8 |
| 2 | 5 |
| 3 | 1 |

## Interpretation

The spawned review layer did meaningful work. It caught real implementation bugs before commit:
frozen catalogs, missing failure code, public imports, coverage shortfall, provider-domain matching,
replayable evidence, writer epoch order, rejection durability, and lost-ack re-fencing.

The spawned review layer was not enough. PR review found many P1/P2 issues in cross-story runtime
invariants. This means the review model needs another layer between story review and PR publication.

Story reviewers were strongest when checking local acceptance criteria and local tests. They were
weaker when the defect crossed package boundaries, depended on event history semantics, or required
composing capability, replay, lifecycle, writer, and analysis behavior.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 Delivery Retro](./README.md) · **← Prev:** [Process and Timeline](./01-process-and-timeline.md) · **Next →:** [PR Review Rounds](./03-pr-review-rounds.md)

<!-- /DOCS-NAV -->
