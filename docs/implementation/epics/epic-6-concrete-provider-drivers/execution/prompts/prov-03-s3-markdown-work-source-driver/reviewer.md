# Reviewer Prompt: prov-03-s3-markdown-work-source-driver

## Assigned Routing

- Source story id: `prov-03-s3-markdown-work-source-driver`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-6-concrete-provider-drivers/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `prov-03-s3-markdown-work-source-driver` covers `AC-1`..`AC-8` and carries a public provider package, real-driver conformance, race-safe task-status authority, capability evidence, failure-token closure, and boundary purity.

## Original Scope

- Story id: `prov-03-s3-markdown-work-source-driver`.
- Epic slug: `epic-6-concrete-provider-drivers`.
- Source story contract: `docs/implementation/epics/epic-6-concrete-provider-drivers/stories/prov-03-s3-markdown-work-source-driver.md`.
- Acceptance criteria: `AC-1` public factory and Work Source provider compatibility; `AC-2` tracker parsing and malformed diagnostics; `AC-3` eligibility/dependency gating; `AC-4` lease/digest/epoch guarded mutation; `AC-5` TaskSnapshot artifact; `AC-6` Work Source capability attestations; `AC-7` Work Source conformance and broken providers; `AC-8` dependency and boundary purity.
- Allowed pathset: `packages/provider-markdown/src/**`, `packages/provider-markdown/tests/**`, `packages/provider-markdown/package.json`, `packages/provider-markdown/tsconfig.json`.
- Dependencies: prior frozen `prov-03-s1-work-source-port`, `prov-03-s2-work-source-testkit`, fnd-02 lease/artifact contracts, and fnd-04 redaction when diagnostics/evidence include sensitive text.
- Non-goals: SDK Work Source type changes, testkit ownership, run lifecycle/events/projections, completion/recovery decisions, design authoring, local git evidence, Forge behavior, and storage implementation changes beyond fnd-02 consumption.
- STOP conditions: Work Source port shape changes, run-log writes, SDK/testkit contract changes, or merging task-status authority with run activity.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

- Verify source AC coverage for `AC-1`..`AC-8`; each AC must be proven by the named standing gate lane or targeted command and not by prose alone.
- Confirm every manifest item maps to AC -> standing gate lane: public factory/type conformance to `typecheck`/`type:fixtures`, parsing/eligibility/mutation/snapshot/capability/conformance to `coverage:baseline`, boundary purity to `deps`.
- Check every failure token is exact and proven: `work-source-unavailable`, `track-malformed`, `dependency-unresolved`, `status-bucket-unknown`, `claim-conflict`, `claim-lock-unavailable`, `snapshot-artifact-unavailable`, `status-write-unavailable`, `status-authority-conflict`.
- Validate evidence pack completeness: public import fixture, focused provider coverage over `packages/provider-markdown/src/**`, boundary sweep, conformance evidence, `pnpm check`, and exact fixture ids named by the source story.
- Confirm production source imports only `sdk` and provider-markdown-owned parsing/filesystem utilities and does not import `testkit`, `cli`, `mcp`, peer providers, core event writers, GitHub/Codex/process drivers, or forbidden package paths.
- Check dependency boundaries and committed dependency inputs from `{{DEPENDENCY_COMMITS}}`; do not accept SDK/testkit or fnd-02 shape rewrites in this story.
- Search sibling occurrences for the same issue before approving a fix.
- Confirm changed files stay inside the allowed pathset.
- Enforce repo conventions, immutable updates, explicit error handling, and mutation limits.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths. Inspect only and return a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 6 - Concrete provider drivers](../../../README.md) · **← Prev:** [Implementer Prompt: prov-03-s3-markdown-work-source-driver](./implementer.md) · **Next →:** [Implementer Prompt: prov-04-s3-local-execution-host-driver](../prov-04-s3-local-execution-host-driver/implementer.md)

<!-- /DOCS-NAV -->
