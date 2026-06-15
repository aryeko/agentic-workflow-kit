---
title: agentic-workflow-kit redesign release-readiness review (round 2)
status: review
owner: "—"
last-reviewed: 2026-06-15
related:
  - ./README.md
  - ./release-readiness-review.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/08-acceptance-criteria.md
  - ../../prds/agentic-workflow-kit-redesign/release-hardening-design.md
---

# agentic-workflow-kit redesign release-readiness review (round 2)

A second deep review of the redesign track, conducted after the release-hardening sub-track
(AWK13.1–AWK13.7) landed and before AWK14 (release readiness). Scope: the PRD and technical solution,
the delivery track, and the implemented orchestrator/runtime code. This review re-checks the seven
release blockers from the [first review](./release-readiness-review.md) against current source and
sweeps for new gaps introduced or left behind. Every load-bearing claim was verified at the cited
`file:line`. Citations are to `main` at commit `1796519`.

## Verdict

**The repo is a role-model OSS project again — and stronger than before the AWK track — but it is not
yet ready to *cut* the V1 tag.** That distinction matters: AWK14 is correctly still `deferred`, and a
short, well-scoped hardening pass should precede it. The redesign delivered a cleanly layered,
dependency-injected runtime with genuine immutability, near-perfect type safety, exemplary CI/release
automation, and accurate consolidated docs.

All seven round-1 release blockers (RB-1..RB-4, H-1..H-4) were independently re-verified as genuinely
fixed, not merely checked off. Of 33 ship-blocker acceptance criteria, **31 are fully met and 2
(OBS-1, OBS-4) are substantively met with minor literal field gaps**. The headline round-1 blocker —
autonomously merging on the child's prose self-report — is closed: the parent now git-verifies merge
ancestry **and** `gh`-verifies CI status and review approval before performing the merge itself.

The remaining gaps are bounded and concentrated: non-atomic full-file artifact writes, a coverage
gate computed over a subset of suites, a missing end-to-end story-run test, and provider-neutrality
that is real at the core but still leaks at the edges.

## Ground truth

| Gate | Result |
| --- | --- |
| `pnpm build` (orchestrator `tsc -p tsconfig.build.json`) | clean |
| `biome check .` | clean |
| `tsc --noEmit` + orchestrator `typecheck` | clean |
| `pnpm check` (lint + typecheck + test) | green |
| orchestrator `vitest` | 329 passed |
| orchestrator coverage | 85.0% lines / 81.6% stmt / 72.2% branch / 85.5% func (thresholds 81/72) |
| version sync | consistent at `0.5.14` across all 8 manifests + materialized plugin mirror (`diff -rq` clean) |

The green gate proves the wiring is internally consistent. It does **not** prove crash-durability or
end-to-end run correctness, because those negative/integration paths remain untested (Findings R2-1,
R2-4).

## Round-1 blockers: re-verification

All confirmed fixed against current source.

| Round-1 finding | Status | Evidence |
| --- | --- | --- |
| RB-1 GitHub prose-trust | **Fixed** | Parent gh-verifies head SHA + CI + review before self-merge (`runner/CompletionGate.ts`, `collaboration/CollaborationInspector.ts`); recovery fed real gh/git state (`runner/RecoveryGuard.ts`) |
| RB-2 Codex-leaky "neutral" contract | **Fixed (core)** | Zero `codex` refs in `runner`/`api`/`scheduler`/`tracks`; `abort()`/`classifyError()` on `drivers/StoryRunner.ts`. Residual edge leaks → R2-3 |
| RB-3 run-state corruption | **Mostly fixed** | Appends serialized via `appendQueues` + `{raw}` parse fallback (`artifacts/FileArtifactStore.ts:46`). Residual: full-file writes still non-atomic → R2-1 |
| RB-4 release mechanics / stale docs | **Fixed** | SECURITY now `0.5.x`; CHANGELOG redirected; changesets present (AWK14 owns the cut) |
| H-1 `trackerMigration: false` | **Fixed** | `api/facade.ts` now advertises `trackerMigration: true` |
| H-2 test trust | **Mostly fixed** | Completion gate now 18 cases incl. fail-closed; real-git ancestry adapter tested. Residual → R2-4 |
| H-3 files over 800 lines | **Fixed** | Largest file 765 lines; splits cohesive, not mechanical |
| H-4 dry-run was instruction-only | **Fixed** | Runtime `confirmNonDryRun` gate (`commands/handlers.ts`) before non-dry-run launch |

