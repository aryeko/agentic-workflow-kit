---
title: "prov-02-s3-github-forge-driver implementation story"
id: "prov-02-s3-github-forge-driver"
epic: 6
status: "story: ready"
design:
  - "docs/design/30-domain-reference/providers/forge-collaboration/README.md"
  - "docs/design/30-domain-reference/providers/forge-collaboration/contracts-and-conformance.md"
  - "docs/design/20-sdk-and-packaging/concrete-providers.md"
---

# prov-02-s3-github-forge-driver

## Purpose

Implement the concrete `provider-github` Forge driver so GitHub remote evidence and runner-owned
actions satisfy the SDK `ForgeProvider` contract with exact-head binding, scoped credentials, and
redacted evidence.

## Normative Design

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

If these sources do not answer a contract question, this story is not ready.

## Spec Surface

- Interfaces / types: `createGitHubForgeProvider`, `GitHubForgeProviderOptions`, and a concrete
  implementation of Epic 2 `ForgeProvider`.
- Events / append intents: none. The driver returns event-ready Forge payloads; the caller appends run
  events.
- Provider operations / commands: `probeCapabilities`, `pushBranch`, `upsertPullRequest`,
  `publishComment`, `collectEvidence`, `updateBranch`, `enqueue`, and `merge`.
- Failure and degraded tokens: consumes Epic 2 `ForgeFailureToken` literals verbatim.
- Evidence records / attestations: `CapabilityAttestation<ForgeCapability>[]`,
  `ForgeEvidenceSnapshot`, `ForgeActionResult`, `ForgeDegraded`, redaction fingerprint ids,
  credential audit event ids, and provider evidence refs.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Bind every read and irreversible action to `expectedHeadSha`; re-read remote head and refuse on
  mismatch, missing, or unknown head.
- Gather PR state, status checks, reviews, review threads, branch protection, rulesets, and merge
  queue facts into a complete `ForgeEvidenceSnapshot` or a named `ForgeDegraded`.
- Implement push, PR create/update, comment publish, update-branch, enqueue, and merge with the
  correct fnd-04 Forge credential phase.
- Reject worker credential scopes, admin/bypass/force-push behavior, GHES/version unknown support,
  unredacted provider text, and ambiguous external state.
- Attest `supportsRulesets`, `supportsMergeQueue`, `supportsThreadResolution`, and
  `canInspectProtection` only from fresh GitHub evidence for the scope.
- Pass Forge conformance with Mock Forge parity, adversarial broken providers, and gated disposable
  GitHub smoke for write-side operations.

## Out of Scope

- SDK `ForgeProvider` types, `ForgeFailureToken`, and testkit Mock Forge/conformance ownership
  (`prov-02-s1`, `prov-02-s2`).
- Completion or merge readiness decisions (`core-05`).
- Local git evidence, process execution, task status authority, credential policy authorship, operator
  UX, and auto-resolving review threads.
- Any admin override, bypass, force-push, or ignoring rules/protection.

## Dependencies and Frozen Inputs

- Covers signals: GitHub concrete provider story group.
- Depends on: prior frozen `prov-02-s1-forge-port`, `prov-02-s2-forge-testkit`, and fnd-04
  credential scope/redaction/audit contracts.
- Depended on by: Epic 7 production composition and core completion/merge consumers at runtime.
- Shared shapes consumed: `prov-02-s1/ForgeProvider`, `ForgeRepoRef`, `ForgeBranchRef`,
  `PullRequestRef`, `ForgeActionResult`, `ForgeDegraded`, `ForgeEvidenceSnapshot`,
  `ForgeFailureToken`, `ForgeCapability`, `prov-00-s1/CapabilityAttestation`,
  `fnd-04/CredentialScope`, `CredentialAuditEvent`, `RedactionSet`.
- Decision inputs consumed: `expectedHeadSha`, observed remote PR head, requested credential scope
  party/phase, GitHub PR/check/review/thread/protection/ruleset/queue responses, redaction result,
  credential audit result, provider/version, rate-limit/auth result, and injected clock.

## Acceptance Criteria

- **AC-1** The provider package exports `createGitHubForgeProvider` and the returned object satisfies
  all eight `ForgeProvider` operations with no private SDK imports - evidence: `typecheck`
  public-import fixture `provider-github-public.public.ts` imports the factory from
  `provider-github`, constructs it, and assigns it to `ForgeProvider`.
