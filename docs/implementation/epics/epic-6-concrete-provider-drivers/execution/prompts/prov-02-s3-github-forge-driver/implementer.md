# Implementer Prompt: prov-02-s3-github-forge-driver

## Assigned Routing

- Source story id: `prov-02-s3-github-forge-driver`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-6-concrete-provider-drivers/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `prov-02-s3-github-forge-driver` covers `AC-1`..`AC-8` and carries a public provider package, credentialed remote-write safety boundary, exact-head invariants, smoke-real evidence, conformance, failure-token closure, and boundary purity.

## Exact Task

Implement `prov-02-s3-github-forge-driver` for epic `epic-6-concrete-provider-drivers`: deliver the concrete `provider-github` Forge driver with exact-head reads/actions, PR/comment/evidence/update/enqueue/merge operations, scoped credentials, redacted evidence, capability attestations, conformance, smoke evidence, and evidence pack. Keep the work limited to source story `prov-02-s3-github-forge-driver` and source AC ids `AC-1`..`AC-8`.

## Why It Matters

This wave 1 story produces the GitHub Forge provider consumed by Epic 7 and core completion/merge consumers at runtime. It executes credentialed remote actions through the Forge port, but it does not decide completion or merge readiness. Unknown external state fails closed, every irreversible action is expected-head bound, and worker credential scopes must never perform Forge writes.

## Required Reading

- `docs/implementation/epics/epic-6-concrete-provider-drivers/stories/prov-02-s3-github-forge-driver.md`
- `docs/implementation/epics/epic-6-concrete-provider-drivers/story-dag.md`
- `docs/design/30-domain-reference/providers/forge-collaboration/README.md`
- `docs/design/30-domain-reference/providers/forge-collaboration/contracts-and-conformance.md`
- `docs/design/20-sdk-and-packaging/provider-ports.md`
- `docs/design/20-sdk-and-packaging/concrete-providers.md`
- `docs/design/20-sdk-and-packaging/dependency-rules.md`
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-02-s1-forge-port.md`
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-02-s2-forge-testkit.md`
- `docs/implementation/epics/epic-1-foundation-substrate/stories/fnd-04-s1-credential-refs.md`
- `docs/implementation/epics/epic-1-foundation-substrate/stories/fnd-04-s3-redaction.md`
- `docs/implementation/epics/epic-1-foundation-substrate/stories/fnd-04-s4-audit-failures.md`
- `docs/engineering/check-gate.md`
- `docs/engineering/test-lanes.md`
- `docs/engineering/testing-policy.md`
- `docs/engineering/dependency-rule-enforcement.md`
- Runtime dependency commits slot: `{{DEPENDENCY_COMMITS}}` for prior frozen Epic 1 and Epic 2 producers.

## Acceptance Criteria

Source story: `prov-02-s3-github-forge-driver`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.

- **AC-1** Export `createGitHubForgeProvider`; the returned object satisfies all eight `ForgeProvider` operations with no private SDK imports, proven by public-import fixture `provider-github-public.public.ts`.
- **AC-2** `collectEvidence` returns a full `ForgeEvidenceSnapshot` only when PR state, status checks, review threads, protection/rulesets, merge queue, scope, evidence refs, redaction fingerprints, and credential audit ids are present for `expectedHeadSha`; absent or ambiguous clusters return exact degraded tokens.
- **AC-3** `pushBranch`, `upsertPullRequest`, `publishComment`, `updateBranch`, `enqueue`, and `merge` use the mapped fnd-04 Forge credential phase, carry redaction/audit ids, reread remote head for expected-head actions, and refuse `forge-head-mismatch` on any difference.
- **AC-4** Worker scopes, denied credentials, provider auth denial, rate limits, unredactable output, unknown GHES/version capability, and admin/bypass/force-push paths return the corresponding `ForgeFailureToken` without remote write.
- **AC-5** `probeCapabilities` emits fresh `CapabilityAttestation<ForgeCapability>` values only when rulesets, merge queue, thread resolution, or protection inspection are proven for provider, host, driver version, and freshness key.
- **AC-6** The GitHub subject passes Forge conformance and broken subjects fail for lied-about head SHA, missing CI/checks, missing reviews/threads, hidden rulesets/protection, hidden queue, denied credentials, and auth failures.
- **AC-7** Gated real GitHub smoke proves disposable-remote push, PR upsert/comment, evidence collection, update/enqueue/merge refusal/acceptance paths, exact-head mismatch behavior, and redacted evidence refs.
- **AC-8** Production source imports only `sdk` and GitHub-provider dependencies such as `@octokit/*`; `deps` and the source boundary sweep return clean.

