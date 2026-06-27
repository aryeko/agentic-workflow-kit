---
title: Codex GitHub Code Review
status: high-level design
last-reviewed: "2026-06-27"
---

# Codex GitHub Code Review

This is the canonical workflow for Codex GitHub automatic pull-request review in
this repository. Use it to review a PR diff for serious correctness, safety,
evidence, and contract risks. It complements [check-gate.md](check-gate.md): the
gate proves format, lint, dependency, type, fixture, and coverage checks; review
asks whether the change is the right implementation of the repository contract.

Codex GitHub review should stay focused on P0/P1 issues. Do not spend review
budget on style, wording, or preference findings unless the applicable
`AGENTS.md` explicitly makes that issue review-blocking.

## Source Routing

Start from the pull request diff, changed files, and the closest `AGENTS.md`
that applies to each changed file. Read only the additional sources needed to
judge that diff:

1. Directly related files needed to understand the changed behavior.
2. Sources explicitly named by the applicable `AGENTS.md`, PR text, changed
   paths, nearby code comments, or touched identifiers.
3. Any implementation story, execution package, reviewer prompt, or evidence
   file named by those routing signals.
4. [../implementation-authoring/lessons-ledger.md](../implementation-authoring/lessons-ledger.md)
   for recurring workflow-kit defect classes. Treat the ledger as the authority
   for known patterns; do not copy or re-state its lesson list here.

Do not scan design or engineering policy documents by default. Open them only
when the routing signals above point to a specific document or contract needed
to judge the changed line.

If an applicable source cannot be found, record that uncertainty as review
context or a note. Missing source evidence is not, by itself, a blocking
finding. Do not invent a missing contract.

## Review Workflow

Run the review as a finder -> verifier -> sweep -> synthesis workflow. Use
subagents when the review surface supports them and the split is useful. If
subagents are unavailable, first write a sequential coverage plan that names the
review topics, target files, ordering, and source evidence for each pass; then
execute those passes separately and keep candidate findings isolated until
verification.

Every candidate finding must name the changed line, the contract it violates,
and a concrete failure mechanism.

### 1. Scope

Build one shared scope packet for all later passes:

- PR head and diff under review.
- Changed files and the nearest applicable instruction files.
- Directly related files needed to understand the changed behavior.
- Specific routed sources, if any, such as implementation stories, execution
  packages, reviewer prompts, evidence files, or design/engineering docs named
  by the applicable `AGENTS.md`, PR text, changed paths, nearby code comments,
  or touched identifiers.
- Ledger sections consulted for known recurring patterns.
- Any constraints from the PR text or explicit reviewer request.

The scope packet is read-only. A reviewer does not fix code, re-characterize the
story, open a new design, or broaden the PR scope.

### 2. Find

Dispatch independent finder passes. Each pass returns candidate findings only;
it does not decide final severity.

| Finder | Purpose |
|---|---|
| Correctness | Look for wrong conditions, missing awaits, off-by-one boundaries, bad defaults, null/undefined paths, stale state, and fail-open behavior. |
| Removed behavior | For deleted or moved code, identify the invariant the old line enforced and whether the diff preserves it elsewhere. |
| Cross-file contract | Trace changed public shapes, callers, producers, consumers, and exported symbols for contract drift outside the immediate hunk. |
| Evidence and tests | Check that claimed acceptance, proof, fixture, and gate evidence is real, standing, and mapped to the changed behavior. |
| Security and secrets | Look for credential exposure, PII leakage, unsafe egress, permission boundary bypass, and missing redaction. |
| Conventions | Quote the exact `AGENTS.md` instruction or ledger-backed pattern that makes the issue review-relevant. |

Each candidate must use this shape:

```text
file: <path>
line: <changed line>
summary: <one sentence>
source: <AGENTS.md instruction, repository contract, or ledger pattern>
failure: <triggering state/input and wrong result>
```

Drop candidates that cannot name an observable failure or violated repository
contract.

### 3. Verify

Verify each candidate independently from the finder that produced it. A verifier
returns one verdict:

- `CONFIRMED`: the diff contains the defect, the triggering state/input is
  concrete, and the wrong result follows from quoted code and sources.
- `PLAUSIBLE`: the mechanism is real, but one condition still depends on runtime,
  configuration, timing, or unavailable evidence. State what would confirm it.
- `REFUTED`: the candidate is factually wrong, already guarded in the diff,
  impossible under the cited contract, pre-existing outside the changed lines, or
  style-only without an explicit review-blocking `AGENTS.md` source.

Prefer refutation over noise when the candidate is only a preference or a
general best-practice concern. Prefer `PLAUSIBLE` over `REFUTED` only for
realistic safety, concurrency, fail-open, or boundary risks that cannot be ruled
out from the diff and sources.

If a verified finding matches a known defect pattern in the lessons ledger, rank
it at least P1. The finding must explicitly say that it matches the known
pattern and cite the specific ledger section or pattern reference.

### 4. Sweep

Run one final sweep after verification. The sweep looks for:

- sibling occurrences of each confirmed or plausible defect pattern,
- systemic gaps that explain multiple local symptoms,
- changed call sites or producers not covered by the first passes,
- ledger-backed recurring patterns that the first passes missed.

The sweep may add new candidates, but every new candidate still goes through the
same verification standard before synthesis.

### 5. Synthesize

Produce a capped GitHub review:

- Dedupe by root cause, not by file.
- Rank `CONFIRMED` P0/P1 issues first, then high-confidence `PLAUSIBLE` issues
  only when they are serious enough to deserve reviewer attention.
- For ledger-matched findings, state the specific known pattern and ledger
  reference in the finding body.
- Keep findings actionable: location, source, failure mechanism, and expected
  fix shape.
- Explicitly discard or summarize refuted candidates only when doing so prevents
  repeated review churn.
- Include the execution summary required by
  [codex-review-execution-summary.md](codex-review-execution-summary.md).

If no serious issue remains after verification, report that no P0/P1 issues were
found under this workflow.

## Boundaries

Review is read-only. It does not apply fixes, update lessons, edit skills,
modify execution packages, push branches, or merge PRs.

If a finding reveals a recurring defect class not already covered by the lessons
ledger, report it as review context only. Any durable lesson extraction belongs
to a separate retro or learning workflow.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Engineering Policy Index](./README.md) · **← Prev:** [Check Gate](./check-gate.md) · **Next →:** [Codex Review Execution Summary](./codex-review-execution-summary.md)

<!-- /DOCS-NAV -->
