← [Back to README](./README.md)

# Acceptance criteria

*Grouped by the five-guarantee structure plus execution-plan schema and delivery surfaces.
Each group uses the prefix established in `jig.md`. `plan-delivery-track` maps stories to
these IDs.*

---

## ① Control & trust — Runtime authorization (PREFIX `FENCE`)

| # | Criterion | Designation |
|---|---|---|
| **FENCE-1** | Every request the worker makes — command execution, file write, network call, provider call — is checked against the approved permission set before it executes. An unauthorized request fails closed; it is never silently permitted or deferred. | **[ship blocker]** |
| **FENCE-2** | The default for an unrecognized request is denial, not approval. Jig never "asks later" at runtime in a way the worker can answer; permission widening requires a human-facing re-approval gate. | **[ship blocker]** |
| **FENCE-3** | The worker holds no forge credentials (push tokens, merge authority, or equivalent). Credentials required for irreversible actions are held exclusively by the runner and never transferred to the worker environment. | **[ship blocker]** |
| **FENCE-4** | Permissions are scoped per-run and per-track. Permissions granted for one run or track do not carry over to another run or track without explicit re-authorization. | **[ship blocker]** |
| **FENCE-5** | The authorization fence covers all request paths, including third-party agent SDK calls, MCP tool invocations, and any extensibility-hook paths — there is no bypass route for any category of request. | **[ship blocker]** |
| **FENCE-6** | The worker's access to the event log is bounded to events tagged with its own story ID. The worker cannot read cross-story events, run-level policy events, gate evaluation outcomes for other stories, or capability attestation results outside its own scope. | **[ship blocker]** |

---

## ① Control & trust — Capability attestation (PREFIX `EARN`)

| # | Criterion | Designation |
|---|---|---|
| **EARN-1** | Before the runner grants a driver autonomous use of a capability, a fresh positive capability probe must succeed for that driver. A positive probe demonstrates a live, functional capability — not merely that the configuration references a credential or that a prior session reported success. Missing, stale, or failed proof routes to a human, regardless of how permissive the policy is set. | **[ship blocker]** |
| **EARN-2** | Capability attestation is per-driver and re-evaluated at the start of each run. An attestation from a prior run is not reused without re-verification. | **[ship blocker]** |
| **EARN-3** | Every capability attestation result — success or failure — is recorded as a durable event in the event log the instant it is produced. | **[ship blocker]** |
| **EARN-4** | A driver that cannot attest a capability receives more human escalation checkpoints for that capability and never silently loses a guarantee. Reduced autonomy is the correct degradation mode; silent failure is not. | **[ship blocker]** |

---

## ① Control & trust — Anti-gaming (PREFIX `GUARD`)

| # | Criterion | Designation |
|---|---|---|
| **GUARD-1** | The policy in force is fixed at the moment a run launches. The worker cannot write, patch, or otherwise modify the active policy during the run. | **[ship blocker]** |
| **GUARD-2** | Work that touches protected files — CI definitions, the policy itself, gate configuration, verification setup — is blocked from completion until the human explicitly re-approves and the work is re-verified under the original (pre-change) policy. The runner enforces this regardless of what the worker proposes. | **[ship blocker]** |
| **GUARD-3** | Every re-approval and re-verification triggered by a protected-file change is recorded as an explicit event in the event log, including who approved, when, and under what policy. | **[ship blocker]** |
| **GUARD-4** | Repo-level policy floors cannot be weakened by per-track policy configuration. A track may tighten floors; it may not loosen them below the repo floor. | **[ship blocker]** |
| **GUARD-5** | A file is considered protected by one of two mechanisms: (1) the system-inferred set — CI configuration files, the active policy file, gate setup files, and verification configuration — which is always protected and cannot be excluded by per-track policy; or (2) a policy-declared protected-path list that the user extends with glob patterns. The policy-declared list may extend but not shrink the system-inferred set. A story that writes to any file matching either mechanism triggers the GUARD-2 re-approval flow. | **[ship blocker]** |

---

## ① Control & trust — Approval and escalation (PREFIX `DOOR`)

