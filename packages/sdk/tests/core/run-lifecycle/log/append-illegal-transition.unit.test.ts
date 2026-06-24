import { describe, expect, it } from 'vitest';

import { appendIntent, createHarness, expectFailureCode, lifecyclePayload, runId } from './test-support.js';

const storageFailure = (code: 'stale-writer-fenced' | 'log-interior-corrupt' | 'network-fs-degraded') => ({
  code,
  message: `storage:${code}`,
  health:
    code === 'log-interior-corrupt'
      ? ('log-interior-corrupt' as const)
      : code === 'network-fs-degraded'
        ? ('network-fs-degraded' as const)
        : ('ok' as const),
});

describe('RunWriter lifecycle validation', () => {
  it('returns illegal-lifecycle-transition and authors RunAppendRejected while writable', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    const result = writer.ok
      ? writer.value.append([
          appendIntent('RunLifecycleTransitioned', lifecyclePayload('created', 'running'), {
            durability: 'durable',
          }),
        ])
      : writer;

    expectFailureCode(result, 'illegal-lifecycle-transition');
    expect(harness.appendCalls).toHaveLength(1);
    expect(harness.appendCalls[0].batch.durability).toBe('durable');
    expect(harness.appendCalls[0].envelopes).toHaveLength(1);
    expect(harness.appendCalls[0].envelopes[0].type).toBe('RunAppendRejected');
    expect(harness.appendCalls[0].envelopes[0].durability).toBe('durable');
    expect(harness.appendCalls[0].envelopes[0].payload).toMatchObject({
      failureCode: 'illegal-lifecycle-transition',
    });
  });

  it('rejects malformed lifecycle transition payloads before committing them', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    if (!writer.ok) {
      throw new Error('expected writer');
    }

    const policy = writer.value.append([
      appendIntent(
        'RunPolicyBound',
        {
          policyDigest: 'sha256:policy',
          provenanceRef: 'artifact://policy',
        },
        { eventId: 'evt-policy', durability: 'barrier' },
      ),
    ]);
    expect(policy.ok).toBe(true);
    harness.resetAppendCalls();

    const result = writer.value.append([
      appendIntent(
        'RunLifecycleTransitioned',
        {
          from: 'created',
          to: 'configured',
          sourceEventIds: ['RunPolicyBound:evt-policy'],
        },
        {
          durability: 'barrier',
        },
      ),
    ]);

    expectFailureCode(result, 'illegal-lifecycle-transition');
    expect(
      harness.records
        .map((record) => harness.decode(record.payload))
        .filter((envelope) => envelope.type === 'RunLifecycleTransitioned')
        .map((envelope) => (envelope.payload as { to?: string }).to),
    ).not.toContain('configured');
    expect(harness.appendCalls).toHaveLength(1);
    expect(harness.appendCalls[0].envelopes[0].type).toBe('RunAppendRejected');
  });

  it('returns storage failure when RunAppendRejected cannot be durably authored', () => {
    for (const fixture of [
      { storageCode: 'log-interior-corrupt' as const, expectedCode: 'interior-corrupt' as const },
      { storageCode: 'network-fs-degraded' as const, expectedCode: 'event-log-unavailable' as const },
      { storageCode: 'stale-writer-fenced' as const, expectedCode: 'stale-writer-fenced' as const },
    ]) {
      const harness = createHarness({
        appendOutcomes: [storageFailure(fixture.storageCode)],
      });
      harness.seedCreatedRun();
      const writer = harness.log.openWriter(runId, harness.acquireLease());
      expect(writer.ok).toBe(true);

      const result = writer.ok
        ? writer.value.append([
            appendIntent('RunLifecycleTransitioned', lifecyclePayload('created', 'running'), {
              durability: 'durable',
            }),
          ])
        : writer;

      expectFailureCode(result, fixture.expectedCode);
      if (!result.ok) {
        expect(result.error.rejection).toBeUndefined();
      }
      expect(harness.records.map((record) => harness.decode(record.payload).type)).not.toContain('RunAppendRejected');
    }
  });

  it('rejects lifecycle source refs that do not name a committed event', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    const result = writer.ok
      ? writer.value.append([
          appendIntent(
            'RunLifecycleTransitioned',
            lifecyclePayload('created', 'configured', {
              sourceEventIds: ['RunPolicyBound:missing'],
            }),
            {
              durability: 'barrier',
            },
          ),
        ])
      : writer;

    expectFailureCode(result, 'illegal-lifecycle-transition');
    expect(harness.appendCalls[0].envelopes[0].type).toBe('RunAppendRejected');
  });

  it('accepts raw source event ids before falling back to typed shorthand', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    if (!writer.ok) {
      throw new Error('expected writer');
    }

    const policy = writer.value.append([
      appendIntent(
        'RunPolicyBound',
        {
          policyDigest: 'sha256:policy',
          provenanceRef: 'artifact://policy',
        },
        { eventId: 'RunPolicyBound:evt-policy', durability: 'barrier' },
      ),
    ]);
    expect(policy.ok).toBe(true);
    harness.resetAppendCalls();

    const result = writer.value.append([
      appendIntent(
        'RunLifecycleTransitioned',
        lifecyclePayload('created', 'configured', {
          sourceEventIds: ['RunPolicyBound:evt-policy'],
        }),
        {
          durability: 'barrier',
        },
      ),
    ]);

    expect(result.ok).toBe(true);
    expect(harness.appendCalls[0].envelopes[0].type).toBe('RunLifecycleTransitioned');
  });

  it('accepts opaque source event ids that resolve to committed factual events', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    if (!writer.ok) {
      throw new Error('expected writer');
    }

    const policy = writer.value.append([
      appendIntent(
        'RunPolicyBound',
        {
          policyDigest: 'sha256:policy',
          provenanceRef: 'artifact://policy',
        },
        { eventId: 'evt-policy', durability: 'barrier' },
      ),
    ]);
    expect(policy.ok).toBe(true);
    harness.resetAppendCalls();

    const result = writer.value.append([
      appendIntent(
        'RunLifecycleTransitioned',
        lifecyclePayload('created', 'configured', {
          sourceEventIds: ['evt-policy'],
        }),
        {
          durability: 'barrier',
        },
      ),
    ]);

    expect(result.ok).toBe(true);
    expect(harness.appendCalls[0].envelopes[0].type).toBe('RunLifecycleTransitioned');
  });

  it('rejects evidence-constrained transitions that cite non-evidence events', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    harness.seedLifecycle('configured', 3);
    harness.seedLifecycle('task-snapshotted', 4);
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    if (!writer.ok) {
      throw new Error('expected writer');
    }

    const result = writer.value.append([
      appendIntent(
        'RunLifecycleTransitioned',
        lifecyclePayload('task-snapshotted', 'workspace-ready', {
          sourceEventIds: ['evt-created-transition'],
        }),
      ),
    ]);

    expectFailureCode(result, 'illegal-lifecycle-transition');
    expect(harness.appendCalls[0].envelopes[0].type).toBe('RunAppendRejected');
  });

  it('accepts evidence-constrained transitions that cite concrete evidence events', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    harness.seedLifecycle('configured', 3);
    harness.seedLifecycle('task-snapshotted', 4);
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    if (!writer.ok) {
      throw new Error('expected writer');
    }

    const evidence = writer.value.append([
      appendIntent('WorkspacePreparedEvidence', { workspaceRef: 'workspace://ready' }, { eventId: 'evt-workspace' }),
    ]);
    expect(evidence.ok).toBe(true);
    harness.resetAppendCalls();

    const result = writer.value.append([
      appendIntent(
        'RunLifecycleTransitioned',
        lifecyclePayload('task-snapshotted', 'workspace-ready', {
          sourceEventIds: ['evt-workspace'],
        }),
      ),
    ]);

    expect(result.ok).toBe(true);
    expect(harness.appendCalls[0].envelopes[0].type).toBe('RunLifecycleTransitioned');
  });

  it('rejects running transitions that cite observer-only session links', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    harness.seedLifecycle('configured', 3);
    harness.seedLifecycle('task-snapshotted', 4);
    harness.seedLifecycle('workspace-ready', 5);
    harness.seedLifecycle('worker-starting', 6);
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    if (!writer.ok) {
      throw new Error('expected writer');
    }

    const observer = writer.value.append([
      appendIntent(
        'SessionLinked',
        {
          linkOrdinal: 1,
          sessionId: 'session-observer',
          linkRole: 'observer',
          startedAt: '2026-06-23T12:02:00.000Z',
          sourceEventId: 'evt-observer-source',
        },
        { eventId: 'evt-observer-session', durability: 'barrier' },
      ),
    ]);
    expect(observer.ok).toBe(true);
    harness.resetAppendCalls();

    const result = writer.value.append([
      appendIntent(
        'RunLifecycleTransitioned',
        lifecyclePayload('worker-starting', 'running', {
          sourceEventIds: ['evt-observer-session'],
        }),
      ),
    ]);

    expectFailureCode(result, 'illegal-lifecycle-transition');
    expect(harness.appendCalls[0].envelopes[0].type).toBe('RunAppendRejected');
  });

  it('rejects policy cancellations without a committed policy decision event', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    harness.seedLifecycle('running', 3);
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    if (!writer.ok) {
      throw new Error('expected writer');
    }

    const evidence = writer.value.append([
      appendIntent('CancellationEvidence', { reason: 'policy-cancel-requested' }, { eventId: 'evt-cancel-evidence' }),
    ]);
    expect(evidence.ok).toBe(true);
    harness.resetAppendCalls();

    const result = writer.value.append([
      appendIntent(
        'RunLifecycleTransitioned',
        lifecyclePayload('running', 'canceled', {
          authority: 'policy',
          sourceEventIds: ['evt-cancel-evidence', 'PolicyDecision:missing'],
          terminal: true,
        }),
        {
          durability: 'barrier',
        },
      ),
    ]);

    expectFailureCode(result, 'illegal-lifecycle-transition');
    expect(harness.appendCalls[0].envelopes[0].type).toBe('RunAppendRejected');
  });

  it('rejects non-policy cancellations that cite policy decisions', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    harness.seedLifecycle('running', 3);
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    if (!writer.ok) {
      throw new Error('expected writer');
    }

    const evidence = writer.value.append([
      appendIntent('CancellationEvidence', { reason: 'policy-cancel-requested' }, { eventId: 'evt-cancel-evidence' }),
      appendIntent('PolicyDecision', { decision: 'cancel' }, { eventId: 'evt-policy-decision' }),
    ]);
    expect(evidence.ok).toBe(true);
    harness.resetAppendCalls();

    const result = writer.value.append([
      appendIntent(
        'RunLifecycleTransitioned',
        lifecyclePayload('running', 'canceled', {
          authority: 'system',
          sourceEventIds: ['evt-cancel-evidence', 'evt-policy-decision'],
          terminal: true,
        }),
        {
          durability: 'barrier',
        },
      ),
    ]);

    expectFailureCode(result, 'illegal-lifecycle-transition');
    expect(harness.appendCalls[0].envelopes[0].type).toBe('RunAppendRejected');
  });
});
