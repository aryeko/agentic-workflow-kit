# T8 - durability-class-per-event proposal

## Decision / answer

Recommendation: keep T4's typed fnd-02 durability contract unchanged and define the core-01 run-log
minimum durability mapping below. The mapping uses only `durable` and `barrier` for canonical
`RunEventEnvelope` records; `buffered` remains available only to lower-level fnd-02 or future
non-authoritative stores, not to the authored Run log.

Frozen input used:

- Wave-1 T4 freezes `DurabilityClass = "buffered" | "durable" | "barrier"` and
  `AppendBatch.durability: DurabilityClass` in
  `design-closure/outputs/wave-1/T4/draft/storage-contracts.md` §A and §C.
- Wave-1 summary marks T4's `DurabilityClass` and `AppendBatch` as the frozen input to T8 in
  `design-closure/outputs/wave-1/WAVE-1-SUMMARY.md` §T4.

Corpus rules applied:

- fnd-02 says `buffered` may disappear after crash and is forbidden for authored, gating, lifecycle,
  coordination, or evidence state; `durable` fsyncs the log file and returns `AppendReceipt`; `barrier`
  flushes or discards prior buffered bytes, then fsyncs the log file and containing directory
  (`docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md` §4 Design).
- core-01 says canonical Run events use only `durable` or `barrier`, never fnd-02 `buffered`, because
  buffered writes cannot support lifecycle, gating, coordination, recovery, or evidence state
  (`docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md` §4 Design).
- core-01 says a multi-intent append is one atomic semantic batch, normalized to the strongest
  requested durability, and every intent must meet the minimum durability for its event type
  (`docs/design/30-domain-reference/core/run-lifecycle-and-state/event-log-writer-and-corruption.md`
  §Append protocol).

Rejected alternatives:

- Reject allowing `buffered` for progress or evidence-bearing Run events. fnd-02 forbids buffered for
  authored/evidence state, and core-01 already says any future UI progress stream must use a separate
  non-authoritative store with no canonical sequence, projection, gating, coordination, lifecycle,
  evidence, or recovery impact.
- Reject making every run-log event `barrier`. The corpus explicitly reserves `durable` for normal
  authored facts, progress, evidence pointers, and non-terminal lifecycle changes that do not gate
  irreversible action (`docs/design/30-domain-reference/core/run-lifecycle-and-state/event-log-writer-and-corruption.md`
  §Durability classes).

## Proposed artifact or change

Add this mapping to core-01's durability section as the normative minimum-durability table.

