# R10 - Observability and Incident Analysis

## Executive Recommendation

Adopt an event-first telemetry contract that records run, child, tool, approval, control, review,
metric-availability, and capability-gate facts at the source, then auto-run a pure analyzer on every
terminal, blocked, supervision-lost, recovery-decision, and stale-progress transition. Confidence:
high for the minimum telemetry and auto-fire behavior; medium for exact OpenTelemetry/OpenInference
export naming because GenAI agent conventions are still moving.

## Sources Checked

- Local: `docs/autopilot-durability-codex-research/README.md`, checked 2026-06-18. Defines the
  R10 charter, report format, and required topics.
- Local: `docs/autopilot-durability/design/00-overview.md`, checked 2026-06-18. Defines the event
  log as source of truth, capability gates, `child-run-result`, and the D5 auto-analysis direction.
- Local: `docs/autopilot-durability/design/02-lifecycle-and-control-plane.md`, checked 2026-06-18.
  Defines progress, approval, and control message classes plus ownership and termination evidence.
- Local: `docs/autopilot-durability/design/05-observability-and-analysis.md`, checked 2026-06-18.
  Drafts structured telemetry, nullable metrics, and terminal/block auto-analysis.
- Local: `docs/autopilot-durability/postmortems/2026-06-18-autopilot-unified-issues.md`, checked
  2026-06-18. Provides failure themes I and J plus the concrete incident evidence that R10 must
  catch.
- Local: `references/runtime-artifact-contract.md`, checked 2026-06-18. Current artifact contract:
  `analysis.json` and `report.md` are explicit report-generation outputs, metrics use nullable
  unavailable reasons, and transcript content is not copied by default.
- Local: `packages/orchestrator/src/analysis/*`, `packages/orchestrator/src/metrics/*`,
  `packages/orchestrator/src/runner/RunJournal.ts`, and related tests, checked 2026-06-18. Current
  analyzer, report, session-log metric, unavailable-metric, and journal behavior.
- Memory context: `/Users/aryekogan/.codex/memories/MEMORY.md`, checked 2026-06-18. Used only as
  prior-context hints for telemetry and analyzer pitfalls: unavailable failed-tool telemetry, real
  artifact regression fixtures, progress session linkage, and thread-aware review evidence.
- OpenTelemetry Logs Data Model, https://opentelemetry.io/docs/specs/otel/logs/data-model/,
  OTel 1.57.0 page checked 2026-06-18. It is stable and defines event/log fields such as timestamp,
  observed timestamp, severity, body, attributes, and event name.
- OpenTelemetry GenAI semantic convention registry,
  https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/registry/attributes/gen-ai.md,
  main branch checked 2026-06-18. Defines structured GenAI attributes for operation, input/output,
  tool call arguments/results, token usage, reasoning tokens, and sensitive-content warnings.
- OpenAI Agents SDK tracing docs, https://openai.github.io/openai-agents-python/tracing/, checked
  2026-06-18. Shows agent tracing commonly captures LLM generations, tool calls, handoffs,
  guardrails, custom events, and has ZDR/privacy caveats.
- Model Context Protocol specification, https://modelcontextprotocol.io/specification/2025-11-25,
  checked 2026-06-18. Establishes progress tracking, cancellation, error reporting, logging, and
  explicit user consent/control expectations for tool execution.
- OpenInference specification, https://arize-ai.github.io/openinference/spec/, checked 2026-06-18.
  Shows agent/LLM observability is commonly represented as structured traces with typed attributes
  for prompts, responses, models, retrieval, tool arguments, and token counts.
- Google SRE postmortem culture,
  https://sre.google/sre-book/postmortem-culture/, checked 2026-06-18. Supports automatic
  incident-report generation as a learning artifact for significant undesirable events, manual
  intervention, and monitoring failures.
- Langfuse token and cost tracking,
  https://langfuse.com/docs/observability/features/token-and-cost-tracking, checked 2026-06-18.
  Useful comparator for token/cost telemetry, including the fact that reasoning-model cost cannot
  always be inferred when token counts are not ingested.

