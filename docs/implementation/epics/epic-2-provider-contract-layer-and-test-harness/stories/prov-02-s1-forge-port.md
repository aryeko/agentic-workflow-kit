---
title: "prov-02-s1-forge-port - SDK Forge provider port implementation story"
id: "prov-02-s1-forge-port"
epic: 2
status: "story: ready"
design:
  - "docs/design/20-sdk-and-packaging/provider-ports.md"
---

# prov-02-s1-forge-port - SDK Forge Provider Port

## Purpose

Define the SDK-owned `ForgeProvider` seam interface, its exact-head evidence DTO catalog, the
`ForgeCapability` attestation specialization, and the `ForgeFailureToken` failure tokens — as pure
types and runtime fixtures with no concrete forge client — so that every action carrying a
`expectedHeadSha` is fail-closed-by-construction against head drift.

## Normative design

- `docs/design/20-sdk-and-packaging/provider-ports.md` — "Forge provider" section (lines ~468–710),
  the normative source for every type name, field, union member, and operation signature below.
- `docs/design/20-sdk-and-packaging/dependency-rules.md` — `sdk` may import only pure runtime
  libraries; `execa`, `child_process`, `@octokit/*`, network clients, and concrete driver clients are
  forbidden in `sdk` runtime.
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s4-export-templates.md`
  — `PackageExportConvention` for the public `sdk` entrypoint.
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s1-package-graph.md`
  — `packages/sdk` package identity.
- `docs/engineering/testing-policy.md`, `docs/engineering/test-lanes.md`,
  `docs/engineering/dependency-policy.md`.

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types — request & ref DTOs: `ForgeRepoRef`, `ForgeBranchRef`, `PullRequestRef`,
  `ForgeScope`, `EvidenceRequest` (carries `expectedHeadSha`),
  `ExpectedHeadActionRequest extends EvidenceRequest` (carries `expectedHeadSha`, optional `method`,
  optional `comment`), `PushBranchRequest`, `PullRequestUpsertRequest`, `PullRequestCommentRequest`.
- Interfaces / types — result & degraded DTOs: `ForgeActionResult`
  (union `accepted | refused | ForgeDegraded`), `ForgeDegraded`.
- Interfaces / types — observed-facts DTOs: `ForgeObservedFacts`, `ForgePrStateFacts`,
  `ForgeStatusCheckFacts`, `ForgeStatusCheckContext`, `ForgeReviewThreadFacts`, `ForgeReviewThread`,
  `ForgeReviewThreadComment`, `ForgeProtectionFacts`, `ForgeBranchProtectionRule`, `ForgeRuleset`,
  `ForgeMergeQueueFacts`, `ForgeMergeQueueEntry`.
- Interfaces / types — exact-head evidence snapshot: `ForgeEvidenceSnapshot` (carries
  `expectedHeadSha`, the pinned exact-head read).
- Interfaces / types — port interface: `ForgeProvider`.
- Unions / enums: `ForgeCapability` (`"supportsRulesets" | "supportsMergeQueue" |
  "supportsThreadResolution" | "canInspectProtection"`); `ForgeCredentialPhase`
  (`"push" | "PR create/update" | "evidence refresh" | "review metadata" | "merge"`);
  `ForgeFailureToken` (twelve tokens, enumerated in the failure table below).
- Provider operations / commands: `probeCapabilities(scope: ForgeScope):
  CapabilityAttestation<ForgeCapability>[]`; `pushBranch(req: PushBranchRequest): ForgeActionResult`;
  `upsertPullRequest(req: PullRequestUpsertRequest): ForgeActionResult`;
  `publishComment(req: PullRequestCommentRequest): ForgeActionResult`;
  `collectEvidence(req: EvidenceRequest): ForgeEvidenceSnapshot | ForgeDegraded`;
  `updateBranch(req: ExpectedHeadActionRequest): ForgeActionResult`;
  `enqueue(req: ExpectedHeadActionRequest): ForgeActionResult`;
  `merge(req: ExpectedHeadActionRequest): ForgeActionResult`.
- Failure and degraded tokens: the twelve `ForgeFailureToken` members — `forge-credential-unavailable`,
  `forge-auth-denied`, `forge-head-mismatch`, `forge-state-unknown`, `forge-protection-uninspectable`,
  `forge-rulesets-unattested`, `forge-merge-queue-unavailable`, `forge-review-threads-uninspectable`,
  `forge-admin-bypass-refused`, `forge-ghes-capability-unknown`, `forge-rate-limited`,
  `forge-redaction-unavailable`.
