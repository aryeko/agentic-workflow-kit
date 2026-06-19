---
title: "w0-1 — Design-spec reconciliation — implementation charter"
id: "w0-1"
wave: 0
layer: "design-corpus"
status: "item: ready"
spec: "docs/design/** (the corpus being reconciled)"
---

# w0-1 — Design-spec reconciliation

**Purpose.** Close the real contract/design defects the 2026-06-19 reviews confirmed, so the corpus is
internally consistent before any code is written against it.

## Scope (the confirmed defects)

- **Credential + egress seam (HIGH).** `fnd-04` expects config to supply credential references +
  egress policy, but `fnd-01`'s `PolicyLayer` disclaims them. Add credential-ref + egress-policy source
  fields to fnd-01's policy schema *(architect's lean — preferred)*, or revise fnd-04 — and reflect the
  decision in **both** design.md files.
- **Core public token casing.** Conventions require kebab-case state/reason/error tokens; several core
  contracts use snake_case. Normalize to kebab-case across the core design.md files, or record an
  explicit ratified exception. Tokens persist in the event log — fix before core-01 is coded.
- **core-05 → core-03 order.** The domain catalog implies core-05 is parallel after core-01/02; it
  actually consumes core-03 approval events. Make the dependency explicit in the catalog.
- **core-01 FR-1 ownership + core-07 NFR-OBS exception.** Resolve the internal inconsistencies (FR-1
  ownership vs the owned-requirements list; the terminal-analysis invariant's exception for
  corrupt/unwritable logs).
- **Remote-seam wording.** `docs/design/README.md` says remote execution sits behind the *Agent* seam;
  AD-13 assigns it to the *Execution Host* seam. Align the README to AD-13.
- **Catalog ↔ frontmatter ↔ body sync.** Reconcile the dependency disagreements (prov-03, fnd-03,
  fnd-04; missing fnd-04 dependencies on provider domains that consume credentials).

## Out of scope

Any code; provider evidence path fixes (tracked in w0-5 / driver waves); changing frozen invariants or
seam semantics — these are *consistency* fixes, not redesigns.

## Requirements owned

Corpus internal consistency; AD-1..AD-14 remain authoritative (this item makes the corpus *match* them).

## Required reading

Both 2026-06-19 review reports; `decisions.md`; `architecture.md`; the affected domain design.md files;
`conventions.md`.

## Deliverable

Edited `design.md` / catalog / README files such that the corpus is self-consistent; a short
reconciliation note per fix recording what changed and why.

## Definition of done

- *Spec compliance:* every listed defect resolved in the affected file(s); no remaining contradiction
  between decisions / architecture / catalog / domain bodies; the credential/egress contract is now
  expressible end-to-end (fnd-01 supplies what fnd-04 consumes).
- *Quality bar:* a reviewer can trace each fix to its review finding; `rg` for the old contradictions
  returns clean; `pnpm check` green.

## Boundaries

Consistency only — do not redesign seams or re-decide invariants. If closing a defect would require a
genuine design change (not a wording/consistency fix), **STOP and surface** to the architect.