## Findings

Facts from sources:

- The current draft architecture already points in the right direction: event log as source of
  truth, projections for state/metrics/summary/launch, typed `CapabilityGateRecord`, structured
  `child-run-result`, and automatic analysis on terminal/block.
- The current shipped artifact contract still says `analysis.json` and `report.md` are written by
  explicit report-generation commands; `analyze-run` is read-only by design. This directly conflicts
  with the R10/D5 goal that every terminal or blocked run produce analysis automatically.
- The current analyzer reconstructs many facts from `state.json`, child artifacts, `events.ndjson`,
  and session logs. It summarizes command counts, subagent counts, token totals, review loops,
  stale launch-only children, recovery events, final verification, merge timing, and normalized
  artifacts.
- Current session-log analysis still derives key facts from host transcript shapes and text
  heuristics. Examples include failed tool calls from string outputs, review loops from
  `spawn_agent`/`wait_agent` text, and finding counts from transcript text. This is useful as a
  compatibility path but is not reliable enough to be the vNext authority.
- Runtime artifacts already support the right metric honesty rule: missing telemetry is `null` with
  an explicit unavailable reason, not observed zero. Memory and tests show this rule matters
  specifically for failed-tool-call budgets.
- OpenTelemetry's stable log model supports source and observed timestamps, trace/span correlation,
  severity, attributes, structured bodies, and event names. That maps cleanly to local NDJSON
  events and later OTLP export.
- OpenTelemetry GenAI and OpenInference conventions both favor structured, typed telemetry for
  model calls, tool calls, token counts, and workflow context. The GenAI registry also warns that
  tool arguments/results and prompts can contain sensitive information, so the local run log should
  store redacted summaries plus refs rather than raw transcript payloads by default.
- OpenAI Agents SDK tracing treats tool calls, handoffs, guardrails, LLM generations, and custom
  events as first-class trace content, but tracing may be disabled and is unavailable for some
  privacy policies. WorkflowKit cannot depend on provider tracing as the only record.
- MCP exposes concepts relevant to progress, cancellation, error reporting, logging, and user
  consent/control. Its security principles support auditing every approval/control action and not
  trusting tool descriptions as authority.
- Google SRE guidance treats postmortems as written records of impact, mitigation, root causes, and
  prevention, and lists manual intervention and monitoring failure as common triggers. For
  WorkflowKit, `blocked`, `supervision_lost`, analyzer failure, manual recovery, and stale-progress
  detection are the local analogs.

Interpretation:

- The minimum useful telemetry is not "more logs"; it is typed decision evidence. To answer "why did
  or did not autopilot act?", every autonomous action and non-action needs a durable gate or
  blocker record with evidence refs.
- Host transcript mining should become fallback enrichment only. If a child or driver knows a fact
  at source, especially tool outcome, approval request, control result, review finding, or token
  usage, it should emit that fact directly into the run event stream.
- Analyzer output must be an artifact of the run lifecycle, not a separate operator habit. Otherwise
  the exact failures from theme J recur: the run reaches a bad terminal state but no diagnosis is
  produced, or diagnosis cannot correlate the relevant facts.

## Options

### Option A - Local canonical event log, optional OpenTelemetry export

WorkflowKit owns a schema-versioned local NDJSON event log as the canonical record. Events are
small, typed, and privacy-preserving by default. Projections, analysis, reports, and any optional
OTel/OpenInference export derive from that log.

Enables:

- Works offline and in private repos without an external observability backend.
- Makes `state`, `summary`, `metrics`, `launch`, `analysis`, and `report` reproducible from the same
  evidence.
- Allows compatibility with current local artifact tooling and regression fixtures.
- Allows future OTLP/OpenInference export by mapping local events to traces/log records.

Cannot do:

- Does not automatically provide hosted dashboards, trace search, or cross-run analytics unless an
  export layer is added.
