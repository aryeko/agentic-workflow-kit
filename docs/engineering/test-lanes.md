---
title: kit-vnext — Test Lanes
status: high-level design
last-reviewed: "2026-06-19"
---

# Test Lanes

Four Vitest lanes are configured in `vitest.config.ts`. Each lane has a distinct
purpose, file-glob, and hermetic policy. The lanes are designed so that conformance
suites for the control plane can run against mock drivers with zero real processes or
network.

## The Four Lanes

### unit — `*.unit.test.ts`

- **Purpose:** hermetic tests of individual functions, utilities, and components.
- **Glob:** `tests/**/*.unit.test.ts`, `packages/**/*.unit.test.ts`
- **Hermetic:** yes — the zero-real-process guard is loaded as a setup file.
- **Allowed I/O:** none. Any call to spawn a process, open a network socket, or call
  `fetch` throws immediately with a `"forbidden"` error.
- **When to use:** all tests that do not need real filesystem writes, real processes,
  or network. The default lane for new code.

### integration — `*.int.test.ts`

- **Purpose:** tests that need real filesystem operations (temp directories, file
  writes, reads). No network allowed by convention.
- **Glob:** `tests/**/*.int.test.ts`, `packages/**/*.int.test.ts`
- **Hermetic:** no guard loaded. Real filesystem access is permitted.
- **When to use:** tests that exercise file persistence, directory scanning, or other
  local I/O that cannot be meaningfully mocked.

### conformance-mock — `*.conformance.test.ts`

- **Purpose:** provider conformance suites running against mock drivers. Each provider
  contract has a conformance suite here that verifies all required behaviors using
  mocks — no real processes or network permitted.
- **Glob:** `tests/**/*.conformance.test.ts`, `packages/**/*.conformance.test.ts`
- **Hermetic:** yes — the same zero-real-process guard as `unit`.
- **When to use:** any test that verifies a provider contract using a mock driver.
  Future home of incident-replay harnesses (deterministic replays of recorded
  real-driver sequences).
- **Adversarial mock rule:** mocks that omit, delay, corrupt, or contradict required
  signals must cause the suite to fail. Mock success alone is not conformance.

### smoke-real — `*.smoke.test.ts`

- **Purpose:** end-to-end smoke tests against real processes and network. The only
  lane permitted to spawn processes or make real network calls.
- **Glob:** `tests/**/*.smoke.test.ts`, `packages/**/*.smoke.test.ts`
- **Hermetic:** no guard. Real processes and network are permitted.
- **Excluded from `pnpm check`:** this lane does not run locally or in the required
  `check` CI job. It runs only in the gated CI `smoke` job.
- **When to use:** real-driver smoke tests; the egress negative-probe (confirming
  the containment helper blocks forbidden calls); live approval and resume checks.
- **Status:** inert until real drivers and the native containment helper land. All
  tests currently pass via `passWithNoTests: true`.

## Summary Table

| Lane | Guard loaded | Real FS | Real network / process | In `pnpm check` |
|---|---|---|---|---|
| `unit` | yes | no | no | yes |
| `integration` | no | yes | no | yes |
| `conformance-mock` | yes | no | no | yes |
| `smoke-real` | no | yes | yes | no (CI-only) |

## The Zero-Real-Process Guard

**File:** `tooling/no-side-effects.setup.ts`

The guard is a Vitest `setupFiles` entry loaded by the `unit` and `conformance-mock`
lanes. It installs module-level `vi.mock` factories for Node builtins and a
`beforeEach` `vi.stubGlobal` replacement for `fetch`. The following APIs throw an
error containing the word `"forbidden"`:

- **`child_process`:** `spawn`, `exec`, `execFile`, `fork`, `spawnSync`, `execSync`,
  `execFileSync`
- **`node:net`:** `connect`, `createConnection`, `createServer`
- **`node:http`:** `request`, `get`
- **`node:https`:** `request`, `get`
- **global `fetch`**

The built-in stubs use `vi.mock` because ESM namespace exports are non-configurable;
`fetch` uses `vi.stubGlobal`. The error message identifies both the forbidden API and
the lane context, making failures self-diagnosing.

The guard is package-agnostic infrastructure. It applies to whatever packages design
owners add later — placing tests in the correct lane is the only configuration needed.

## Test Placement Guide

| Test type | Lane |
|---|---|
| Pure logic, utilities, data transforms | `unit` |
| File I/O, directory operations | `integration` |
| Provider contract conformance (mock drivers) | `conformance-mock` |
| Incident replay (recorded sequences, mock) | `conformance-mock` |
| Real-driver smoke, egress probe, live approval | `smoke-real` |

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Engineering Policy Index](./README.md) · **← Prev:** [Dependency Rule Enforcement](./dependency-rule-enforcement.md) · **Next →:** [Testing Policy](./testing-policy.md)

<!-- /DOCS-NAV -->