- **AC-2** `collectEvidence` returns a full `ForgeEvidenceSnapshot` only when PR state, status checks,
  review threads, protection/rulesets, merge queue, scope, evidence refs, redaction fingerprints, and
  credential audit ids are present for `expectedHeadSha`; absent or ambiguous clusters return the
  exact degraded token for that cluster - evidence: `coverage:baseline` fixtures
  `github-evidence-complete-snapshot`, `github-state-unknown`, `github-protection-uninspectable`,
  `github-rulesets-unattested`, `github-review-threads-uninspectable`, and
  `github-merge-queue-unavailable`.
- **AC-3** `pushBranch`, `upsertPullRequest`, `publishComment`, `updateBranch`, `enqueue`, and `merge`
  use the mapped fnd-04 Forge credential phase, carry redaction/audit ids, and all expected-head
  actions re-read the remote head and refuse with `forge-head-mismatch` on any difference - evidence:
  `coverage:baseline` cases `github-action-phase-mapping`, `github-expected-head-accepted`, and
  `github-expected-head-mismatch-refused`.
- **AC-4** Worker credential scopes, denied credentials, provider auth denial, rate limits,
  unredactable provider output, unknown GHES/version capability, and admin/bypass/force-push paths
  return the corresponding `ForgeFailureToken` without performing a remote write - evidence:
  `coverage:baseline` cases `github-worker-scope-refused`, `github-auth-denied`,
  `github-rate-limited`, `github-redaction-unavailable`, `github-ghes-capability-unknown`, and
  `github-admin-bypass-refused`.
- **AC-5** `probeCapabilities` emits fresh `CapabilityAttestation<ForgeCapability>` values only when
  the driver proves rulesets, merge queue, thread resolution, or protection inspection for the
  provider, host, driver version, and freshness key; stale/negative evidence keeps the capability
  absent - evidence: `coverage:baseline` `github-capability-probe-matrix` asserts all four
  capability literals plus stale/wrong-scope cases.
- **AC-6** The GitHub subject passes the Forge conformance suite and broken subjects fail for lied-about
  head SHA, missing CI/checks, missing reviews/threads, hidden rulesets/protection, hidden queue,
  denied credentials, and auth failures - evidence: `coverage:baseline`
  `provider-github.conformance.test.ts` cases `github-subject-passes` and
  `broken-github-subjects-fail`.
- **AC-7** Gated real GitHub smoke proves disposable-remote push, PR upsert/comment, evidence
  collection, update/enqueue/merge refusal/acceptance paths, and exact-head mismatch behavior with
  redacted evidence refs - evidence: `smoke-real` suite `provider-github-smoke.test.ts` records
  `github-disposable-remote-exact-head-smoke` and redacted artifact ids.
- **AC-8** Production source imports only `sdk` and GitHub-provider dependencies such as `@octokit/*`;
  it imports no `testkit`, `cli`, `mcp`, peer provider package, local git modules, process execution
  helper, or core completion/merge decision module - evidence: `deps` passes and boundary sweep
  `grep -REn "from ['\\\"](testkit|cli|mcp|provider-|@kit/testkit|@kit/cli|@kit/mcp)|execa|child_process|recordLocalGitEvidence|evaluateCompletion|evaluateMerge|createRunEventLog" packages/provider-github/src`
  returns zero matches.

## Manifest Coverage

| Responsibility / spec-surface item | Proven by | Standing gate lane |
|---|---|---|
| Public factory and provider type conformance | AC-1 | `typecheck`, `type:fixtures` |
| Exact-head evidence snapshot and degraded clusters | AC-2 | `coverage:baseline` |
| Credential phase mapping and expected-head actions | AC-3 | `coverage:baseline` |
| Auth, scope, bypass, rate, redaction, and GHES failures | AC-4 | `coverage:baseline` |
| Forge capability attestations | AC-5 | `coverage:baseline` |
| Forge conformance and broken providers | AC-6 | `coverage:baseline` |
| Disposable GitHub smoke | AC-7 | gated `smoke-real` |
| Dependency and boundary purity | AC-8 | `deps` |

## Predicate-Input Matrix