- Requires WorkflowKit to maintain a local event schema and migration path.

### Option B - Native OpenTelemetry/OpenInference tracing as canonical

Represent every run as an OTel trace and rely on spans/events/attributes as the primary telemetry
store. Local artifacts would be a cached/exported view of the trace.

Enables:

- Strong interoperability with existing observability tools.
- Natural trace hierarchy for run -> story -> child -> tool call -> model call.
- Vendor-neutral export path for teams that already operate OTel.

Cannot do:

- Makes local-first diagnosis dependent on collector/backend availability unless fully mirrored.
- Current GenAI agent conventions are still evolving, especially multi-agent orchestration details.
- Privacy policies or disabled provider tracing can remove exactly the data needed for diagnosis.

### Option C - Keep current artifacts and enrich analyzer heuristics

Keep current `state.json`, `metrics.live.json`, child artifacts, session-log parsing, and manual
`run-report`; add more analyzer rules over existing files.

Enables:

- Lowest implementation cost and highest backward compatibility.
- Improves diagnosis for legacy runs quickly.

Cannot do:

- Does not fix source telemetry loss. Reviewers, approvals, control outcomes, and failed tools can
  still be text-only or missing.
- Does not answer "why did not autopilot act?" unless every skipped action happens to leave a
  parseable trace.
- Keeps analysis manual unless the lifecycle changes separately.

## Recommendation

Choose Option A: local canonical event log first, with a deliberate OTel/OpenInference mapping later.
Use Option C only as a compatibility layer for legacy run analysis. Do not make Option B canonical
until the external agent conventions and privacy/export guarantees are stable enough for local
incident recovery.

Minimum source-structured telemetry:

1. Event envelope

Every event should include:

- `schemaVersion`
- `seq`
- `runId`
- `storyId` when applicable
- `childId` or `launchId` when applicable
- `traceId` and `spanId` or local equivalents for later OTel mapping
- `type`
- `topic`: `lifecycle`, `progress`, `tool`, `approval`, `control`, `review`, `verification`, `pr`,
  `merge`, `metric`, `gate`, `analysis`, `recovery`
- `level`: `debug`, `info`, `warn`, `error`, `fatal`
- `eventAt`: source timestamp
- `recordedAt`: journal timestamp
- `source`: `orchestrator`, `driver`, `child`, `inspector`, `analyzer`, `operator`
- `writerId` and lease/epoch from the event-sourcing lane
- `causationId` for the request/decision/action that caused this event
- `evidenceRefs`: paths, line/event seqs, PR/thread ids, transcript refs, or command ids
- `data`: typed payload specific to the event

2. Capability and action gates

Emit a gate event every time the autopilot considers an autonomous action, whether it acts or not:

- `capability-gate-evaluated`
- `action-selected`
- `action-skipped`
- `action-applied`
- `action-failed`

The gate payload should include `capability`, `action`, `decision`, `guarantees`, `policyRef`,
`evidenceRefs`, and `reason`. This is the core answer to "why did or did not autopilot act?"

Minimum capabilities/actions to gate:

- launch child
- grant escalation
- continue unattended
- mark story complete
- create PR
- apply review fix batch
- rerequest review
- merge PR
- delete branch
- interrupt/kill child
- recover/resume/relaunch
- clear duplicate launch

3. Child lifecycle and progress

Source events:

- `child-launch-requested`
- `child-process-started`
- `child-session-linked`
- `child-progress`
- `child-heartbeat` only if emitted by the child/driver, not by parent polling
- `child-stalled`
- `child-run-result`
- `child-terminal`
- `child-supervision-lost`

Progress payloads should include `phase`, `activity`, `progressSource`, `sessionId`,
`sessionLogPath` if known, and `worktreePath`. Poll events can exist for operator diagnostics, but
must not count as child progress or wake evidence.

4. Tool-call telemetry

Emit source events for tool starts and outcomes:

