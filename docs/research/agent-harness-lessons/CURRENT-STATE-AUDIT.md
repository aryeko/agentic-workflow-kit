# Current-state audit

This audit compares source-derived agent-harness guidelines against current kit-vnext evidence.

## Status legend

- `strong` - Designed and backed by tooling, code, tests, or durable docs.
- `partial` - Present in design or scaffolding, but not yet fully implemented or verified.
- `gap` - Missing as a concrete product or repo practice.
- `not applicable` - Source lesson does not fit kit-vnext's product boundary.

## Executive read

kit-vnext is ahead of the source set on safety architecture: event-log authority, worker/runner
separation, capability attestation, fail-closed policy, evidence gates, and two-authorities semantics
are stronger than the public patterns in the articles and Symphony. The current codebase is not yet a
complete autonomous work daemon; it is a strong foundation substrate plus a detailed implementation
plan for the remaining orchestration layers.

The highest-confidence next improvements are not broad rewrites. They are targeted harness upgrades:
make physical repo navigation clearer, codify long-work runbooks, close package-doc drift, make
observability/evals concrete story criteria, and carry Symphony-style retry/reconciliation into the
event-log-backed runtime rather than volatile scheduler memory.

## Standing by guideline group

| Guideline group | Status | Evidence | Audit files |
|---|---|---|---|
| Repo-local knowledge as source of truth | strong | `AGENTS.md` routes work to `docs/design`, `docs/implementation`, `docs/engineering`, and research context; design and implementation docs use guided descent. | [Knowledge and docs legibility](repo-audit/knowledge-and-docs-legibility.md) |
| Progressive disclosure and short agent entrypoint | strong | `AGENTS.md` is a compact map, not a large manual; design conventions require high-to-low reading and single-source facts. | [Knowledge and docs legibility](repo-audit/knowledge-and-docs-legibility.md) |
| Living execution plans/runbooks | partial | Story contracts are strong grading surfaces and this research has a runbook, but there is not yet a canonical long-work execution journal convention. | [Knowledge and docs legibility](repo-audit/knowledge-and-docs-legibility.md) |
| Physical architecture map | gap/defer | Logical architecture is strong, but there is no short contributor-facing map from design concepts to current packages/modules. | [Knowledge and docs legibility](repo-audit/knowledge-and-docs-legibility.md) |
| Mechanical architecture enforcement | strong | Dependency-cruiser, TypeScript project references, package graph tests, local gate scripts, and no-side-effect guards enforce current boundaries. | [Architecture and enforcement](repo-audit/architecture-and-enforcement.md) |
| Runtime seam enforcement | partial | Provider seams are well designed, but SDK provider ports, mocks, conformance, and concrete drivers remain future work. | [Architecture and enforcement](repo-audit/architecture-and-enforcement.md), [Orchestration and autonomy](repo-audit/orchestration-and-autonomy.md) |
| Event-log truth and durable evidence | strong substrate, partial control plane | Foundation event log, storage, artifacts, evidence bundles, and leases exist and are tested; core run lifecycle is not fully built. | [Orchestration and autonomy](repo-audit/orchestration-and-autonomy.md), [Observability](repo-audit/observability-and-improvement-loop.md) |
| Per-task workspace isolation | strong foundation, partial execution runtime | Worktree setup, leases, local git evidence, and cleanup blockers exist; Execution Host launch/containment is still planned. | [Orchestration and autonomy](repo-audit/orchestration-and-autonomy.md) |
| Worker/runner split | strong design, partial runtime | AD-12 and architecture make worker edit/commit only; Forge/Execution Host drivers are not yet implemented. | [Orchestration and autonomy](repo-audit/orchestration-and-autonomy.md) |
| Capability attestation and fail-closed autonomy | strong design, partial implementation | Architecture and accepted decisions require fresh positive attestations; policy defaults keep autonomous powers off; core gates are not live yet. | [Orchestration and autonomy](repo-audit/orchestration-and-autonomy.md) |
| Long-running supervision, retry, reconciliation | strong design, partial implementation | Requirements and domain docs cover liveness/recovery/reconciliation; foundation cleanup exists; composed run recovery is pending. | [Orchestration and autonomy](repo-audit/orchestration-and-autonomy.md) |
| Observability, analysis, and evals | partial | Core-07 design is strong and FND storage/evidence substrate exists; analyzer runtime, eval datasets, metrics, and exporters are gaps. | [Observability](repo-audit/observability-and-improvement-loop.md) |
| Continuous cleanup and drift control | partial | Docs nav and check gate catch normative drift; package README drift shows the need for explicit freshness checks. | [Knowledge and docs legibility](repo-audit/knowledge-and-docs-legibility.md), [Observability](repo-audit/observability-and-improvement-loop.md) |
| Product workflow metrics | gap/partial | Requirements name observability; no delivered metrics surface measures blocked-run rate, approval latency, recovery time, or review closure. | [Observability](repo-audit/observability-and-improvement-loop.md) |

## What we probably do better already

- We separate worker and runner authority more cleanly than the article examples and Symphony sample
  workflow: workers do implementation; runners own push, PR, verification, merge, and credentials.
- We treat event-log truth as the durable authority instead of relying on provider thread state,
  dashboard state, Markdown runbooks, or volatile scheduler memory.
- We require earned autonomy through capability attestation and fail-closed defaults rather than
  treating tool availability or provider claims as sufficient.
- We distinguish Work Source task status from run activity, avoiding tracker state becoming hidden
  orchestration truth.
- We already have a strong local verification gate with docs-nav, format, lint, dependency graph,
  typecheck, unit, integration, conformance-mock, and coverage baseline.

## Current gaps that matter most

- Provider ports, provider mocks/conformance, and concrete drivers are still future work. This means
  many source lessons are validated by design, not yet by end-to-end behavior.
- Core orchestration domains remain planned: run lifecycle, capability gates, approval relay,
  supervision, completion/merge, recovery/reconciliation, and analysis.
- Package-state documentation has drifted. Some package READMEs still describe behavior-free
  skeletons even though foundation code and exports now exist.
- There is no concise physical architecture map that answers where a contributor or worker should
  edit as package implementation grows.
- Observability lacks delivered analyzer/eval/report runtime. Foundation artifacts are ready, but
  `core-07` needs story contracts and implementation.

## Evidence base

- Source synthesis: [Guideline matrix](GUIDELINE-MATRIX.md)
- Repo map: [Current system map](repo-audit/current-system-map.md)
- Detailed audits:
  [knowledge and docs](repo-audit/knowledge-and-docs-legibility.md),
  [architecture and enforcement](repo-audit/architecture-and-enforcement.md),
  [orchestration and autonomy](repo-audit/orchestration-and-autonomy.md), and
  [observability and improvement loop](repo-audit/observability-and-improvement-loop.md)
