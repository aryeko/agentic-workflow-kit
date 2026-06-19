---
title: "prov-01 — Agent contract + mock — implementation charter"
id: "prov-01-contract"
wave: 2
layer: "contracts (providers)"
status: "item: ready"
spec: "docs/design/domains/providers/prov-01-agent-execution/"
---

# prov-01 — Agent contract + mock

**Purpose.** The seam for the rented worker: the model/session protocol, approval relay, structured
tool-exit, and normalized progress events — plus a mock agent. Contract + mock only; the real Codex
driver is the driver track.

**Spec (normative).** Implement the contract + capability set from
`docs/design/domains/providers/prov-01-agent-execution/`. Normalized worker-event shapes, the
approval-relay protocol, and structured tool-exit are normative.

## Responsibilities (in scope)

- The Agent contract: start/resume a session against an Execution Host; relay approval requests/answers;
  emit normalized progress + structured tool-exit events.
- The capability set (`canRelayApproval`, `emitsStructuredToolExit`, attestation).
- A **mock agent** with adversarial cases (omits progress, delays, lies about tool-exit, never asks for
  approval it should) + conformance cases.

## Out of scope

*Where* the worker runs (prov-04 — referenced, not implemented here); the real Codex app-server driver
(driver track); approval *adjudication* (core-03).

## Requirements owned

The contract side of FR-3/FR-4/FR-5 (worker progress/approval); NFR-EXT, NFR-TEST; **plus prov-01
contract spec compliance.**

## Dependencies & frozen contracts

Depends on the prov-04 contract (runs on a host), fnd-04 (scoped creds), w2-1. Consumed by
core-02/03/04/06.

## Libraries

`zod`, conformance-kit, `fast-check`. **No Codex SDK / app-server, no real process** (driver track).

## Required reading

This domain's spec (`README.md` + sibling aspect files); the prov-04 contract item; `dependency-policy.md`; `testing-policy.md`; w2-1.

## Deliverable

The Agent contract package + mock agent, passing the conformance kit.

## Definition of done

- *Spec compliance:* contract + normalized events + approval relay + tool-exit match the design; the
  capability set matches the attestation model.
- *Quality bar:* the mock passes the kit; adversarial agents (omit/delay/lie/silent-on-approval) are
  caught/fail-closed as specified; `conformance-mock` lane; `pnpm check` green.

## Boundaries

Contract + mock only; references the prov-04 contract, never a real host. If the agent/host contract
boundary is ambiguous, **STOP and surface** (don't fold host concerns into the agent seam).