## Remaining findings (round 2)

### R2-1 — Full-file artifact writes are non-atomic (HIGH)

**Criteria affected:** Q-2 (durability). **Contradicts:** the AWK13.3 "harden run-state durability"
claim.

`FileArtifactStore.writeJson`/`writeText` do a plain `writeFile` with no temp-file + `rename`
(`artifacts/FileArtifactStore.ts:11-19`). `state.json`, `summary.json`, and every full-file artifact
go through this path, so a crash mid-write corrupts run state. AWK13.3 correctly fixed the *append*
path (serialized queue + `{raw}` parse fallback), but the full-file path was left non-atomic. The
correct pattern already exists in the codebase: `tracks/trackerClaimer.ts` writes to a temp file,
`rename`s, and reads back to verify. Apply the same temp+rename to `writeText`.

### R2-2 — Coverage ratchet is computed over a subset of suites (HIGH)

Root `vitest.config.ts` includes only `test/**` and carries **no coverage block**; the package
`packages/orchestrator/vitest.config.ts` gates only `tests/**`. Several high-value suites live in the
*uninstrumented* root `test/` directory (duplicate-launch-guard, both tracker-claimer concurrency
tests, codex-control, run-analyzer, workflow-runner). Net effect: the reported 81.6%/72.2%
*understates* true coverage **and** the ratchet passes over a subset, clearing thresholds by a razor
margin (stmts 81.61 vs 81.00). This is honest-but-fragile — it reads as "covered" when the gate is
not seeing every suite. Unify the configs so coverage spans both `test/**` and `tests/**`.

### R2-3 — Provider-neutrality is real at the core, leaky at the edges (MEDIUM)

**Criteria affected:** HC-2 (contract is met; neutrality is asserted but never exercised).

The abstraction is sound — the core orchestration layers contain zero Codex references. But a *second*
driver today would still require edits in four places:

- `mcp/codexControl.ts` implements child reply/interrupt as a standalone Codex path (spawns its own
  `StdioClientTransport`, hardcoded `codex_reply`/`codex_interrupt` tool-name candidates) that
  **bypasses `StoryRunner.controlChild`/`abort`**.
- Artifact root is hardcoded to `.codex/agentic-workflow-kit/runs` inside the *neutral*
  `ResolvedWorkflowConfig` (`config/configLoader.ts`).
- `ResolvedWorkflowConfig.codex` is a provider-named field on a neutral type (`types.ts:332`).
- No driver factory/registry: `new CodexMcpStoryRunner(...)` is hardcoded at ~4 call sites despite
  `OrchestratorDriver` being a (single-member) union and `SUPPORTED_DRIVERS` existing.

Follow-up: route control through the contract, add a driver factory, and parameterize the artifact
directory so HC-2 becomes load-bearing rather than scaffolding with one inhabitant.

### R2-4 — Test trust has three honest holes (MEDIUM)

**Criteria affected:** Q-5. The tests are largely trustworthy and free of theater — mocking is at
clean seams, fakes mirror real contracts, and assertions check concrete behavior. The gaps:

- **No crash-recovery round-trip test.** RunJournal durability is asserted only against an in-memory
  store; write → simulate restart → read `state.json`/`launch.json` → `RecoveryGuard` decision is
  never exercised end-to-end. Compounds R2-1.
- **No end-to-end story-run test.** The codex smoke test is an MCP handshake only. For a tool whose
  value proposition is autonomous runs, this is the most valuable missing test.
