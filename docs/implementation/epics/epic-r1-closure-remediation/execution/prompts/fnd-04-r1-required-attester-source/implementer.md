# Implementer Prompt: fnd-04-r1-required-attester-source

## Assigned Routing

- Source story id: `fnd-04-r1-required-attester-source`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: fnd-04-r1 covers AC-1..AC-6 over a security-sensitive egress-attestation release-match
  and a public `RequiredAttester` shape (safety boundary). The selected tier is at or above the DAG floor
  and uses no provider-specific runtime model id.

## Exact Task

Story `fnd-04-r1-required-attester-source` (epic `epic-r1-closure-remediation`). Single outcome:
forward-fix the **delivered** fnd-04 code so it closes audit finding **#7** and nothing more — narrow
`RequiredAttester` to the amended design shape, remove the runtime-fact fabrication, and correct the
release-match. This is a forward-fix of already-shipped Epic 1 code; **preserve the delivered
`(input, dependencies)` function API** and all existing behaviour except the specific correction below.
Do **not** migrate to a `CredentialsAndSecretsContract` object or a `CredentialAuditContext` parameter, do
**not** touch findings #5/#6/#8/#9 surface (verified already closed), and do **not** reopen Epic 1
planning artifacts.

## Why It Matters

`RequiredAttester` is a public fnd-04 shape; the delivered code fabricates Host-driver `platform`/
`driverVersion` (with a `'runtime-metadata-missing'` fallback) and gates the egress-attestation
release-match on those fabricated values — a meaningless check that contradicts the amended design, which
says those are Host-reported runtime facts matched against the Host `CapabilityAttestation`, not values
fnd-04 produces. No intra-epic dependents; the fix removes latent seam divergence in shipped security code.

## Required Reading

- Source story contract: `docs/implementation/epics/epic-r1-closure-remediation/stories/fnd-04-r1-required-attester-source.md`.
- Frozen DAG: `docs/implementation/epics/epic-r1-closure-remediation/story-dag.md`.
- Amended design: `docs/design/30-domain-reference/foundation/credentials-and-secrets/contracts-and-events.md`
  (lines 48–56: `RequiredAttester` comment + body) and `.../README.md` (lines 132–135: release-match rule).
- Delivered code to change: `packages/sdk/src/foundation/credentials-secrets/egress/egress-types.ts`,
  `.../egress/issue-egress-policy.ts` (`resolveRequiredAttesters`, ~lines 100–102),
  `.../injection/resolve-credential.ts` (`matchesEgressAttestation`, ~lines 42, 52, 53).
- `docs/engineering/test-lanes.md`; `docs/design/20-sdk-and-packaging/dependency-rules.md`.

## Acceptance Criteria

(Restated from the source contract with original ids; the contract is authoritative for full evidence
clauses.)

- **AC-1** `RequiredAttester` declares exactly `{ point, capability, driverId, scopeDigest, egressPolicyDigest }`
  and no `platform`, `driverVersion`, or `runtimeMetadataAvailable`. Test: `required-attester-shape.types.test.ts`
  with a five-member fixture (tsc zero errors) + three `@ts-expect-error` lines for the dropped members.
- **AC-2** `resolveRequiredAttesters` produces a `RequiredAttester` with exactly those five keys and never
  the `'runtime-metadata-missing'` fabrication. Test: `issue-egress-policy-attester-shape.unit.test.ts`
  asserts produced keys exactly `["point","capability","driverId","scopeDigest","egressPolicyDigest"]`.
- **AC-3** Release-match acceptance does not depend on platform/driver-version: an `EgressAttestation` with
  arbitrary sentinel `platform`/`driverVersion` but matching `driverId`/`scopeDigest`/`egressPolicyDigest`
  on a fresh positive `egress-confinement` attestation is **accepted** (`{ ok: true }`). Test:
  `release-match-platform-agnostic.unit.test.ts`.
- **AC-4** Release-match still **denies** a genuine mismatch (`egressPolicyDigest` mismatch →
  `{ ok: false, reason: "egress-policy-unattested" }`). Test: `release-match-denies-mismatch.unit.test.ts`
  + sweep that `resolve-credential.ts` no longer reads `required.platform/driverVersion/runtimeMetadataAvailable`.
