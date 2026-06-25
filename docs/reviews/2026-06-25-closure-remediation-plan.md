# Closure-Defect Remediation — Durable Execution Plan

- **Date:** 2026-06-25
- **Owner:** Claude (delivery owner — verifies every stage personally; delegates work to sub-agents).
- **Source of findings:** `docs/reviews/2026-06-25-producer-consumer-closure-audit.md` (~18 confirmed
  closure defects, 2 refuted, 4 root patterns P1–P4).
- **Operating principle:** **Leverage sub-agents** for independent slices (edits, reverify, review) —
  do **not** do everything in the main session — but the delivery owner **verifies every stage
  personally**. Subtle frozen-corpus edits (WU-1 approval, WU-2 fnd-04) are owner-authored; mechanical
  WUs are delegated and owner-reviewed.

## Guardrails (all phases)

- Work in `<repo>/.worktrees/<name>` off `v-next`; verify `git rev-parse --show-toplevel` before any
  write. PR base `v-next` (protected — never push direct). Run `pnpm check` before claiming done.
- **Do not touch delivered epics' charters or scope.** Delivered-code defects are fixed *forward* via a
  remediation epic, never by reopening Epic 1/3 planning.
- Frozen design corpus: amendments are corrections to under-specified seam contracts, gated by a
  clean-room reverify (below), not new scope.

## Phase A — Design amendments (this PR: `design-closure-fixes`)

Amend `docs/design/**` to close the ~18 defects by the four root-pattern fixes. Work units (disjoint
files → parallel-safe):

- **WU-1 Approval (owner)** — `ApprovalContext` += `requestedAt`/`promptRef`; `classify` += `classifiedAt`;
  add `park`/`ParkDecision`; `kind→subject` map; protected-policy binding block.
- **WU-2 fnd-04 (owner)** — `CredentialAuditContext` on all methods; thread `EgressPolicySource` into
  `issueEgressPolicy`; drop `RequiredAttester.platform/driverVersion`; AuditBase provenance.
- **WU-3 Recovery (sub-agent)** — define `RecoveryRecordInput`, 8 per-event `*Payload`s,
  `ReconciliationBlockedPayload`, `planId` minting rule, import core-05 enums.
- **WU-4 Completion (sub-agent)** — define `CompletionDecisionPayload`/`MergeDecisionPayload`.
- **WU-5 core-01 (sub-agent)** — `requestedBy` source on `CreateRunInput` + lineage prose.
- **WU-6 SDK/providers (sub-agent)** — `ForgeRuleset.requiredStatusChecks` on canonical type; declare a
  dedicated public-entrypoint/barrel **aggregation owner**.
- **WU-7 Architecture (sub-agent, after WU-1)** — correct `protected-policy-gate.md` to reference, not
  duplicate, core-05 digests/paths.
- **Process (sub-agent)** — add a **closure/construction check** to Gate-1 (`docs/implementation-authoring/`)
  and the design-review checklist: every produced record/event field and every required public symbol
  must name a declared source in inputs or owned pathset.

**Gates:** owner reviews full diff → `pnpm check` → **clean-room reverify** (fresh read-only agents given
only the closure method + scope, NOT the findings list) + regression matrix (each of the 18 now closed;
0 new gaps; #11/#19 stay refuted; canonical↔domain type parity) → **independent reviewer** → fix →
**PR to v-next** → watch Codex review (`chatgpt-codex-connector`) **1 round max** → fix → **merge + clean**.

## Phase B — Recreate Epic 4 (after Phase A merges)

User removes the current Epic 4 delivery branches/worktrees. Then, against the amended design:
1. `$plan-epic` — re-author the Epic 4 story DAG + contracts; re-freeze Gate 1.
2. `$plan-delivery` — new execution package (discard the old one).
3. `$orchestrated-delivery` — deliver. Leverage sub-agents (per-story workers/reviewers); owner verifies.
   PR(s) to `v-next`, review, merge.

## Phase C — Remediation epic for delivered-code defects (after Phase B)

The delivered-code defects (**fnd-04** audit/clock/egress + **core-01 `requestedBy`**) are forward-fixed
as a **remediation epic** — stories + execution package + delivery. May be a **single story** if the scope
is small enough. Independent of Epic 4 (no dependency), so it may also run earlier if preferred.

1. Author the remediation epic: story DAG + ready contracts + execution package (`$plan-epic` →
   `$plan-delivery`), scoped to the delivered code the design amendments now require.
2. **Implementation runs via the `codex` CLI**, not the main session:
   - **Model:** `gpt-5.5`. **Effort:** `high`.
   - **Skill:** `$orchestrated-delivery` against the remediation execution package.
   - **Prompt must pre-authorize**: sub-agent dispatch **and** plan execution up front, so codex runs
     autonomously and does **not** pause for plan/subagent approval.
   - Owner (Claude) verifies the codex output, the diff, and `pnpm check`; owns the PR, review round,
     merge, and cleanup.

## Cross-phase notes

- The four not-yet-delivered defect domains (recovery, completion, sdk-barrel, protected-policy,
  supervision-append) need only the Phase-A design fix; they are planned correctly when their epics run.
- Each phase is its own PR(s) to `v-next`; no phase bundles design + code.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../README.md) · **← Prev:** [Delivery-model reform + barrel simplification — self-contained remediation plan](./2026-06-25-barrel-coownership-and-closure-wiring-plan.md) · **Next →:** [Producer↔Consumer Closure Audit — kit-vnext design corpus](./2026-06-25-producer-consumer-closure-audit.md)

<!-- /DOCS-NAV -->