- `tool-call-started`
- `tool-call-completed`
- `tool-call-failed`

Payload:

- `callId`
- `toolName`
- `toolType`: `shell`, `mcp`, `subagent`, `git`, `github`, `file`, `custom`
- `commandSummary` and optional `commandHash` for shell commands
- `argsRef` or redacted `argsSummary`, not raw sensitive args by default
- `exitCode` or structured status
- `durationMs`
- `errorKind`
- `outputRef`
- `approvalRequestId` or `grantId` when elevated permission was used

The analyzer should count failed tools from these events first. Session-log parsing remains fallback
only and must mark unavailable when the source coverage is partial.

5. Approval and control events

Approval events:

- `approval-requested`
- `approval-parked`
- `approval-decision`
- `approval-applied`
- `approval-denied`
- `approval-timed-out`
- `approval-orphaned`

Payload:

- `requestId`
- `kind`: network, filesystem, sandbox, command, credential, package-install, github, other
- `riskTier`
- `scope`: command, host, registry, path, duration, story
- `policyMode`: manual, assisted, auto
- `decisionBy`: policy, orchestrator, human
- `decision`
- `rationale`
- `childStateAtDecision`

Control events:

- `control-requested`
- `control-outcome`
- `process-signal-sent`
- `process-tree-reaped`
- `control-unsupported`

Payload:

- `controlId`
- `kind`: interrupt, terminate, kill, abort
- `target`: run, story, process-group, session
- `ownershipClass`
- `signal`
- `outcome`
- `survivingDescendants`
- `reason`

6. Verification, review, PR, and merge evidence

The `child-run-result` and inspector events should carry:

- changed files and diff refs
- verification commands with phase, status, exit code, output refs, and skipped reasons
- PR refs: number, URL, head SHA, base SHA, branch freshness
- CI checks: required flag, name, conclusion, URL, observed SHA
- reviewer findings: reviewer, source, severity, file, line/thread id, summary, status,
  firstSeenAt, resolvedAt, fixBatchId
- review gate outcomes: required reviewer/bot, pending/finding/approved/unknown
- merge evidence: method, commit, mergedAt, branch deletion outcome

Reviewer findings should be structured at the source by review subagents and GitHub inspectors.
Thread-aware GitHub review data should be treated as first-class evidence, not flattened comments.

7. Metrics and unavailable metrics

Record metrics as observations with availability metadata:

- wall time and phase durations
- tool call count by tool
- failed tool call count
- subagent count by role
- token totals: input, cached input, output, reasoning output, total
- optional cost if directly known, not inferred for reasoning models unless token and model pricing
  evidence are available
- no-progress gaps from real progress events

Every metric must include one of:

- `status: available` plus `value`, `source`, and `observedAt`
- `status: unavailable` plus `unavailableReason`
- `status: partial` plus `coverage` and `unavailableReason`

Missing or partial telemetry must never be coerced to zero.

8. Analyzer issue taxonomy

Use typed issues instead of only strings:

- `id`
- `category`
- `severity`: info, warning, blocker, safety
- `message`
- `evidenceRefs`
- `actionability`: operator, bug, config, external, unknown
- `relatedCapability`
- `firstDetectedAt`
- `regressionFixture`

Initial categories:

- `linkage`: linked event missing from projection, projection clobber, diagnostic candidate only
- `liveness`: stale real progress, poll-only activity, startup stale, supervision lost
- `approval`: unanswered request, denied request, timeout, orphaned parked request, ungrantable
  policy
- `control`: unsupported control, kill failed, surviving descendants, unowned child
- `state-coherence`: projection mismatch, stale writer, late event after terminal
- `completion`: claim/evidence mismatch, missing final verification, tracker/PR conflict
- `review`: unresolved thread, untriaged finding, max loops reached, review downgrade/block
- `merge`: gate denied, merge before final verification, stale branch, CI not green
- `metrics`: unavailable required metric, partial telemetry, budget unevaluable
- `sandbox`: network/dependency path impossible, setup script missing, policy/profile conflict
- `analyzer`: malformed input, missing required artifact, analyzer exception, schema mismatch

