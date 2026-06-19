---
title: "w0-4 — Implementation policies — implementation charter"
id: "w0-4"
wave: 0
layer: "foundation-docs"
status: "item: ready"
spec: "docs/reviews/2026-06-19-infra-tooling-framework-research.md"
---

# w0-4 — Implementation policies

**Purpose.** Translate the architecture's invariants into concrete implementation rules every later
wave (and every Codex worker) follows — the written guardrail behind the depcruise enforcement.

## Scope — two docs

### `docs/foundation/dependency-policy.md`
- The **library placement matrix** (from the
  [infra-tooling research](../../../../reviews/2026-06-19-infra-tooling-framework-research.md)).
- **Explicit constructor/factory injection; no DI container in core.** Awilix only ever at the
  composition root, if at all (default: not at all).
- **Clock / id / randomness are injected ports** — no ambient `Date.now`/`Math.random`. This is a
  determinism rule (NFR-DET), not a style preference.
- A **`Result<T,E>` discipline** for core decision functions (typed failures, no silent throws). State
  the default (hand-rolled discriminated unions vs a library) and the tripwire to revisit.
- The **schema-ownership model**: contract-owned for seam payloads, foundation-owned for
  config/policy/event-envelope/artifacts, driver-owned for evidence/probes. Seam payload schemas must
  be JSON-Schema-representable (Zod `toJSONSchema`).
- The **per-library acceptance checklist**: placement, why it reduces code/risk, the boundary it sits
  behind, mock/test strategy, depcruise guard, security/observability implications.
- **octokit as the worked example** of "SDK behind a seam": REST+GraphQL, evidence-DTO mapping, token
  via fnd-04, schema-pinned conformance, dies at the driver boundary (no SDK type crosses the seam).

### `docs/foundation/testing-policy.md`
- When each lane is required (unit / integration / conformance / smoke).
- **Property tests (fast-check) required for**: core state-machine reducers, capability-gate
  predicates, replay/projection equivalence, fail-closed branches.
- The **provider conformance bar**: schema probes, real smoke, adversarial mocks that must *fail* the
  kit.
- Coverage targets (per `AGENTS.md`).

## Out of scope

Installing libraries; the depcruise rules themselves (w0-3 — the two must agree).

## Requirements owned

NFR-DET, NFR-TEST, NFR-SOLID, NFR-SEC (redaction/credential rules in logs).

## Required reading

The [infra-tooling research](../../../../reviews/2026-06-19-infra-tooling-framework-research.md);
`architecture.md`; `decisions.md` (AD-2, AD-3, AD-6, AD-10); `conventions.md`; w0-3's package map.

## Deliverable

The two policy docs, each linkable from work-item charters.

## Definition of done

- *Spec compliance:* the placement matrix matches w0-3's package-name bans exactly (no rule in one doc
  that the other contradicts); the determinism + schema-ownership + DI stances are stated
  unambiguously.
- *Quality bar:* a worker can decide "may I add/import library X here?" and "what tests must this item
  have?" from these docs alone; `pnpm check` green.

## Boundaries

Policy, not code. If a policy decision is genuinely open (e.g., Result library vs hand-rolled), state
the default + the tripwire — do not leave it undecided.
