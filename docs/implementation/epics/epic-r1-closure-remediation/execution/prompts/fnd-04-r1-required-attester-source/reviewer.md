# Reviewer Prompt: fnd-04-r1-required-attester-source

## Assigned Routing

- Source story id: `fnd-04-r1-required-attester-source`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: security-sensitive release-match + public `RequiredAttester` shape; must confirm
  finding #7 is closed and denial behaviour preserved. At or above the DAG floor; no provider-specific
  runtime model id.

## Original Scope

- Story id: `fnd-04-r1-required-attester-source`.
- Epic slug: `epic-r1-closure-remediation`.
- Source story contract path: `docs/implementation/epics/epic-r1-closure-remediation/stories/fnd-04-r1-required-attester-source.md`.
- Allowed pathset: `packages/sdk/src/foundation/credentials-secrets/**`, `packages/sdk/tests/foundation/credentials-secrets/**`.
- Direct dependencies: none. Dependency inputs: frozen fnd-01 `RequiredAttesterSource` (committed) +
  `{{DEPENDENCY_COMMITS}}`.

### Acceptance Criteria

- **AC-1** `RequiredAttester` = exactly `{ point, capability, driverId, scopeDigest, egressPolicyDigest }`;
  no `platform`/`driverVersion`/`runtimeMetadataAvailable` (type test + 3 `@ts-expect-error`).
- **AC-2** `resolveRequiredAttesters` produces only those five keys; no `'runtime-metadata-missing'`.
- **AC-3** Release-match accepts an attestation with arbitrary platform/version when
  `driverId`/`scopeDigest`/`egressPolicyDigest` match a fresh positive `egress-confinement` attestation.
- **AC-4** Release-match denies a genuine `egressPolicyDigest` mismatch with `egress-policy-unattested`;
  sweep proves no `required.platform/driverVersion/runtimeMetadataAvailable` reads remain.
- **AC-5** Ambient-clock sweep zero matches (regression guard for #9).
- **AC-6** `RequiredAttester` importable from `sdk` with the narrowed shape.

### Dependencies And Frozen Inputs

- Covers signals: none (forward-fix; signal owner Epic 1 `fnd-04-s1..s4`). Depends on: fnd-01
  `RequiredAttesterSource`. Depended on by: none intra-epic. Shared shapes consumed: `RequiredAttesterSource`.

### Non-Goals

Findings #5/#6/#8/#9; API-shape migration; new audit events; fnd-01/Host/core-01 changes; Epic 1 planning
edits.

### STOP Conditions And Boundaries

Owned pathset above only; forbidden production deps `testkit`/`provider-*`/`cli`/`mcp`; STOP if a fix needs
a design or fnd-01/Host change.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

- **AC coverage:** each `AC-n` proven by the named test with the concrete assertion (not a bare file path).
- **Security correctness (load-bearing):** confirm dropping platform/version from the *match* is correct
  per design lines 48–56 / README 132–135 — the Host owns the platform/version match; fnd-04 must not
  fabricate it. Confirm AC-4 preserves fail-closed `egress-policy-unattested` denial; the change must not
  silently widen acceptance beyond removing the meaningless fabricated gate.
- **Scope fidelity:** no API-shape migration; findings #5/#6/#8/#9 untouched; no new audit events; only the
  owned pathset changed.
- **Stale names / sibling occurrences:** grep that no `platform`/`driverVersion`/`runtimeMetadataAvailable`
  reference to the dropped `RequiredAttester` members survives anywhere in credentials-secrets.
- **Evidence pack completeness:** both sweeps captured (zero matches), coverage number present,
  public-import result present.
- **Repo conventions / mutation limits:** worker made no commits/PRs/tracker edits; writes within pathset.

## Verdict Format

Return `APPROVED` when no blocking findings remain. Otherwise list findings severity-ordered, each with
file/line, the required fix, and the violated `AC-n` or boundary.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker/package edits, or source-planning edits.
Inspect and return a verdict only.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic R1 - Delivered-code closure remediation](../../../README.md) · **← Prev:** [Implementer Prompt: fnd-04-r1-required-attester-source](./implementer.md) · **Next →:** [Epic R1 Execution Tracker](../../tracker.md)

<!-- /DOCS-NAV -->