| Run-log event type or class | Minimum durability | Rule followed | Barrier justification |
|---|---:|---|---|
| `RunCreated` | `barrier` | Run creation is listed as `barrier`; `createRun` commits `RunCreated` with the initial lifecycle transition in one `barrier` batch (`event-log-writer-and-corruption.md` §Append protocol and §Durability classes; `projections-lifecycle-and-tests.md` §Event roles). | Establishes the Run's first factual metadata and precedes all later sequence, projection, and lifecycle facts. The ordering point must survive before any follow-on fact can rely on the Run existing. |
| `RunPolicyBound` | `barrier` | Resolved policy binding is listed as `barrier`; the `created -> configured` lifecycle transition must reference `RunPolicyBound` (`event-log-writer-and-corruption.md` §Durability classes; `projections-lifecycle-and-tests.md` §Lifecycle state machine and §Event roles). | The policy digest gates later approvals, capability checks, completion gates, and merge decisions. It must be durably ordered before the configured lifecycle state. |
| `TaskSnapshotRecorded` | `barrier` | Task snapshot is listed as `barrier`; the `configured -> task-snapshotted` transition must reference it (`event-log-writer-and-corruption.md` §Durability classes; `projections-lifecycle-and-tests.md` §Lifecycle state machine and §Event roles). | The task snapshot is the replayable work input for the Run. Later execution and recovery must not race ahead of an un-fsynced task identity. |
| `RunLifecycleTransitioned` where `from = null, to = "created"` | `barrier` | The first lifecycle transition is explicitly `barrier` and must reference `RunCreated` (`projections-lifecycle-and-tests.md` §Lifecycle state machine). | Creates lifecycle authority and must be atomically ordered with `RunCreated`. |
| `RunLifecycleTransitioned` where `to = "configured"` | `barrier` | The `created -> configured` transition is explicitly `barrier` and must reference `RunPolicyBound` (`projections-lifecycle-and-tests.md` §Lifecycle state machine). | Locks in the resolved policy before any policy-dependent work proceeds. |
| `RunLifecycleTransitioned` where `to = "task-snapshotted"` | `barrier` | The `configured -> task-snapshotted` transition is explicitly `barrier` and must reference `TaskSnapshotRecorded` (`projections-lifecycle-and-tests.md` §Lifecycle state machine). | Locks in the immutable task snapshot before workspace or worker launch. |
| `RunLifecycleTransitioned` to `completed`, `blocked`, `failed`, or `canceled` | `barrier` | Terminal lifecycle events are listed as `barrier`; terminal states require `barrier` and close lifecycle mutation for the writer epoch (`event-log-writer-and-corruption.md` §Durability classes; `projections-lifecycle-and-tests.md` §Lifecycle state machine). | Terminal closure is irreversible for the lifecycle projection and fences later lifecycle mutation. |
| `RunLifecycleTransitioned` for non-terminal transitions that do not gate irreversible action | `durable` | `durable` is allowed for non-terminal lifecycle changes that do not gate irreversible action (`event-log-writer-and-corruption.md` §Durability classes). | Not a barrier row. It is still fsynced and replay-authoritative, but no extra ordering barrier is required unless the transition gates irreversible action. |
| `RunLifecycleTransitioned` for any transition that gates irreversible action | `barrier` | `barrier` is required for any fact that gates irreversible action (`event-log-writer-and-corruption.md` §Durability classes). | The transition is the ordering point before the irreversible action may be taken. |
| `SessionLinked` | `barrier` | Session linkage is listed as `barrier`; `SessionLinked` records append-only ownership facts and missing or ambiguous linkage forces degraded operation (`event-log-writer-and-corruption.md` §Durability classes; `projections-lifecycle-and-tests.md` §Session linkage and §Event roles). | Session ownership is coordination state used by liveness, approvals, and recovery. It must be ordered before dependent ownership-sensitive actions. |
| `SessionLinkSuperseded` | `barrier` | `SessionLinkSuperseded` records linkage correction or handoff and is listed as `barrier` (`projections-lifecycle-and-tests.md` §Session linkage and §Event roles). | Supersession determines which session is current while preserving prior facts; dependent ownership projections need an ordering barrier. |
| `RunLogTailRepaired` | `barrier` | Corruption records are listed as `barrier`; core-01 appends `RunLogTailRepaired` at `barrier` after fnd-02 tail repair when a writer is available (`event-log-writer-and-corruption.md` §Durability classes and §Corruption handling; `projections-lifecycle-and-tests.md` §Event roles). | The repaired-tail health record declares which committed sequence is safe to continue from. It must be ordered before subsequent appends. |
| `RunAppendRejected` | `durable` | `RunAppendRejected` is a semantic pre-storage rejection recorded only while durable recording is still available; normal authored facts use `durable` unless they are barrier-required (`event-log-writer-and-corruption.md` §Durability classes; `projections-lifecycle-and-tests.md` §Event roles). | Not a barrier row. The rejection is evidence of a failed semantic append attempt; if it leads to terminal closure, the terminal lifecycle transition supplies the barrier. |
| Sibling-domain normal authored facts, progress records, and evidence pointers | `durable` | core-01 consumes any valid `RunEventEnvelope` appended through `RunWriter`; payload semantics stay with the emitting domain. `durable` covers normal authored facts, progress, evidence pointers, and non-terminal lifecycle changes that do not gate irreversible action (`README.md` §6 Events & data; `event-log-writer-and-corruption.md` §Durability classes). | Not a barrier row. These records are replay-authoritative and cannot be buffered, but ordinary evidence/progress does not by itself require an ordering barrier. |
| Sibling-domain approval parked/resumed facts | `barrier` | Approval parked/resumed facts are listed as `barrier`; core-03 currently declares `ApprovalParked` and `ApprovalResumed` as `barrier` events (`event-log-writer-and-corruption.md` §Durability classes; `approval-and-escalation/interfaces-events-and-tests.md` §Events & data). | Park/resume is durable coordination state for human latency and answer delivery; later resume or block decisions must not race ahead of it. |
| Sibling-domain lifecycle prerequisite facts that are explicitly listed as `barrier` by their owning domain | `barrier` | Sibling domains append through core-01's `RunWriter`, but their payload-specific meaning stays with the emitting domain; core-01 enforces minimum durability per event type (`README.md` §6 Events & data; `event-log-writer-and-corruption.md` §Append protocol). Current examples include core-02 `CapabilityGateRecord`, core-03 approval decision/outcome records, core-04 fail-closed/termination records, core-05 completion/merge records, core-06 recovery/reconciliation records, and core-07 analysis records. | The owning domain has classified the record as an ordering point, usually because it gates autonomous execution, protected Forge operations, recovery, terminal closure, or post-terminal evidence. |
| Any sibling-domain fact that gates an irreversible action but lacks an explicit owner mapping | `barrier` | `barrier` is required for any fact that gates irreversible action (`event-log-writer-and-corruption.md` §Durability classes). | The barrier is the required "record before act" ordering point. If an owner omits this mapping, core-01 should reject weaker durability with `durability-insufficient`. |
| Well-formed unknown future payload types with no declared gating, coordination, lifecycle, recovery, or evidence impact | `durable` | Unknown future payloads are preserved and ignored by projections unless explicitly declared relevant; canonical Run events still cannot use `buffered` (`event-log-writer-and-corruption.md` §Event envelope and §Durability classes). | Not a barrier row. Unknown payloads are replay-preserved but have no declared ordering role. |

