---
title: "w0-5 — Implementation readiness tracker — implementation charter"
id: "w0-5"
wave: 0
layer: "tracking"
status: "item: ready"
spec: "n/a — produces the readiness matrix (both review reports)"
---

# w0-5 — Implementation readiness tracker

**Purpose.** Separate "design-approved" from "implementation/conformance-ready" — the readiness model
both reviews asked for — so `status: approved` in the design corpus is never mistaken for "the driver
works."

## Scope

- Clarify `status:` semantics corpus-wide: `approved` means **design-approved** (contract + evidence
  that it is satisfiable by a real + mock driver). Add a separate readiness axis.
- Publish a **readiness matrix** per domain and per driver with columns: design-approved · package
  implemented · mock conformance · real-driver smoke · negative/egress probes · open capability gaps ·
  runtime attestation (absent until probed).
- Seed it from the reviews' provider findings (prov-01 live approval/resume/tool-exit/parentage
  incomplete; prov-03 fixture-only; prov-04 real Local + native helper + live egress probes
  incomplete; prov-02 write-side smoke open) — as *tracked status*, not defects.

## Out of scope

Doing the conformance work (driver waves); editing design semantics (w0-1).

## Requirements owned

Readiness transparency; capability-gate honesty (evidence ≠ live capability).

## Required reading

Both review reports (the readiness / `approved`-ambiguity findings); `decisions.md` (AD-5, AD-10
capability attestation); `conventions.md` (provider evidence/conformance).

## Deliverable

A readiness-matrix doc under `docs/implementation/`; a one-line `status:` semantics clarification
applied where the corpus defines the legend.

## Definition of done

- *Spec compliance:* every provider/driver and domain appears in the matrix; `approved` is defined as
  design-approved everywhere it is used.
- *Quality bar:* the matrix is the single place to answer "is driver X safe to rely on yet?"; it is
  updated by each later wave as it lands; `pnpm check` green.

## Boundaries

Tracking only. Do not mark anything conformance-ready that has no executable evidence — fail toward
"not ready."