- Evidence records / attestations: `CapabilityAttestation<ForgeCapability>[]` from `probeCapabilities`
  (the four `ForgeCapability` members attested); `ForgeEvidenceSnapshot` as the exact-head evidence
  record. The generic envelope is consumed, not redefined — see shared shapes below.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Define the `ForgeProvider` interface with exactly the design's eight operations and their request/
  result signatures.
- Define every request and ref DTO (`ForgeRepoRef`, `ForgeBranchRef`, `PullRequestRef`, `ForgeScope`,
  `EvidenceRequest`, `ExpectedHeadActionRequest`, `PushBranchRequest`, `PullRequestUpsertRequest`,
  `PullRequestCommentRequest`) with exactly the design's fields and optionality.
- Define the exact-head trio so that head drift is structurally caught: `EvidenceRequest` and
  `ExpectedHeadActionRequest` both carry `expectedHeadSha`, and `ForgeEvidenceSnapshot` is pinned to
  `expectedHeadSha`; `ExpectedHeadActionRequest` extends `EvidenceRequest`.
- Define the result types (`ForgeActionResult` union `accepted | refused | ForgeDegraded`,
  `ForgeDegraded`) so a refusal and a degraded read are distinct, statically discriminable variants —
  a degraded read is never typed as an authoritative `accepted` result.
- Define the observed-facts DTO catalog (`ForgeObservedFacts`, `ForgePrStateFacts`,
  `ForgeStatusCheckFacts`, `ForgeStatusCheckContext`, `ForgeReviewThreadFacts`, `ForgeReviewThread`,
  `ForgeReviewThreadComment`, `ForgeProtectionFacts`, `ForgeBranchProtectionRule`, `ForgeRuleset`,
  `ForgeMergeQueueFacts`, `ForgeMergeQueueEntry`) with the design's fields.
- Define the `ForgeCapability` union and the `probeCapabilities` specialization
  `CapabilityAttestation<ForgeCapability>[]`, attesting rulesets, merge queue, thread resolution, and
  protection inspection.
- Define `ForgeFailureToken` (twelve members) and `ForgeCredentialPhase`, and bind each failure to its
  exact-head/degraded trigger via the failure table.
- Export the public seam shapes through the `sdk` public entrypoint per `PackageExportConvention`.
- Carry no concrete forge behavior: the port source imports no `@octokit/*`, no network client, no
  `execa`/`child_process` — proven by a runnable forbidden-symbol sweep.

## Out of scope

- The generic `CapabilityAttestation<Capability>` envelope, `CapabilityProvider`,
  `CapabilityAttestationResult`, `capabilityAttestationSchema`, `isCapabilityAttestation` — owned by
  `prov-00-s1-capability-attestation`.
- The Forge conformance test kit and in-memory recorded fixtures that exercise this interface — owned
  by `prov-02-s2-forge-testkit`.
- Concrete GitHub / GHES behavior, real `@octokit/*` calls, live credentials, and real-head reads —
  owned by Epic 6 provider drivers.
- The capability-gate evaluation that enforces attestation freshness — owned by core-02 (Epic 3).
- `CredentialScope` and its sibling credential shapes — owned by `fnd-04` (Epic 1), consumed here.

## Dependencies and frozen inputs

- Covers signals: "SDK Forge provider interface and exact-head evidence DTO catalog"; and the `split`
  part "Forge capability attestations for rulesets, merge queue, review-thread resolution, and
  protection inspection."
- Depends on: `prov-00-s1-capability-attestation`.
- Depended on by: `prov-02-s2-forge-testkit`.
- Shared shapes consumed:
  `prov-00-s1-capability-attestation/CapabilityAttestation` (generic envelope, specialized here as
  `CapabilityAttestation<ForgeCapability>`); `fnd-04-s1-credential-refs/CredentialScope` (carried by
  `EvidenceRequest`, `ExpectedHeadActionRequest`, `PushBranchRequest`, `PullRequestUpsertRequest`,
  `PullRequestCommentRequest`).

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** `ForgeProvider` declares exactly the eight operations `probeCapabilities`, `pushBranch`,
  `upsertPullRequest`, `publishComment`, `collectEvidence`, `updateBranch`, `enqueue`, `merge`, each
  with the design's request type and return type, and a fixture implementing it type-checks - evidence:
  `pnpm typecheck` over `forge-provider-shape.unit.test.ts` compiles a conforming `ForgeProvider`
  fixture and rejects (`// @ts-expect-error`) one missing an operation.
