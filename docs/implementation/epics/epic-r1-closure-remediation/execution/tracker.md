# Epic R1 Execution Tracker

Initial state for a later `$orchestrated-delivery` run. Every row projects from
`docs/implementation/epics/epic-r1-closure-remediation/story-dag.md` (`story-dag: frozen`) and its
`story: ready` source contract. All stories start `pending`; reviewer verdict, gate evidence, and commit
hash remain empty until execution.

| story id | source AC ids | wave | dependencies | status | implementer routing | reviewer routing | prompt paths | reviewer verdict | gate evidence | commit hash | blockers | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `fnd-04-r1-required-attester-source` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 | 1 | — | done | `strong-coder`; effort `high`; reasoning `elevated`; DAG floor `elevated`; rationale: fnd-04-r1 covers AC-1..AC-6 over a security-sensitive release-match + public `RequiredAttester` shape (safety boundary). | `frontier-reviewer`; effort `high`; reasoning `elevated`; DAG floor `elevated`; rationale: confirm finding #7 closed and `egress-policy-unattested` denial preserved. | implementer: `execution/prompts/fnd-04-r1-required-attester-source/implementer.md`<br>reviewer: `execution/prompts/fnd-04-r1-required-attester-source/reviewer.md` | APPROVED | pnpm check green (8/8 tasks); targeted 78 tests passed; sweep zero-matches on required.platform/driverVersion/runtimeMetadataAvailable and ambient-clock; credentials-secrets coverage: issue-egress-policy.ts 98.52%, resolve-credential.ts 100%, plan-injection.ts 97.4% | feaea36 | | Findings #5/#6/#8/#9 verified already closed in delivered code; scope is #7 only. Testkit and providers/execution-host fixtures updated as necessary coupling fixes. |
| `core-01-r1-create-run-requested-by` | AC-1, AC-2, AC-3 | 1 | — | pending | `general-coder`; effort `medium`; reasoning `standard`; DAG floor `light`; rationale: core-01-r1 covers AC-1..AC-3; additive single field on the public shared `CreateRunInput` shape. | `frontier-reviewer`; effort `medium`; reasoning `standard`; DAG floor `light`; rationale: confirm required-not-optional + single source (`input.requestedBy`). | implementer: `execution/prompts/core-01-r1-create-run-requested-by/implementer.md`<br>reviewer: `execution/prompts/core-01-r1-create-run-requested-by/reviewer.md` | | | | | — |

Done semantics: a row is `done` only after implementation is independently approved, reviewer verdict is
`APPROVED`, gate evidence is recorded, the execution run commits the approved pathset, and `commit hash`
records the real commit. Evidence conflicts resolve toward git state, `pnpm check` output, and live review
truth over worker prose or stale notes.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic R1 - Delivered-code closure remediation](../README.md) · **← Prev:** [Reviewer Prompt: fnd-04-r1-required-attester-source](./prompts/fnd-04-r1-required-attester-source/reviewer.md) · **Next →:** [Epic R1 - stories](../stories/README.md)

<!-- /DOCS-NAV -->
