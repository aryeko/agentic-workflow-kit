# Report 2 — Design-Reference Behaviors for JIG Rebuild

## 1. Summary
This report translates the design corpus into product-visible behavior, not implementation law. The design acts as a **reference of what must be true** for reliability, safety, and operator control, while preserving the product goal: deterministic, auditable automation that never overreaches without evidence.

Primary references: [docs/design/00-orientation/requirements.md](../../design/00-orientation/requirements.md), [docs/design/10-architecture/architecture.md](../../design/10-architecture/architecture.md), [docs/design/10-architecture/runtime-flow.md](../../design/10-architecture/runtime-flow.md), [docs/design/10-architecture/human-control-and-approvals.md](../../design/10-architecture/human-control-and-approvals.md), [docs/design/10-architecture/evidence-gates-and-merge.md](../../design/10-architecture/evidence-gates-and-merge.md), [docs/design/10-architecture/recovery-and-reconciliation.md](../../design/10-architecture/recovery-and-reconciliation.md), [docs/design/10-architecture/capability-attestation.md](../../design/10-architecture/capability-attestation.md), [docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md](../../design/30-domain-reference/core/run-lifecycle-and-state/README.md), [docs/design/30-domain-reference/core/completion-and-merge/README.md](../../design/30-domain-reference/core/completion-and-merge/README.md), [docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md](../../design/30-domain-reference/core/recovery-and-reconciliation/README.md), [docs/design/30-domain-reference/edge/operator-surface/README.md](../../design/30-domain-reference/edge/operator-surface/README.md), [docs/design/30-domain-reference/providers/agent-execution/README.md](../../design/30-domain-reference/providers/agent-execution/README.md), [docs/design/30-domain-reference/providers/work-source/README.md](../../design/30-domain-reference/providers/work-source/README.md), [docs/design/30-domain-reference/providers/forge-collaboration/README.md](../../design/30-domain-reference/providers/forge-collaboration/README.md), [docs/design/30-domain-reference/providers/execution-host/README.md](../../design/30-domain-reference/providers/execution-host/README.md), [docs/design/30-domain-reference/foundation/configuration-and-policy/README.md](../../design/30-domain-reference/foundation/configuration-and-policy/README.md), [docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md](../../design/30-domain-reference/foundation/credentials-and-secrets/README.md), [docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md](../../design/30-domain-reference/foundation/storage-and-artifacts/README.md), [docs/design/30-domain-reference/foundation/workspace-and-repository/README.md](../../design/30-domain-reference/foundation/workspace-and-repository/README.md).

## 2. Product-Visible Behaviors Worth Preserving

### Operator-facing behavior (human-first control)
1. Operator has a single, stable control surface for start/preview/inspect/stop/recovery with deterministic results and explainability (`/operator command surface`) [docs/design/30-domain-reference/edge/operator-surface/README.md](../../design/30-domain-reference/edge/operator-surface/README.md).
2. Long-running work is transparent via recorded run status, attention events, and concise explanations tied to evidence, not chatty narrative guesses [docs/design/30-domain-reference/core/observability-and-analysis/README.md](../../design/30-domain-reference/core/observability-and-analysis/README.md).
3. High-risk or policy-flagged actions are always surfaced to the operator, with bounded wait windows and explicit park/resume behavior [docs/design/10-architecture/human-control-and-approvals.md](../../design/10-architecture/human-control-and-approvals.md).