### Consumed Predicates

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-2 | evidence cluster complete | GitHub PR/check/review/thread/protection/ruleset/queue response fields | owned GitHub response mapper | decidable |
| AC-2, AC-3 | observed head equals expected | request `expectedHeadSha`, observed PR head SHA | request + GitHub read resolver | decidable |
| AC-3, AC-4 | credential phase/scope permitted | `CredentialScope.party`, `phase`, repo credential ref | fnd-04 scope + request mapping | decidable |
| AC-4 | admin/bypass required | GitHub protection/ruleset/write error facts | owned GitHub error mapper | decidable |
| AC-4 | output redaction succeeded | redaction result/fingerprint ids | fnd-04 redaction contract | decidable |
| AC-5 | capability fresh and positive | `ForgeScope`, provider/version/host, probe result, freshness key | owned probe resolver | decidable |
| AC-7 | smoke safe to count | disposable repo id, scoped credential, observed redacted artifact refs | gated CI smoke environment | decidable |

### Produced Obligations

| Produced record/event/symbol | Required field or symbol | Declared source | Writer seam, if any | Verdict |
|---|---|---|---|---|
| `createGitHubForgeProvider` | public export | `packages/provider-github/src/index.ts` owned export | none | closed |
| `ForgePrStateFacts` | baseRefOid, headRefOid, state, reviewDecision, mergeStateStatus, isInMergeQueue | GitHub PR GraphQL response mapped by owned evidence resolver | provider return | closed |
| `ForgeStatusCheckFacts` / `ForgeStatusCheckContext` | state, contexts, context name, state, conclusion | GitHub status-check rollup response | provider return | closed |
| `ForgeReviewThreadFacts` / `ForgeReviewThread` | threads, id, isResolved, viewerCanResolve, path, comments | GitHub review-thread response with redacted comment body refs | provider return | closed |
| `ForgeProtectionFacts` / rules | branchProtectionRules, rulesets, required status checks and rule fields | GitHub branch protection and repository ruleset responses | provider return | closed |
| `ForgeMergeQueueFacts` | mergeQueuePresent, mergeQueueEntry, position, state, base/head commit oids | GitHub merge-queue response | provider return | closed |
| `ForgeEvidenceSnapshot` | repo, pullRequest, expectedHeadSha, facts clusters, scope, evidenceRefs, redaction ids, audit ids, collectedAt | request fields, owned fact mappers above, fnd-04 redaction/audit, injected clock | provider return | closed |
| `ForgeActionResult.accepted/refused` | kind, token if refused, observedHeadSha, redaction ids, audit ids, evidenceRef, at | action request, GitHub read/write result, expected-head resolver, fnd-04 redaction/audit, injected clock | provider return | closed |
| `ForgeDegraded` | kind, token, observedHeadSha, redaction ids, audit ids, evidenceRef, at, observedFacts | GitHub response/error mapper, partial fact mappers, fnd-04 redaction/audit, injected clock | provider return | closed |
| `CapabilityAttestation<ForgeCapability>` | capability, probeMethod, result, evidenceRef, scope, expiry, driverVersion, platform, freshnessKey, at | probe scope/outcome, provider config, evidence ref, injected clock/expiry rule | provider return | closed |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `forge-credential-unavailable` | fnd-04 denies or cannot resolve credential | no remote write/read using credential | AC-3, AC-4 |
| `forge-auth-denied` | GitHub rejects scoped credential | return refused/degraded token | AC-4 |
| `forge-head-mismatch` | observed PR head differs from expected | refuse exact-head action | AC-3 |
| `forge-state-unknown` | required PR/check/review state absent or ambiguous | degrade; no guessed state | AC-2 |
| `forge-protection-uninspectable` | protection cannot be proven | degrade; capability absent | AC-2, AC-5 |
| `forge-rulesets-unattested` | rulesets stale/absent | degrade; capability absent | AC-2, AC-5 |
| `forge-merge-queue-unavailable` | queue hidden/unsupported | degrade or refuse enqueue | AC-2, AC-5 |
| `forge-review-threads-uninspectable` | review threads cannot be inspected | degrade; no empty-thread guess | AC-2, AC-5 |
| `forge-admin-bypass-refused` | success would require admin/bypass/force-push | refuse without remote write | AC-4 |
| `forge-ghes-capability-unknown` | provider/version outside attested matrix | degrade; no capability claim | AC-4 |
| `forge-rate-limited` | fresh evidence/action blocked by rate limit | degrade/refuse with evidence | AC-4 |
| `forge-redaction-unavailable` | provider output cannot be safely redacted | no persisted unredacted evidence | AC-4 |

## Quality Bar

