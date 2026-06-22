# Orchestration and autonomy audit

## Scope and method

This audit covers event log, Work Source, workspace/repository, Agent provider, Forge provider,
Execution Host, capability attestation, worker/runner split, approval, completion, recovery, leases,
and reconciliation.

Classifications:

- `strong` - implemented and backed by code, tests, or durable repo practice.
- `partial` - designed, scaffolded, or implemented only for a narrower substrate than the full
  orchestration behavior.
- `gap` - no concrete runtime product behavior found in the current tree.
- `not applicable` - deliberately out of current v1 scope.

The starting evidence is the guideline matrix and current system map. The matrix rates harness lessons
around event logs, workspace isolation, worker/runner split, capability attestation, reconciliation, and
recovery as mostly strong in design but partial in runtime
(`docs/research/agent-harness-lessons/GUIDELINE-MATRIX.md:22-30`). The system map is the key guardrail:
foundation storage, workspace/repository, credentials, and the verify gate have real implementation, while
providers and deterministic core orchestration are designed or scaffolded but not substantially implemented
(`docs/research/agent-harness-lessons/repo-audit/current-system-map.md:38-45`,
`docs/research/agent-harness-lessons/repo-audit/current-system-map.md:60-72`).

## Top findings

1. `partial` - kit-vnext has a real foundation substrate, not yet a running autonomous orchestrator.
   Storage/event-log, leases, artifacts, workspace/repository, local git evidence, credentials, and policy
   are implemented, but run lifecycle, provider ports, approval relay, completion, and recovery are still
   design or implementation-story surfaces.

2. `strong` - the append-only event-log and lease primitives are implemented at the foundation layer. The
   SDK exposes append/replay types, lease-bound handles, receipts, durability classes, and replay results
   (`packages/sdk/src/foundation/storage/event-log/event-log-types.ts:27-70`). Filesystem storage rejects
   stale writers, enforces expected sequence, commits durable records, and returns digest evidence
   (`packages/sdk/src/foundation/storage/filesystem/filesystem-storage.ts:78-209`). Tests cover stale
   writer rejection, buffered/durable/barrier behavior, and replay evidence
   (`packages/sdk/tests/foundation/storage/event-log/event-log-contract.unit.test.ts:49-120`,
   `packages/sdk/tests/foundation/storage/event-log/event-log-contract.unit.test.ts:144-237`).

3. `strong` - leases are concrete and suitable as a coordination substrate. The lease store supports
   acquire, renew, release, read, and fence (`packages/sdk/src/foundation/storage/leases/lease-store-types.ts:19-25`).
   Filesystem leases use guard files and TTL/epoch/token fencing
   (`packages/sdk/src/foundation/storage/filesystem/filesystem-lease-store.ts:107-160`,
   `packages/sdk/src/foundation/storage/filesystem/filesystem-lease-store.ts:167-254`,
   `packages/sdk/src/foundation/storage/filesystem/filesystem-lease-store.ts:303-320`). Tests verify
   monotonic epochs, stale renew/release rejection, digest-only snapshots, fencing, and fail-closed
   degraded storage (`packages/sdk/tests/foundation/storage/leases/lease-store.unit.test.ts:24-67`,
   `packages/sdk/tests/foundation/storage/leases/lease-store.unit.test.ts:88-141`,
   `packages/sdk/tests/foundation/storage/leases/lease-store.unit.test.ts:198-246`).

4. `strong` - workspace/repository is implemented for local worktree and branch preparation. The
   `WorkspaceRepository` interface creates leases, evaluates and confirms setup, records local git
   evidence, finalizes leases, and cleans leases
   (`packages/sdk/src/foundation/workspace-repository/worktree/index.ts:187-194`). `createLease` validates
   repo/path inputs, resolves the base ref, checks path conflicts, acquires a lease, creates the worktree
   and local branch, then emits append intents
   (`packages/sdk/src/foundation/workspace-repository/worktree/index.ts:376-588`). Local git evidence
   captures head, merge base, commits, changed paths, patch/stat refs, and working tree cleanliness
   (`packages/sdk/src/foundation/workspace-repository/evidence/index.ts:32-50`,
   `packages/sdk/src/foundation/workspace-repository/evidence/index.ts:117-143`).