| # | Criterion | Designation |
|---|---|---|
| **DOOR-1** | A deterministic risk classification drives an escalation ladder: low-risk, proven work proceeds automatically; medium-risk, high-risk, or unproven work routes to a human. The default when classification is ambiguous is fail-closed escalation to a human. | **[ship blocker]** |
| **DOOR-2** | An escalation is persisted as a durable event the instant it fires. The run parks at the escalation point and survives a process or machine restart without losing the pending question or any prior progress. | **[ship blocker]** |
| **DOOR-3** | A grant in response to an escalation is scoped as tightly as the situation allows — this command, this command prefix, this host, this session — never a blanket grant for the duration of the run or beyond. | **[ship blocker]** |
| **DOOR-4** | The risk thresholds and escalation targets are configurable through policy. The default classification table, which ships with the _prevention_ preset, categorizes requests into three tiers: **low-risk** (read operations, local file reads within declared scope, running local tests); **medium-risk** (writes outside declared scope, network calls, provider API calls not pre-approved by capability attestation); **high-risk** (irreversible operations — push, merge, delete — any operation touching protected files, any operation requiring forge credentials, any scope-widening action). Operators may tighten these thresholds; the default when no threshold matches is high-risk (fail-closed escalation). Under the _balanced_ preset, a positive capability attestation satisfies the medium-risk gate for the specific attested capability — that capability proceeds automatically; unattested medium-risk actions still escalate to a human. | **[ship blocker]** |
| **DOOR-5** | The user can inspect the current escalation queue — what is pending, what was decided, and when — from the event log without additional tooling. | **[ship blocker]** |
| **DOOR-6** | Escalations do not expire automatically. A run parked at an escalation point remains parked indefinitely until the human decides (approve, reject, or cancel the run). Jig does not auto-resolve an escalation on timeout. A future Phase 2 feature may add configurable escalation timeouts; automatic expiry is not a Phase 0 requirement. | **[ship blocker]** |
| **DOOR-7** | When a protected file changes under a parked escalation (GUARD-2 / RESUME-5 scenario), the re-approval covers the new change set only. Stories that were already completed and merged before the protected-file change was detected are not re-run unless they directly produced or modified the protected file. The re-approval flow uses the same DOOR escalation mechanism, not a separate pathway. | **[ship blocker]** |

---

## ① Control & trust — Merge-on-evidence (PREFIX `MERGE`)

| # | Criterion | Designation |
|---|---|---|
| **MERGE-1** | Completing and landing a story requires independent evidence — CI pass, all required reviews, capability attestation — before the merge action is taken. The worker's self-report is never sufficient. | **[ship blocker]** |
| **MERGE-2** | Push and merge are performed exclusively by the runner. The worker that writes code cannot initiate, trigger, or circumvent a push or merge. | **[ship blocker]** |
| **MERGE-3** | The conditions under which a change may merge are explicit, bound to the policy's merge spectrum, recorded in the event log before the merge action executes, and not modifiable by the worker. | **[ship blocker]** |
| **MERGE-4** | The merge spectrum is a declarative policy setting. At Phase 0, two preset merge behaviors ship: _prevention_ — the runner pushes the branch and parks; the human must manually initiate the merge after reviewing; _balanced_ — the runner auto-merges on evidence (CI pass + all required reviews resolved, with at least one reviewer). The _throughput_ preset ships in Phase 1: auto-merges on CI pass with no required review by default. Any intermediate configuration is expressible through policy. | **[ship blocker]** |

---

## ② Configuration (PREFIX `CFG`)

| # | Criterion | Designation |
|---|---|---|
| **CFG-1** | Policy is the governance contract; it covers gating posture, merge spectrum, concurrency ceiling, retry budget, required review configuration, approval and escalation rules, and anti-gaming protection. Changing it during a run requires explicit human re-approval and re-verification. | **[ship blocker]** |
| **CFG-2** | Work profile is the realization; it covers model, effort, prompt strategy, and role configuration. Profile changes are not safety-gated; a profile change takes effect on the next story that starts. | **[ship blocker]** |
| **CFG-3** | Policy and work profile are scoped per track. A track policy may not weaken repo-level policy floors. | **[ship blocker]** |
| **CFG-4** | The actual concurrency and execution parameters for a run are derived by Jig from the policy's concurrency ceiling and the plan's current eligible story set. The eligible set is re-evaluated continuously as stories complete and their dependents become unblocked. The user sets intent through policy; Jig derives the live parameters. The user cannot hand-set the live concurrency count or task queue directly. | **[ship blocker]** |
| **CFG-5** | Jig ships a guided setup flow that interviews the user on their intent (gating aggressiveness, PR behavior, review requirements, prompt strategy) and maps their answers to a named preset. The user never encounters a raw configuration surface before the guided setup completes. | **[ship blocker]** |
| **CFG-6** | At Phase 0, two canonical presets are shipped and fully documented with their reasoning and policy-field defaults: _prevention_ (merge spectrum = human-initiates-merge; required reviews = at least one; gating = fail-closed on all unproven capabilities; concurrency ceiling = conservative; escalation threshold default = as per DOOR-4 default table) and _balanced_ (merge spectrum = auto-merge on evidence; required reviews = at least one; gating = fail-closed on high-risk, escalate on medium-risk with capability attestation; concurrency ceiling = moderate; escalation threshold default = as per DOOR-4 default table). Each preset is a usable, self-contained starting configuration. | **[ship blocker]** |
| **CFG-7** | Jig exposes stable extensibility contracts (hooks for scheduling, custom story sources, observability consumers, the fix-forward scan seam) that allow operators and tool integrators to build on top of Jig without modifying its core. These contracts are documented and versioned. The fix-forward scan seam is an enable-not-build hook: at each blocked or merged story, Jig emits the story record (ID, outcome, block reason if blocked, AC ID references) and the event log slice for that story; the hook may return one of: `approve` (no action), `flag-for-follow-up` (Jig records the flag as an event), or `spawn-story` (Jig appends a follow-up story to the plan). The scan implementation is external. | **[target]** |
| **CFG-8** | Jig ships tooling and documentation for the three-level prompt-strategy ladder: fully dynamic per task, templated and plan-injected, unified role prompts. Versioned generation guidelines at each level are provided as recommended practice. | **[target]** |
| **CFG-9** | At Phase 1, the _throughput_ preset ships: merge spectrum = auto-merge on CI pass; required reviews = none by default; gating = escalate only on high-risk; concurrency ceiling = high; fix-forward scan seam enabled via CFG-7. | **[target]** |