- Coverage scope and threshold: `packages/provider-github/src/**`, 90% minimum and 95% target over
  request mapping, exact-head guards, evidence mapping, error/token mapping, redaction/audit binding,
  and capability probes.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`; focused command
  `pnpm exec vitest run --project unit --project conformance-mock --coverage --passWithNoTests -- packages/provider-github/tests`.
- Smoke evidence: gated `vitest run --project smoke-real -- packages/provider-github/tests/**/*.smoke.test.ts`
  against a disposable writable remote.
- Required tests: AC-1..AC-8 plus every failure row.
- Public exposure: `provider-github` package entrypoint exports the factory/options and public-import
  fixture imports through the package name.
- Determinism constraints: no ambient decision state; exact-head and credential-scope values are input
  fields; provider timestamps are normalized through injected clock where the SDK payload requires `at`.
- Dependency boundaries: Octokit is allowed only in `provider-github`; no `testkit` in production,
  no core decisions, no local git/process/provider peer imports.
- File-size budget: factory, auth/scope, evidence mapper, action mapper, capability, and error mapper
  files <= 280 lines each; split before 400; 800 hard cap.
- Domain non-negotiables: exact-head support is mandatory; unknown external state fails closed; worker
  never receives Forge credentials.
- Unattended safety actions: none. Update/enqueue/merge execute only explicit SDK Forge requests and
  refuse on expected-head or credential mismatch.

## Required Reading

- Forge design README and contracts/conformance file.
- Epic 2 Forge port and testkit story contracts.
- fnd-04 credential, redaction, and audit story contracts.
- Test lane, testing policy, and dependency-rule docs.

## Deliverable

The `packages/provider-github` driver implementation, tests, public package export, disposable-remote
smoke evidence, and evidence pack.

## Evidence Pack

- Test names or fixture ids from AC-1..AC-8.
- Negative fixtures for head mismatch, state unknown, hidden protection/rulesets/queue/threads, auth
  denied, worker scope, admin bypass, GHES unknown, rate limit, and redaction unavailable.
- Manifest item -> AC -> gate lane matrix above.
- `pnpm check` result plus focused coverage output.
- Gated smoke-real results with redacted artifact ids.
- Public import fixture `provider-github-public.public.ts`.
- Boundary sweep from AC-8 with zero-match output.
- Conformance evidence for GitHub subject and broken subjects.

## Gate 4 Readiness Boxes

- Proof-substrate match: runtime request/action/evidence/error/capability mappers are measured by
  `coverage:baseline`; disposable GitHub side effects are named as gated `smoke-real`; public type
  compatibility is proven by `typecheck` and `type:fixtures`.
- Predicate-input closure - relational and compound: consumed-predicate rows name both operands for
  expected-head matching, credential scope/phase, evidence-cluster completeness, redaction, and
  capability freshness.
- Failure-token/catalog closure: all failure rows use Epic 2 `ForgeFailureToken` literals and ACs
  require exact-literal fixtures.
- Manifest coverage: every manifest item maps to an AC and standing gate lane in the matrix above.

## Boundaries and STOP Conditions

- Package/module boundary: `packages/provider-github`.
- Owned pathset: `packages/provider-github/src/**`, `packages/provider-github/tests/**`,
  `packages/provider-github/package.json`, `packages/provider-github/tsconfig.json`.
- Forbidden dependencies: `cli`, `mcp`, `testkit` in production source, peer provider packages,
  process helpers, local git evidence modules, core completion/merge/recovery modules.
- STOP when a requirement needs a Forge port change, a local git read, a completion/merge decision,
  a worker Forge credential, admin/bypass behavior, or undocumented GitHub state as load-bearing
  evidence.

## Characterization Review Evidence

### Design -> AC Mirror

| Frozen design obligation | Source line | Covering AC / evidence | Falsification check |
|---|---|---|---|
| Forge is the remote, credentialed collaboration seam; workers never receive Forge credentials. | `docs/design/30-domain-reference/providers/forge-collaboration/README.md:16`, `docs/design/30-domain-reference/providers/forge-collaboration/README.md:25`, `docs/design/30-domain-reference/providers/forge-collaboration/README.md:64` | AC-3, AC-4, AC-8; fixtures `github-action-phase-mapping`, `github-worker-scope-refused`, boundary sweep | A worker credential scope reaches a remote action or production source imports worker/process helpers. |
| Reads/actions bind to `expectedHeadSha`; mismatch refuses all expected-head actions. | `docs/design/30-domain-reference/providers/forge-collaboration/README.md:109`, `docs/design/30-domain-reference/providers/forge-collaboration/README.md:112`; `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-02-s1-forge-port.md:144` | AC-2, AC-3, AC-7; fixtures `github-expected-head-mismatch-refused`, `github-disposable-remote-exact-head-smoke` | Update/enqueue/merge proceeds after observed head differs from expected head. |
| Evidence snapshots must include PR state, status/checks, review/thread, protection/ruleset, and queue facts or degrade with named tokens. | `docs/design/30-domain-reference/providers/forge-collaboration/README.md:94`, `docs/design/30-domain-reference/providers/forge-collaboration/README.md:102`, `docs/design/30-domain-reference/providers/forge-collaboration/README.md:127` | AC-2, AC-6; fixtures `github-evidence-complete-snapshot`, `github-state-unknown`, `broken-github-subjects-fail` | Missing or ambiguous facts are reported as complete evidence. |
| Protection, rulesets, merge queue, and review-thread support are capabilities; unknown external state fails closed. | `docs/design/30-domain-reference/providers/forge-collaboration/contracts-and-conformance.md:246`, `docs/design/30-domain-reference/providers/forge-collaboration/contracts-and-conformance.md:248` | AC-2, AC-5; fixtures `github-protection-uninspectable`, `github-rulesets-unattested`, `github-review-threads-uninspectable`, `github-merge-queue-unavailable` | Hidden provider state is guessed as absent/empty instead of degraded. |
| Provider auth/rate/redaction/admin/bypass failures refuse without unsafe remote writes. | `docs/design/30-domain-reference/providers/forge-collaboration/README.md:202`, `docs/design/30-domain-reference/providers/forge-collaboration/README.md:214`, `docs/design/30-domain-reference/providers/forge-collaboration/README.md:227` | AC-4; fixtures `github-auth-denied`, `github-rate-limited`, `github-redaction-unavailable`, `github-admin-bypass-refused` | Admin/bypass/force-push or unredacted persistence is required for success. |

### Load-Bearing Scope Decisions

| Decision | Rationale and source | Falsification criterion | Escalation path |
|---|---|---|---|
| GitHub gathers remote facts and executes bounded Forge requests; it does not decide merge readiness. | Forge separates remote facts from decisions (`forge-collaboration/README.md:94`). | Story asks provider to classify completion/merge readiness or override checks. | Route to core completion/merge design. |
| fnd-04 owns credential policy; GitHub maps requested Forge phases to scoped credentials. | Forge consumes fnd-04 credential refs/scope/audit (`forge-collaboration/README.md:158`). | Story authors new credential policy or gives Forge credentials to workers. | Route to fnd-04 or reject as AD-12 violation. |
| Exact-head is mandatory for irreversible actions. | Exact-head DTOs and requests are frozen in `prov-02-s1` (`docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-02-s1-forge-port.md:144`). | Update/enqueue/merge lacks `expectedHeadSha` or does not re-read observed head. | Stop for Forge port/design correction. |
| GitHub state uncertainty degrades; it is never interpreted as an empty safe state. | Unknown external state fails closed (`forge-collaboration/README.md:214`). | Missing rulesets/queue/threads are treated as no requirements/no blockers. | Keep degraded token or escalate provider capability gap. |

### Regression Checks

| Known blocker pattern | Evidence in this story |
|---|---|
| Failure-row AC match | Each failure row cites AC-2, AC-3, AC-4, or AC-5 where the exact token/trigger is named, including `forge-state-unknown`. |
| Producer/source closure | Produced-obligations rows name sources for every Forge facts cluster, action result, degraded result, evidence snapshot, public export, and attestation field. |
| Predicate-input closure | Consumed-predicate rows name expected/observed head operands, credential scope/phase, fact clusters, redaction results, and capability freshness. |
| Boundary discipline | STOP conditions exclude local git, process execution, core decisions, worker credentials, and admin/bypass behavior. |

Verdict: ready.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 6 - stories](./README.md) · **← Prev:** [prov-01-s3-codex-agent-driver implementation story](./prov-01-s3-codex-agent-driver.md) · **Next →:** [prov-03-s3-markdown-work-source-driver implementation story](./prov-03-s3-markdown-work-source-driver.md)

<!-- /DOCS-NAV -->
