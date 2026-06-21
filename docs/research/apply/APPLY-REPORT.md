# Design closure apply report

Date: 2026-06-21
Branch: `design-closure`
Worktree: `/Users/aryekogan/repos/workflow-kit/.worktrees/design-closure`

## Inputs applied

- Wave 1 proposal package under `design-closure/outputs/wave-1/`.
- Wave 2 proposal package plus `WAVE-2-RULINGS.md`, marked `APPROVED - 2026-06-21`.
- Wave 3 proposal package plus `WAVE-3-RULINGS.md`, marked `APPROVED - 2026-06-21`.
- `design-closure/prompts/run-apply.md` superseded the proposal-only rule in
  `design-closure/README.md` for this apply session.

## Preflight evidence

- Corpus present: `docs/design/30-domain-reference/`.
- Closure package present: `design-closure/outputs/`.
- `git rev-parse --show-toplevel`:
  `/Users/aryekogan/repos/workflow-kit/.worktrees/design-closure`.
- Current branch: `design-closure`.
- The primary checkout remains `/Users/aryekogan/repos/workflow-kit`; this run used the worktree
  under `.worktrees/design-closure`.

## File-by-file changes

### Orientation and architecture

- `docs/design/00-orientation/mission-and-scope.md`: updated the runtime diagram's concrete Codex
  driver node label so it no longer uses the old `AgentDriver` interface name.
- `docs/design/10-architecture/capability-attestation.md`: applied R-T9.3; clarified that recorded
  or mock attestations can drive core and conformance tests, while production live powers require
  fresh positive provider probes.
- `docs/design/10-architecture/protected-policy-gate.md`: bound protected-policy snapshots to the
  prov-04 canonical verifier `commandDigest`.
- `docs/design/10-architecture/provider-seams.md`: pointed authoritative provider-port ownership to
  the SDK provider-port catalog.

### SDK and package boundary

- `docs/design/20-sdk-and-packaging/provider-ports.md`: added the SDK-owned canonical provider-port
  catalog with `AgentProvider`, `ExecutionHostProvider`, `ForgeProvider`, `WorkSourceProvider`, and
  shared `CapabilityAttestation` payloads.
- `docs/design/20-sdk-and-packaging/storage-port-types.md`: added the fnd-02 storage port type
  catalog for event log, artifacts, leases, durability classes, and storage health.
- `docs/design/20-sdk-and-packaging/README.md`: added the new provider-port and storage-port files
  to the package reading order.
- `docs/design/20-sdk-and-packaging/sdk-boundary.md`: identified SDK ownership of provider ports,
  `CapabilityAttestation`, and same-typed `*StorePort` injections.
- `docs/design/20-sdk-and-packaging/provider-interface-model.md`: linked canonical method signatures
  and DTOs to `provider-ports.md`.
- `docs/design/20-sdk-and-packaging/testkit-and-conformance.md`: clarified that testkit mocks and
  fixtures consume, not own, production provider interfaces and `CapabilityAttestation`.
- `docs/design/20-sdk-and-packaging/cli-and-mcp-wrappers.md`: nav-only regeneration.

### Foundation domains

- `docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md`:
  added `approval.decisionWindowMs`, the default `900000`, the `merge` key, and default-off
  `escalation-auto-grant`.
- `docs/design/30-domain-reference/foundation/configuration-and-policy/interfaces-events-and-verification.md`:
  added schema/default tests for `approval.decisionWindowMs` and `escalation-auto-grant`.
- `docs/design/30-domain-reference/foundation/configuration-and-policy/README.md`: closed the
  approval/escalation field-name question and recorded the merged policy shape.
- `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md`: pointed per-run-event
  durability ownership to the core-01 durability table.
- `docs/design/30-domain-reference/foundation/workspace-and-repository/events.md`: added fnd-03 event
  payloads for workspace/repository setup, path leases, task snapshots, cleanup, and failures.
- `docs/design/30-domain-reference/foundation/workspace-and-repository/README.md`: recorded
  path-lease-only concurrency, top-level task snapshot fields consumed by core-05, and fnd-03-owned
  event-name validity.
- `docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md`: nav-only
  regeneration.

### Core domains

