# Durable execution and tests

## Opportunity summary

LangGraph and LangGraph.js should not become kit-vnext's core runtime, graph engine, checkpoint
store, or persistence substrate. The opportunity is narrower and still valuable: mine their
interrupt/resume, checkpoint, replay, streaming, retry, fault-tolerance, and time-travel concepts into
kit-vnext test fixtures, conformance cases, failure catalogs, and operator documentation.

Score line: code avoided: medium; product gain: medium-high; seam fit: high for tests/docs and low
for runtime adoption; invariant risk: low if patterns only, high if checkpoints become authority;
dependency risk: low for copied patterns/docs, medium-high for a package dependency; timing: Frontier
1 through Frontier 5 test/story work, with any real adapter after seam mocks; use type: copied
pattern plus test fixture vocabulary, not direct core reuse.

## Candidate projects

- LangGraph: Python durable agent workflow runtime with graph state, persistence, interrupts,
  streaming, time travel, and fault tolerance.
- LangGraph.js: TypeScript/JavaScript counterpart with the more relevant API surface for kit-vnext's
  TS packages and future provider-driver experiments.

Candidate scope is only source-level learning. The existing LangChain review already recommends
`maybe` and "reference only" for both projects. This report refines that into leverage for tests,
fixtures, and docs.

## What to leverage

- Interrupt/resume vocabulary: a persisted pause, a durable resume cursor, a resume value, duplicate
  resume behavior, stale resume behavior, and changed-code-on-resume behavior.
- Checkpoint concepts: thread-scoped state snapshots, checkpoint history, current state inspection,
  stale checkpoint detection, and checkpoint-like old-state migration hazards.
- Replay concepts: re-running from a prior point, replaying only from committed evidence, and proving
  that completed steps do not repeat while unfinished or side-effectful steps are fenced.
- Streaming concepts: separate modes for state updates, full values, messages/tokens, custom data,
  tasks/checkpoints, tool events, interrupts, final output, and debug events.
- Retry/fault tolerance: per-node or per-task retry policy, timeout, exhausted-retry handling, and
  idempotency requirements for side effects.
- Time travel: replay from a prior checkpoint and fork from a prior checkpoint with modified state,
  mainly as negative test vocabulary for kit-vnext recovery.
- Backward compatibility caveats: paused work can break when node/state names or required state
  fields change; kit-vnext can translate this into event-schema and projection migration fixtures.

## Why it helps kit-vnext

kit-vnext already has the right primitives: fnd-02 `EventLogStore.replay`, `LeaseStore` fencing,
durability classes, artifact refs, and current tests for append/replay equivalence, durable/barrier
fsync behavior, sequence conflicts, tail repair, interior corruption, input validation, and redacted
exports. Core-01 then requires an append-only event log as the only authored run state, pure
projections, monotonic sequences, writer-epoch fencing, and property-tested replay determinism.

LangGraph can save work by supplying an already-used language for the hard durable-execution cases
that kit-vnext must test anyway:

- Core-01 tests can name checkpoint-like cases without adding checkpoints: lost ack, replay from
  cursor, stale writer epoch, tail-repaired replay, interior-corrupt replay, and old event schema.
- Core-03 tests can copy the interrupt/resume shape: pending approval persisted before decision,
  parked request, resume with scoped grant, duplicate resume, expired resume, and resume after process
  death.
- Core-04 tests can compare stream categories while preserving the invariant that liveness advances
  only from current-session worker events, not polling, reconnects, wait responses, projection reads,
  or debug streams.
- Core-06 tests can turn replay/time-travel warnings into recovery fixtures: replay must not rerun
  Forge writes, Work Source status changes, host termination, approval delivery, or merge operations
  unless explicit provider controls and capability gates record new evidence.
- Testkit and conformance-kit can add adversarial mocks inspired by LangGraph pitfalls: omitted
  state, delayed stream, duplicate interrupt ids, stale resume cursor, reordered stream events,
  checkpoint/state mismatch, retry after partial side effect, and changed schema while work is parked.
- Docs can explain resume/restart with familiar durable-workflow terms while repeatedly stating that
  kit-vnext's authority is the event log, not runtime snapshots.

## Direct reuse vs adapter vs copied pattern

Direct reuse: no for SDK/core. Do not add `@langchain/langgraph`, Python LangGraph, or LangSmith as
dependencies for run lifecycle, approval, liveness, recovery, storage, or analysis.

