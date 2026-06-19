# Event log and state

The event log is the only authored run state. Projections are derived read models.

```mermaid
flowchart TB
  EventLog["Append-only run event log"] --> State["State projection"]
  EventLog --> Summary["Summary projection"]
  EventLog --> Metrics["Metrics projection"]
  EventLog --> Launch["Launch projection"]

  Domains["SDK domains"] -->|append events| EventLog
  State --> Decisions["Control decisions"]
  Summary --> Decisions
  Launch --> Decisions
```

## Invariants

- Events are append-only.
- State is never manually edited.
- Projections are pure functions of the log.
- Non-deterministic inputs enter as recorded events.
- Recovery records new events; it does not perform artifact surgery.

Full details live in [Run lifecycle and state](../30-domain-reference/core/run-lifecycle-and-state/README.md).