---

## ③ Recovery — Interruption resume (PREFIX `RESUME`)

| # | Criterion | Designation |
|---|---|---|
| **RESUME-1** | Completed work and state transitions are persisted to durable storage the moment they occur. A process crash, machine restart, or provider timeout does not lose progress that was already recorded. | **[ship blocker]** |
| **RESUME-2** | On resume, the run continues from the last safe checkpoint. Only work that was not yet durably recorded re-runs; already-completed work does not re-execute. | **[ship blocker]** |
| **RESUME-3** | Irreversible actions already recorded (push, PR creation, merge) are never repeated on resume. The runner detects prior-action records and skips them. | **[ship blocker]** |
| **RESUME-4** | When Jig cannot safely determine how to continue, it parks in a named, inspectable state with a structured error that identifies the state reached and what is needed to proceed. It never silently advances or silently abandons progress. | **[ship blocker]** |
| **RESUME-5** | On resume, Jig re-validates the policy and contract context against what was in force at the checkpoint. If a protected element changed while the run was down, Jig triggers re-approval and re-verification before continuing — the same anti-gaming protection as GUARD-1/GUARD-2. | **[ship blocker]** |

---

## ③ Recovery — Fault isolation (PREFIX `ISO`)

| # | Criterion | Designation |
|---|---|---|
| **ISO-1** | A blocked or rejected story halts only itself and the stories directly downstream of it in the dependency graph. Every story with no dependency path through the blocked story continues running. | **[ship blocker]** |
| **ISO-2** | The resolution behavior for a blocked story is determined by the policy's gating posture: prevention-leaning = quarantine the blocked subgraph and surface it to a human or re-plan queue, resume once resolved, optionally open PRs for mergeable work; throughput-leaning = merge eligible independent work, log the block, enable the fix-forward scan seam for the blocked item. | **[ship blocker]** |
| **ISO-3** | Every block is recorded as a first-class, structured event in the event log with the story ID, the reason for the block, and a timestamp. This event is the input for human triage, automated scans, and the learning loop. | **[ship blocker]** |

---

## ④ Stack seams (PREFIX `STACK`)

| # | Criterion | Designation |
|---|---|---|
| **STACK-1** | All five guarantees — control, evidence, configuration, recovery, observability — hold regardless of which agent driver is plugged into the Agent seam. A weaker driver earns less autonomy via EARN; it never silently degrades a guarantee. | **[ship blocker]** |
| **STACK-2** | Jig exposes four stable, documented seam contracts — Agent, Execution Host, Forge, Work Source — each independently swappable. The contracts are versioned and include capability probe specifications. | **[ship blocker]** |
| **STACK-3** | At Phase 0, at least one driver is shipped and tested for each of the four seams: Codex agent driver, one execution host driver, GitHub forge driver, one work source driver. | **[ship blocker]** |
| **STACK-4** | Driver capabilities are attested per driver per run (EARN-1/EARN-2). A driver that cannot prove a capability gets more human escalation checkpoints for that capability — never a silently degraded guarantee. | **[ship blocker]** |
| **STACK-5** | Credentials and authority do not cross seam boundaries. The worker never holds forge credentials; the forge seam is the exclusive path for push/PR/merge authority. | **[ship blocker]** |
| **STACK-6** | A Claude agent adapter ships in Phase 1 against the Agent seam contract, with full capability attestation and guarantee-invariance verified. | **[target]** |
| **STACK-7** | At least one additional forge driver (beyond GitHub) ships in Phase 1. | **[target]** |
| **STACK-8** | The Work Source seam produces stories conformant to the execution-plan schema (PLAN-4): each story has a unique ID, declared scope, explicit dependency references (or an empty set), and references to acceptance criteria IDs. A Work Source driver may represent stories from any task-tracking system (files, GitHub Issues, Jira, etc.) as long as its output conforms to the schema. The Phase 0 work source driver supports plan files as the story source. | **[ship blocker]** |