- **AC-2** Every request and ref DTO — `ForgeRepoRef`, `ForgeBranchRef`, `PullRequestRef`,
  `ForgeScope`, `EvidenceRequest`, `ExpectedHeadActionRequest`, `PushBranchRequest`,
  `PullRequestUpsertRequest`, `PullRequestCommentRequest` — is constructable from a fixture with the
  design's fields and optionality, and an object missing a required field fails to type-check -
  evidence: `forge-dtos.unit.test.ts` constructs each DTO and pins one `// @ts-expect-error` per
  required-field omission.
- **AC-3** The exact-head trio is structurally pinned: `EvidenceRequest.expectedHeadSha` and
  `ExpectedHeadActionRequest.expectedHeadSha` are required `string` fields, `ExpectedHeadActionRequest`
  extends `EvidenceRequest`, and `ForgeEvidenceSnapshot.expectedHeadSha` is a required `string` -
  evidence: `forge-exact-head.unit.test.ts` constructs the trio and a fixture dropping `expectedHeadSha`
  from any of the three fails to type-check (`// @ts-expect-error`).
- **AC-4** `ForgeActionResult` is a discriminated union of exactly `accepted`, `refused`, and
  `ForgeDegraded` on `kind`, where `accepted` carries `observedHeadSha`/`redactionFingerprintIds`/
  `credentialAuditEventIds`/`evidenceRef`/`at`, `refused` additionally carries `token: ForgeFailureToken`,
  and `ForgeDegraded` carries `kind: "degraded"` with optional `observedHeadSha`/`observedFacts` — so a
  `degraded` value never narrows to `accepted` - evidence: `forge-action-result.unit.test.ts` narrows
  each variant by `kind` and pins a `// @ts-expect-error` that an `accepted` value cannot carry
  `kind: "degraded"`.
- **AC-5** A head-mismatch fixture (observed head differs from `expectedHeadSha`) yields a `refused`
  result with `token: "forge-head-mismatch"` carrying `observedHeadSha`, and no `accepted` result is
  representable for that input — the mutating operations refuse fail-closed-by-construction - evidence:
  `forge-head-mismatch.unit.test.ts` asserts the refusal token and `observedHeadSha`, and a
  `// @ts-expect-error` rejects an `accepted` value built from the drifted-head fixture.
- **AC-6** `collectEvidence` returns `ForgeEvidenceSnapshot | ForgeDegraded`, and a degraded-read
  fixture is typed as `ForgeDegraded` (carrying a `ForgeFailureToken`) and is not assignable to
  `ForgeEvidenceSnapshot`, so a degraded read is not presentable as an authoritative snapshot -
  evidence: `forge-collect-evidence.unit.test.ts` constructs both branches and pins a
  `// @ts-expect-error` assigning a `ForgeDegraded` value to a `ForgeEvidenceSnapshot` binding.
- **AC-7** `ForgeCapability` has exactly the four members `supportsRulesets`, `supportsMergeQueue`,
  `supportsThreadResolution`, `canInspectProtection`, and `probeCapabilities` returns
  `CapabilityAttestation<ForgeCapability>[]` reusing `prov-00-s1-capability-attestation/CapabilityAttestation`
  without redeclaring its fields - evidence: `forge-capabilities.unit.test.ts` builds one attestation
  per member via the imported generic and pins a `// @ts-expect-error` for a non-member capability
  string.
- **AC-8** `ForgeFailureToken` is exactly the twelve members `forge-credential-unavailable`,
  `forge-auth-denied`, `forge-head-mismatch`, `forge-state-unknown`, `forge-protection-uninspectable`,
  `forge-rulesets-unattested`, `forge-merge-queue-unavailable`, `forge-review-threads-uninspectable`,
  `forge-admin-bypass-refused`, `forge-ghes-capability-unknown`, `forge-rate-limited`,
  `forge-redaction-unavailable`, each presentable on a `refused`/`degraded` fixture, and a non-member
  token string is rejected - evidence: `forge-failure-tokens.unit.test.ts` enumerates the twelve on
  refusal/degraded fixtures and pins a `// @ts-expect-error` for an out-of-set token.
- **AC-9** The Forge port source under `packages/sdk/src/providers/forge/**` imports no `@octokit/*`,
  no network client, and no `execa`/`child_process`, and every public seam shape is importable from the
  `sdk` public entrypoint (not a private module path) - evidence: `pnpm deps` plus a runnable grep
  sweep (command, roots, token set, zero-match output in the Evidence pack) and
  `forge-public-import.unit.test.ts` importing every exported shape from `sdk`.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No
responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| `ForgeProvider` interface with the eight operations and signatures | AC-1 |
| Request & ref DTOs (`ForgeRepoRef`, `ForgeBranchRef`, `PullRequestRef`, `ForgeScope`, `EvidenceRequest`, `ExpectedHeadActionRequest`, `PushBranchRequest`, `PullRequestUpsertRequest`, `PullRequestCommentRequest`) | AC-2, AC-3 |
| Exact-head trio pinned to `expectedHeadSha` (`EvidenceRequest`, `ExpectedHeadActionRequest`, `ForgeEvidenceSnapshot`) | AC-3 |
| `ForgeActionResult` union (`accepted` / `refused` / `ForgeDegraded`) and `ForgeDegraded` distinct from `accepted` | AC-4 |
| Fail-closed head-mismatch refusal (`forge-head-mismatch` + `observedHeadSha`, never mutate) | AC-5 |
| `collectEvidence` returns `ForgeEvidenceSnapshot \| ForgeDegraded`; degraded not authoritative | AC-6 |
| Observed-facts DTO catalog (`ForgeObservedFacts`, `ForgePrStateFacts`, `ForgeStatusCheckFacts`, `ForgeStatusCheckContext`, `ForgeReviewThreadFacts`, `ForgeReviewThread`, `ForgeReviewThreadComment`, `ForgeProtectionFacts`, `ForgeBranchProtectionRule`, `ForgeRuleset`, `ForgeMergeQueueFacts`, `ForgeMergeQueueEntry`) | AC-4, AC-6 |
| `ForgeCapability` union + `probeCapabilities` specialization `CapabilityAttestation<ForgeCapability>[]` | AC-7 |
| `ForgeFailureToken` (twelve members) | AC-8 |
| `ForgeCredentialPhase` union | AC-8 |
| Consume `CredentialScope` and generic `CapabilityAttestation` without redeclaring | AC-2, AC-7 |
| Public export via `PackageExportConvention`; no concrete forge/network/process import | AC-9 |

## Failure and degraded outcomes

Each row's cited AC asserts this row's trigger and required behavior (not the happy path).

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `forge-head-mismatch` | Observed head differs from `expectedHeadSha` on `updateBranch`/`enqueue`/`merge`/`collectEvidence`. | Refuse fail-closed carrying `observedHeadSha`; never mutate; no `accepted` representable. | AC-5 |
| `forge-credential-unavailable` | Credential for the requested `ForgeCredentialPhase` is unavailable. | Surface as `refused`/`degraded` token; do not proceed. | AC-8 |
| `forge-auth-denied` | Credential present but authorization denied. | Surface as `refused`/`degraded` token; do not proceed. | AC-8 |
| `forge-state-unknown` | Forge state cannot be read for the pinned head. | Surface as `ForgeDegraded`; not presentable as authoritative. | AC-6, AC-8 |
| `forge-protection-uninspectable` | Branch protection cannot be inspected. | Surface as `ForgeDegraded` with token; not authoritative. | AC-6, AC-8 |
| `forge-rulesets-unattested` | Rulesets capability not attested. | Surface token; do not assert ruleset facts. | AC-8 |
| `forge-merge-queue-unavailable` | Merge queue facts unavailable. | Surface as `ForgeDegraded`/`refused` token. | AC-6, AC-8 |
| `forge-review-threads-uninspectable` | Review-thread resolution cannot be inspected. | Surface as `ForgeDegraded` token; not authoritative. | AC-6, AC-8 |
| `forge-admin-bypass-refused` | Admin bypass of protection requested. | Refuse with token; do not bypass. | AC-8 |
| `forge-ghes-capability-unknown` | GHES capability cannot be determined. | Surface token; treat capability as unattested. | AC-8 |
| `forge-rate-limited` | Forge rate limit hit. | Surface as `ForgeDegraded`/`refused` token. | AC-8 |
| `forge-redaction-unavailable` | Redaction fingerprints cannot be produced. | Surface token; do not emit unredacted result. | AC-8 |

## Quality bar

- Coverage scope and threshold: the Forge port type-and-fixture helpers under
  `packages/sdk/src/providers/forge/**` at 90% minimum, aiming for 95%.
- Coverage command and instrumented lane(s):
  `pnpm exec vitest run --project unit --coverage --passWithNoTests -- packages/sdk/tests/providers/forge`
  instruments the unit lane for the stated Forge port helper scope; `pnpm coverage:baseline` aggregates
  across the unit, integration, and conformance-mock lanes.
- Required tests, catalogued by AC and failure row: `forge-provider-shape.unit.test.ts` (AC-1);
  `forge-dtos.unit.test.ts` (AC-2); `forge-exact-head.unit.test.ts` (AC-3);
  `forge-action-result.unit.test.ts` (AC-4); `forge-head-mismatch.unit.test.ts` (AC-5, `forge-head-mismatch`
  row); `forge-collect-evidence.unit.test.ts` (AC-6, degraded rows); `forge-capabilities.unit.test.ts`
  (AC-7); `forge-failure-tokens.unit.test.ts` (AC-8, all twelve token rows);
  `forge-public-import.unit.test.ts` (AC-9).