Adapter: maybe later, only behind `AgentProvider`. A future `provider-langgraph-agent` or
`provider-langgraph-js-agent` spike is plausible after `seam-agent-contract-mock`,
`seam-execution-host-contract-mock`, core event contracts, and provider conformance suites exist. The
adapter would have to emit kit-native `AgentEvent`, approval, terminal, artifact, and
`CapabilityAttestation` evidence. LangGraph thread/checkpoint ids would be provider-private
correlation data, not kit state.

Copied pattern: yes. Copy the test patterns, fixture names, docs caveats, and failure taxonomy. This
is the main recommendation.

## Source-level fit notes

Fit with fnd-02:

- Current fnd-02 code already implements the durable substrate kit-vnext needs: `EventLogStore.append`
  validates lease fencing and expected sequence, writes framed records with commit trailers, fsyncs
  durable/barrier writes, returns receipts, and replays committed records with health. This maps to
  LangGraph checkpoint/replay concepts only as testing vocabulary.
- Current fnd-02 tests already cover append/replay property behavior, durability observations,
  sequence conflicts, tail repair, interior corruption, degraded replay, invalid inputs, lease
  failures, artifact verification, and redacted exports. LangGraph adds useful missing fixture names:
  stale checkpoint, duplicate resume, retry after partial task failure, changed schema while parked,
  and forked recovery branch.

Fit with core-01:

- LangGraph checkpointers save state at super-step boundaries; kit-vnext records authored events in
  contiguous sequences. The reusable pattern is not snapshot storage, but the idea that every resume
  case needs a durable cursor and deterministic replay tests.
- Core-01 should phrase tests as event-log replay cases, not graph checkpoint cases:
  `checkpoint_id` becomes `RunEventCursor`; thread state becomes replay/projection; graph state
  history becomes event log history; `updateState`/fork becomes an appended recovery event plus a
  legal lifecycle transition.

Fit with core-03:

- LangGraph `interrupt()` plus `Command({ resume })` is a strong conceptual fit for approval parking.
  The copyable test shape is: persist pending state first, surface a JSON-serializable request,
  resume through an owned session, and assert duplicate/stale/expired resume behavior.
- The boundary difference is essential: kit-vnext approval decisions are deterministic policy/human
  records and scoped grants. They are not LangGraph resume values with authority.

Fit with core-04:

- LangGraph streaming modes are useful as a coverage checklist for event visibility. Kit-vnext should
  ensure it has progress, tool, approval, terminal, recovery, and debug/report evidence where needed.
- LangGraph stream events must not become a liveness shortcut. Core-04 explicitly denies liveness
  refresh from parent polling, wait responses, watch reconnects, projection reads, lifecycle-only
  events, Operator decisions, runner commands, Forge events, Work Source events, and raw host output.

Fit with core-06:

- LangGraph replay/time-travel docs are most useful as negative guidance. They warn that replay after
  a checkpoint re-executes downstream calls and interrupts. Kit-vnext can turn that into tests that
  forbid blind replay of provider side effects and require in-band recovery events plus gates.
- LangGraph fork semantics map to "append a new recovery classification/action and continue from a
  legal lifecycle edge," not to editing historical state.

Fit with conformance-kit/testkit:

- Current conformance-kit already has positive and adversarial capability mocks for omitted, delayed,
  and lying attestations. Add durable-execution adversarial mock families with the same style:
  `duplicate-resume`, `stale-cursor`, `reordered-stream`, `missing-terminal`, `partial-side-effect`,
  `schema-migration-break`, and `timeout-then-success`.

## Required kit-vnext stories

- Frontier 1 / core-01: add story acceptance criteria for event-log replay fixtures named after
  durable workflow hazards: stale cursor, lost ack, duplicate resume-like append, old schema replay,
  tail repair, interior corruption, and writer-epoch fencing. Keep implementation on fnd-02/core-01.
- Frontier 3 / testkit and conformance-kit: add reusable adversarial fixture builders for delayed,
  reordered, duplicated, missing, and contradictory durable-event streams. These should be pure mocks,
  not LangGraph imports.
- Frontier 4 / core-03: add approval interrupt/resume fixtures covering persisted pending state,
  park before human latency, resume with scoped grant, duplicate resume denial, expired request,
  ambiguous session linkage, and provider resume failure.
- Frontier 4 / core-04: add stream taxonomy coverage tests proving only current-session Agent events
  advance liveness and that waits/reconnects/debug streams never do.
- Frontier 5 / core-06: add replay/time-travel safety fixtures proving recovery never reruns side
  effects without exact provider evidence, leases, legal lifecycle transition, and a committed
  capability gate where required.
- Documentation story: add a short durable execution glossary/example page that maps
  checkpoint/replay/fork/interrupt terms to kit-vnext terms and states the non-adoption boundary.
