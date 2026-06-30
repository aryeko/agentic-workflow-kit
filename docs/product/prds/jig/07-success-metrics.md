← [Back to README](./README.md)

# Success metrics

## North-star

**Percentage of runs that complete to the configured policy outcome (merged changes or
deliberate user stop) without unplanned manual intervention** — meaning the user was
interrupted only for the escalations and approvals they configured, not for environmental
failures, Jig errors, or unexpected states.

A run where the user is interrupted only for a configured escalation gate (required review,
mid-plan policy change, a story they flagged for human decision) counts as a success. A run
where they are interrupted because Jig crashed, lost state, produced a duplicate merge, or
took an unauthorized action is a failure.

## Supporting metrics

| Metric | Phase 0 target | Phase 1 target |
|---|---|---|
| Runs reaching configured policy outcome without unplanned interruption | ≥ 80% | ≥ 90% |
| Stories that reach their configured merge state with verifiable independent evidence (CI pass + all required reviews) at gate | 100% — no exception | 100% |
| Escalations that are successfully resolved from the parked state and resumed without re-running from scratch | ≥ 95% | ≥ 98% |
| Event log completeness: runs where all state transitions are recorded with no gaps | 100% | 100% |
| Anti-gaming violations: runs where an agent successfully modifies its own policy or gates mid-run | 0 | 0 |
| Credential leaks: runs where a privileged token appears in the event log, worker output, or observable artifact | 0 | 0 |
| Schema rejection at ingestion: non-conformant execution plans that were rejected before any action was taken | 100% of invalid plans | 100% of invalid plans |
| Fault isolation: blocked stories that halted only their downstream subgraph (independent stories continued) | 100% | 100% |

## Anti-metrics

Jig explicitly does **not** optimize for:

- **Speed of execution at the expense of safety guarantees.** Throughput is a policy
  choice the user makes; it is not a default or a product value. Jig executes the configured
  policy faithfully — prevention-leaning and throughput-leaning runs are both successes if
  the policy is honored.
- **LLM token or cost efficiency.** The agent worker's cost of implementation is outside
  Jig's control; Jig's job is the harness around it, not the efficiency of the work inside
  it.
- **Number of drivers shipped.** Driver breadth is a Phase 1+ concern; correctness and
  guarantee-invariance for the first driver is the Phase 0 measure. Shipping a second driver
  that silently degrades a guarantee would be a regression, not progress.
- **Minimizing human interruption at the cost of proceeding unsafely.** The goal is
  interrupting the user only for configured or real decisions — not never interrupting them.
  A system that never interrupts the user is one that is making decisions the user should be
  making.
- **Minimizing event log size.** Completeness is the requirement; pruning events to save
  storage is an anti-goal until completeness is proven.

---
Previous: [06-quality-bars](./06-quality-bars.md) · Next: [08-acceptance-criteria](./08-acceptance-criteria.md) · Up: [README](./README.md)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Jig PRD](./README.md) · **← Prev:** [Quality bars](./06-quality-bars.md) · **Next →:** [Acceptance criteria](./08-acceptance-criteria.md)

<!-- /DOCS-NAV -->
