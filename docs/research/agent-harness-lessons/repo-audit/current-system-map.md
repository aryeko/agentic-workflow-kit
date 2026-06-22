# Current system map

## Scope

This note maps the live `v-next` worktree state into five statuses used by the synthesis:
`designed`, `planned`, `scaffolded`, `implemented`, and `verified`.

## Evidence inspected

- `AGENTS.md`
- `docs/design/10-architecture/architecture.md`
- `docs/design/00-orientation/requirements.md`
- `docs/design/40-decisions/accepted-decisions.md`
- `docs/implementation/README.md`
- `docs/engineering/check-gate.md`
- `docs/engineering/test-lanes.md`
- `docs/research/langchain-leverage/README.md`
- `docs/research/langchain-leverage/LEVERAGE-REPORT.md`
- `packages/**/README.md`
- `packages/sdk/src/**`
- `packages/sdk/tests/**`
- `packages/testkit/tests/**`
- `tests/**`
- `tooling/**`
- `.dependency-cruiser.cjs`
- `vitest.config.ts`
- `package.json`

## System status by surface

| Surface | Status | Evidence | Notes |
|---|---|---|---|
| Repo-local knowledge system | strong designed, strong planned, partial verified | `AGENTS.md`, `docs/design/**`, `docs/implementation/**`, `docs/engineering/**`, `tooling/docs-nav/generate-nav.mjs`, `package.json` `docs:nav:check` | The repo uses a short AGENTS map and deeper design/engineering/implementation corpora. Docs navigation freshness is mechanically checked. |
| Architecture seams and dependency rule | strong designed, partial implemented, partial verified | `docs/design/10-architecture/architecture.md`, `docs/design/40-decisions/accepted-decisions.md`, `.dependency-cruiser.cjs`, `tests/dependency-rules/**` | The four seams and layer rule are explicit. Dependency-cruiser and tests enforce package-level guardrails, but most seam implementations are still future work. |
| Requirements and acceptance checks | strong designed, strong planned | `docs/design/00-orientation/requirements.md`, `docs/implementation/work-item-authoring-guide.md`, `docs/implementation/coverage.md` | Requirements use FR/NFR IDs and verifiable acceptance checks. Implementation stories define evidence packs and STOP conditions. |
| Implementation slicing | strong planned, partial verified | `docs/implementation/README.md`, `docs/implementation/domain-dag.md`, `docs/implementation/epic-dag.md`, `docs/implementation/epics/**` | The design-to-story ladder exists. Some epics are still scaffolded or awaiting lower-level story contracts. |
| Package target | implemented as package skeletons, partial verified | `packages/README.md`, eight package directories, package manifests, `tests/package-templates/**`, `tsconfig.json` | The eight package directories exist. Provider packages, CLI, MCP, and testkit are mostly skeletons. |
| Foundation configuration and policy | implemented, verified by unit tests | `packages/sdk/src/foundation/configuration-policy/**`, `packages/sdk/tests/foundation/configuration-policy/**` | Schema validation, defaults, adoption diagnostics, stable provenance, and policy resolution are represented in code and tests. |
| Foundation storage and artifacts | implemented, verified by unit/integration/conformance tests | `packages/sdk/src/foundation/storage/**`, `packages/sdk/tests/foundation/storage/**` | Event log, leases, artifact store, filesystem storage, storage health, and evidence-bundle shapes exist with focused tests. |
| Workspace and repository foundation | implemented, verified by integration/unit tests | `packages/sdk/src/foundation/workspace-repository/**`, `packages/sdk/tests/foundation/workspace-repository/**` | Worktree setup, branch/repository boundary, cleanup settlement, and local git evidence surfaces exist. |
| Credentials and secrets foundation | implemented, verified by unit tests | `packages/sdk/src/foundation/credentials-secrets/**`, `packages/sdk/tests/foundation/credentials-secrets/**` | Credential refs/scopes, injection planning, egress policy issue, redaction, lifecycle/audit events, and denial reasons are represented. |
| Agent, Forge, Work Source, Execution Host providers | designed and scaffolded, not substantially implemented | `docs/design/30-domain-reference/providers/**`, `packages/provider-codex/README.md`, `packages/provider-github/README.md`, `packages/provider-local/README.md`, `packages/provider-markdown/README.md` | Provider package READMEs describe future drivers and skeleton boundaries. Concrete provider behavior is not present yet. |
| Deterministic control plane domains | strong designed, partial planned, mostly not implemented | `docs/design/30-domain-reference/core/**`, `docs/implementation/domains/core/**`, `docs/implementation/epics/**` | Core run lifecycle, capability, approval, supervision, completion, recovery, and analysis are design/planning surfaces, not runtime code yet. |
| Operator surface | designed and scaffolded, not implemented | `docs/design/30-domain-reference/edge/operator-surface/**`, `packages/cli/**`, `packages/mcp/**` | CLI and MCP packages exist as package targets, but no operator behavior is implemented. |
| Verification gate | strong implemented and verified | `package.json`, `docs/engineering/check-gate.md`, `docs/engineering/test-lanes.md`, `vitest.config.ts`, `tooling/no-side-effects.setup.ts`, `tests/gate/**`, `tests/infra/**` | Local gate, lane definitions, no-side-effect guard, and package/dependency/template tests are implemented. |
| Prior-art research pattern | strong implemented as docs process | `docs/research/langchain-leverage/**` | Existing research report demonstrates the same pattern: source-fit analysis, opportunity files, no-go areas, and implementation roadmap. |

## Current strengths

- The design already encodes many harness-engineering lessons: short entry contract, repo-local
  source of truth, strict seams, fail-closed capability gates, worker/runner split, evidence over
  prose, and mechanical dependency checks.
- The implementation has meaningful foundation code, not only design docs. Configuration, storage,
  workspace/repository, and credentials/secrets all have source and tests.
- The verify gate is itself documented, scripted, and tested. That makes it usable as agent feedback,
  not merely human convention.
- The repo already keeps research as durable docs, with `docs/research/langchain-leverage/` as a
  precedent for this report.

## Current gaps and caveats

- Most autonomous orchestration behavior remains designed or planned rather than implemented:
  provider drivers, run lifecycle, capability-gate runtime, approval relay, liveness supervision,
  completion/merge, recovery/reconciliation, observability analysis, CLI, and MCP are not yet real
  product behavior.
- Package README text is partly stale. For example `packages/sdk/README.md` and
  `packages/sdk/src/README.md` still describe the SDK as behavior-free/reserved even though
  foundation code now exists under `packages/sdk/src/foundation/**`.
- Conformance and smoke lanes are defined, but real-provider smoke remains intentionally inert until
  real drivers and containment exist.
- The current system is strong at design-time and local verification; it is not yet a full
  long-running work daemon comparable to Symphony.
