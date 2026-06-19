---
title: "Agent Execution - mock driver"
status: draft
last-reviewed: "2026-06-18"
---

# Mock driver

The mock Agent driver is a programmable adversarial simulator for the Agent contract. It is not a
loose fake; it must implement the same interface, capability attestations, event types, answer
channel rules, and failure modes as a real driver.

## Scenario model

```ts
interface MockAgentScenario {
  scenarioId: string;
  capabilities: Record<AgentCapability, "positive" | "negative">;
  start: {
    providerSessionId?: string;
    ownershipClass: "owned" | "owned-remote" | "observe-only";
    linkDelayMs?: number;
  };
  events: MockAgentStep[];
  answerRules?: Record<string, MockAnswerRule>;
}

type MockAgentStep =
  | { atMs: number; emit: "linked"; providerSessionId: string }
  | { atMs: number; emit: "progress"; message: string }
  | { atMs: number; emit: "approval-requested"; request: AgentApprovalRequest }
  | { atMs: number; emit: "tool-observed"; tool: Partial<ToolObserved> }
  | { atMs: number; emit: "guardian-review"; review: Partial<GuardianReviewObserved> }
  | { atMs: number; emit: "terminal"; reason: AgentTerminalReason }
  | { atMs: number; emit: "drop-connection" }
  | { atMs: number; emit: "contradiction"; field: string; first: unknown; second: unknown };

interface MockAnswerRule {
  accepts: ScopedGrantKind[];
  persistable: boolean;
  dropAnswer?: boolean;
  mutateResponse?: unknown;
}
```

Scenarios are deterministic: time advances through a test clock, not real sleep. Every emitted event
includes the configured driver version, platform, freshness key, and evidenceRef so capability tests
can replay exactly why a gate opened or stayed closed.

## Required fixtures

Fixture specs are recorded in `../evidence/2026-06-18-mock-adversarial-fixtures.jsonl`.

| Fixture | Mock behavior | Expected normalized result |
|---|---|---|
| `dropped-approval` | Emits `approval-requested`, then drops or rejects the answer. | `approval-answer-channel-lost`; run parks. |
| `lost-linkage` | Emits progress/terminal without a stable `linked` event, or changes session id mid-run. | `agent-linkage-lost`; no resume or approval answer. |
| `no-exit-code` | Emits a command item with output but null/missing exit code. | `structured-tool-exit-missing`; no `ToolObserved`. |
| `claim-without-evidence` | Emits success prose and terminal completed without tool/git/evidence events. | Worker claim is ignored by gates; completion remains unverified. |

Additional adversarial switches:

- delay any event beyond liveness timeout;
- emit duplicate `linked` or duplicate `terminal`;
- emit a command with `source != "agent"`;
- provide raw output without `outputRef`;
- emit Guardian `approved` with no target item;
- attest a capability with wrong freshness key or expired scope;
- claim parentage while the host says `observe-only`.

## Conformance role

Core tests use the mock with zero real processes and zero network. For every Control plane behavior
that consumes Agent events, there must be at least one positive mock scenario and one adversarial
scenario. The mock must also replay captured real incidents as immutable JSONL fixtures so a future
Codex driver regression can be reproduced without launching Codex.

The mock is considered conformant only when:

- its schema accepts every Agent event and failure reason in the contract;
- its positive paths produce the same event order a real driver must produce;
- every named degraded mode can be forced independently;
- it can lie about capabilities and signals, and Capability & Safety still fails closed;
- fixture replay is deterministic by scenario id and seed.
