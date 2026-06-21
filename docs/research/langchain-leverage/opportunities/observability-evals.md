# Observability and evals

## Opportunity summary

LangSmith can reduce `core-07` product and implementation work by giving kit-vnext a tested
reference vocabulary for traces, runs, threads, feedback, datasets, experiments, annotation queues,
automation rules, OpenTelemetry ingestion, and bulk export. The leverage is highest if kit-vnext
copies patterns and builds optional adapters after the pure analyzer exists. It is low-to-negative if
LangSmith becomes the source of truth for run state, gates, task status, replay, or durability.

Score line: code avoided: medium; product gain: high; seam fit: medium-high; invariant risk: medium
if adapter-only, high if authoritative; dependency risk: medium-high; timing: after `core-07` story
contract and event-log/artifact implementation; use type: copied pattern first, optional exporter and
external-eval adapter later.

The core answer is: use LangSmith concepts to avoid inventing the operator/eval flywheel from a blank
page, not to avoid implementing the kit-native analyzer. `core-07` still needs deterministic trigger
classification, honest metrics, issue ids, redacted artifacts, `AnalysisRecorded` /
`AnalysisFailed`, and terminal-analysis invariant tests over the `core-01` log.

## Candidate projects

- `core-07` analyzer contract and tests: copy LangSmith's trace/run/thread/feedback vocabulary where
  it sharpens local terminology, but keep the input model as committed `RunEventEnvelope`s and
  fnd-02 artifact refs.
- `core-07` report/export artifact: shape report sections around trace hierarchy, run status,
  feedback, tags/metadata, costs/tokens where available, and issue drill-down patterns.
- Optional `core-07` OpenTelemetry exporter: project kit run events and analysis issues into spans
  after the local `AnalysisRecorded` event is committed.
- Optional eval dataset generator: turn selected terminal failures, blocked runs, stale-progress
  events, review findings, and recovery cases into local JSONL fixtures or LangSmith-compatible
  datasets.
- Optional external-eval import: ingest evaluator/annotation feedback as non-authoritative evidence
  events only when tied to a kit event cursor, artifact digest, analyzer version, rule-set digest, and
  redaction policy digest.
- Edge/operator follow-on: borrow LangSmith-style filters, annotation queues, feedback criteria,
  automation rule logs, and experiment comparison UX after `edge-01` consumes core reports.

## What to leverage

- Trace shape: LangSmith's project -> trace -> run/span -> thread model is a useful display and
  export projection. It maps naturally to kit run, lifecycle phase, provider operation, and
  multi-session linkage views, but not to authored state.
- OpenTelemetry mapping: LangSmith documents framework-neutral OTel ingestion, span kind attributes,
  message/tool/exception event extraction, and collector fan-out. This can reduce exporter design
  time by making OTel a downstream projection rather than a bespoke trace protocol.
- Feedback model: feedback has stable keys, scores, values, comments, source metadata, and can attach
  to root or child runs. That is a good model for human review, evaluator output, and per-step
  critique artifacts, provided kit stores only redacted, cited feedback as evidence.
- Dataset and experiment loop: LangSmith's offline/online split, dataset versions/tags/splits,
  experiment comparison, and production-failure-to-dataset loop are strong product prior art for
  turning `AnalysisIssue`s into regression cases.
- Automation rules: filters, sampling rates, annotation queue routing, dataset promotion, webhooks,
  evaluator actions, and retention upgrades are useful edge/operator patterns. In core, the equivalent
  remains deterministic auto-fire triggers from committed events.
- Export model: bulk exports to S3-compatible storage in Parquet, selectable fields, date/project
  ranges, partitioning, retries, and raw feedback caveats give concrete prior art for later analytics
  export requirements.
- CLI/API ergonomics: JSON-first CLI/API access to traces, runs, datasets, experiments, and threads is
  relevant to kit's future operator diagnostics, but the LangSmith CLI is alpha and should not be a
  stable dependency.

## Why it helps kit-vnext

LangSmith helps kit-vnext avoid spending product-design effort on well-trodden observability and eval
shapes. The most valuable copied patterns are:

- a trace tree view over event-log facts;
- feedback keys and rubric configuration;
- annotation queues for ambiguous or high-risk cases;
- dataset versions/splits/tags for regression stability;
- experiment comparisons for analyzer/evaluator changes;
- promotion of production failures into future tests;
- export-field selection to control privacy and payload size.

This does not remove the need to build the `core-07` analyzer. The analyzer is kit-specific because
its job is to enforce the terminal-analysis invariant, correlate lifecycle/capability/approval/
liveness/completion/recovery/provider/storage/privacy evidence, preserve metric honesty, and append a
kit-native analysis fact through the `core-01` writer.

