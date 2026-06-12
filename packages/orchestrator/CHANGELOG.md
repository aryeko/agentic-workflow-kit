# @agentic-workflow-kit/orchestrator

## 0.5.10

### Patch Changes

- b817ea6: Add Codex plugin smoke coverage and runbook steps for reinstalling over stale plugin caches.

## 0.5.9

### Patch Changes

- dcc3826: Harden workflow-autopilot child startup supervision with a short startup acknowledgement timeout, explicit requested/launched/startup-failed launch states, stale startup duplicate recovery, tracker claim release for unacknowledged startup failures, and analyzer reporting for startup-pending and startup-stale children.

## 0.5.8

### Patch Changes

- a381679: Fix autopilot supervision and analysis for merged child runs by separating supervisor polls from child progress, refreshing completion authority from the base tracker after merged PR evidence, returning MCP run_eligible launch receipts quickly, and reporting stale parent snapshots with per-story merge/review/verification evidence.

## 0.5.7

### Patch Changes

- 9f492bc: Harden workflow-autopilot child supervision and diagnostics by adding split no-progress/wall-clock timeout config, early child lifecycle metadata persistence, completion authority reporting, recovery guard evidence, richer analyze-run child details, and updated child prompt/docs contracts for preflight, review, PR fix batches, and rendered verification fallback.

## 0.5.6

### Patch Changes

- 1ac6358: Remove the redundant Codex fixture root MCP config and keep MCP wiring on the explicit Claude and Codex plugin manifests.
- eb96cd6: Move plugin MCP startup to the published orchestrator package executable and remove checked-in generated MCP bundles.
- 1a97bfd: Harden autopilot recovery analysis, auto-merge completion evidence, runtime artifact dirty checks, and child-session review loop extraction.

## 0.5.5

### Patch Changes

- 9f944ea: Fix Codex plugin MCP startup from consumer repositories by pinning the bundled server command to the installed plugin root and expanding installed-plugin smoke coverage.

## 0.5.4

### Patch Changes

- 8c08549: Use the `mcpServers` manifest shape that Codex Desktop accepts for plugin-bundled MCP servers.

## 0.5.3

### Patch Changes

- 056d62d: Align Codex plugin MCP packaging with current Codex plugin guidance, preserve the active target repo
  cwd for plugin-bundled MCP sessions, and add server-wide MCP instructions for workflow-tool
  selection and launch safety.

## 0.5.2

### Patch Changes

- 3992148: Fix implement-next run analysis telemetry for review loops, PR follow-up, session log paths, and journal timestamps.

## 0.5.1

### Patch Changes

- 36432a8: Harden interactive implement-next review policy docs and extend analyze-run to reconstruct review,
  verification, merge, cleanup, and deterministic timeline summaries from event journals.

## 0.5.0

### Minor Changes

- 01bee94: Add durable child launch records, supervision-lost run analysis, duplicate launch blocking, parent-owned tracker claims, and configurable repo-local worktree directories for orchestrated story runs.

## 0.4.0

### Minor Changes

- dd900f4: Add configurable interactive implement-next review/subagent policy and make analyze-run understand
  compatible interactive implement-next journals.

## 0.3.0

### Minor Changes

- 4aba549: Clarify the planning artifact model and rename the public planning skills.

  BREAKING (plugin surface): the public planning skills are renamed — `plan-product` →
  `define-product`, `plan-architecture` → `design-technical-solution`, and `plan-track` →
  `plan-delivery-track`. The old slash-command names no longer resolve; update any saved prompts or
  automation that invoked them. The execution skills (`workflow-init`, `implement-next`,
  `workflow-autopilot`) are unchanged.

  New artifact model with one owner per altitude:
  `PRD → technical solution (when complex) → delivery tracker + story briefs → detailed story spec →
implementation plan → code`. `define-product` writes the PRD, `design-technical-solution` adds a
  high-level technical solution gate for complex work, `plan-delivery-track` emits the tracker plus
  lightweight story briefs, and `implement-next` now expands a brief into a detailed technical story
  spec (blocking on unresolved technical questions) and an implementation plan before writing code.
  Adds story-brief, detailed-story-spec, and technical-solution contracts and templates.

  Detailed specs and implementation plans now resolve from the configured `paths.specsDir` /
  `paths.plansDir` (defaults `docs/specs` / `docs/plans`) instead of a hardcoded directory, keeping
  per-repo artifact locations declarative.

  BREAKING (templates): the `standalone-spec` and `delta-spec` templates are removed; new trackers
  link story briefs. Existing trackers that link a detailed spec directly — including legacy
  `see <ID> + [delta](path)` rows — remain valid and are read as the detailed spec by `implement-next`.

  The `@agentic-workflow-kit/orchestrator` runtime and CLI are functionally unchanged; this minor
  bump versions the shared release so the Claude/Codex plugin surface and the published CLI stay in
  lockstep.

## 0.2.1

### Patch Changes

- 7f40c06: Clarify Codex PR review gates as reaction/comment based signals and pass the resolved PR policy into child-session prompts.

## 0.2.0

### Minor Changes

- f7edcb5: Add a bundled MCP runtime for plugin installs, exposing orchestrator operations as MCP tools while preserving the standalone CLI.
