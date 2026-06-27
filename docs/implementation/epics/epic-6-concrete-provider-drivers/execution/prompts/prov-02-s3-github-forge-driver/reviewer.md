# Reviewer Prompt: prov-02-s3-github-forge-driver

## Assigned Routing

- Source story id: `prov-02-s3-github-forge-driver`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-6-concrete-provider-drivers/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `prov-02-s3-github-forge-driver` covers `AC-1`..`AC-8` and carries a public provider package, credentialed remote-write safety boundary, exact-head invariants, smoke-real evidence, conformance, failure-token closure, and boundary purity.

## Original Scope

- Story id: `prov-02-s3-github-forge-driver`.
- Epic slug: `epic-6-concrete-provider-drivers`.
- Source story contract: `docs/implementation/epics/epic-6-concrete-provider-drivers/stories/prov-02-s3-github-forge-driver.md`.
- Acceptance criteria: `AC-1` public factory and Forge provider compatibility; `AC-2` exact-head evidence snapshot and degraded clusters; `AC-3` credential phase mapping and expected-head actions; `AC-4` auth/scope/bypass/rate/redaction/GHES failures; `AC-5` Forge capability attestations; `AC-6` Forge conformance and broken providers; `AC-7` disposable GitHub smoke; `AC-8` dependency and boundary purity.
- Allowed pathset: `packages/provider-github/src/**`, `packages/provider-github/tests/**`, `packages/provider-github/package.json`, `packages/provider-github/tsconfig.json`.
- Dependencies: prior frozen `prov-02-s1-forge-port`, `prov-02-s2-forge-testkit`, and fnd-04 credential scope/redaction/audit contracts.
- Non-goals: SDK Forge type changes, failure catalog/testkit ownership, completion/merge readiness decisions, local git evidence, process execution, task status authority, credential policy authorship, operator UX, auto-resolving review threads, admin override, bypass, force-push, or ignoring rules/protection.
- STOP conditions: Forge port change, local git read, completion/merge decision, worker Forge credential, admin/bypass behavior, or undocumented GitHub state as load-bearing evidence.

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
- Confirm every manifest item maps to AC -> standing gate lane: public factory/type conformance to `typecheck`/`type:fixtures`, evidence/actions/failures/capability/conformance to `coverage:baseline`, disposable remote smoke to gated `smoke-real`, boundary purity to `deps`.
- Check every failure/degraded token is exact and proven: `forge-credential-unavailable`, `forge-auth-denied`, `forge-head-mismatch`, `forge-state-unknown`, `forge-protection-uninspectable`, `forge-rulesets-unattested`, `forge-merge-queue-unavailable`, `forge-review-threads-uninspectable`, `forge-admin-bypass-refused`, `forge-ghes-capability-unknown`, `forge-rate-limited`, `forge-redaction-unavailable`.
- Validate exact-head invariants: read/action binds to `expectedHeadSha`, remote head is reread for expected-head actions, and mismatch refuses without unsafe remote write.
- Validate evidence pack completeness: public import fixture, focused provider coverage over `packages/provider-github/src/**`, boundary sweep, conformance evidence, gated disposable GitHub smoke with redacted artifact ids, and `pnpm check`.
- Confirm production source imports only `sdk` and GitHub-provider dependencies such as `@octokit/*`, and does not import `testkit`, `cli`, `mcp`, peer providers, local git modules, process helpers, or core completion/merge/recovery modules.
- Check dependency boundaries and committed dependency inputs from `{{DEPENDENCY_COMMITS}}`; do not accept SDK/testkit or fnd-04 shape rewrites in this story.
- Search sibling occurrences for the same issue before approving a fix.
- Confirm changed files stay inside the allowed pathset.
- Enforce repo conventions, immutable updates, explicit error handling, and mutation limits.

## Verdict Format

Return `APPROVE` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths. Inspect only and return a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 6 - Concrete provider drivers](../../../README.md) · **← Prev:** [Implementer Prompt: prov-02-s3-github-forge-driver](./implementer.md) · **Next →:** [Implementer Prompt: prov-03-s3-markdown-work-source-driver](../prov-03-s3-markdown-work-source-driver/implementer.md)

<!-- /DOCS-NAV -->