---

## ⑤ Observability (PREFIX `SEE`)

| # | Criterion | Designation |
|---|---|---|
| **SEE-1** | Every run produces a complete event log covering: authorization decisions, capability attestations, gate outcomes, state transitions, escalations and their resolutions, approvals, story starts/completions/blocks, push/PR/merge actions, and run-level start/pause/resume/stop events. Nothing relevant to "what happened and why" is omitted. | **[ship blocker]** |
| **SEE-2** | The event log is machine-readable with a documented, versioned schema. It is an explicit product surface and an input contract for suite-level tools; it is not a debugging side-channel. | **[ship blocker]** |
| **SEE-3** | Observability and gates share one source of truth. The exact records that were evaluated when a gate fired are the records the user inspects afterward. There is no separate audit trail that can drift out of agreement with what actually governed the run. | **[ship blocker]** |
| **SEE-4** | On the minimal product — Jig alone, no learning loop or additional tooling — a developer can diagnose a bad plan or bad policy by reading the event log directly. The event log is self-explanatory without additional tooling. | **[ship blocker]** |
| **SEE-5** | A structured run-export operation produces a complete, human-readable summary of a full run (stories executed, gates evaluated, escalations, final outcome) without requiring the user to parse raw event log records. | **[target]** |

---

## Execution-plan input schema (PREFIX `PLAN`)

| # | Criterion | Designation |
|---|---|---|
| **PLAN-1** | Jig validates every submitted execution plan against a documented, versioned schema at ingestion. A plan that fails validation is rejected with a structured, human-readable error before any story is started, any event is emitted, or any resource is allocated. | **[ship blocker]** |
| **PLAN-2** | The execution-plan schema is the single hard schema boundary in the suite. Upstream products (design→plan and others) produce conformant artifacts; BYO plans are accepted as long as they conform. There is no secondary or implicit schema boundary. | **[ship blocker]** |
| **PLAN-3** | The execution-plan schema is versioned. Breaking changes to the schema define a documented migration path; Jig rejects plans whose schema version it does not recognize rather than silently interpreting them. | **[ship blocker]** |
| **PLAN-4** | The schema enforces that every story in the plan has: a unique ID, a declared scope, explicit dependency references (or an empty set), and references to acceptance criteria IDs from the source PRD. A plan missing any of these fields per story is rejected at ingestion. | **[ship blocker]** |

---

## Delivery surfaces (PREFIX `SURF`)

| # | Criterion | Designation |
|---|---|---|
| **SURF-1** | Jig is invocable as a Claude Code skill (`jig` skill) from within a Claude agent session. All five guarantees and all policy controls are fully exercised through the skill invocation surface. | **[ship blocker]** |
| **SURF-2** | Jig is invocable as a standalone CLI command (`jig`). The CLI surface exposes the same plan submission, policy configuration, run management, and event log inspection capabilities as the skill surface. | **[ship blocker]** |
| **SURF-3** | Jig is invocable programmatically via an MCP server interface. The Phase 1 MCP surface exposes run management (start, pause, resume, cancel, status query) and event log query capabilities. Plan submission and policy configuration are not available via the MCP surface at Phase 1; the CLI and skill surfaces remain the primary authoring interfaces for those operations. | **[target]** |

---

## Ship-blocker summary

All `[ship blocker]` criteria must be met before Jig ships v1.0.0. These are:
FENCE-1 through FENCE-6, EARN-1 through EARN-4, GUARD-1 through GUARD-5,
DOOR-1 through DOOR-7, MERGE-1 through MERGE-4, CFG-1 through CFG-6,
RESUME-1 through RESUME-5, ISO-1 through ISO-3, STACK-1 through STACK-5, STACK-8,
SEE-1 through SEE-4, PLAN-1 through PLAN-4, SURF-1 through SURF-2.

`[target]` criteria (CFG-7, CFG-8, CFG-9, STACK-6, STACK-7, SEE-5, SURF-3) may be deferred to
Phase 1 or Phase 2 with a documented workaround or timeline.

---
Previous: [07-success-metrics](./07-success-metrics.md) · Next: [09-risks-and-open-questions](./09-risks-and-open-questions.md) · Up: [README](./README.md)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Jig PRD](./README.md) · **← Prev:** [Success metrics](./07-success-metrics.md) · **Next →:** [Risks and open questions](./09-risks-and-open-questions.md)

<!-- /DOCS-NAV -->
