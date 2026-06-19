# Testing policy

## Required lanes

| Lane | Purpose |
|---|---|
| Unit | Pure SDK logic, provider mapping logic, reducers, predicates. |
| Integration | SDK with in-memory ports and mock providers. |
| Conformance | Provider packages and testkit mocks against SDK provider interfaces. |
| Smoke | Real provider paths with external systems, gated separately. |

## Core rule

SDK tests must run without real processes, network, credentials, GitHub, Codex, or filesystem mutation unless the test is explicitly an integration over local in-memory/temp ports.

## Provider rule

Provider packages need conformance tests for positive, negative, missing, stale, delayed, and contradictory evidence.
