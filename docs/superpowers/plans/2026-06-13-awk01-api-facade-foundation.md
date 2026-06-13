# AWK01 API Facade Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first product-named API facade with shared envelopes for project inspection and run preview.

**Architecture:** Add a small facade module beside existing command handlers. The facade wraps current handler results in a stable envelope and is exposed through new MCP tools and nested CLI commands while legacy surfaces remain untouched.

**Tech Stack:** TypeScript, Vitest, Commander, MCP SDK, existing orchestrator handlers.

---

## File Structure

- Create `packages/orchestrator/src/api/facade.ts` for envelope types, error mapping, project inspect,
  and run preview.
- Modify `packages/orchestrator/src/types.ts` for product command variants and request types.
- Modify `packages/orchestrator/src/cli/args.ts` to parse `project inspect` and `run preview`.
- Modify `packages/orchestrator/src/cli.ts` to print facade envelopes for product commands.
- Modify `packages/orchestrator/src/mcp/tools.ts` to register `workflow_project_inspect` and
  `workflow_run_preview`.
- Modify `packages/orchestrator/src/index.ts` to export facade types and functions.
- Add `packages/orchestrator/tests/api-facade.test.ts` and extend CLI/MCP tests.
- Update canonical docs and tracker status before the PR.

### Task 1: Failing Facade Tests

- [ ] Add `packages/orchestrator/tests/api-facade.test.ts` covering `projectInspectFacade`,
  story preview, track preview, and error envelopes.
- [ ] Extend `packages/orchestrator/tests/mcp-server.test.ts` to expect new product MCP tools while
  keeping legacy tools.
- [ ] Extend `packages/orchestrator/tests/cli-args.test.ts` to parse `project inspect` and
  `run preview`.
- [ ] Run the focused test command and confirm failures reference missing facade exports/commands.

### Task 2: Shared Facade

- [ ] Create `packages/orchestrator/src/api/facade.ts` with envelope/resource types.
- [ ] Implement `projectInspectFacade` from resolved config and discovered tracks.
- [ ] Implement `runPreviewFacade` by delegating to existing dry-run handlers.
- [ ] Export the facade from `packages/orchestrator/src/index.ts`.
- [ ] Run `pnpm vitest run packages/orchestrator/tests/api-facade.test.ts` and confirm it passes.

### Task 3: CLI and MCP Exposure

- [ ] Add product command variants and parser support for `project inspect` and `run preview`.
- [ ] Print facade envelopes from `runCli`.
- [ ] Register `workflow_project_inspect` and `workflow_run_preview` with product input schemas.
- [ ] Run the focused CLI/MCP tests and fix any compatibility failures.

### Task 4: Canonical Docs and Tracker

- [ ] Document the new facade in `docs/architecture.md` and `packages/orchestrator/README.md`.
- [ ] Remove this transient spec and plan in the final implementation commit after canonical docs are
  updated.
- [ ] Set AWK01 tracker status to `done` before opening the PR, then fill the PR column after the PR
  exists.
- [ ] Run `pnpm check`.
