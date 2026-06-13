# AWK01 API Facade Foundation Design

## Goal

Create the first shared product API facade for the orchestrator so MCP tools and CLI commands can
return the same WorkflowKit vocabulary and result envelope while preserving every existing 0.5.13
compatible legacy tool and command.

## Scope

In scope:

- Shared TypeScript result envelope types for success, error, warnings, next actions, artifact refs,
  response bounds, project context, capabilities, and run-preview resources.
- A command facade module that calls existing handlers for project inspection and dry-run run
  preview without replacing legacy handlers.
- Product-named MCP tools for `workflow_project_inspect` and `workflow_run_preview`.
- Product-named CLI commands for `project inspect` and `run preview` with JSON envelope output.
- Focused tests for envelope vocabulary, MCP exposure, CLI parsing, and legacy compatibility.
- Canonical docs that record the facade contract and note that this story is implemented by the
  pinned 0.5.13 executor.

Out of scope:

- Implementing every future workflow API command.
- Changing release/version behavior.
- Removing or renaming existing legacy commands or MCP tools.
- Implementing live streaming, abort/control persistence, report export, agent profiles, or tracker
  migration.

## Compatibility Plan

The new facade coexists under product names. Existing legacy MCP tools such as `run_story` and
`run_eligible`, and existing CLI commands such as `run-story` and `run-eligible`, remain registered
and keep their current request and response behavior. Product commands call a shared facade that
wraps current handler results in a stable envelope:

- `workflow_project_inspect` and `agentic-workflow-kit project inspect` resolve repo context,
  config path, docs paths, and capability flags.
- `workflow_run_preview` and `agentic-workflow-kit run preview` call existing dry-run story or
  eligible-track handlers and return the selected run preview in the envelope.
- Facade errors use `ok: false`, `operation`, and a structured error object instead of raw string
  errors.

## Minimal Foundation

AWK01 implements the envelope and product vocabulary needed by later stories, not the later runtime
features themselves. Capability flags can advertise current limitations explicitly. Unsupported
future capabilities should be absent from the first facade result rather than implied by missing
fields on an operation response.

## Acceptance Mapping

- WF-5: Docs and types distinguish product resources from current legacy tool names.
- RUN-1: Story run preview uses the same request/result model that later launch can reuse.
- RUN-2: Track autopilot preview uses the same request/result model that later launch can reuse.
- OBS-1: The envelope has a stable place for run status resources and response bounds.
- OBS-2: The facade vocabulary reserves future control capability flags without implementing abort.
- OBS-3: Artifact refs are first-class envelope fields.
- HC-1: Legacy Codex-backed tools remain available and product preview still routes through the
  current Codex-compatible runtime path.
- HC-2: Product resources use `run`, `track`, `story`, `project`, and `capabilities` rather than
  Codex-only terms.

## Validation

Focused gate:

```bash
pnpm vitest run packages/orchestrator/tests/api-facade.test.ts packages/orchestrator/tests/mcp-server.test.ts packages/orchestrator/tests/cli-args.test.ts packages/orchestrator/tests/cli.test.ts packages/orchestrator/tests/handlers.test.ts
```

Final gate:

```bash
pnpm check
```
