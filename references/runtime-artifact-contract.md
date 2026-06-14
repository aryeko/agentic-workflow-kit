# Runtime artifact contract

Runtime artifacts are local-first JSON files under:

```text
.codex/agentic-workflow-kit/runs/<runId>/
```

Existing artifact files remain compatibility anchors:

```text
run.json
config.resolved.json
state.json
metrics.live.json
events.ndjson
stories.initial.json
stories/
children/
```

The V1 normalized runtime artifact model adds these files without changing the meaning of existing
files:

```text
summary.json
rows.json
budgets.json
transcripts.json
analysis.json
report.md
```

`summary.json` has `schemaVersion: 1` and records run status, timing, blocker fields, active and
completed story ids, aggregate metrics, artifact path refs, and explicit unavailable telemetry
reasons.

`rows.json` has `schemaVersion: 1` and one row per known story or child/session at the current
runtime grain. Rows include story id, status, session id/path, timing, latest progress, tool calls,
failed tool calls, subagent count, and token totals. Nullable metric fields use this shape:

```json
{
  "value": null,
  "unavailableReason": "session log token telemetry is unavailable"
}
```

`budgets.json` has `schemaVersion: 1` and records resolved agent profile budget policy, support
metadata, and evaluations for wall time, tokens, tool calls, failed tool calls, and cost. Budget
evaluations distinguish `not-configured`, `within-limit`, `warning`, `limit-reached`, and
`unavailable`. Missing telemetry must not be reported as observed zero.

`transcripts.json` has `schemaVersion: 1` and indexes session ids and transcript paths. It never
copies transcript contents into the run bundle by default.

`analysis.json` is written by explicit report generation commands and contains the stable
machine-readable analyzer result for a run. `analyze-run` remains read-only for compatibility and
does not create this file by itself.

`report.md` is written by explicit report generation commands and contains a deterministic
human-readable run report. Reports may display transcript ids, paths, statuses, and unavailable
reasons, but must not inline host transcript content.

Bounded export bundles may copy approved run artifacts and child JSON evidence, but must skip raw
child payloads and must not follow transcript paths to copy host transcript files by default.

When host telemetry cannot expose a metric, the field must be `null` with an explicit unavailable
reason instead of omitted. Existing run artifacts without these files or without metric
availability fields must still analyze.