- `docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md`: recorded that sibling
  event names are valid once listed and typed by the emitting domain; core-01 does not own a central
  sibling event registry.
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md`: added run durability
  and degraded-health bridge types over fnd-02 storage health.
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/event-log-writer-and-corruption.md`:
  added the minimum event durability table and append enforcement rules.
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md`:
  aligned lifecycle and append-rejection durability requirements to the new table.
- `docs/design/30-domain-reference/core/capability-and-safety/README.md`: re-pointed provider
  dependencies to seam contract/mock nodes.
- `docs/design/30-domain-reference/core/approval-and-escalation/README.md`: applied core-03 closure:
  decision deadline precedence, default window, canonical Agent seam dependency, and fail-closed
  grant mapping posture.
- `docs/design/30-domain-reference/core/approval-and-escalation/decision-model.md`: mapped policy
  grant plans to Agent `ScopedGrant` values and made unmapped grant kinds fail closed.
- `docs/design/30-domain-reference/core/approval-and-escalation/interfaces-events-and-tests.md`:
  added tests for grant mapping, invalid mappings, explicit `expiresAt` precedence, and live-window
  park-before-expiry semantics.
- `docs/design/30-domain-reference/core/approval-and-escalation/park-resume-and-failures.md`:
  clarified deadline semantics and `approval-expired` behavior.
- `docs/design/30-domain-reference/core/supervision-and-liveness/README.md`: re-pointed provider
  dependencies and renamed host contract references to `ExecutionHostProvider`.
- `docs/design/30-domain-reference/core/supervision-and-liveness/liveness-model.md`: renamed the host
  termination call to `ExecutionHostProvider.terminateWorker`.
- `docs/design/30-domain-reference/core/completion-and-merge/README.md`: applied core-05 closure:
  policy-owned required evidence, Forge branch-protection/ruleset evidence, and blocker PR rules.
- `docs/design/30-domain-reference/core/completion-and-merge/evidence-model-and-predicates.md`:
  added verifier `commandDigest` binding, ruleset-derived required checks, and blocker PR
  classifications.
- `docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md`: re-pointed provider
  dependencies to seam contract/mock nodes.
- `docs/design/30-domain-reference/core/recovery-and-reconciliation/recovery-model.md`: referenced
  fnd-02 `LeaseSnapshot` and `StorageHealth` as storage port types.

### Provider domains

- `docs/design/30-domain-reference/providers/agent-execution/README.md`: made `AgentProvider` the
  canonical public interface name and recorded that concrete Codex support is production-readiness
  work.
- `docs/design/30-domain-reference/providers/agent-execution/contracts-and-conformance.md`: renamed
  the public contract to `AgentProvider` while preserving the frozen v1 surface.
- `docs/design/30-domain-reference/providers/agent-execution/capabilities-and-conformance.md`: marked
  the conformance contract approved.
- `docs/design/30-domain-reference/providers/agent-execution/mock-driver.md`: marked the mock-driver
  contract approved.
- `docs/design/30-domain-reference/providers/execution-host/README.md`: made `ExecutionHostProvider`
  canonical and added precomputable `commandDigest` expectations.
- `docs/design/30-domain-reference/providers/execution-host/contracts-and-conformance.md`: defined the
  canonical `commandDigest` hook as SHA-256 over sorted-key canonical JSON for `{ kind, argv, cwd,
  timeoutSeconds, injection.scopeDigest }`, with failure mapped to
  `runner-command-capture-incomplete`.
- `docs/design/30-domain-reference/providers/forge-collaboration/README.md`: made `ForgeProvider`
  canonical and recorded normalized ruleset required-check evidence.
- `docs/design/30-domain-reference/providers/forge-collaboration/contracts-and-conformance.md`: added
  `ForgeRuleset.requiredStatusChecks`.
- `docs/design/30-domain-reference/providers/work-source/README.md`: made `WorkSourceProvider`
  canonical.
- `docs/design/30-domain-reference/providers/work-source/contracts-and-conformance.md`: renamed the
  public contract to `WorkSourceProvider` and updated write-status references.

### Domain catalog and implementation contract

- `docs/design/30-domain-reference/domain-catalog.md`: updated core/provider dependencies and the
  suggested order to foundation, seam ports/mocks, core spine, core gates/control, real drivers, then
  edge.
- `docs/implementation/README.md`: summarized Frontier 2/3 as seam contract/mock work with real
  provider driver stories treated separately as production-readiness work.
- `docs/implementation/domain-dag.md`: re-pointed core-to-provider edges to
  `seam-<provider>-contract-mock` nodes, preserved provider domains as real-driver homes, and
  published the build order: foundation -> seam ports and mocks -> core spine -> core gates -> real
  drivers in parallel -> edge.
- `docs/implementation/frontiers/frontier-2-provider-seams/charter.md`: split Work Source, Forge, and
  Execution Host contract/mock stories from real-driver production-readiness stories.
- `docs/implementation/frontiers/frontier-3-agent-and-core-gates/charter.md`: split the Agent
  contract/mock story from Codex real-driver production-readiness and made runtime attestations
  non-blocking for core build/test readiness.
- `docs/implementation/frontiers/frontier-4-run-control/charter.md`: recorded that Frontier 4 consumes
  seam contract/mock surfaces, not real-driver production readiness.
- `docs/implementation/frontiers/frontier-5-completion-and-recovery/charter.md`: recorded that
  Frontier 5 consumes seam contract/mock surfaces, not real-driver production readiness.
- `docs/implementation/package-rollout.md`: aligned package rollout with SDK ports/testkit mocks first
  and real provider drivers later.
- `docs/implementation/readiness-matrix.md`: reclassified runtime attestation as a production gate,
  with SDK/core readiness proven by package implementation, fixtures, replay tests, and mock-driven
  core tests.
- `docs/implementation/work-item-authoring-guide.md`: updated story evidence and gate rules to
  distinguish mock/conformance evidence from production runtime probes.
- `docs/README.md`, `docs/agent-provider-contract-researches/*.md`, `docs/engineering/tooling-and-ci.md`,
  and `docs/roadmap.md`: nav-only regeneration from `tooling/docs-nav/generate-nav.mjs`.

## Deferred, flagged, or stopped items

- `pnpm check` is not green in this worktree. It fails before changed docs are evaluated because
  `format:check` reports 334 formatting diagnostics under untouched `_old_docs/.../evidence/*.json`.
- A separate `pnpm lint` run also fails on pre-existing style issues in
  `tooling/docs-nav/generate-nav.mjs` (`noAssignInExpressions` and `useTemplate`). I did not broaden
  this design-closure commit into unrelated tooling cleanup.
- Wave 2 F-2 authorized the prov-04 `commandDigest` hook and deferred exact input-set membership to
  the prov-04 owner. The corpus now records the approved minimal hook and proposed input set, but the
  provider owner still needs to confirm final membership during implementation.
- Real-provider live attestations remain required for production live powers. They are deliberately
  reclassified as production-readiness work, not removed.
- Unrelated non-blocking design questions remain where they existed outside the closure target set,
  such as AD-14-deferred LLM adjudication, provider-specific live probes, remote-host support, and
  fnd-03 missing/moved worktree repair.

## Verification evidence

### Completeness checks

Command:

```sh
rg -n "AgentDriver|ExecutionHost\\b|ForgeContract|interface WorkSource\\b|WorkSource\\.writeStatus|\\b5p\\b|proposed draft|proposal draft|Do not apply|DRAFT" docs/design docs/implementation -g '!**/evidence/**'
```

Result: exit 1, no matches. Provider-interface naming is consistent after R-T9.4 in live docs, no
formal `5p` label was introduced, and proposal/draft markers were not carried into applied docs.

Command:

```sh
rg -n '^  - "prov-0[1-4]|^  - '\''prov-0[1-4]|^  - prov-0[1-4]' docs/design/30-domain-reference/core/*/README.md
```

Result: exit 1, no matches. Core README frontmatter no longer depends on `prov-*` nodes.

Command:

```sh
node tooling/docs-nav/generate-nav.mjs --dry | tail -n 30
```

Result: `DRY RUN - would update 0/114 files. No files written.`

Command:

```sh
git diff --check
```

Result: exit 0.

### Full gate

Command:

```sh
pnpm check
```

Result: failed in `format:check` before lint/type/test lanes.

Key output:

```text
$ pnpm format:check && pnpm lint && pnpm deps && pnpm typecheck && pnpm test:unit && pnpm test:int && pnpm test:conf && pnpm coverage:foundation
$ biome format .
_old_docs/design/domains/providers/prov-01-agent-execution/evidence/2026-06-18-codex-0.141.0-app-server-schema/ApplyPatchApprovalParams.json format
...
Diagnostics not shown: 314.
Checked 430 files in 82ms. No fixes applied.
Found 334 errors.
```

### Remaining lanes

Command:

```sh
pnpm lint && pnpm deps && pnpm typecheck && pnpm test:unit && pnpm test:int && pnpm test:conf && pnpm coverage:foundation
```

Result: failed in `lint`.

Key output:

```text
tooling/docs-nav/generate-nav.mjs:82:11 lint/suspicious/noAssignInExpressions
tooling/docs-nav/generate-nav.mjs:140:17 lint/style/useTemplate
tooling/docs-nav/generate-nav.mjs:146:31 lint/style/useTemplate
tooling/docs-nav/generate-nav.mjs:165:31 lint/style/useTemplate
tooling/docs-nav/generate-nav.mjs:176:16 lint/style/useTemplate
tooling/docs-nav/generate-nav.mjs:184:15 lint/style/useTemplate
Found 1 error.
Found 5 infos.
```

Command:

```sh
pnpm deps && pnpm typecheck && pnpm test:unit && pnpm test:int && pnpm test:conf && pnpm coverage:foundation
```

Result: passed.

Key output:

```text
no dependency violations found (80 modules, 214 dependencies cruised)
tsc -b
Test Files 9 passed (9), Tests 67 passed (67)
Test Files 5 passed (5), Tests 45 passed (45)
Test Files 2 passed (2), Tests 24 passed (24)
Coverage: Statements 94.14%, Branches 90.35%, Functions 98.39%, Lines 93.95%
```

## Readiness verdict

The applied design corpus is now buildable core-first at the design level. The closure decisions are
landed in owned locations, core domains depend on seam ports and mocks rather than real provider
drivers, runtime attestation is a production-readiness gate rather than a core build/test
prerequisite, and the published build order is foundation -> seam ports and mocks -> core spine ->
core gates -> real drivers in parallel -> edge.

Implementation story writing can start after architect review of this apply commit. The only gate
blockers found are existing repo hygiene failures in `_old_docs` formatting and the docs-nav generator
lint style, not design-closure corpus conflicts.
