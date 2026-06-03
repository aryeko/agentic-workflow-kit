# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - Unreleased

### Added

- Five skills that form the delivery pipeline: `workflow-init` (scaffold config + tracks),
  `plan-product` (guided PRD authoring), `plan-track` (PRD to tracker + per-story specs),
  `implement-next` (one story end-to-end: isolate, spec-review, implement, verify, ship),
  and `workflow-autopilot` (autonomous fan-out to Codex child sessions).
- `.workflow/config.yaml` contract: the single shared spine read by both the interactive skill
  and the orchestrator, declaring paths, the status vocabulary buckets, verification commands,
  git strategy, and PR/merge policy.
- Three PR/merge presets: `push-and-merge` (no CI wait, auto-squash-merge),
  `gated-automerge` (waits on CI and a bot review, then auto-squash-merges), and `push-only`
  (opens the PR and stops for human review).
- Markdown tracker contract (`references/tracker-contract.md`): a status matrix with a
  defined vocabulary (`specced`, `plan-approved`, `implementing`, `done`, `verified`, plus the
  terminal states `blocked`, `canceled`, `deferred`, `superseded`) and a dependency graph; the
  tracker row is the only completion authority.
- PRD contract (`references/prd-contract.md`): multi-file PRD format with worked examples
  (`examples/`) for the Linkly reference project.
- `@agentic-workflow-kit/orchestrator` package: the optional TypeScript orchestrator CLI
  (`agentic-workflow-kit` bin) that drives autonomous multi-session delivery via the Codex MCP
  driver, with concurrency control, retry, and timeout handling. It also carries the shared
  config layer: the Zod schema (with generated JSON Schema), the YAML loader, and the preset
  definitions used by the CLI and tests.
