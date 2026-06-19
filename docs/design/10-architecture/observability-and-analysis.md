# Observability and analysis

Analysis auto-fires on terminal, blocked, supervision-lost, stale-progress, and recovery transitions.

```mermaid
flowchart LR
  Event["Trigger event"] --> Analyzer["Pure analyzer"]
  EventLog["Event log + projections"] --> Analyzer
  Analyzer -->|success| Recorded["AnalysisRecorded"]
  Analyzer -->|failure| Failed["AnalysisFailed"]
  Recorded --> EventLog
  Failed --> EventLog
```

## Metric honesty

Metrics are `available`, `partial`, or `unavailable`. Unavailable is never coerced to zero.
