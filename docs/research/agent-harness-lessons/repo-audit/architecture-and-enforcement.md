# Architecture and enforcement audit

## Scope and method

Audit scope: dependency rule, package graph, `.dependency-cruiser.cjs`, TypeScript
project references, package templates, check gate, lint/typecheck/test lanes, package
skeletons, and SDK/package drift.

Status values:

- `strong` - present and mechanically enforced by config, scripts, tests, or code.
- `partial` - designed or scaffolded, but not fully implemented or verified.
- `gap` - missing or stale enough to mislead future work.
- `not applicable` - intentionally outside the current implementation stage.

Baseline: the guideline matrix calls architecture enforcement strong for package graph
and partial for runtime seams (`docs/research/agent-harness-lessons/GUIDELINE-MATRIX.md:20`).
The system map makes the same split: architecture seams are strong designed/partial
implemented, the package target is skeletonized, and the gate is strong verified
(`docs/research/agent-harness-lessons/repo-audit/current-system-map.md:33-45`).

## 1. Dependency rule and package graph

Classification: `strong`.

- Design ownership is explicit. The architecture rule is Edge to Control plane to
  Contracts, Drivers to Contracts, everything to Foundation, and no concrete driver
  dependencies (`docs/design/10-architecture/architecture.md:64-76`). AD-15 freezes the
  SDK-centered eight-package model and rejects one-package-per-domain mapping
  (`docs/design/40-decisions/accepted-decisions.md:100-109`).
- The package target and dependency matrix define the tree and allowed edges:
  `sdk`, `cli`, `mcp`, four `provider-*` packages, and `testkit`
  (`docs/design/20-sdk-and-packaging/package-target.md:13-46`), with SDK/provider/edge
  forbidden imports listed in `docs/design/20-sdk-and-packaging/dependency-rules.md:16-50`.
- `.dependency-cruiser.cjs` enforces the model: target groups
  (`.dependency-cruiser.cjs:21-29`), graph hygiene (`.dependency-cruiser.cjs:43-67`),
  SDK runtime/executable/provider bans (`.dependency-cruiser.cjs:68-97`),
  provider/testkit/fixture boundaries (`.dependency-cruiser.cjs:99-127`), and owner-only
  external dependencies (`.dependency-cruiser.cjs:129-188`).
- Tests assert the `pnpm deps` script, allowed imports, and rejected SDK, provider-peer,
  production-testkit, owner-only, cycle, and orphan violations
  (`tests/dependency-rules/dependency-guardrails.int.test.ts:12-164`).
- Minor drift: `docs/engineering/dependency-rule-enforcement.md` calls deps step 3
  (`docs/engineering/dependency-rule-enforcement.md:17-21`), while the current gate makes
  it step 4 after lint (`docs/engineering/check-gate.md:17-21`). Enforcement is still
  correct.

## 2. TypeScript project references

Classification: `strong`.

- The root solution references infra plus all eight packages (`tsconfig.json:1-13`).
- The graph helper freezes the package IDs and allowed reference matrix
  (`tooling/typescript-solution/typecheck-project-graph.ts:72-92`) and reports missing
  root/package references, non-composite configs, and forbidden references with explicit
  failure tokens (`tooling/typescript-solution/typecheck-project-graph.ts:150-213`).
- Tests validate the actual graph, composite declaration settings, and allowed package
  references (`tests/typescript-solution/typecheck-project-graph.unit.test.ts:36-101`).
  Negative tests fail missing references and a forbidden `sdk -> cli` edge before code can
  rely on that import path
  (`tests/typescript-solution/typecheck-project-graph.unit.test.ts:104-150`).

## 3. Check gate, lint, typecheck, and lanes

Classification: `strong`.

- `package.json` declares format, lint, deps, typecheck, unit, integration,
  conformance, smoke, coverage, docs nav, check, and pack dry-run scripts
  (`package.json:29-43`). The `check` script is a fail-fast chain from docs nav through
  coverage (`package.json:42-42`).
- The check-gate doc matches the current nine-step composition
  (`docs/engineering/check-gate.md:13-25`), excludes smoke and pack dry-run locally
  (`docs/engineering/check-gate.md:41-46`), and reserves pack dry-run plus smoke for CI
  surfaces (`docs/engineering/check-gate.md:68-76`). `LOCAL_CHECK_GATE` encodes the same
  order and renders the `&&` chain (`tooling/docs-nav/local-check-gate.ts:25-88`).
- Vitest defines `unit`, `integration`, `conformance-mock`, and `smoke-real`
  (`vitest.config.ts:14-40`). Coverage targets `tooling/**/*.ts` and
  `packages/sdk/src/**/*.ts` with 90 percent thresholds (`vitest.config.ts:3-13`).
  Unit and conformance lanes load the no-side-effect guard, which blocks process/network
  APIs and `fetch` (`vitest.config.ts:15-33`, `tooling/no-side-effects.setup.ts:11-60`).
- Gate and infra tests assert ordered steps, package-script wiring, lane globs/guards, and
  guard behavior (`tests/gate/local-check-gate.unit.test.ts:4-30`,
  `tests/gate/package-scripts.int.test.ts:20-47`,
  `tests/gate/vitest-lanes.int.test.ts:27-52`, `tests/infra/no-side-effects.unit.test.ts:5-20`).

