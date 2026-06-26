# Orchestrated-Delivery Operator UX Design

Short summary: `orchestrated-delivery` should read as a sparse operator ledger, not a noisy event stream. Visible assistant-authored updates should report story state, milestone significance, and the next decision or action.

## Background

PR #164 fixed the alias-first message envelope so coordinator-authored updates can begin with story and role context instead of raw worker ids. That solved one message-format problem, but the Codex CLI operator experience remains too noisy and too event-centric.

The remaining issue is broader than the envelope itself:

- built-in CLI telemetry is mixed with assistant-authored status;
- repeated shell warnings consume attention without changing decisions;
- waits can produce visible filler;
- the operator still has to reconstruct state from fragments.

This note records the desired UX and why we want it. It does not design implementation mechanics.

## Problem

The current surface over-exposes transport and tooling events, and under-exposes the actual state the operator is supervising.

### Example: empty wait filler
```text
Waiting for workers.
Still waiting.
No verdict yet.
Checking again.
```

This shows activity without state change. The operator still does not know what moved or whether any action is needed.

### Example: repeated `fnm` sandbox warning
```text
error: Can't create the symlink for multishells at "/Users/.../.local/state/fnm_multishells/..."
error: Can't create the symlink for multishells at "/Users/.../.local/state/fnm_multishells/..."
error: Can't create the symlink for multishells at "/Users/.../.local/state/fnm_multishells/..."
```

If the warning does not change execution viability or require intervention, repeating it inline is ledger noise.

### Example: built-in `Ran` / `Spawned` telemetry dominates
```text
Spawned subagent 019f...
Ran git status --short
Ran sed -n ...
Spawned subagent 019f...
```

Those rows are useful raw telemetry, but they do not tell the operator which story advanced, what the outcome was, or what happens next.

### Example: operator must reconstruct state

The operator can still end up inferring run state by correlating launch rows, shell commands, readdress rows, and later blocker summaries. That is the wrong burden. The surface should report state first and mechanics second.

## Desired UX

### Sparse run ledger

Visible assistant-authored updates should appear only for meaningful milestones, such as:

- package preflight passed or refused;
- runtime binding completed;
- worker launched for a clear purpose;
- worker returned with result, blocker, or readdress need;
- review approved, blocked, or escalated;
- story merged back, skipped, or routed back;
- PR state changed;
- closeout state became known.

The ledger should stay quiet between milestones unless the operator asks for status.

### Meaningful milestone updates

Each visible status should say:

- what changed;
- why it matters;
- what happens next.

Examples:

- "waiting on two active stories; no operator action yet";
- "story `core-03-s3` blocked on source-contract defect; next action is route back to `$plan-epic`";
- "review passed; next action is merge-back and verify".

### Story state before tool mechanics

Visible updates should lead with story, role, round, verdict, and route-back or next-step context. Tool details are secondary.

Preferred order:

1. story or run state;
2. significance;
3. next action or awaited event;
4. traceability details such as raw ids, commits, or tool evidence.

### Shell and tool noise summarized once

Repeated warnings that do not change the decision surface should be collapsed into one concise note.

Example:

```text
Environment note: repeated `fnm` sandbox warning observed; no decision impact.
```

After that, the ledger should return to story state.

### Every visible status includes next decision or action

If a status is visible, it should answer at least one of these:

- what should the operator do now;
- what is the system waiting on now;
- what route-back or escalation is now required;
- what closeout step is next.

## Boundaries

- Codex CLI event rows such as `Ran` and `Spawned` are immutable client telemetry. This design does not assume they can be hidden, removed, or restyled.
- `model_reasoning_summary`, `model_verbosity`, and Markdown formatting cannot hide or restyle those immutable rows.
- Live inline table surfaces, continuously refreshed updates, and richer real-time UI widgets are out of scope for this pass.
- `model_reasoning_summary = "concise"` is only a run or profile setting for reducing reasoning-summary noise. It is not a design answer for operator-ledger UX.

## Non-Goals

- no scheduling or runtime changes;
- no live dashboard or new interactive surface;
- no source-skill implementation design yet;
- no broad warning suppression;
- no redesign of Codex CLI rows that the client owns.

## Before / After

### Before

```text
Spawned subagent 019f...
Ran sed -n ...
error: Can't create the symlink for multishells at "/Users/.../.local/state/fnm_multishells/..."
Still waiting.
Ran git status --short
```

Operator burden: reconstruct what changed and whether action is needed.

### After

```text
Wait: 2 stories active. No operator action yet.
- core-03-s3-impl R1 | implementer | waiting on worker result
- core-04-s3-review R1 | reviewer | verifying gate evidence

Environment note: repeated `fnm` sandbox warning observed; no decision impact.
```

### Before

```text
Launch worker 019f...
Ran ...
Ran ...
Result returned.
```

### After
```text
Result: core-03-s3-impl R1 BLOCKED | source-contract | route=$plan-epic
Next action: return the story for planning repair; do not continue implementation on this branch.
```

## Open Questions

- Should this sparse-ledger rule stay repo-local to `orchestrated-delivery`, or become a broader standard for similar long-running skills?
- When immutable CLI telemetry is especially noisy, do we want a standard one-time note distinguishing raw client telemetry from assistant-authored state?
- For longer waits, what reminder cadence keeps the run calm without making it feel stalled?

## Decision Summary

We want `orchestrated-delivery` to read like an operator ledger, not an event log. Visible assistant-authored updates should be sparse, milestone-based, and decision-oriented. Story state comes first, tool mechanics come second, and repeated shell noise is summarized once unless it changes the run's meaning.
