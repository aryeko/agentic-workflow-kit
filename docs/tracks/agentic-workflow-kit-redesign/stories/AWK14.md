---
title: AWK14 story brief
owner: "—"
last-reviewed: 2026-06-13
related:
  - ../README.md
  - ../../../prds/agentic-workflow-kit-redesign/README.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../../../.changeset/README.md
---

# AWK14 story brief

not implementation-ready; create a detailed technical story spec before plan/code

## PRD criteria

| Criterion | Product outcome |
| --- | --- |
| WF-5 | Release artifacts align with documented workflow roles. |
| POL-1 | Release defaults remain conservative where expected. |
| POL-2 | Presets encode the intended PR/CI/review/merge behavior. |
| HC-1 | Codex package/plugin smoke passes before release handoff. |
| HC-2 | Package API remains provider-neutral. |
| FUT-1 | Release does not require a full benchmark harness. |
| FUT-2 | Release artifacts are structured for later UI/eval consumers. |

## Technical solution sections

| Section | Relevance |
| --- | --- |
| Migration/deploy surfaces | Defines compatibility-first rollout and rollback expectations. |
| Testing strategy | Defines final package/plugin gates. |
| Delivery inputs | Places release readiness after docs consolidation. |

## Dependencies

| Dependency | Reason |
| --- | --- |
| AWK13 | Release notes and version handoff must reflect canonical docs after final consolidation. |
| AWK13.16 | Direct blocker: release must not ship until all hardening and speed-policy work (AWK13.1–AWK13.16) lands. AWK13.16 is the last and depends transitively on the rest. |
| AWK13.6 / AWK13.11 / AWK13.15 | Release must not ship until the test-trust and coverage hardening across all rounds lands. |
| AWK13.7 / AWK13.12 | Release notes and docs must reflect post-hardening behavior (approval default, GitHub verification, provider-neutral wiring) and corrected version/security facts. |

## Execution guidance

- This story is intentionally deferred from autopilot. After AWK13.1–AWK13.16 are complete, run AWK14
  manually by changing the tracker status back to `specced`/`plan-approved` or by force-running the
  story.
- Do not start release-readiness work until the release-hardening and speed-policy stories
  (AWK13.1–AWK13.16) have landed and the release-readiness reviews' blockers are resolved.
- The redesign now ships real code changes from AWK13.1–AWK13.16; reflect that in the changeset and
  semver decision (likely a minor bump, confirm against actual API compatibility).
- Record the honest, intentional limitations in the release notes (see release-hardening-design-3
  "Release-note carry-forward"): live token telemetry is off (`tokenTelemetryLive: false`) and the
  structured-output contract is recorded but not enforced (`structuredOutputEnforced: false`).

## Scope boundary

**In scope**

- Create one consolidated Changesets entry for the whole redesign track; do not require per-story changesets retroactively.
- Decide semver bump in the detailed spec based on the actual shipped surface changes.
- Run final release-readiness gates: `pnpm check`, `pnpm build`, `pnpm pack:dry-run`, `pnpm smoke:codex-plugin`.
- Verify package/plugin version consistency and release workflow expectations.
- Prepare release handoff notes, including that implementation was executed with pinned plugin 0.5.13 and the new code becomes consumable only after release.

**Out of scope**

- Publishing without explicit maintainer approval or CI release workflow.
- New feature/code changes beyond release-readiness fixes.
- Docs rewrite; AWK13 owns docs.

## Candidate surfaces

- **Files/modules:** `.changeset/*.md`, `package.json`, `packages/orchestrator/package.json`, `packages/orchestrator/CHANGELOG.md` if versioning runs, `.github/workflows/*` if release workflow docs/tests require inspection, plugin manifests if version sync is part of release prep
- **Queries/schema:** package metadata
- **Prompts/tools:** none expected
- **Events/metrics:** release-readiness evidence
- **Components/routes:** package publishing surface

## Validation expectations

- `pnpm check`
- `pnpm build`
- `pnpm pack:dry-run`
- `pnpm smoke:codex-plugin`
- If `pnpm version-packages` is run, verify generated version and changelog changes before commit.

## Open technical questions

| Question | Blocking? | Resolution expected in detailed spec |
| --- | --- | --- |
| Is the redesign a patch, minor, or major release based on actual API compatibility? | yes | Decide after AWK13 and before creating the changeset. |
| Should this story run `pnpm version-packages`, or leave versioning to the release workflow? | yes | Follow the repo's current release automation and maintainer preference. |