- **AC-5** No ambient-clock regression: the clock sweep over the credentials-secrets src tree returns zero
  matches (exit 1). Test/artifact: `injected-time` regression sweep captured in the evidence pack.
- **AC-6** `RequiredAttester` is importable from the `sdk` public entrypoint with the narrowed shape. Test:
  `required-attester-public-import.unit.test.ts`.

### Failure / degraded tokens

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `egress-policy-unattested` | Host attestation missing/stale/partial or `scope`/`egressPolicyDigest`/`driverId` mismatch | deny; no confined credential released | AC-4 |

## Allowed Writes

Exactly the source contract's owned pathset; all other writes forbidden:

- `packages/sdk/src/foundation/credentials-secrets/**`
- `packages/sdk/tests/foundation/credentials-secrets/**`

## Dependency Inputs

- Consumes frozen fnd-01 `RequiredAttesterSource` (`packages/sdk/src/foundation/configuration-policy/...`,
  already delivered) — import, do not redeclare.
- No intra-epic producer dependency. `{{DEPENDENCY_COMMITS}}`: none.

## Non-Goals And STOP Conditions

- Non-goals: findings #5/#6/#8/#9 (already closed); migrating the function API to a contract object or
  `CredentialAuditContext` param; emitting `EgressPolicyIssued`; back-filling `CredentialUsePlanned`
  attestation refs; editing fnd-01 types, the Host attestation domain, the core-01 envelope, or Epic 1
  planning artifacts.
- STOP when: the fix would require a design change, a fnd-01 type change, Host-domain logic, or would alter
  behaviour beyond the finding-#7 correction. Report and stop rather than widen scope.

## Implementation Constraints

- Keep `EgressAttestation.platform`/`driverVersion` (Host-reported evidence) and `RequiredAttesterRuntime`
  only insofar as still needed; remove what existed solely to feed the dropped `RequiredAttester` fields.
- Match criteria per design: `driverId` + `scopeDigest` + `egressPolicyDigest` + fresh positive
  `egress-confinement` attestation. Fail closed (`egress-policy-unattested`) on missing/stale/mismatch.
- Determinism: no `Date.now()`, `new Date()`, `Math.random()`, `crypto.randomUUID()` in production source.
- Imports: production source imports only the fnd-01/fnd-02/core-01 types it already depends on; never
  `testkit`, `provider-*`, `cli`, `mcp`.
- TDD: write the failing test first (RED) for each AC, then implement (GREEN), then refactor.

## Verification

- Targeted: `pnpm exec vitest run --project unit --coverage --passWithNoTests -- packages/sdk/tests/foundation/credentials-secrets/**`.
- Sweeps (expect zero matches, exit 1; capture output):
  - `grep -REn "required\.(platform|driverVersion|runtimeMetadataAvailable)" packages/sdk/src/foundation/credentials-secrets/`
  - `grep -REn "Date\.now|new Date\(|Math\.random|crypto\.randomUUID" packages/sdk/src/foundation/credentials-secrets/`
- Repo gate: `pnpm check` green over the worktree.
- Evidence pack: per-AC test names, the AC-1 `@ts-expect-error` fixtures, the AC-4 mismatch fixture, the
  coverage number for the changed surface, the public-import result, and both sweep outputs.

## Delivery Report

Return: changed files; AC coverage mapped by `AC-n`; tests/checks run and results; the evidence pack;
any open questions; any blockers. Do not claim done without `pnpm check` output.

## Mutation Limits

No staging, commits, pushes, PRs, merges, tracker/package edits, or writes outside the allowed pathset.
Implement and report; the orchestrator commits the approved pathset.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic R1 - Delivered-code closure remediation](../../../README.md) · **← Prev:** [Reviewer Prompt: core-01-r1-create-run-requested-by](../core-01-r1-create-run-requested-by/reviewer.md) · **Next →:** [Reviewer Prompt: fnd-04-r1-required-attester-source](./reviewer.md)

<!-- /DOCS-NAV -->
