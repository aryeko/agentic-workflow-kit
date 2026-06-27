# Reviewer Prompt: prov-04-s3-local-execution-host-driver

## Assigned Routing

- Source story id: `prov-04-s3-local-execution-host-driver`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-6-concrete-provider-drivers/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `prov-04-s3-local-execution-host-driver` covers `AC-1`..`AC-9` and carries a public provider package, process/containment and credential-injection safety boundary, smoke-real evidence, conformance, failure-token closure, and boundary purity.

## Original Scope

- Story id: `prov-04-s3-local-execution-host-driver`.
- Epic slug: `epic-6-concrete-provider-drivers`.
- Source story contract: `docs/implementation/epics/epic-6-concrete-provider-drivers/stories/prov-04-s3-local-execution-host-driver.md`.
- Acceptance criteria: `AC-1` public factory and Execution Host provider compatibility; `AC-2` workspace attachment/cwd containment; `AC-3` runner command digest and capture; `AC-4` worker spawn/observation; `AC-5` termination proof shape; `AC-6` capability/egress attestations; `AC-7` injection separation and credential destruction; `AC-8` Execution Host conformance and broken providers; `AC-9` dependency and boundary purity.
- Allowed pathset: `packages/provider-local/src/**`, `packages/provider-local/tests/**`, `packages/provider-local/package.json`, `packages/provider-local/tsconfig.json`.
- Dependencies: prior frozen `prov-04-s1-execution-host-port`, `prov-04-s2-execution-host-testkit`, fnd-03 workspace leases, fnd-04 injection/egress/redaction/audit, and fnd-02 artifacts.
- Non-goals: SDK Execution Host type changes, testkit ownership, Agent protocol/approval/resume, local git evidence, worktree lifecycle, Forge actions, credential policy authorship, completion/liveness/recovery decisions, and core event-log append.
- STOP conditions: changed Execution Host port, Forge credentials exposed to workers, schema-only egress/kill claims, approval/recovery decisions, or local git evidence gathering.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

- Verify source AC coverage for `AC-1`..`AC-9`; each AC must be proven by the named standing gate lane or targeted command and not by prose alone.
- Confirm every manifest item maps to AC -> standing gate lane: public factory/type conformance to `typecheck`/`type:fixtures`, workspace/command/injection/conformance/boundary to `coverage:baseline` or `deps`, live worker/termination/egress evidence to gated `smoke-real`.
- Check every failure token is exact and proven: `host-capability-unattested`, `workspace-mount-unavailable`, `workspace-cwd-outside-mount`, `credential-injection-rejected`, `egress-confinement-unattested`, `worker-spawn-failed`, `host-observation-incomplete`, `termination-unproven`, `runner-command-capture-incomplete`, `credential-destroy-unconfirmed`.
- Validate return-shape invariants: `terminateWorker` never returns `HostFailure`; `releaseWorkspace` uses `HostReleaseResult` and surfaces credential destruction failure through observation semantics as the source story requires.
- Validate evidence pack completeness: public import fixture, focused provider coverage over `packages/provider-local/src/**`, boundary sweep, conformance evidence, gated smoke-real evidence, and `pnpm check`.
- Confirm production source imports only `sdk` and Local-provider runtime dependencies and does not import `testkit`, `cli`, `mcp`, peer providers, Forge/Codex protocol packages outside this provider, core decision modules, local git evidence modules, or Work Source status writers.
- Check dependency boundaries and committed dependency inputs from `{{DEPENDENCY_COMMITS}}`; do not accept SDK/testkit, fnd-03, or fnd-04 shape rewrites in this story.
- Search sibling occurrences for the same issue before approving a fix.
- Confirm changed files stay inside the allowed pathset.
- Enforce repo conventions, immutable updates, explicit error handling, and mutation limits.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths. Inspect only and return a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 6 - Concrete provider drivers](../../../README.md) · **← Prev:** [Implementer Prompt: prov-04-s3-local-execution-host-driver](./implementer.md) · **Next →:** [Epic 6 Execution Tracker](../../tracker.md)

<!-- /DOCS-NAV -->
