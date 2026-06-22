# Observability and improvement loop audit

## Scope

Audit scope: observability, analysis, telemetry, evidence bundles, run artifacts, evals, review
feedback loops, cleanup and garbage collection, docs freshness, metrics, gate outputs, and prior-art
research loops.

Classifications: `strong`, `partial`, `gap`, or `not applicable`.

## Files inspected

- `docs/research/agent-harness-lessons/GUIDELINE-MATRIX.md`
- `docs/research/agent-harness-lessons/repo-audit/current-system-map.md`
- `docs/design/00-orientation/requirements.md`
- `docs/design/10-architecture/observability-and-analysis.md`
- `docs/design/10-architecture/evidence-gates-and-merge.md`
- `docs/design/30-domain-reference/core/observability-and-analysis/README.md`
- `docs/design/30-domain-reference/core/observability-and-analysis/analysis-contract.md`
- `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md`
- `docs/design/30-domain-reference/core/completion-and-merge/evidence-model-and-predicates.md`
- `docs/design/30-domain-reference/providers/forge-collaboration/README.md`
- `docs/implementation/domains/core/core-07-observability-and-analysis.md`
- `docs/implementation/epics/epic-3-core-runtime-spine/README.md`
- `docs/implementation/epics/epic-3-core-runtime-spine/story-dag.md`
- `docs/implementation/epics/epic-1-foundation-substrate/stories/fnd-02-s2-event-log.md`
- `docs/implementation/epics/epic-1-foundation-substrate/stories/fnd-02-s4-artifact-evidence.md`
- `docs/engineering/check-gate.md`, `docs/engineering/test-lanes.md`
- `tooling/docs-nav/generate-nav.mjs`, `package.json`, `packages/sdk/src/**`, `packages/sdk/tests/**`
- `docs/research/langchain-leverage/**`

## Summary

- Overall status: `partial`.
- Strong design exists for observability, metric honesty, evidence over prose, and analysis failures.
- Strong implementation exists for storage/artifact/event-log substrate and local gate outputs.
- Gaps remain for the core-07 analyzer, report writer, invariant sweeper, eval datasets, and exporters.
- Main risk: future stories could mistake precise design for already-built runtime behavior.

## Findings table