5. `partial` - workspace cleanup/recovery exists only as local foundation cleanup, not as whole-run
   recovery. The cleanup code blocks on unfinalized leases, dirty worktrees, path conflicts, registration
   leftovers, branch head mismatches, and checked-out branches
   (`packages/sdk/src/foundation/workspace-repository/cleanup/index.ts:318-424`,
   `packages/sdk/src/foundation/workspace-repository/cleanup/index.ts:426-608`). The higher-level recovery
   charter still describes planned classifier, safety classes, resume/restart eligibility, story-launch
   leases, and reconciliation records (`docs/implementation/domains/core/core-06-recovery-and-reconciliation.md:14-20`,
   `docs/implementation/domains/core/core-06-recovery-and-reconciliation.md:61-69`).

6. `gap` - no concrete Work Source, Agent, Forge, or Execution Host driver behavior is implemented.
   Provider packages declare roles but explicitly state they contain no domain behavior, provider driver
   logic, credential handling, network calls, process execution, or forge integration
   (`packages/provider-codex/README.md:23-26`, `packages/provider-github/README.md:23-26`,
   `packages/provider-local/README.md:24-27`, `packages/provider-markdown/README.md:24-27`). Epic 6 is the
   planned home for real Markdown Work Source, Local Execution Host, GitHub Forge, and Codex Agent drivers
   (`docs/implementation/epics/epic-6-concrete-provider-drivers/README.md:13-15`,
   `docs/implementation/epics/epic-6-concrete-provider-drivers/README.md:49-61`).

7. `partial` - capability attestation is strong design and policy, but not a runtime gate yet. Architecture
   requires probed `CapabilityAttestation` records and fresh positive attestations before autonomous powers
   are allowed (`docs/design/10-architecture/architecture.md:78-104`). Accepted decisions make the four
   provider interfaces and `CapabilityAttestation` SDK-owned production surface
   (`docs/design/40-decisions/accepted-decisions.md:111-119`). Current code has capability policy defaults
   with all autonomous powers off and fresh-attestation required
   (`packages/sdk/src/foundation/configuration-policy/defaults/defaults.ts:56-73`), but the core gate layer
   is still a charter, not runtime code (`docs/implementation/domains/core/core-02-capability-and-safety.md:14-20`,
   `docs/implementation/domains/core/core-02-capability-and-safety.md:54-62`).

8. `partial` - the worker/runner split is a clear invariant but not yet enforced by a composed runtime.
   Design assigns edits and local commits to the worker, while runner-owned verify, push, PR, evidence, and
   merge happen via Execution Host and Forge (`docs/design/10-architecture/architecture.md:116-134`,
   `docs/design/10-architecture/architecture.md:138-149`). AD-12 also forbids Forge credentials in the
   worker and binds evidence to exact head SHA (`docs/design/40-decisions/accepted-decisions.md:79-85`).
   Policy defaults allow runner push/open-PR but keep merge disabled by default
   (`packages/sdk/src/foundation/configuration-policy/defaults/defaults.ts:86-90`). With Forge and Execution
   Host drivers still skeletons, this remains design plus policy, not end-to-end enforcement.

9. `partial` - approval has policy/schema implementation but no approval relay runtime. The policy schema
   supports manual/assisted mode, parking on human latency, recorded decisions, and decision windows
   (`packages/sdk/src/foundation/configuration-policy/schema/types.ts:66-83`), and defaults require recorded
   assisted decisions (`packages/sdk/src/foundation/configuration-policy/defaults/defaults.ts:31-49`). Core-03
   still owns implementation planning for normalized requests, deterministic classification, scoped grants,
   pending approval state, and park/resume facts
   (`docs/implementation/domains/core/core-03-approval-and-escalation.md:14-19`,
   `docs/implementation/domains/core/core-03-approval-and-escalation.md:54-63`).

10. `gap` - completion and merge are not product behavior yet. Requirements demand runner-gathered evidence
    and evidence-based merge decisions (`docs/design/00-orientation/requirements.md:22-24`). Core-05 is still
    an implementation-planning charter for candidate-head evidence, verification freshness, merge predicates,
    Forge operation intents, and post-merge classification
    (`docs/implementation/domains/core/core-05-completion-and-merge.md:14-20`,
    `docs/implementation/domains/core/core-05-completion-and-merge.md:57-67`). Epic 5 is ready but describes
    outputs to be built, not current runtime behavior
    (`docs/implementation/epics/epic-5-completion-verification-and-recovery/README.md:45-56`,
    `docs/implementation/epics/epic-5-completion-verification-and-recovery/README.md:116-122`).