Failure and degraded outcomes to prove exactly: `forge-credential-unavailable`, `forge-auth-denied`, `forge-head-mismatch`, `forge-state-unknown`, `forge-protection-uninspectable`, `forge-rulesets-unattested`, `forge-merge-queue-unavailable`, `forge-review-threads-uninspectable`, `forge-admin-bypass-refused`, `forge-ghes-capability-unknown`, `forge-rate-limited`, `forge-redaction-unavailable`.

## Allowed Writes

Only these source-owned paths may be changed:
- `packages/provider-github/src/**`
- `packages/provider-github/tests/**`
- `packages/provider-github/package.json`
- `packages/provider-github/tsconfig.json`

Every other write is forbidden, including execution package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn outside the owned package, generated files outside the owned pathset, and changes to SDK/testkit contracts.

## Dependency Inputs

- Producer story ids: prior frozen `prov-02-s1-forge-port`, `prov-02-s2-forge-testkit`, and fnd-04 credential scope/redaction/audit contracts.
- Dependency commit evidence: `{{DEPENDENCY_COMMITS}}`.
- Public import paths: `sdk` and `testkit` only where the source contract permits tests/conformance; production source may use GitHub-provider dependencies such as `@octokit/*` and must not import `testkit`.
- Shared shapes consumed: `ForgeProvider`, `ForgeRepoRef`, `ForgeBranchRef`, `PullRequestRef`, `ForgeActionResult`, `ForgeDegraded`, `ForgeEvidenceSnapshot`, `ForgeFailureToken`, `ForgeCapability`, `CapabilityAttestation`, `CredentialScope`, `CredentialAuditEvent`, `RedactionSet`.

## Non-Goals And STOP Conditions

Non-goals: SDK Forge provider type changes, Forge failure catalog/testkit ownership, completion or merge readiness decisions, local git evidence, process execution, task status authority, credential policy authorship, operator UX, auto-resolving review threads, admin override, bypass, force-push, and ignoring branch rules/protection.

Source STOP conditions: stop if the story needs a Forge port change, a local git read, a completion/merge decision, a worker Forge credential, admin/bypass behavior, or undocumented GitHub state as load-bearing evidence.

Also stop and report if dependency commits are missing, a required source value is absent, an AC requires writes outside the owned pathset, or implementation would require reinterpreting a source AC.

## Implementation Constraints

Honor expected-head binding, credential phase mapping, redaction/audit ids, fail-closed unknown external state, no admin/bypass/force-push, no worker Forge credentials, no local git/process helpers, no core completion/merge decisions, no unredacted provider text persistence, injected clocks where SDK payloads require `at`, and no production imports from `testkit`, `cli`, `mcp`, peer providers, process helpers, local git modules, or core decision modules.

## Verification

Run the targeted checks and evidence required by the source contract:
- Public import fixture `provider-github-public.public.ts`.
- `coverage:baseline` fixtures `github-evidence-complete-snapshot`, `github-state-unknown`, `github-protection-uninspectable`, `github-rulesets-unattested`, `github-review-threads-uninspectable`, `github-merge-queue-unavailable`, `github-action-phase-mapping`, `github-expected-head-accepted`, `github-expected-head-mismatch-refused`, `github-worker-scope-refused`, `github-auth-denied`, `github-rate-limited`, `github-redaction-unavailable`, `github-ghes-capability-unknown`, `github-admin-bypass-refused`, `github-capability-probe-matrix`.
- Forge conformance cases `github-subject-passes` and `broken-github-subjects-fail`.
- Gated `smoke-real` suite `provider-github-smoke.test.ts`, including `github-disposable-remote-exact-head-smoke` and redacted artifact ids.
- Focused provider coverage over `packages/provider-github/src/**` at the source threshold.
- Boundary sweep from AC-8 with zero-match output.
- `pnpm check`.

Report exact command output or an explicit blocked reason. Do not claim AC coverage from prose alone.

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:
- Make `pnpm check` green before every commit.
- Make an impl-done commit when the story first proves out, then one commit per fix round.
- Add commit trailers `Story: prov-02-s3-github-forge-driver` and `Round: <n>`.
- On orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove the gate, and re-commit.
- Report real logic conflicts rather than forcing a resolution.

## Delivery Report

Return changed files, AC coverage by source AC id, per-round commit hashes, tests and checks run, evidence pack, open questions, and blockers. The implementer does not update tracker state or perform merge, PR, push, publication, worker closure, package, or source-planning actions.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree. It performs no pushes, PRs, merges, tracker edits, package edits, source planning edits, worker closure, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 6 - Concrete provider drivers](../../../README.md) · **← Prev:** [Reviewer Prompt: prov-01-s3-codex-agent-driver](../prov-01-s3-codex-agent-driver/reviewer.md) · **Next →:** [Reviewer Prompt: prov-02-s3-github-forge-driver](./reviewer.md)

<!-- /DOCS-NAV -->