The practical leverage is therefore front-loaded into story design, fixture design, schema naming,
report shape, and optional export adapters. It should reduce ambiguity and UX churn more than it
reduces core logic.

## Direct reuse vs adapter vs copied pattern

| Area | Recommended use | Rationale |
|---|---|---|
| Trace/run/thread vocabulary | Copied pattern | Good mental model for report and export projections; incompatible as authored state. |
| OTel span export | Adapter | Export only after `AnalysisRecorded`; use collector fan-out so LangSmith is one sink among many. |
| Datasets/experiments | Copied pattern, optional adapter | Use locally for regression fixtures first; optionally publish redacted examples to LangSmith later. |
| Feedback/annotation queues | Copied pattern, optional import adapter | Useful for human/evaluator review; imported feedback must cite kit evidence and never decide gates alone. |
| Automation rules | Copied edge pattern | Core auto-fire stays event-log-triggered; LangSmith-like routing belongs in `edge-01` or an external sink. |
| Bulk export | Copied pattern, later adapter | Field selection and partitioning are useful; SaaS export cannot be core evidence or durability. |
| LangSmith CLI | Reference only | Alpha surface; fine for research, not for core contracts. |
| LangSmith Deployment / Agent Server | Do not use | It would compete with kit-vnext's control plane, event log, and worker/runner isolation. |

## Source-level fit notes

LangSmith's trace tree fits kit-vnext as a projection, not as the log. LangSmith says traces are made
of runs/spans and threads link multiple traces by metadata; kit-vnext says the authored run state is
the append-only `core-01` event log, with projections rebuilt purely from replay. A kit exporter can
map `RunLifecycleTransitioned`, `SessionLinked`, provider evidence, verification evidence, and
`AnalysisRecorded` into spans, but the span ids must be derived from committed event ids or artifact
digests.

The OTel path is the best seam fit. LangSmith accepts standard OTel traces and documents attributes
for span kinds, messages, tool calls, exceptions, attachments, and collector fan-out. That lets
kit-vnext define a provider-neutral `AnalysisExportSink` or later OTel exporter behind fnd-02/core-07,
with LangSmith configured externally. The core package should emit no LangSmith SDK calls.

LangSmith datasets/evals fit the regression loop. Offline evals run applications over datasets;
online evals score production runs or threads and route failures into datasets. Kit can mirror that
locally by converting `AnalysisIssue` fixtures into deterministic tests before any SaaS export. If a
LangSmith adapter exists later, it should publish redacted examples and import only evaluator feedback
that references the originating kit run/event cursor.

Feedback and annotation queues map to review artifacts. LangSmith feedback records criteria, score,
value, comments, correction, source, and run id; annotation queues add reusable rubrics. Kit can reuse
that shape for `AnalysisIssue` review and evaluator audit trails, but imported feedback is still an
artifact/evidence input, not a gate result.

Bulk export is useful as an analytics pattern, especially field selection and excluding large
inputs/outputs. It is not a replacement for fnd-02 export because LangSmith bulk export depends on
API keys, workspace ids, S3-compatible destinations, plan availability, date/project ranges, retries,
and LangSmith's retained trace corpus.

Open SWE reinforces the same adapter boundary. It uses LangSmith tracing for agent/reviewer graphs
and has analyzer/reviewer ideas worth mining, but its LangGraph threads, metadata, PR automation, and
LangSmith traces are app state. Kit should only use those as fixture/product references after SDK
provider ports and event-log evidence exist.

## Required kit-vnext stories

- `core-07-story-contract`: define analyzer rule-set digesting, deterministic issue ids, terminal
  invariant tests, metric-honesty tests, and report artifact shape before any export.
- `core-07-report-fixtures`: create redacted golden reports for completed, failed, canceled, blocked,
  supervision-lost, stale-progress, and recovery-decision triggers.
- `core-07-eval-fixtures`: convert representative `AnalysisIssue` outputs into local regression
  datasets with version tags, splits, expected issue codes, and metric states.
- `core-07-otel-export-spike`: after `AnalysisRecorded` exists, map committed event refs and report
  refs to OTel spans and attributes; prove that disabling the exporter does not change analysis
  output or event ids.
- `core-07-feedback-import-spike`: define a non-authoritative feedback artifact/event shape for human
  annotation and evaluator results, including source, score/value/comment, redaction state, cursor,
  and digest binding.
- `edge-01-observability-queues`: later, design operator queues and filters inspired by LangSmith
  automation/annotation concepts while keeping approvals, recovery, and merge decisions in kit core.
- `provider-observability-langsmith-optional`: later, build a LangSmith sink package outside core if
  there is a product need; it must depend on exported kit evidence, not on live provider state.

## Risks and constraints

