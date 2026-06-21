# Track: intake

```kit-work-source
workSourceId: local-markdown
track: intake
statusBuckets:
  eligible: [ready]
  inProgress: [claimed]
  complete: [done]
  blocked: [blocked]
```

## Task WS-1: Add claim-safe task intake

```kit-task
id: WS-1
track: intake
status: ready
target:
  project: workflow-kit
specRefs:
  - kind: path
    ref: docs/kit-vnext/domains/prov-03-work-source/design.md
    label: Work Source design
dependencies: []
claim: null
```

The Work Source must list this task, treat it as eligible, and produce a TaskSnapshot when claimed.

## Task WS-2: Complete status write

```kit-task
id: WS-2
track: intake
status: blocked
target:
  project: workflow-kit
specRefs:
  - kind: path
    ref: docs/kit-vnext/domains/prov-03-work-source/design.md
    label: Work Source design
dependencies:
  - workSourceId: local-markdown
    trackId: intake
    taskId: WS-1
claim:
  runId: run-existing
  holder: evidence
  claimedAt: "2026-06-18T00:00:00Z"
  expiresAt: "2026-06-18T00:30:00Z"
  epoch: 1
```

The Work Source must keep this task ineligible until WS-1 is complete or the source-native status
mapping says the dependency is complete.

## Task WS-3: Unknown native status

```kit-task
id: WS-3
track: intake
status: mystery
target:
  project: workflow-kit
specRefs: []
dependencies: []
claim: null
```

The Work Source must map this unmapped native status to `unknown` / `status-bucket-unknown`.

## Task WS-4: Depends on unknown status

```kit-task
id: WS-4
track: intake
status: ready
target:
  project: workflow-kit
specRefs: []
dependencies:
  - workSourceId: local-markdown
    trackId: intake
    taskId: WS-3
claim: null
```

The Work Source must keep this task ineligible because WS-3 resolves to `unknown`.
