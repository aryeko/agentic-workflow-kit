# Reviewer Prompt: prov-01-s3-codex-agent-driver

## Assigned Routing

- Source story id: `prov-01-s3-codex-agent-driver`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-6-concrete-provider-drivers/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `prov-01-s3-codex-agent-driver` covers `AC-1`..`AC-10` and carries a public provider package, Agent event normalization, approval relay safety boundary, Guardian advisory boundary, Local/Codex parentage dependency, smoke-real evidence, conformance, failure-token closure, and boundary purity.

## Original Scope

- Story id: `prov-01-s3-codex-agent-driver`.
- Epic slug: `epic-6-concrete-provider-drivers`.
- Source story contract: `docs/implementation/epics/epic-6-concrete-provider-drivers/stories/prov-01-s3-codex-agent-driver.md`.
- Acceptance criteria: `AC-1` public factory and Agent provider compatibility; `AC-2` versioned schema probes; `AC-3` linkage and terminal invariants; `AC-4` structured tool output refs; `AC-5` approval answer relay/persistence; `AC-6` owned-session resume; `AC-7` Guardian advisory boundary; `AC-8` capability attestations and parentage; `AC-9` Agent conformance and broken providers; `AC-10` dependency and boundary purity.
- Allowed pathset: `packages/provider-codex/src/**`, `packages/provider-codex/tests/**`, `packages/provider-codex/package.json`, `packages/provider-codex/tsconfig.json`, `tests/providers/codex-local-parentage.smoke.test.ts`.
- Dependencies: merged `prov-04-s3-local-execution-host-driver` for live host parentage evidence; prior frozen `prov-01-s1-agent-port`, `prov-01-s2-agent-testkit`, fnd-04 redaction/worker-safe credentials, and fnd-02 artifact refs.
- Non-goals: SDK Agent type changes, failure catalog/testkit ownership, process spawn/containment/termination, runner-owned verify, approval adjudication, liveness/supervision decisions, completion/recovery decisions, local git, Forge actions, Forge credentials, Guardian gate authority, and Guardian bypass automation.
- STOP conditions: Agent port change, live Codex capability without versioned schema plus smoke evidence, Forge credential in worker scope, Guardian as approval authority, or host parentage without Local containment evidence.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

- Verify source AC coverage for `AC-1`..`AC-10`; each AC must be proven by the named standing gate lane or targeted command and not by prose alone.
- Confirm every manifest item maps to AC -> standing gate lane: public factory/type conformance to `typecheck`/`type:fixtures`, schema/events/tool/approval/resume/Guardian/capability/conformance to `coverage:baseline`, live Codex/Local behavior to gated `smoke-real`, boundary purity to `deps`.
- Check every failure token is exact and proven: `agent-capability-unattested`, `agent-linkage-lost`, `approval-relay-unattested`, `approval-answer-channel-lost`, `agent-resume-unattested`, `structured-tool-exit-missing`, `tool-output-ref-missing`, `guardian-review-untrusted`, `host-parentage-unproven`, `agent-terminal-ambiguous`.
- Validate dependency unlock: `{{DEPENDENCY_COMMITS}}` must include the merged Local provider story and the diff must consume Local host parentage evidence through the root cross-provider smoke harness/public entrypoints, not a provider-package peer import.
- Validate Guardian boundary: advisory observation only, no automated gate authority, and boundary sweep for `approve_guardian_denied_action` returns zero matches.
- Validate evidence pack completeness: public import fixture, focused provider coverage over `packages/provider-codex/src/**`, boundary sweeps, conformance evidence, gated Codex approval/resume/parentage smoke, and `pnpm check`.
- Confirm production source imports only `sdk` and Codex-provider protocol dependencies and does not import `testkit`, `cli`, `mcp`, peer providers, Forge clients, local git modules, runner command execution outside Local, or core approval/liveness/recovery decision modules.
- Search sibling occurrences for the same issue before approving a fix.
- Confirm changed files stay inside the allowed pathset.
- Enforce repo conventions, immutable updates, explicit error handling, and mutation limits.

## Verdict Format

Return `APPROVE` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths. Inspect only and return a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 6 - Concrete provider drivers](../../../README.md) · **← Prev:** [Implementer Prompt: prov-01-s3-codex-agent-driver](./implementer.md) · **Next →:** [Implementer Prompt: prov-02-s3-github-forge-driver](../prov-02-s3-github-forge-driver/implementer.md)

<!-- /DOCS-NAV -->