### Task intake and assignment
4. A run starts from an explicit task source snapshot (track/task/spec refs/spec digest/source revision) and task claim is race-safe with immutable snapshot evidence [docs/design/30-domain-reference/providers/work-source/README.md](../../design/30-domain-reference/providers/work-source/README.md).
5. Task status is owned by the work source, while run activity is owned by the run event log; they are separate authorities [docs/design/10-architecture/architecture.md](../../design/10-architecture/architecture.md) and [docs/design/00-orientation/requirements.md](../../design/00-orientation/requirements.md#fr-11).

### Execution flow and responsibilities
6. Worker and runner responsibilities are distinct: the worker edits and commits locally, the runner owns verification, PR operations, merge, and irreversible actions [docs/design/10-architecture/architecture.md](../../design/10-architecture/architecture.md), [docs/design/10-architecture/runtime-flow.md](../../design/10-architecture/runtime-flow.md).
7. Runtime is evidence-driven end-to-end (task claim -> workspace -> worker session -> approvals -> runner verify -> forge evidence -> completion/merge decisions) [docs/design/10-architecture/runtime-flow.md](../../design/10-architecture/runtime-flow.md).
8. Merge is not merely “green status”; it requires completion evidence, merge evidence, policy conformance, exact head matching, and capability allowance [docs/design/10-architecture/evidence-gates-and-merge.md](../../design/10-architecture/evidence-gates-and-merge.md).

### Safety and control quality
9. Any missing/ambiguous requirement transitions the system to a blocked or parked state rather than guessing [docs/design/10-architecture/evidence-gates-and-merge.md](../../design/10-architecture/evidence-gates-and-merge.md), [docs/design/10-architecture/recovery-and-reconciliation.md](../../design/10-architecture/recovery-and-reconciliation.md).
10. Recovery is in-band and rule-based, including resume vs restart and repo-level duplicate run prevention across processes [docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md](../../design/30-domain-reference/core/recovery-and-reconciliation/README.md).
11. Evidence-backed anti-gaming checks remain visible to users: protected-policy changes require explicit approval and re-verification [docs/design/30-domain-reference/core/completion-and-merge/README.md](../../design/30-domain-reference/core/completion-and-merge/README.md).

### Security and credential behavior
12. The worker never receives Forge credentials; runner-only credential use and redaction are enforced and auditable [docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md](../../design/30-domain-reference/foundation/credentials-and-secrets/README.md).
13. Network actions are permissioned and explainable via resolved policy and capability checks (no silent privilege escalation) [docs/design/30-domain-reference/foundation/configuration-and-policy/README.md](../../design/30-domain-reference/foundation/configuration-and-policy/README.md).

## 3. Design Language To Translate

Translate these as product language:

- `Event log as single source of truth` [docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md](../../design/30-domain-reference/core/run-lifecycle-and-state/README.md)
  - **Product meaning:** Every run should be reconstructible from one durable timeline.

- `Failure is parked, not ignored`
  - **Product meaning:** If a required fact is missing, the run stops and asks the right person.

- `Fail-closed` [docs/design/10-architecture/evidence-gates-and-merge.md](../../design/10-architecture/evidence-gates-and-merge.md)
  - **Product meaning:** Safe default is to do nothing when we cannot prove safety.

- `Two authorities: task status vs run activity` [docs/design/10-architecture/architecture.md](../../design/10-architecture/architecture.md)
  - **Product meaning:** Backlog progress (Work Source) and run lifecycle are separate control planes and should not be mixed.

- `Capability attestation = proven ability, not promise` [docs/design/10-architecture/capability-attestation.md](../../design/10-architecture/capability-attestation.md)
  - **Product meaning:** Features (auto-approval, auto-recover, auto-merge, unattended run) only appear when tested and current.

- `Runner-owned evidence` (verify, forge reads, local git evidence) [docs/design/10-architecture/runtime-flow.md](../../design/10-architecture/runtime-flow.md)
  - **Product meaning:** A worker’s statement is useful but never sufficient for approvals.

- `Completion` vs `Merge` decisions [docs/design/30-domain-reference/core/completion-and-merge/README.md](../../design/30-domain-reference/core/completion-and-merge/README.md)
  - **Product meaning:** “Done” and “merged” are separate milestones with separate proof requirements.

- `Recovered run` categories (resume/restart/operator-required/forbidden)
  - **Product meaning:** Recovery should be explicit, explainable, and bounded in scope.

## 4. Design Details To Avoid Importing Into Product

1. Do not copy implementation-only scaffolding into product requirements: driver-specific seams, provider contract internals, FS-specific lease token semantics, and exact event field names [docs/design/30-domain-reference/README.md](../../design/30-domain-reference/README.md).
2. Avoid exposing low-level infrastructure states directly (`run-writer`, `story-launch` internals, fsync class, durability modes, lease epoch internals) as user-facing behavior [docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md](../../design/30-domain-reference/foundation/storage-and-artifacts/README.md).
3. Avoid requiring users to know provider schemas, command digest formats, tool prefix tokens, and protocol-specific session IDs [docs/design/30-domain-reference/providers/agent-execution/README.md](../../design/30-domain-reference/providers/agent-execution/README.md).
4. Avoid prescribing local implementation details that should remain implementation-private: process trees, cwd containment ladders, or exact kill timing sequences [docs/design/30-domain-reference/providers/execution-host/README.md](../../design/30-domain-reference/providers/execution-host/README.md).
5. Keep model-lean product promises around outcomes and trust boundaries; not around internal event naming, field-level schemas, or protocol transport details [docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md](../../design/30-domain-reference/core/run-lifecycle-and-state/README.md).

## 5. Suggested Simple Product Themes

1. **Transparent Operator Control Plane**
   - Single command surface with predictable results and searchable explanations for each major action [docs/design/30-domain-reference/edge/operator-surface/README.md](../../design/30-domain-reference/edge/operator-surface/README.md).

2. **Evidence-First Completion**
   - A run is visible as progressing only when claim, workspace, verify, forge checks, and merge checks are independently captured [docs/design/10-architecture/runtime-flow.md](../../design/10-architecture/runtime-flow.md), [docs/design/30-domain-reference/core/completion-and-merge/README.md](../../design/30-domain-reference/core/completion-and-merge/README.md).

3. **Safe Autonomy Spectrum**
   - Expose three tiers: manual, assisted, and blocked/parked states, with explicit reasons and required human action for high-risk cases [docs/design/10-architecture/human-control-and-approvals.md](../../design/10-architecture/human-control-and-approvals.md).

4. **Run Integrity, Not Speed**
   - Prioritize deterministic sequencing, duplicate-run prevention, and stable re-try semantics over parallel throughput [docs/design/10-architecture/recovery-and-reconciliation.md](../../design/10-architecture/recovery-and-reconciliation.md), [docs/design/10-architecture/architecture.md](../../design/10-architecture/architecture.md).

5. **Credential Safety by Construction**
   - Product statement: workers operate with minimal secrets; runner carries privileged actions with full traceability and redaction [docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md](../../design/30-domain-reference/foundation/credentials-and-secrets/README.md).

6. **Policy-Driven Protection of Merge Path**
   - Protected-file changes and merge-critical evidence should trigger explicit policy gates and review checkpoints [docs/design/30-domain-reference/core/completion-and-merge/README.md](../../design/30-domain-reference/core/completion-and-merge/README.md).

## 6. Implications For Rebuild

- Keep **run lifecycle ownership and interfaces** aligned with `run` = durable artifact, while keeping domain boundaries intact (`operator`, `core`, `provider`, `foundation`) to prevent host/protocol coupling [docs/design/10-architecture/architecture.md](../../design/10-architecture/architecture.md).
- Rebuild acceptance criteria should use behavior checks: evidence completeness, explainability, recoverability, and no silent default actions [docs/design/00-orientation/requirements.md](../../design/00-orientation/requirements.md).
- Prioritize a single “proof ledger” view in product UX with explicit state transitions: started → worker-running → waiting → verifying → merge-ready/blocked/failed, rather than deep internal event detail [docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md](../../design/30-domain-reference/core/run-lifecycle-and-state/README.md).
- Build merge and completion as separate milestones with explicit policy gates and exact-head verification so users can understand why merge is held even when tests appear “done” [docs/design/10-architecture/evidence-gates-and-merge.md](../../design/10-architecture/evidence-gates-and-merge.md), [docs/design/30-domain-reference/core/completion-and-merge/README.md](../../design/30-domain-reference/core/completion-and-merge/README.md).
- Make recovery explicit and user-readable (`parked`, `operator-required`, `blocked`, `restarting`), with no blind relaunch semantics [docs/design/10-architecture/recovery-and-reconciliation.md](../../design/10-architecture/recovery-and-reconciliation.md).
- Treat credentials as a foundational trust policy in rebuild planning: worker privilege minimization, redaction, and audited usage should be non-negotiable [docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md](../../design/30-domain-reference/foundation/credentials-and-secrets/README.md).
- Maintain evidence capture boundaries: worker reports are suggestions; only independently captured run evidence can change outcome state [docs/design/10-architecture/human-control-and-approvals.md](../../design/10-architecture/human-control-and-approvals.md), [docs/design/10-architecture/runtime-flow.md](../../design/10-architecture/runtime-flow.md).

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Jig product layer rebuild review](./README.md) · **← Prev:** [01 — Product Layer Read (R01-PRODUCT-LAYER-READ)](./01-product-layer-read.md) · **Next →:** [03 — Product Skills Inventory (R03-PRODUCT-SKILLS-INVENTORY)](./03-product-skills-inventory.md)

<!-- /DOCS-NAV -->