- Optional provider story after seam mocks: spike a LangGraph.js-backed `AgentProvider` adapter only
  to test whether it can pass existing kit conformance without leaking checkpoint authority.

## Risks and constraints

- Authority risk: LangGraph checkpoints are runtime snapshots; kit-vnext's append-only event log is
  the single source of truth. Do not let checkpoint terms imply authored state.
- Replay side-effect risk: LangGraph documentation explicitly warns that downstream LLM/API calls and
  interrupts can run again on replay. Kit-vnext software-delivery actions must be fenced by leases,
  exact-head checks, provider evidence, and explicit recovery events.
- Seam risk: LangGraph bundles graph runtime, state, tool/model calls, persistence, and streaming.
  kit-vnext must keep Agent, Execution Host, Forge, and Work Source seams separate.
- Dependency risk: LangGraph.js is active and useful, but recent project-report notes mention
  checkpoint replay and concurrency fixes. Any adapter must be version-pinned and conformance-tested.
- Timing risk: current readiness still requires story contracts and executable package evidence
  across the core frontiers. Adding a runtime dependency now would distract from SDK/testkit-first
  implementation.
- Documentation risk: borrowing terms such as "checkpoint" or "time travel" could confuse readers.
  Prefer "checkpoint-like fixture" and "replay/fork hazard" unless the text explicitly maps to
  kit-vnext event-log terms.

## Recommended verdict

Adopt the concepts as copied test and documentation patterns. Do not adopt LangGraph or LangGraph.js
as a core runtime, persistence layer, event-log replacement, liveness authority, recovery engine, or
LangSmith-backed required evidence surface.

The best near-term use is a small durable-execution fixture catalog for core-01/core-03/core-04/core-06
and testkit. That catalog can save design and implementation effort by giving story authors a shared
set of adversarial cases without forcing them to invent every interrupt, resume, retry, replay, and
stale-state scenario from scratch.

## Sources

- Local: `AGENTS.md`.
- Local: `design-closure/outputs/langchain-review/README.md`.
- Local: `design-closure/outputs/langchain-review/UNIFIED-REPORT.md`.
- Local: `design-closure/outputs/langchain-review/project-reports/langgraph.md`.
- Local: `design-closure/outputs/langchain-review/project-reports/langgraph-js.md`.
- Local: `design-closure/outputs/langchain-review/adoption-reports/langgraph-adoption.md`.
- Local: `design-closure/outputs/langchain-review/adoption-reports/langgraph-js-adoption.md`.
- Local: `docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md`.
- Local: `docs/design/30-domain-reference/core/approval-and-escalation/README.md`.
- Local: `docs/design/30-domain-reference/core/supervision-and-liveness/README.md`.
- Local: `docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md`.
- Local: `docs/design/20-sdk-and-packaging/storage-port-types.md`.
- Local: `docs/implementation/domain-dag.md`.
- Local: `docs/implementation/readiness-matrix.md`.
- Local source sampled: `packages/foundation-fnd-02/src/event-log-store.ts`.
- Local source sampled: `packages/foundation-fnd-02/src/lease-store.ts`.
- Local source sampled: `packages/foundation-fnd-02/src/types.ts`.
- Local source sampled: `packages/foundation-fnd-02/tests/storage.event-log-and-artifacts.int.test.ts`.
- Local source sampled: `packages/foundation-fnd-02/tests/storage.validation-and-failures.int.test.ts`.
- Local source sampled: `packages/conformance-kit/src/conformance.ts`.
- Local source sampled: `packages/conformance-kit/src/mocks.ts`.
- Official docs: [LangGraph.js overview](https://docs.langchain.com/oss/javascript/langgraph/overview).
- Official docs: [LangGraph.js checkpointers](https://docs.langchain.com/oss/javascript/langgraph/checkpointers).
- Official docs: [LangGraph.js interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts).
- Official docs: [LangGraph.js Functional API](https://docs.langchain.com/oss/javascript/langgraph/functional-api).
- Official docs: [LangGraph.js Graph API](https://docs.langchain.com/oss/javascript/langgraph/graph-api).
- Official docs: [LangGraph.js time travel](https://docs.langchain.com/oss/javascript/langgraph/use-time-travel).
- Official docs: [LangGraph.js backward compatibility](https://docs.langchain.com/oss/javascript/langgraph/backward-compatibility).
- Official docs: [LangGraph Python fault tolerance](https://docs.langchain.com/oss/python/langgraph/fault-tolerance).

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../README.md) · **← Prev:** [Coding-agent operations](./coding-agent-operations.md) · **Next →:** [Observability and evals](./observability-evals.md)

<!-- /DOCS-NAV -->
