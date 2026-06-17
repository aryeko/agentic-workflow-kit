---
title: agentic-workflow-kit redesign release handoff (AWK14)
status: ready
last-reviewed: 2026-06-16
related:
  - ./README.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/release-hardening-design-3.md
---

# Release handoff — agentic-workflow-kit redesign (AWK14)

Release-readiness handoff for the `agentic-workflow-kit-redesign` track. It records the semver
decision, release gates, intentional limitations, and the publish flow. AWK14 is the final story; all
implementation (AWK01–AWK13.16) and three hardening rounds are complete.

## Semver decision

**Minor bump: 0.5.x → 0.6.0.** The redesign is additive at the API level (new `workflow_*` facade,
agent profiles, run control/observability, provider-neutral child-session boundary) but changes
default behavior and one config surface:

- Non-dry-run story launches now require explicit `--yes` / `confirmNonDryRun` approval.
- `workflow-init` defaults to the conservative `push-only` preset.
- The inert `costUsd` budget dimension is removed; the strict config schema now rejects `budget.costUsd`.

For a pre-1.0 (0.x) package these behavior/config changes ship as a minor per the changesets
semver-zero convention. The release changesets are authored per theme under `.changeset/` (five
`minor` plus one `patch`, aggregating to 0.6.0). The four changesets added mid-track were removed and
their content re-covered by this set.

## Release gates (all green on this branch)

| Gate | Command | Result |
| --- | --- | --- |
| Lint + typecheck + test + coverage | `pnpm check` | pass — root 590 + orchestrator 378 tests; coverage 85.96 / 77.66 / 91.12 / 89.11 vs thresholds 85 / 76 / 90 / 88.5 |
| Build | `pnpm build` | pass |
| Package contents | `pnpm pack:dry-run` | pass — ships `dist/` only (no `src`/tests) |
| Codex plugin smoke | `pnpm smoke:codex-plugin` | pass — 3 tests |

## Intentional limitations (carry-forward)

Real, disclosed limitations, surfaced in run evidence rather than hidden:

- **Live token telemetry is off** (`tokenTelemetryLive: false`). Token budgets and breakdowns are
  null-with-reason unless transcript parsing supplies totals.
- **Structured output is recorded but not enforced** (`structuredOutputEnforced: false`). A profile
  can configure a structured-output contract, but the Codex MCP V1 driver emits a capability
  downgrade and parses child output heuristically.
- **Provider neutrality is structural, not yet exercised.** The driver boundary is genuinely
  Codex-free, but Codex MCP is the only shipped driver, so neutrality is not load-tested by a second
  adapter. The artifact root (`.codex/agentic-workflow-kit`) and the `codex_*` tool aliases remain as
  intentional back-compat.

POL-4 note: the cost budget dimension is now satisfied by removing the inert knob rather than shipping
a budget control that cannot enforce.

## Pinned-executor note

All track stories (AWK01–AWK13.16) were executed by the installed, pinned WorkflowKit plugin version
0.5.13. Code changes from the track do not affect the running executor; the new runtime becomes
consumable only after 0.6.0 is published and installed.

## Publish flow (automation-owned)

This story does NOT run `pnpm version-packages` by hand. The repository's release automation owns
versioning: on merge to `main`, the `release` workflow consumes the accumulated changeset to open a
"Version Packages" PR (version bump + `CHANGELOG.md`); merging that PR publishes
`@agentic-workflow-kit/orchestrator` to npm via OIDC trusted publishing.
`scripts/sync-plugin-versions.mjs` keeps the plugin manifests in lockstep during `version-packages`.

Publishing requires explicit maintainer approval; do not publish from this branch.

## Post-release follow-ups (tracked, not blocking release)

- Archive the transient track/PRD process docs (3x release-readiness review, 3x release-hardening
  design, story briefs) under `docs/archive/`.
- Surface config `capabilityWarnings` (inline-profile capability warnings) in the facade/CLI envelope;
  they are recorded today but not user-visible.
- Add a `FileArtifactStore` crash-safety test that asserts a partial write preserves the prior file.
- Reword the `tokens` budget unavailable-reason string to drop the internal "AWK06/AWK08" milestone
  reference.
