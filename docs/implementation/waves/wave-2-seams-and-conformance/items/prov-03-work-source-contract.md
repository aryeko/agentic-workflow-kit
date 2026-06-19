---
title: "prov-03 — Work Source contract + mock — implementation charter"
id: "prov-03-contract"
wave: 2
layer: "contracts (providers)"
status: "item: ready"
spec: "docs/design/domains/providers/prov-03-work-source/"
---

# prov-03 — Work Source contract + mock

**Purpose.** The seam for *where work comes from* and the **task status authority** (AD-8): task/track
inventory, eligibility, race-safe claim/release, status writes — plus a mock work source. Contract +
mock only; the real Markdown driver is the driver track.

**Spec (normative).** Implement the contract + capability set from
`docs/design/domains/providers/prov-03-work-source/`. The task/track model, eligibility, claim/release
semantics, and status-authority writes are normative.

## Responsibilities (in scope)

- The Work Source contract: list tasks/tracks; compute eligibility; **race-safe claim/release**; write
  task status (the authority).
- The capability set (`supportsClaim`, `supportsStatusWrite`, attestation).
- A **mock work source** with adversarial cases (claim race, stale status, eligibility flip) +
  conformance cases.

## Out of scope

The real Markdown driver + fixtures→executable (driver track); run-activity authority (that's the event
log, core-01 — keep the two authorities separate per FR-11); routing across projects (out of v1 scope).

## Requirements owned

The contract side of FR-1 (task intake) and FR-11 (two authorities separated); NFR-EXT, NFR-TEST;
**plus prov-03 contract spec compliance.**

## Dependencies & frozen contracts

Depends on fnd-02 (persistence for claim/status), w2-1. Consumed by core-06 and the launch/task-snapshot
path of core-01.

## Libraries

`zod`, conformance-kit, `fast-check`. **No real Markdown driver, no FS-format coupling** (driver track).

## Required reading

This domain's spec (`README.md` + sibling aspect files); `decisions.md` AD-8; `dependency-policy.md`; `testing-policy.md`; w2-1.

## Deliverable

The Work Source contract package + mock, passing the conformance kit; race-safe claim semantics
provable on the mock.

## Definition of done

- *Spec compliance:* contract + task/track model + claim/release + status-authority match the design;
  task status (this seam) and run activity (event log) never overwrite each other (FR-11).
- *Quality bar:* the mock passes the kit; claim races resolve to a single winner under property tests;
  stale-status / eligibility-flip adversarial cases handled as specified; `pnpm check` green.

## Boundaries

Contract + mock only; do not bake in the Markdown file format (that's the driver). If the
status-authority vs event-log boundary is ambiguous, **STOP and surface**.