- Exact commands: `pnpm typecheck`; `pnpm test:unit -- packages/sdk/tests/providers/forge/*.unit.test.ts`;
  `pnpm deps`; `pnpm check`; coverage via the command above for the stated Forge port scope.
- Public exposure (import path + public-import test): every exported shape named in the spec surface is
  exported from the `sdk` public entrypoint per `epic0-s4-export-templates/PackageExportConvention`
  (export + barrel + `exports`), proven by `forge-public-import.unit.test.ts` (AC-9). No consumer imports
  a private module path.
- Determinism constraints: fixtures are static and value-stable; type-level assertions use
  `// @ts-expect-error`, carrying no runtime nondeterminism.
- Dependency boundaries: `packages/sdk` Forge port imports only pure runtime libraries permitted by
  `dependency-policy.md`; forbidden in this source: `@octokit/*`, network clients, `execa`,
  `child_process`, concrete driver clients, and any import of `testkit`/`provider-*`/`cli`/`mcp`.
- File-size budget (lines per file): soft cap ~200 lines per file; split the DTO catalog (refs,
  requests, results, observed-facts, evidence-snapshot) across focused files if a file approaches the cap.
- Domain non-negotiables: the exact-head invariant — `updateBranch`/`enqueue`/`merge` accept only
  `ExpectedHeadActionRequest` and a drifted head is unrepresentable as `accepted`; a degraded read is
  never typed as an authoritative `ForgeEvidenceSnapshot`.

## Required reading

- `docs/design/20-sdk-and-packaging/provider-ports.md` — "Forge provider" section.
- `docs/design/20-sdk-and-packaging/dependency-rules.md`.
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-00-s1-capability-attestation.md`.
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s4-export-templates.md`.
- `docs/engineering/testing-policy.md`, `docs/engineering/test-lanes.md`,
  `docs/engineering/dependency-policy.md`.

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The `packages/sdk` Forge provider port module providing the `ForgeProvider` interface, the exact-head
evidence DTO catalog, the `ForgeCapability` attestation specialization, `ForgeFailureToken`, and
`ForgeCredentialPhase` from the spec surface above, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC (catalogued in Quality bar).
- Test name or artifact proving each failure/degraded outcome row (`forge-head-mismatch.unit.test.ts`,
  `forge-failure-tokens.unit.test.ts`, `forge-collect-evidence.unit.test.ts`).
- Negative fixture or `// @ts-expect-error` failing assertion for every rejection / fail-closed /
  not-presentable-as-authoritative claim (AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8).
- `pnpm check` result, unless the gate is blocked by an unrelated repository issue that is named.
- Coverage command, instrumented lane(s), and number for the stated Forge port helper scope.
- Public-import test result (`forge-public-import.unit.test.ts`) for every shape exposed on the public
  `sdk` surface, imported through the intended path.
- Boundary/forbidden-symbol sweep: exact command
  `grep -REn "@octokit/|child_process|from ['\"]execa['\"]|node:net|node:https?" packages/sdk/src/providers/forge`,
  path root `packages/sdk/src/providers/forge`, forbidden-token set
  {`@octokit/*`, `child_process`, `execa`, network clients}, expected zero matches, output captured;
  plus `pnpm deps` output.
- Conformance evidence: this story delivers pure types + in-memory fixtures only; no real process,
  network, or credential. Real-driver / live forge attestation is Epic 6.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/providers/forge`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/providers/forge/**`, `packages/sdk/tests/providers/forge/**`.
- Forbidden dependencies: `@octokit/*`, any network client, `execa`, `child_process`, concrete driver
  clients, and any import of `testkit`, `provider-*`, `cli`, or `mcp`.
- STOP when: a Forge type name or field is not in the `provider-ports.md` Forge section; a failure
  token outside the twelve is requested; the generic `CapabilityAttestation` envelope or `CredentialScope`
  would need redeclaring rather than importing; or any operation would require concrete forge/network
  behavior (that is Epic 6).

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 2 - stories](./README.md) · **← Prev:** [prov-01-s2-agent-testkit - testkit mock Agent provider and conformance implementation story](./prov-01-s2-agent-testkit.md) · **Next →:** [prov-02-s2-forge-testkit - testkit Mock Forge and conformance implementation story](./prov-02-s2-forge-testkit.md)

<!-- /DOCS-NAV -->