- Authority inversion: if LangSmith traces, evaluator scores, annotation queues, or automation rules
  become the reason a run is completed, merged, recovered, or approved, kit violates event-log and
  gate authority.
- SaaS dependency: API keys, workspace/region configuration, rate limits, retention, plan-specific
  export features, and service availability make LangSmith unsuitable as core evidence storage.
- Retention mismatch: LangSmith SaaS trace retention is finite unless data is promoted or retention
  is upgraded; kit run evidence must remain governed by fnd-02 retention and write-once artifact
  semantics.
- Privacy: LangSmith's trace/export model can include inputs, outputs, events, errors, tags, metadata,
  and feedback. Kit must export redacted projections by default and never export raw prompts, tokens,
  credentials, unredacted command output, scratch refs, or tombstoned originals.
- Metric semantics: LangSmith cost/token/latency fields are useful when available, but kit metrics
  must keep `available` / `partial` / `unavailable`; missing exported fields or unsupported providers
  cannot be coerced to zero.
- Ordering semantics: LangSmith `dotted_order` and span hierarchy are presentation/export ordering;
  kit's canonical order remains `RunEventEnvelope.sequence` and `RunEventCursor`.
- CLI stability: LangSmith CLI is useful for manual research and diagnostics, but its alpha status
  rules it out as a stable automation contract.
- Timing: the readiness matrix says `core-07` has approved design but no story contract, package, or
  conformance evidence. LangSmith integration before local analyzer tests would create dependency and
  product drift.

## Recommended verdict

Use LangSmith for `core-07` leverage, but only as non-authoritative prior art and optional downstream
integration.

The immediate verdict is `adopt patterns, defer integration`. Copy the trace/eval/feedback/export
concepts into kit-native stories and fixtures now. Build the deterministic analyzer, redacted report
artifact, metric-honesty model, terminal invariant, and local eval fixtures first. Reopen an optional
LangSmith exporter/importer only after the event log, fnd-02 artifact store, `AnalysisRecorded` /
`AnalysisFailed`, and replay tests are executable.

This avoids the largest design and implementation trap: LangSmith is excellent at observing and
evaluating LLM apps, but kit-vnext's core must remain the authority for run activity, evidence,
capability gates, approvals, recovery, completion, and merge.

## Sources

- [LangSmith adoption review](../../langchain-review/adoption-reports/langsmith-adoption.md)
- [LangSmith project report](../../langchain-review/project-reports/langsmith.md)
- [Open SWE adoption review](../../langchain-review/adoption-reports/open-swe-adoption.md)
- [Open SWE project report](../../langchain-review/project-reports/open-swe.md)
- [LangChain ecosystem unified report](../../langchain-review/UNIFIED-REPORT.md)
- [core-07 Observability & Analysis](../../../../docs/design/30-domain-reference/core/observability-and-analysis/README.md)
- [core-07 Analysis contract](../../../../docs/design/30-domain-reference/core/observability-and-analysis/analysis-contract.md)
- [Architecture observability and analysis](../../../../docs/design/10-architecture/observability-and-analysis.md)
- [core-01 Run Lifecycle & Event State](../../../../docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md)
- [Storage port types](../../../../docs/design/20-sdk-and-packaging/storage-port-types.md)
- Domain DAG
- Readiness matrix
- [LangSmith Observability concepts](https://docs.langchain.com/langsmith/observability-concepts)
- [LangSmith Trace with API](https://docs.langchain.com/langsmith/trace-with-api)
- [LangSmith Trace with OpenTelemetry](https://docs.langchain.com/langsmith/trace-with-opentelemetry)
- [LangSmith Evaluation](https://docs.langchain.com/langsmith/evaluation)
- [LangSmith Manage datasets](https://docs.langchain.com/langsmith/manage-datasets)
- [LangSmith Evaluate with OpenTelemetry](https://docs.langchain.com/langsmith/evaluate-with-opentelemetry)
- [LangSmith Feedback data format](https://docs.langchain.com/langsmith/feedback-data-format)
- [LangSmith Log user feedback using the SDK](https://docs.langchain.com/langsmith/attach-user-feedback)
- [LangSmith Annotation queues SDK](https://docs.langchain.com/langsmith/annotation-queues-sdk)
- [LangSmith Automation rules](https://docs.langchain.com/langsmith/rules)
- [LangSmith Bulk export trace data](https://docs.langchain.com/langsmith/data-export)
- [LangSmith CLI](https://docs.langchain.com/langsmith/langsmith-cli)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../README.md) · **← Prev:** [Durable execution and tests](./durable-execution-tests.md) · **Next →:** [Tool and MCP adapter patterns](./tool-mcp-adapters.md)

<!-- /DOCS-NAV -->
