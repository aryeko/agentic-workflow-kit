---
title: agentic-workflow-kit redesign release-readiness review (round 3)
status: review
owner: "—"
last-reviewed: 2026-06-16
related:
  - ./README.md
  - ./release-readiness-review.md
  - ./release-readiness-review-2.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/08-acceptance-criteria.md
  - ../../prds/agentic-workflow-kit-redesign/release-hardening-design-2.md
---

# agentic-workflow-kit redesign release-readiness review (round 3)

A third review of the redesign track, conducted after the round-2 hardening sub-track
(AWK13.8–AWK13.12) landed and before AWK14 (release readiness). Scope: the implemented
orchestrator/runtime code, the test/coverage gate, and spec compliance against the PRD ship blockers.
Every load-bearing claim was verified at the cited `file:line`. Citations are to `main` at commit
`d7c90b8`.

## Verdict

**The repo remains a role-model OSS project — stronger than at the end of round 2 — and the round-2
blockers are genuinely closed at HEAD.** All five round-2 findings (R2-1..R2-5) were independently
re-verified as fixed, not merely checked off:

| Round-2 finding | Status at `d7c90b8` | Evidence |
| --- | --- | --- |
| R2-1 non-atomic full-file writes | **Fixed** | `artifacts/FileArtifactStore.ts:16` `writeText` now writes a temp file, preserves mode, `rename`s over the target, and unlinks the temp on failure |
| R2-2 coverage over a subset of suites | **Fixed** | root `vitest.config.ts` carries the unified gate spanning `test/**` + orchestrator `tests/**` (AWK13.11 ratchet) |
| R2-3 leaky provider-neutrality | **Fixed (core+wiring)** | child control routes through the driver registry (`feat: route child control through driver registry`); residual host naming is intentional back-compat (see below) |
| R2-4 test-trust holes | **Mostly fixed** | 913 tests pass; coverage now spans all suites |
| R2-5 prose-based error classification | **Fixed** | typed `WorkflowKitError` hierarchy + `WorkflowApiErrorCode`; facade reads `error.code` (`fix: use typed workflow api errors`) |

The full gate runs green locally at `d7c90b8`: `biome check` clean (139 files), `tsc --noEmit` +
orchestrator typecheck clean, `pnpm build` clean, **913 tests pass** (559 root + 354 orchestrator),
coverage gate met.

This round surfaces a **bounded set of lighter residuals** — one MEDIUM telemetry-fidelity gap and a
cluster of maintainability/DevX items. None are safety- or correctness-critical; they are the right
scope for a final hardening pass (AWK13.13–AWK13.15) before cutting V1.

Follow-up note: a later operator review identified a separate child-session speed/service-tier config
gap. That work is tracked as AWK13.16 after AWK13.15 and also gates AWK14.

## Ground truth

| Gate | Result |
| --- | --- |
| `biome check .` | clean (139 files) |
| `tsc --noEmit` + orchestrator typecheck | clean |
| `pnpm build` | clean |
| `pnpm test` (root + orchestrator) | 913 passed |
| Combined coverage | stmts 85.0 / branches 75.2 / functions 89.9 / lines 88.5 (thresholds 84 / 75 / 89 / 88) |
| version sync | consistent at `0.5.14` across all manifests |

The green gate proves internal consistency. It does **not** prove the coverage gate has comfortable
headroom — every metric clears its threshold by ≤ ~1 point, branches by **+0.18** (Finding R3-3).

## Remaining findings (round 3)

### R3-1 — `failedToolCalls` is structurally never populated; one advertised budget dimension is inert (MEDIUM)

**Criteria affected:** OBS-4, POL-4, Q-5.

`RunJournal` hardcodes `failedToolCalls: nullableMetric(null, …UNAVAILABLE_REASONS.sessionLogMetrics)`
(`runner/RunJournal.ts:305`), so the metric is always null. POL-4 advertises `failedToolCalls` as a
configurable per-profile budget dimension (`config/schema.ts`), and POL-5 maps budget breaches to
warn/stop/checkpoint/abort — but because the observed value is always null, a `failedToolCalls` budget
can never trip. The PRD's "when host telemetry exposes them" wording makes the null *honest* rather
than a false claim, and the facade flags `tokenTelemetryLive: false` (`api/facade.ts:615`) in the same
spirit. The defect is the **mismatch**: a budget dimension is offered in config that the runtime can
never enforce. Either derive `failedToolCalls` from the session-log metrics the driver already parses,
or stop advertising the dimension and document the limitation in the budget contract and release notes.