Implementation note for the later corpus edit: `RunWriter.append` should validate the minimum mapping
against the requested `AppendIntent.durability` before calling fnd-02. It should continue to normalize
the actual fnd-02 `AppendBatch.durability` to the strongest requested durability in the semantic batch,
and it should record that effective durability on every committed envelope. This follows the existing
core-01 append protocol and keeps T4's `AppendBatch` unchanged.

## Corpus impact

No corpus file was edited. If accepted, amend:

- `docs/design/30-domain-reference/core/run-lifecycle-and-state/event-log-writer-and-corruption.md`
  §Durability classes: replace the high-level two-row semantic-use table with the event-type mapping
  above, or add the event-type table immediately below it.
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md`
  §Event roles: add durability annotations for `RunLifecycleTransitioned` and `RunAppendRejected`, since
  the current list names barriers for most core-01 roles but leaves those two implicit.
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md`
  §Testing strategy: make "durability-class rejection tests for every barrier-required event" point to
  the accepted mapping table.
- `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md` §10 Open questions:
  replace "Exact event-to-durability mapping is owned with core-01 event semantics" with a pointer to
  the accepted core-01 mapping.

No change is proposed to `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md`:
`RunDurabilityClass = "durable" | "barrier"` already matches the proposed canonical Run-log surface.
No change is proposed to fnd-02's `DurabilityClass`: T4's typed contract keeps `buffered` for the
lower-level storage contract, while core-01 narrows canonical Run events to `durable | barrier`.

## Acceptance criteria

1. A table maps every run-log event type to `durable` or `barrier`, with no lifecycle/evidence event
   left buffered.
   - Met for every core-01-owned event named in
     `docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md` §6 Events & data:
     `RunCreated`, `RunPolicyBound`, `TaskSnapshotRecorded`, `RunLifecycleTransitioned`,
     `SessionLinked`, `SessionLinkSuperseded`, `RunLogTailRepaired`, and `RunAppendRejected`.
   - Met for sibling-domain records appended through core-01 by adding a default/override rule:
     normal authored facts/progress/evidence pointers are `durable`; owner-declared barrier facts and
     any fact that gates irreversible action are `barrier`. This follows core-01's statement that
     sibling domains append through `RunWriter` while payload meaning stays with the owner
     (`README.md` §6 Events & data).
   - `buffered` is excluded from all canonical Run-log rows.