## Tradeoffs and Risks

- More structured events increase schema maintenance and migration work. The counterweight is that
  every field above exists because a real diagnosis or gate needs it.
- Tool argument/result telemetry can leak secrets. The default should be redacted summaries and
  refs, with raw transcript content out of bundle scope unless explicitly exported.
- Auto-analysis adds work on terminal paths. It must be bounded and non-blocking for terminalization.
- If every possible event is required before shipping vNext, the scope will sprawl. Start with the
  minimum action/gate, approval/control, source tool outcome, reviewer finding, and unavailable
  metric records.
- External observability naming can drift. Keep local names stable and map outward.
- Analyzer findings must not become another authority that silently changes run state. Analysis
  explains and recommends; capability gates and recovery controls still perform state transitions.

## Fallback and Degraded Modes

- If provider or host token telemetry is absent, record `metric-unavailable` with the exact source
  and reason. Do not enforce token/cost budgets from missing data.
- If source tool telemetry is absent but a session log exists, parse it as compatibility
  enrichment and mark the metric source as `fallback: session-log`.
- If both source telemetry and transcript are absent, mark tool, token, failed-call, and subagent
  metrics unavailable. Do not report zero.
- If GitHub review-thread state cannot be fetched, record `review-inspection-unavailable` and deny
  merge gates that require resolved findings.
- If the analyzer crashes or times out, terminalization still completes. The runner records
  `analysis-failed`, writes a stub `analysis.json` and `report.md`, and includes the analyzer error,
  input artifact refs, and retry command.
- If an event line is malformed, the analyzer should consume the contiguous valid prefix, flag
  `state-coherence/malformed-event-tail`, and produce a degraded report rather than crashing.
- If a run is legacy and lacks the vNext event schema, analyze from existing artifacts as read-only
  compatibility mode and label issue confidence accordingly.

## Validation Spikes

- Build a small fixture with only vNext events and prove `state`, `summary`, `metrics`, `launch`,
  `analysis.json`, and `report.md` can be regenerated deterministically.
- Convert the two June 2026 incident artifacts into regression fixtures and assert the analyzer flags
  linkage clobber, stale progress, unanswered approval, control unsupported, manual recovery, and
  absent analysis.
- Add a fixture where every terminal state writes either complete analysis artifacts or
  `analysis-failed` plus stub artifacts.
- Add partial telemetry fixtures: one child has failed-tool telemetry, one does not. Assert aggregate
  failed-tool metrics become unavailable/partial, not zero.
- Add a thread-aware review fixture with unresolved GitHub review threads and assert merge gates
  explain the denial with reviewer/thread evidence.
- Add a privacy fixture with sensitive tool args/results and assert report/export artifacts contain
  redacted summaries and refs only.
- Map a representative run to OTel log/trace records as a spike, but keep this non-blocking for the
  local schema.

## Open Questions

- Which exact event schema version belongs in the first vNext release, and how long should legacy
  compatibility support remain?
- Should `analysis.json` be a projection rebuilt on every inspect/report call, or a terminal
  artifact written once with explicit `analysis-regenerated` events on later reruns?
- What is the timeout budget for automatic analysis before it records `analysis-failed`?
- Should auto-analysis also fire periodically for long-running `running` runs after a stale-progress
  warning, or only when the run transitions to blocked/supervision-lost?
- Which raw telemetry, if any, may be included in exported bundles under an explicit operator flag?
- What exact OTel/OpenInference attribute mapping should be supported first, given GenAI agent
  conventions are still developing?

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../../README.md) · **← Prev:** [R9 - PR, Review, CI, and Merge Gating](./R9-pr-review-ci-merge-gating.md) · **Next →:** [R11 - Config, Policy, and Migration](./R11-config-policy-migration.md)

<!-- /DOCS-NAV -->