### R3-2 — Runtime type-safety hole + the supervision core is one oversized function (MEDIUM)

**Criteria affected:** Q-2, Q-3 (maintainability of the durability/recovery core).

Two related items in the runner, both consequences of breaking a cycle between `WorkflowRunner` and its
helpers:

- **`runner: unknown` + structural cast** at three seams — `runner/ChildSupervisor.ts:53`,
  `runner/ChildLaunchRecorder.ts:57`, `runner/WorkflowRunnerEligible.ts:44` — each immediately doing
  `const self = runner as <…>Runner`. This is the one place type safety in an otherwise
  zero-`any`/zero-suppression package is defeated: the compiler cannot check the call boundary. A
  typed runner-context interface threaded as the parameter type removes the `unknown` and the cast.
- **`executeChildWithSupervisor` is a ~270-line function** (`runner/ChildSupervisor.ts:52`) carrying
  most of the package's irreducible complexity: four racing timeout promises plus nested
  startup/lifecycle/polling closures. It is well-named but is the single hardest unit to reason about
  and the obvious target for extraction into named collaborators.

### R3-3 — Coverage headroom is razor-thin and a stale `coverage/` dir crashes local `pnpm test` (LOW)

**Criteria affected:** Q-5, Q-9 (DevX).

The unified ratchet passes, but branches clear by **+0.18** — one uncovered branch added later turns CI
red. Separately, the v8 coverage provider crashes with `ENOENT .../coverage/.tmp/coverage-0.json` when a
prior `pnpm test` was interrupted and left a stale `coverage/` directory; it does not recur from a clean
state. CI from a clean checkout is unaffected, but local contributors hit a confusing crash that looks
like a test failure. Widen the headroom on the thinnest metrics and add a pre-test clean of the coverage
temp dir.

### Explicitly out of scope (intentional, not gaps)

- **Residual host naming** — `DEFAULT_ARTIFACT_ROOT_DIR = '.codex/agentic-workflow-kit'`
  (`drivers/registry.ts:5`) and the `config.codex` alias. AWK13.8 deliberately kept these as
  back-compatible defaults/aliases (compatibility-first); the driver *contract* (HC-2) is neutral. Do
  not rename — it would break existing on-disk run paths and configs.
- **Structured-output enforcement** — `structuredOutputEnforced: false` (`api/facade.ts:616`) is honest.
  POL-3 requires only that a profile can *configure* a structured-output contract, which it can. This is
  a **release-note** line item for AWK14, not a code story.

## Acceptance-criteria scorecard (delta from round 2)

31/33 ship blockers fully met (unchanged). OBS-4 remains the one substantive partial — token breakdown
plus `failedToolCalls` are honestly null-with-reason, and R3-1 proposes closing the
`failedToolCalls` half. All other round-2 partials (OBS-1, HC-2) are resolved at HEAD.

## Recommended path to release

The round-3 residuals are sequenced as remediation stories **AWK13.13–AWK13.15** (see
[release-hardening-design-3](../../prds/agentic-workflow-kit-redesign/release-hardening-design-3.md)),
inserted between AWK13.12 and AWK14; they **gate AWK14**.

1. **AWK13.13 / R3-2** — typed runner-context interface (remove the `runner: unknown` casts) and
   decompose `executeChildWithSupervisor`. Lands first because it reshapes runner internals the later
   stories ride.
2. **AWK13.14 / R3-1** — wire `failedToolCalls` from session-log metrics, or retire the dimension and
   document the limitation. Follows AWK13.13 since `RunJournal` lives in `runner/`.
3. **AWK13.15 / R3-3** — widen coverage headroom and fix the stale-`coverage/` local footgun. Lands after
   the round-3 behavior fixes so the re-baselined ratchet reflects the final shapes.
4. **AWK13.16** — child-session speed/service-tier policy discovered in a later operator review; gates
   AWK14.
5. Then **AWK14**: consolidated changeset, release handoff, and a release note recording the honest
   telemetry/structured-output limitations.

## Method

Reviewed across four dimensions (code/architecture, spec compliance, OSS hygiene/DevX, and the
test/build/coverage gate) with parallel agents, then verified each round-2 fix and every round-3 finding
directly against source. Build and full verify gate run green locally at `d7c90b8`.
