---
title: Epic R1 - stories
epic: "r1"
status: "stories: ready"
last-reviewed: "2026-06-25"
---

# Epic R1 Stories

Epic R1's two forward-fix story contracts are ready for the `plan-delivery` handoff.

| story id | status | one-line job |
|---|---|---|
| `fnd-04-r1-required-attester-source` | `story: ready` | Drop runtime-only `platform`/`driverVersion`/`runtimeMetadataAvailable` from `RequiredAttester` and fix the release-match to match on `driverId`/`scopeDigest`/`egressPolicyDigest` (finding #7; #5/#6/#8/#9 verified already closed in delivered code). |
| `core-01-r1-create-run-requested-by` | `story: ready` | Add top-level required `requestedBy` to `CreateRunInput`, sourcing `RunCreatedPayload.requestedBy`. |

Gate-1 handoff: 2 of 2 stories are `story: ready`; the DAG is `story-dag: frozen`. This epic claims zero
new Story Group Signals (forward-fix of delivered code; coverage rollup unchanged). Next stage:
`plan-delivery`.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic R1 - Delivered-code closure remediation](../README.md) · **← Prev:** [Epic R1 Execution Tracker](../execution/tracker.md) · **Next →:** [core-01-r1-create-run-requested-by - source CreateRunInput.requestedBy on the run-creation seam](./core-01-r1-create-run-requested-by.md)

**Children:** [core-01-r1-create-run-requested-by - source CreateRunInput.requestedBy on the run-creation seam](./core-01-r1-create-run-requested-by.md) · [fnd-04-r1-required-attester-source - drop runtime-only RequiredAttester facts and fix release-match](./fnd-04-r1-required-attester-source.md)

<!-- /DOCS-NAV -->
