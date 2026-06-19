---
title: "Wave 0 — Truth & Substrate"
wave: 0
status: "wave: ready"
depends-on-waves: []
delivers-as: "single PR into v-next"
last-updated: 2026-06-19
---

# Wave 0 — Truth & Substrate  (the gate)

**Goal.** Make the design corpus internally consistent and frozen, decide and scaffold the package
decomposition, turn the Dependency Rule into machine-enforced CI, and write the implementation
policies — so every later wave builds on a stable, self-consistent, mechanically guarded base.
**No production code in this wave.**

**Why first.** Operator-confirmed: *Wave 0 gates everything.* It absorbs every confirmed finding from
the two 2026-06-19 Codex reviews (repo-review + infra-tooling-research). Build waves start only once it
lands.

**Frozen inputs.** The approved design corpus (`docs/design/**`); the two review reports as the finding
source.

## Work items (one commit each; Codex plans the agent delegation)

- [w0-1 — Design-spec reconciliation](./items/w0-1-design-spec-reconciliation.md) — close the real
  contract/design defects (credential+egress seam, token casing, core-05 order, core-01/07
  clarifications, remote-seam wording, catalog/frontmatter sync).
- [w0-2 — Governance & doc truth](./items/w0-2-governance-and-doc-truth.md) — rewrite stale
  root/governance docs and templates for kit-vnext so they don't misdirect contributors or workers.
- [w0-3 — Package decomposition & dependency-rule activation](./items/w0-3-package-decomposition-and-dependency-rules.md)
  — the package map + dependency-cruiser layer rules + package-name SDK bans.
- [w0-4 — Implementation policies](./items/w0-4-implementation-policies.md) — `dependency-policy.md`
  + `testing-policy.md` that every later charter cites.
- [w0-5 — Implementation readiness tracker](./items/w0-5-readiness-tracker.md) — the design-approved
  vs conformance-ready matrix per domain/driver.

## Scope & boundaries

- *In:* design-corpus reconciliation, governance docs, tooling/CI config, policy docs, the package map.
- *Out:* any package implementation; any runtime-library install (decisions only); anything a build
  wave owns.
- The package map and dependency-cruiser rules are **decided and committed** here; packages are
  *created* by the wave that implements them, against rules that already exist.

## Wave Definition of done

- *Spec compliance:* the design corpus is internally consistent — no contradiction between
  `decisions.md`, `architecture.md`, the catalog, and domain bodies; every reconciliation in w0-1 is
  reflected in the affected `design.md`.
- *Quality bar:* `pnpm check` green (incl. the new dependency-cruiser rules); no stale legacy reference
  remains in tracked governance docs; policies + package map reviewed and frozen.

## Wave checklist

- [ ] w0-1: credential/egress seam closed; tokens normalized or exceptions ratified; core-05→core-03
      order fixed; core-01/core-07 clarifications landed; remote-seam wording aligned to AD-13;
      catalog ↔ frontmatter ↔ body in sync.
- [ ] w0-2: README/CONTRIBUTING/SECURITY rewritten; Dependabot `target-branch: v-next`; issue/PR
      templates updated; roadmap refreshed; zero-process-guard + workspace docs match reality.
- [ ] w0-3: package map documented; dependency-cruiser layer rules + package-name SDK bans committed
      and green (proven by a temporary violation fixture that fails, then is removed).
- [ ] w0-4: `dependency-policy.md` + `testing-policy.md` written and linkable from work-item charters.
- [ ] w0-5: readiness matrix published; `status:` semantics clarified corpus-wide.
- [ ] `pnpm check` green on the wave branch; no out-of-scope code.
- [ ] PR opened against `v-next`.

## Out of scope / deferred

Any package implementation; any library install; the readiness *of* drivers (tracked, not produced,
here).
