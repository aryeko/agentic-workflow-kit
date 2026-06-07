# @agentic-workflow-kit/orchestrator

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