2. Each assignment cites the durability rule it follows from fnd-02 / core-01 prose.
   - Met in the mapping table's "Rule followed" column. The common rules are fnd-02 §4 Design and
     core-01 §Append protocol / §Durability classes.

3. Barrier events are justified.
   - Met in the mapping table's "Barrier justification" column. Rows mapped to `durable` explicitly
     say they are not barrier rows and why no ordering barrier is required.

4. If T4 output is missing or ambiguous, record blocker.
   - No blocker. T4 output is present and unambiguous for T8: it defines the three physical
     `DurabilityClass` values and `AppendBatch.durability` in
     `design-closure/outputs/wave-1/T4/draft/storage-contracts.md` §A and §C.

5. Lists corpus files and sections to amend; no corpus file edited.
   - Met in §Corpus impact. Verification should remain `git status --porcelain docs/` empty.

## Minimal-change justification

No existing typed shape or field changes are required. The smallest sufficient change is a prose
mapping table in core-01 plus a pointer from fnd-02's open-question section.

The proposal deliberately does not:

- remove `buffered` from fnd-02 `DurabilityClass`, because fnd-02 owns lower-level storage classes and
  T4 froze the full union;
- widen or rename `RunDurabilityClass`, because core-01 already exposes exactly `durable | barrier`;
- force every event to `barrier`, because core-01 already distinguishes normal `durable` authored
  facts from ordering-barrier facts.

Optional upgrades:

- Add generated tests from the accepted table so every barrier-required event has an explicit
  `durability-insufficient` rejection case. This is consistent with core-01's existing testing strategy
  but is not required to settle the design decision.

## Contradiction & open-choice log

- Open choice: should `RunLifecycleTransitioned` be one fixed durability per event type or a
  payload-sensitive mapping? Recommendation: keep it payload-sensitive. The corpus explicitly marks the
  first three lifecycle transitions and terminal transitions as `barrier`, while the durability table
  allows non-terminal lifecycle changes that do not gate irreversible action to be `durable`
  (`projections-lifecycle-and-tests.md` §Lifecycle state machine;
  `event-log-writer-and-corruption.md` §Durability classes). A single fixed value would either
  over-strengthen all lifecycle updates or contradict the terminal/initial barrier rows.
- Scope tension: T8 asks for "every run-log event type," but core-01 says domain-specific event
  semantics are out of scope and sibling payload meaning stays with the emitting domain
  (`README.md` §Mandate and §6 Events & data). Recommendation: core-01 should own the minimum
  durability rule and the core-01 event table, while sibling domains continue to own their named event
  durability so long as they satisfy the core-01 minimums.
- No T4 blocker found. T4's `DurabilityClass` and `AppendBatch` are sufficient for T8.
- No existing enum value or mode is narrowed. The proposal narrows only canonical core-01 usage, which
  the corpus already narrows through `RunDurabilityClass = "durable" | "barrier"` and the no-buffered
  Run-log rule.

## Open issues / assumptions / risk

- Assumption: "evidence pointer" means an authored fact that records or cites evidence but does not
  itself authorize an irreversible action. If the owner uses the fact as the final gate before an
  irreversible action, it falls under the `barrier` override.
- Risk: sibling domains that currently omit explicit durability could drift from the core-01 minimum
  rule. The proposed core-01 table should become the conformance source that `RunWriter.append` and
  domain tests use.
- Risk: the corpus currently has both a general durability table and scattered domain event lists. The
  smallest durable fix is to amend core-01 with the central rule and leave domain-owned lists as
  examples/consumers, rather than duplicating a full cross-domain catalog in every domain.