| Area | Class | Designed | Implemented / verified | Future story criteria |
|---|---|---|---|---|
| Observability requirement | strong | FR-9 requires structured telemetry and auto-fired analysis; NFR-OBS requires terminal `AnalysisRecorded` or `AnalysisFailed` (`docs/design/00-orientation/requirements.md:25`, `docs/design/00-orientation/requirements.md:36`). | Current map calls observability strong in design but partial in runtime (`docs/research/agent-harness-lessons/repo-audit/current-system-map.md:43`). | Every terminal, blocked, stale-progress, supervision-lost, or recovery-decision story names its analysis trigger and outcome. |
| Analyzer contract | strong | Analyzer is pure over event log/projections, writes redacted report artifacts, appends success/failure, and excludes uncorroborated worker prose (`docs/design/10-architecture/observability-and-analysis.md:9`, `docs/design/10-architecture/observability-and-analysis.md:19`, `docs/design/10-architecture/observability-and-analysis.md:58`). | Domain design is approved and complete, but runtime is not built (`docs/design/30-domain-reference/core/observability-and-analysis/README.md:260`). | Implement trigger coverage, terminal invariant, replay determinism, redaction, and fallback tests (`docs/design/30-domain-reference/core/observability-and-analysis/README.md:246`). |
| Honest metrics | partial | Metrics are `available`, `partial`, or `unavailable`, with evidence refs and missing denominators (`docs/design/10-architecture/observability-and-analysis.md:45`, `docs/design/30-domain-reference/core/observability-and-analysis/analysis-contract.md:32`). | No package/test metrics surface exists yet; core-07 owners are still unassigned in the Epic 3 charter (`docs/implementation/epics/epic-3-core-runtime-spine/README.md:105`). | Missing tool-call, latency, review, token/cost, or duration evidence produces `partial` or `unavailable`, never fake zero. |
| Evidence bundles | strong | FND-02 defines write-once artifacts for outputs/evidence/analysis/reports with digests, retention, redaction, limits, and export (`docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md:17`). | SDK artifact refs and bundle manifests exist (`packages/sdk/src/foundation/storage/artifacts/artifact-types.ts:6`, `packages/sdk/src/foundation/storage/evidence-bundles/evidence-bundle-manifest.ts:3`); tests cover metadata, scratch refs, tombstones, redacted export, and bundle manifests (`packages/sdk/tests/foundation/storage/artifacts/artifact-store.unit.test.ts:86`, `packages/sdk/tests/foundation/storage/artifacts/artifact-store.unit.test.ts:197`, `packages/sdk/tests/foundation/storage/artifacts/artifact-store.unit.test.ts:249`, `packages/sdk/tests/foundation/storage/artifacts/artifact-store.unit.test.ts:355`). | Core-07 report evidence consumes only authoritative `ArtifactRef.id`; scratch refs and tombstoned originals fail. |
| Run artifacts and event log | strong | FND-02 owns append receipts, replay health, durability, corruption handling, and lease fencing while payloads stay opaque (`docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md:83`). | SDK event-log types exist (`packages/sdk/src/foundation/storage/event-log/event-log-types.ts:4`, `packages/sdk/src/foundation/storage/event-log/event-log-types.ts:33`, `packages/sdk/src/foundation/storage/event-log/event-log-types.ts:61`); tests cover stale writers, buffered acks, receipts, barriers, tail repair, corruption, and degraded refusal (`packages/sdk/tests/foundation/storage/event-log/event-log-contract.unit.test.ts:49`, `packages/sdk/tests/foundation/storage/event-log/event-log-contract.unit.test.ts:122`, `packages/sdk/tests/foundation/storage/event-log/event-log-contract.unit.test.ts:144`, `packages/sdk/tests/foundation/storage/event-log/event-log-contract.unit.test.ts:198`, `packages/sdk/tests/foundation/storage/event-log/event-log-contract.unit.test.ts:280`, `packages/sdk/tests/foundation/storage/event-log/event-log-contract.unit.test.ts:300`, `packages/sdk/tests/foundation/storage/event-log/event-log-contract.unit.test.ts:328`). | Analysis events use barrier durability, cite immutable cursors, and preserve replayed payloads as immutable inputs. |
| Core observability runtime | gap | Epic 3 intends analysis over recorded evidence and redacted report refs (`docs/implementation/epics/epic-3-core-runtime-spine/README.md:13`, `docs/implementation/epics/epic-3-core-runtime-spine/README.md:54`). | Epic 3 story DAG is still scaffolded and core-07 owning stories are unassigned (`docs/implementation/epics/epic-3-core-runtime-spine/story-dag.md:10`, `docs/implementation/epics/epic-3-core-runtime-spine/README.md:107`). | Create stories for trigger classification, metric wrappers, issue ids, report writing, outcome recording, invariant sweeping, and golden reports. |
| Review feedback loop | partial | Merge requires fresh Forge PR/CI/review/thread/protection/exact-head/capability evidence; unresolved threads deny merge when policy requires resolved threads (`docs/design/10-architecture/evidence-gates-and-merge.md:34`, `docs/design/30-domain-reference/core/completion-and-merge/evidence-model-and-predicates.md:151`). | Forge reads thread state/comments by design, but provider packages are scaffolded, not implemented (`docs/design/30-domain-reference/providers/forge-collaboration/README.md:109`, `docs/research/agent-harness-lessons/repo-audit/current-system-map.md:42`). | Add fixtures for unresolved threads, dismissed reviews, stale heads, blocker comments, and promotion of repeated feedback into docs/tests. |
| Gate outputs | strong | `pnpm check` is fail-fast and runs docs nav, format, lint, deps, typecheck, unit, integration, conformance mock, and coverage baseline (`docs/engineering/check-gate.md:9`, `docs/engineering/check-gate.md:15`). | `package.json` wires the chain (`package.json:29`); tests assert order, smoke exclusion, and stale docs-nav failure (`tests/gate/package-scripts.int.test.ts:20`, `tests/gate/package-scripts.int.test.ts:41`, `tests/gate/package-scripts.int.test.ts:49`). | Evidence packs cite exact `pnpm check` output and lane-specific coverage when aggregate coverage is insufficient. |
| Docs freshness | partial | Docs nav intentionally excludes `evidence/` and `research/` from the normative corpus (`tooling/docs-nav/generate-nav.mjs:46`). | Matrix and audit notes flag stale package README drift; `packages/sdk/src/README.md` still says behavior-free (`docs/research/agent-harness-lessons/GUIDELINE-MATRIX.md:34`, `packages/sdk/src/README.md:1`, `docs/research/agent-harness-lessons/RESEARCH-RUNBOOK.md:21`, `docs/research/agent-harness-lessons/repo-audit/current-system-map.md:66`). | Add package README freshness checks or a hygiene story comparing package prose with package source. |
| Cleanup and retention | partial | Retention defaults remain open and writes must name retention explicitly (`docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md:257`). | Cleanup blocked intents and tests cover stale fences, cleanup-before-finalize, dirty/path/branch/registration/I/O blockers (`packages/sdk/src/foundation/workspace-repository/cleanup/worktree-settlement.ts:61`, `packages/sdk/tests/foundation/workspace-repository/cleanup/cleanup-finalize-and-guards.int.test.ts:16`, `packages/sdk/tests/foundation/workspace-repository/cleanup/cleanup-finalize-and-guards.int.test.ts:87`, `packages/sdk/tests/foundation/workspace-repository/cleanup/cleanup-blocked-paths.int.test.ts:17`, `packages/sdk/tests/foundation/workspace-repository/cleanup/cleanup-blocked-paths.int.test.ts:152`, `packages/sdk/tests/foundation/workspace-repository/cleanup/cleanup-blocked-paths.int.test.ts:284`). | Prove cleanup cannot delete evidence still cited by committed events; define retention for analysis reports and evidence bundles. |
| Evals | gap | Matrix calls workflow outcome metrics gap/partial and suggests blocked-run rate, approval latency, recovery time, review closure, and rerun count (`docs/research/agent-harness-lessons/GUIDELINE-MATRIX.md:35`). | LangChain leverage recommends LangSmith trace/eval vocabulary only as non-authoritative prior art, and says local core-07 analyzer tests come first (`docs/research/langchain-leverage/LEVERAGE-REPORT.md:41`, `docs/research/langchain-leverage/opportunities/observability-evals.md:172`). | Add local eval fixtures: golden reports, JSONL issue datasets, metric states, analyzer/rule-set binding, feedback imports, and regression promotion. |
| Prior-art loop | partial | This pass extracts guidance, audits live evidence, classifies guidelines, and proposes docs/story work only (`docs/research/agent-harness-lessons/README.md:27`). | LangChain leverage is a leverage-library report, not a replacement; current map treats prior-art research as strong docs process (`docs/research/langchain-leverage/README.md:5`, `docs/research/langchain-leverage/LEVERAGE-REPORT.md:101`, `docs/research/agent-harness-lessons/repo-audit/current-system-map.md:46`). | Promote prior-art findings only by copying them into design docs, story ACs, fixtures, tests, or roadmap items. |

