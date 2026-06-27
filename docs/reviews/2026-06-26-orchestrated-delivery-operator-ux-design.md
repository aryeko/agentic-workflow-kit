# Orchestrated-Delivery Operator UX Design

Short summary: `orchestrated-delivery` should read as a sparse, separable operator ledger, not a noisy event stream. Visible assistant-authored updates should report story state, milestone significance, and the next decision or action in a fixed shape the operator can scan and a retro can audit.

## Background

PR #164 fixed the alias-first message envelope so coordinator-authored updates can begin with story and role context instead of raw worker ids. That solved one message-format problem, but the Codex CLI operator experience remains too noisy and too event-centric.

The remaining issue is broader than the envelope itself:

- built-in CLI telemetry is mixed with assistant-authored status;
- repeated shell warnings consume attention without changing decisions;
- waits can produce visible filler;
- the operator still has to reconstruct state from fragments.

The design therefore has two goals that must be held together:

- **Sparseness:** emit fewer assistant-authored lines, and only when they carry state or liveness.
- **Separability:** make the assistant-authored ledger visually and structurally distinct from immutable Codex CLI telemetry, so the operator can find state updates even when `Ran`, `Spawned`, and shell-output rows remain visible.

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

Pure sparseness can make this worse if the few assistant-authored updates are visually indistinct from the denser immutable telemetry around them. The ledger lines need a stable prefix and field order so the eye can filter for operator state.

### Example: operator must reconstruct state

The operator can still end up inferring run state by correlating launch rows, shell commands, readdress rows, and later blocker summaries. That is the wrong burden. The surface should report state first and mechanics second.

## Desired UX

### Sparse and separable run ledger

Visible assistant-authored updates should appear only for meaningful milestones, such as:

- package preflight passed or refused;
- runtime binding completed;
- worker launched for a clear purpose;
- worker returned with result, blocker, or readdress need;
- review approved, blocked, or escalated;
- story merged back, skipped, or routed back;
- PR state changed;
- closeout state became known.

The ledger should stay quiet between milestones unless the operator asks for status, a liveness threshold is reached, or new evidence changes the state. When it does speak, it should use the same compact grammar every time.

### Meaningful milestone updates

Each visible status should say:

- what changed;
- why it matters;
- what happens next.

Examples:

- "waiting on two active stories; no operator action yet";
- "story `core-03-s3` blocked on source-contract defect; next action is route back to `$plan-epic`";
- "review passed; next action is merge-back and verify".

### Fixed line grammar

Milestone updates should use a required grammar so the design is checkable rather than only stylistic guidance.

Preferred single-line grammar:

```text
State: <scope> | <story-or-counts> | <verdict-or-mode> | next=<action-or-await>
```

Preferred two-line grammar when a reason, route, or evidence needs room:

```text
State: <story> <role> R<round> <VERDICT> | <facet> | route=<target>
Next: <specific coordinator action or awaited event>
```

Examples:

```text
State: epic-4-continuation | active=2 locked=1 blocked=0 | next=wait for committed worker rounds

State: core-03-s3 implementer R1 BLOCKED | source-contract | route=$plan-epic
Next: return the story for planning repair; do not continue implementation on this branch.
```

The exact tokens may evolve during implementation, but the final skill contract should keep these properties:

- a stable first token such as `State:`, `Next:`, or `Env:`;
- story id, role, round, and verdict when the update is story-specific;
- aggregate counts when the update is run-wide;
- one explicit `next=` field or `Next:` line;
- raw worker ids only as traceability fields, never as the leading identifier.

### Story state before tool mechanics

Visible updates should lead with story, role, round, verdict, and route-back or next-step context. Tool details are secondary.

Preferred order:

1. story or run state;
2. significance;
3. next action or awaited event;
4. traceability details such as raw ids, commits, or tool evidence.

### Shell and tool noise summarized conservatively

Repeated warnings should be collapsed only when they match a known-benign allowlist and do not change execution viability. Unknown warnings surface at least once with the command context that produced them, because suppressing a novel warning can hide real evidence.

Initial allowlist:

- `fnm` multishell symlink warning under Codex `seatbelt` sandbox when `fnm env` exits 0 and dependent `node`, `pnpm`, or setup commands still succeed.

Example:

```text
Env: fnm_multishell_warning repeated | known sandbox diagnostic | next=continue unless node/pnpm fails
```

After that, the ledger should return to story state.

Anything outside the allowlist should be treated as potential evidence until classified. The goal is conservative summarization, not broad warning suppression.

### Wait cadence

Empty waits should not produce filler such as "still waiting" or "no result yet." Long waits still need liveness, so the rule should be:

- no assistant-authored line for unchanged short waits;
- emit immediately when worker state, story state, blocker state, or route-back state changes;
- emit one separable liveness line after a configured long-wait threshold, even if no state changed;
- after that, repeat only at the same coarse threshold or when the operator asks for status.

Example:

```text
State: epic-4-continuation | active=1 locked=2 blocked=0 | next=wait for core-03-s3 implementer result
```

This keeps the run from feeling stalled without turning waiting into visible filler.

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
- no attempt to generalize this UX standard beyond `orchestrated-delivery` before it is proven there;
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
State: epic-4-continuation | active=2 locked=0 blocked=0 | next=wait for worker results
- core-03-s3-impl R1 | implementer | waiting on worker result
- core-04-s3-review R1 | reviewer | verifying gate evidence

Env: fnm_multishell_warning repeated | known sandbox diagnostic | next=continue unless node/pnpm fails
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

### After, fixed grammar

```text
State: core-03-s3 implementer R1 BLOCKED | source-contract | route=$plan-epic
Next: return the story for planning repair; do not continue implementation on this branch.
```

Operator burden: scan for `State:`, `Next:`, and `Env:` lines, then ignore raw telemetry unless deeper trace evidence is needed.

## Auditability

The eventual implementation should include a post-run retro check over assistant-authored visible updates. The check does not need to parse Codex client telemetry rows, but it should make the operator-ledger contract falsifiable.

Minimum audit checks:

- every assistant-authored status line starts with an approved ledger token such as `State:`, `Next:`, or `Env:`;
- every `State:` block includes a next action through `next=` or a following `Next:` line;
- story-specific `State:` lines include story id, role or phase, round when applicable, and verdict or mode;
- empty waits do not produce filler lines before the configured liveness threshold;
- repeated warnings are collapsed only when they match the known-benign warning allowlist;
- raw worker ids do not appear as the leading identifier in milestone updates.

This is intentionally an audit contract, not an implementation design. It states how to tell whether the skill followed the communication policy after a run.

## Open Questions

- When immutable CLI telemetry is especially noisy, do we want a standard one-time note distinguishing raw client telemetry from assistant-authored state?
- What is the right initial liveness threshold for long waits in `orchestrated-delivery`?

## Decision Summary

We want `orchestrated-delivery` to read like an operator ledger, not an event log. Visible assistant-authored updates should be sparse, separable, milestone-based, and decision-oriented. Story state comes first, tool mechanics come second, every visible state block carries a next action, and repeated shell noise is summarized only through a conservative known-benign allowlist unless it changes the run's meaning.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [agentic-workflow-kit — documentation home](../README.md) · **← Prev:** [Epic 4 execution blockers - source-closure profile and prevention buttons](./2026-06-26-epic-4-execution-blocker-patterns.md) · **Next →:** [PR #167 authoring hardening note](./2026-06-26-pr-167-authoring-hardening-note.md)

<!-- /DOCS-NAV -->
