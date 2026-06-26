import type { RunEventEnvelope, SupervisionTimerPolicy } from 'sdk';
import { classifyLivenessAdvance, foldLiveness, isLivenessRefreshingEvent } from 'sdk';
import { describe, expect, it } from 'vitest';

describe('core-04-s2 public sdk liveness imports', () => {
  it('imports the liveness fold surface from the sdk entrypoint', () => {
    const policy: SupervisionTimerPolicy = {
      startupMs: 120_000,
      idleMs: 900_000,
      noProgressMs: 2_700_000,
      perToolMs: 1_800_000,
      approvalSlaMs: 86_400_000,
      maxRuntimeMs: 28_800_000,
    };
    const linkedEvent: RunEventEnvelope = {
      schema: 'kit-vnext.run-event.v1',
      runId: 'run-public-01',
      eventId: 'evt-linked',
      sequence: 1,
      writerEpoch: 1,
      domain: 'Agent',
      type: 'AgentSessionLinked',
      durability: 'durable',
      occurredAt: '2026-06-25T10:00:00.000Z',
      recordedAt: '2026-06-25T10:00:00.000Z',
      payloadDigest: 'sha256:linked',
      payload: {
        sessionId: 'session-public-01',
        hostWorkerHandleId: 'worker-public-01',
      },
    };

    const classified = classifyLivenessAdvance(linkedEvent, {
      currentSessionId: 'session-public-01',
      linkage: 'known',
      linkedSessionIds: new Set(['session-public-01']),
      stableToolItemIds: new Set<string>(),
      currentWorkerHandleId: 'worker-public-01',
    });
    const projection = foldLiveness({
      runId: 'run-public-01',
      events: [linkedEvent],
      sampledAt: '2026-06-25T10:30:00.000Z',
      timerPolicy: policy,
    });

    expect(classified?.advanceClass).toBe('startup-linkage');
    expect(
      isLivenessRefreshingEvent(linkedEvent, {
        currentSessionId: 'session-public-01',
        linkage: 'known',
        linkedSessionIds: new Set(['session-public-01']),
        stableToolItemIds: new Set<string>(),
        currentWorkerHandleId: 'worker-public-01',
      }),
    ).toBe(true);
    expect(projection.projection.runId).toBe('run-public-01');
  });
});