- **Live Codex intervention path ~8% covered** (`mcp/codexControl.ts`): only helper resolution and
  secret redaction are tested, not live `codex_reply`/`codex_interrupt` against a session.

### R2-5 — Public API error classification by substring-matching English (MEDIUM)

`api/facade.ts` classifies error codes by matching human-readable message text
(`message.includes('config')`, `'track'`, `'not eligible'`). This is brittle and order-dependent for
a *public* API contract — error messages are not a stable interface. Additionally, `retryable` is
hardcoded `false` everywhere, making that envelope field meaningless. Derive codes from typed error
classes instead of prose.

### Low-severity polish

- Tracker claim lock has no stale-lock recovery — a process that crashes holding `.lock` blocks
  claimants until manual cleanup (`tracks/trackerClaimer.ts`).
- Add `.github/CODEOWNERS` to make review routing explicit as contributors arrive.
- Replace the bare `@aryeko` handle in `CODE_OF_CONDUCT.md` with a contact address (already flagged
  in-doc).
- Cosmetic: lone CamelCase "WorkflowKit" at `docs/architecture.md:130`.

## Acceptance-criteria scorecard

| Group | Fully met | Partial |
| --- | --- | --- |
| WF (1–5) | WF-1..5 | — |
| TRK (1–4) | TRK-1..4 | — |
| RUN (1–6) | RUN-1..6 | — |
| POL (1–7) | POL-1..7 | — |
| OBS (1–7) | OBS-2, OBS-3, OBS-5, OBS-6 | OBS-1 (no `phase`/subagent realtime field), OBS-4 (no `turns`; token breakdown lacks cache/active), OBS-7 (target; poll-backed stream) |
| HC (1–4) | HC-1, HC-3, HC-4 | HC-2 (contract met; neutrality not exercised — R2-3) |
| FUT (1–2) | FUT-1, FUT-2 | — |

31/33 ship blockers fully met; OBS-1 and OBS-4 are minor literal-field gaps, not safety- or
function-critical, and unavailable fields are honestly null-with-reason (`metrics/availability.ts`).

## What is genuinely solid

Do not redo these:

- **Dependency inversion + immutability** — `WorkflowRunner` consumes injected interfaces
  (`StoryRunner`, `GitInspector`, `ArtifactStore`, `Clock`, `CollaborationInspector`); copy-on-write
  state throughout; only 2 unsafe casts in 14.4k LOC, both at the MCP-SDK boundary.
- **Completion gate** — fail-closed on child-only evidence; requires gh-verification AND git ancestry
  to agree; parent performs the merge itself. 18 test cases.
- **Budgets** — real warn < stop-launching < checkpoint-stop < abort enforcement, observed-vs-configured
  to `budgets.json`, tested end-to-end.
- **Tracker claiming** — lockfile + atomic temp+rename + read-back verify; real concurrent-claim test.
- **Codex MCP driver** — real stdio client, session linkage, structured output, transient-only
  retries, layered timeouts, abort propagation; excellent test coverage of retry/timeout/abort.
- **OSS hygiene** — all standard files present and high-quality; versions perfectly synced; CI runs
  the full gate; release uses changesets with npm OIDC trusted publishing + provenance; `getting-started.md`
  is a runnable tutorial against shipped examples.

## Recommended path to release

1. **R2-1** — atomic temp+rename in `FileArtifactStore.writeText` (blocker for the durability claim).
2. **R2-4** — one crash-recovery round-trip test + one end-to-end story-run test.
3. **R2-2** — unify the two vitest configs so coverage spans both suites.
4. Fast-follow (not strict blockers): **R2-3** driver factory + route control through the contract +
   parameterize artifact dir; **R2-5** typed error codes in the facade.
5. Then AWK14: consolidated changeset, regenerated changelog, release handoff.

## Method

Reviewed across four dimensions (code/architecture, test trust, spec compliance, docs/DevX/packaging)
with parallel agents, then verified each round-1 blocker and every round-2 finding directly against
source. Build and full verify gate run green locally at commit `1796519`.
