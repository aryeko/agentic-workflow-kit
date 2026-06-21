---
title: kit-vnext — Engineering Policy Index
status: high-level design
last-reviewed: "2026-06-19"
---

# Engineering Policy

This directory holds the implementation-side policy for the kit-vnext rebuild: how
packages are verified, how dependency rules are enforced, and what the test
infrastructure requires. It is the counterpart to `docs/design/`, which owns
invariants and seam contracts.

`docs/design/` is normative for package names, allowed edges, and domain behavior.
When this directory and `docs/design/` conflict, `docs/design/` wins.

## Documents

| File | Contents |
|---|---|
| [check-gate.md](check-gate.md) | `pnpm check` gate — all steps, ordering rationale, CI split, smoke gating |
| [dependency-policy.md](dependency-policy.md) | Package dependency rules, SDK bans, injection and determinism policy |
| [dependency-rule-enforcement.md](dependency-rule-enforcement.md) | How dependency-cruiser and TypeScript project references enforce the rules |
| [test-lanes.md](test-lanes.md) | Four Vitest lanes, hermetic guards, file-glob conventions |
| [testing-policy.md](testing-policy.md) | When each lane is required, coverage targets, evidence expectations |
| [tooling-and-ci.md](tooling-and-ci.md) | Toolchain versions, TypeScript layout, build strategy, GitHub Actions jobs |

## Relationship to `docs/design/`

The ground truth for package names and allowed dependency edges is
[docs/design/20-sdk-and-packaging/dependency-rules.md](../design/20-sdk-and-packaging/dependency-rules.md).
The files here describe how those rules are *enforced* and *verified* — they must
not be looser than the design specification.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../README.md) · **← Prev:** [Frontier 6 charter - operator surface](../implementation/frontiers/frontier-6-operator-surface/charter.md) · **Next →:** [Check Gate](./check-gate.md)

**Children:** [Check Gate](./check-gate.md) · [Dependency Policy](./dependency-policy.md) · [Dependency Rule Enforcement](./dependency-rule-enforcement.md) · [Test Lanes](./test-lanes.md) · [Testing Policy](./testing-policy.md) · [Tooling and CI](./tooling-and-ci.md)

<!-- /DOCS-NAV -->