11. `partial` - reconciliation is designed around two authorities and launch ordering, but only low-level
    storage/workspace primitives are implemented. Requirements split task status from run activity
    (`docs/design/00-orientation/requirements.md:17-28`), AD-17 keeps Work Source audit citation as task
    metadata rather than run truth (`docs/design/40-decisions/accepted-decisions.md:121-130`), and AD-18
    defines story-launch lease and Work Source claim ordering
    (`docs/design/40-decisions/accepted-decisions.md:132-144`). The Work Source concrete provider and core
    recovery/reconciliation layer are still planned (`docs/implementation/domains/providers/prov-03-work-source.md:14-23`,
    `docs/implementation/domains/core/core-06-recovery-and-reconciliation.md:41-50`).

12. `not applicable` - full auto/LLM-adjudicated autonomy should not be counted as a current product gap.
    v1 explicitly excludes auto/orchestrator-decide approval (`docs/design/00-orientation/requirements.md:45-51`),
    and AD-14 limits v1 to manual and assisted modes with nondeterministic inputs recorded as events
    (`docs/design/40-decisions/accepted-decisions.md:93-98`).

## Surface classification

| Surface | Classification | Current implementation status |
|---|---|---|
| Foundation event log | `strong` | Append/replay contracts, leases, receipts, durability, filesystem persistence, and tests exist. |
| Core run lifecycle/event state | `partial` | Storage substrate exists; event envelopes, lifecycle transitions, projections, cursors, and session links remain planned (`docs/implementation/domains/core/core-01-run-lifecycle-and-state.md:14-29`, `docs/implementation/domains/core/core-01-run-lifecycle-and-state.md:57-65`). |
| Leases | `strong` | Generic lease store and filesystem guard/fence implementation are real and tested. |
| Story-launch coordination | `partial` | AD-18 defines ordering, but Work Source claim plus run launch composition is not implemented. |
| Workspace/repository | `strong` | Local worktree lease, branch creation, setup evaluation, local git evidence, finalize, and cleanup exist. |
| Work Source provider | `gap` | Markdown provider package is a skeleton; Work Source port/mock/conformance are planned in Epic 2 and concrete driver in Epic 6. |
| Agent provider | `gap` | Codex provider package is a skeleton; Agent port/mock/conformance are planned in Epic 2 and concrete driver in Epic 6. |
| Forge provider | `gap` | GitHub provider package is a skeleton; no push, PR, check, review, merge, or thread behavior exists. |
| Execution Host provider | `gap` | Local provider package is a skeleton; no process spawn, command capture, containment, or termination runtime exists. |
| Capability attestation | `partial` | Design, AD ownership, and policy defaults exist; provider attestations and gate records are planned. |
| Worker/runner split | `partial` | Strong design and policy posture; not enforced by composed Agent, Execution Host, and Forge runtime yet. |
| Approval | `partial` | Policy schema/defaults exist; approval relay, pending state, grant mapping, park/resume facts are planned. |
| Completion/merge | `gap` | Evidence predicates, runner verification freshness, Forge intents, and merge decisions are planned in Core-05/Epic 5. |
| Recovery/reconciliation | `partial` | Workspace cleanup blocking exists; full run recovery classifier and Work Source reconciliation are planned. |
| Auto autonomy | `not applicable` | Explicitly deferred from v1; manual and assisted modes are the intended current target. |

## Audit conclusion

The current repository is best described as an evidence-oriented foundation plus a detailed orchestration
design, not a delivered autonomous control plane. The most reusable implemented pieces for agent-harness
lessons are event-log durability, lease fencing, local workspace isolation, local git evidence, cleanup
blocking, credential/policy defaults, and the verify gate. The largest implementation gaps are the SDK
provider ports/mocks/conformance layer, concrete providers, core run lifecycle, capability gates, approval
relay, liveness, completion, merge, and recovery/reconciliation.

The next repo-audit question should treat foundation code as real and provider/core orchestration as
planned unless a later branch adds Epic 2 through Epic 6 runtime surfaces.