## 4. Seam boundary readiness

Classification: `partial`.

- Seam design is strong. Architecture places host/tool-specific risk behind Agent,
  Execution Host, Forge, or Work Source (`docs/design/10-architecture/architecture.md:53-62`)
  and defines hard boundary lines across Workspace/Repository, Forge, Execution Host, and
  Agent responsibilities (`docs/design/10-architecture/architecture.md:136-149`). AD-5
  and AD-16 make seams and `CapabilityAttestation` SDK-owned
  (`docs/design/40-decisions/accepted-decisions.md:38-43`,
  `docs/design/40-decisions/accepted-decisions.md:111-119`).
- The canonical provider port catalog remains design-level. It specifies
  `CapabilityAttestation` (`docs/design/20-sdk-and-packaging/provider-ports.md:25-49`)
  and the Agent, Execution Host, Forge, and Work Source interfaces
  (`docs/design/20-sdk-and-packaging/provider-ports.md:257-264`,
  `docs/design/20-sdk-and-packaging/provider-ports.md:457-465`,
  `docs/design/20-sdk-and-packaging/provider-ports.md:700-708`,
  `docs/design/20-sdk-and-packaging/provider-ports.md:813-820`).
- Epic 2 exists to add SDK provider ports, shared DTOs, testkit mocks, conformance
  helpers, and fixtures
  (`docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/README.md:11-15`,
  `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/README.md:48-64`).
  Current provider READMEs say concrete drivers may land later and contain no domain
  behavior, credential handling, network calls, process execution, or Forge integration
  (`packages/provider-github/README.md:1-26`, `packages/provider-local/README.md:1-27`,
  `packages/provider-markdown/README.md:1-27`).

## 5. Package skeletons and template enforcement

Classification: `partial`.

- The live target exists. `packages/README.md` lists the eight packages and package-map
  docs (`packages/README.md:9-32`) and requires manifests, composite tsconfigs, root
  solution wiring, dependency-cruiser coverage, and repo conventions
  (`packages/README.md:52-65`). The package graph test asserts frozen directories,
  canonical manifests, and approved workspace edges
  (`packages/testkit/tests/package-graph.unit.test.ts:42-78`).
- The package template is stricter: it defines generated README, manifest, source index,
  four lane tests, and tsconfig paths (`tooling/package-templates/package-template.ts:41-59`);
  defines all eight target packages and dependencies
  (`tooling/package-templates/package-template.ts:148-241`); and generates exports,
  scripts, dependencies, composite references, and lane markers
  (`tooling/package-templates/package-template.ts:316-357`). Template tests cover paths,
  dependencies, lane placement, forbidden content, and dependency-cruiser compatibility
  (`tests/package-templates/package-template-contract.unit.test.ts:20-87`,
  `tests/package-templates/package-template-dependencies.int.test.ts:5-21`).
- Live manifests are not publication-ready. `packages/sdk/package.json` has no public
  `exports` map (`packages/sdk/package.json:1-17`), while the template requires
  `exports["."]` (`tooling/package-templates/package-template.ts:81-100`) and the export
  convention reports `export-map-missing` when absent
  (`tooling/package-exports/export-convention.ts:54-83`).

## 6. SDK and package drift

Classification: `gap`.

- SDK docs are stale. `packages/sdk/README.md` says provider interfaces, storage ports,
  and runtime code may land later (`packages/sdk/README.md:1-4`) and claims no domain
  behavior (`packages/sdk/README.md:23-26`). `packages/sdk/src/README.md` says Epic 0
  keeps source behavior-free (`packages/sdk/src/README.md:1-4`).
- Source contradicts that. `packages/sdk/src/index.ts` exports foundation configuration,
  credentials/secrets, storage/artifacts/event-log/evidence/filesystem/leases, and
  workspace repository modules (`packages/sdk/src/index.ts:1-25`). Foundation barrels
  export configuration policy, storage, workspace/repository, and credentials/secrets
  (`packages/sdk/src/foundation/configuration-policy/index.ts:1-34`,
  `packages/sdk/src/foundation/storage/index.ts:1-18`,
  `packages/sdk/src/foundation/workspace-repository/index.ts:1-7`,
  `packages/sdk/src/foundation/credentials-secrets/index.ts:1-7`).
- This matters because the matrix flags stale knowledge as a drift risk
  (`docs/research/agent-harness-lessons/GUIDELINE-MATRIX.md:34`), and the system map
  already identifies this README drift
  (`docs/research/agent-harness-lessons/repo-audit/current-system-map.md:60-72`).

## 7. Real-provider smoke and live seam enforcement

Classification: `not applicable`.

- `smoke-real` is the only lane allowed real process/network effects, is excluded from
  `pnpm check`, and is inert until real drivers and the native containment helper land
  (`docs/engineering/test-lanes.md:48-59`, `docs/engineering/test-lanes.md:61-68`).
- The check-gate doc says smoke is not required branch protection yet and current smoke
  tests pass with `passWithNoTests: true` (`docs/engineering/check-gate.md:72-76`).
- Near-term expectation: keep static guards green, add mock conformance in Epic 2, then
  add real-driver smoke in concrete-provider stories.