## Evidence notes

- The strongest implemented surface is the FND-02 storage/artifact/event-log substrate.
- The strongest designed surface is core-07's pure analyzer and metric-honesty contract.
- Review feedback is treated as merge evidence, not optional commentary, but the Forge/runtime pieces are
  not yet implemented.
- Gate outputs are local and concrete; `pnpm check` is not merely a convention.
- Docs freshness is mixed: normative docs nav is guarded, while research and package README drift require
  separate hygiene.
- Cleanup safety has concrete worktree tests, but artifact retention and garbage collection still need
  policy and story criteria.
- Evals should start as local deterministic fixtures before any optional external exporter.
- Prior-art reports are useful only after their lessons are promoted into normative docs, story criteria,
  fixtures, tests, or roadmap items.

## Story criteria detail

- Trigger classifier: cover terminal, blocked, supervision-lost, stale-progress, and recovery-decision
  inputs from committed events.
- Terminal invariant: prove every terminal run with usable replay and writable log records
  `AnalysisRecorded` or `AnalysisFailed`.
- Metric honesty: prove unknown values stay `partial` or `unavailable`, not `0`, `false`, empty, or
  success.
- Report artifacts: write redacted-by-default report artifacts and cite authoritative `ArtifactRef.id`
  values only.
- Artifact rejection: prove scratch refs, tombstoned originals, and unavailable redaction inputs cannot
  satisfy analysis evidence.
- Replay determinism: fix analyzer version, rule-set digest, cursor, `analyzedAt`, and redaction policy
  digest as explicit inputs.
- Failure catalog: test degraded input, artifact unavailable, redaction unavailable, rule error,
  unwritable record, and missing invariant.
- Review feedback: make unresolved threads, dismissed reviews, stale head review state, and blocker
  comments deterministic fixtures.
- Gate evidence: require exact `pnpm check` output and lane-specific coverage when aggregate coverage is
  not evidence for the touched helper scope.
- Docs freshness: compare package README claims with package implementation surfaces, not only generated
  docs navigation.
- Cleanup safety: prove cleanup cannot delete artifacts or logs still cited by committed run events.
- Eval loop: turn `AnalysisIssue` fixtures into local datasets before optional LangSmith or OTel export.

## Follow-up candidates

1. Write the `core-07` story contract set with one story per analyzer surface.
2. Add local eval fixture criteria to `core-07`: golden reports, issue datasets, metric-state assertions,
   and feedback-import fixtures.
3. Add package README freshness checks or a hygiene story for stale SDK/package prose.
4. Define retention and garbage-collection criteria for analysis reports and evidence bundles.
