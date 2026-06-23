import { describe, expect, it } from 'vitest';

import {
  appendIntent,
  createHarness,
  expectFailureCode,
  lifecyclePayload,
  makeEnvelope,
  runId,
} from './test-support.js';

const encoder = new TextEncoder();

const seedTerminal = (harness: ReturnType<typeof createHarness>) => {
  const states = [
    [3, 'created', 'configured'],
    [4, 'configured', 'task-snapshotted'],
    [5, 'task-snapshotted', 'workspace-ready'],
    [6, 'workspace-ready', 'worker-starting'],
    [7, 'worker-starting', 'running'],
    [8, 'running', 'runner-verifying'],
    [9, 'runner-verifying', 'forge-waiting'],
    [10, 'forge-waiting', 'merge-waiting'],
    [11, 'merge-waiting', 'settling'],
  ] as const;
  const terminalPayload = lifecyclePayload('settling', 'completed', {
    terminal: true,
    sourceEventIds: ['Evidence:merge'],
  });
  const terminal = makeEnvelope(12, 'RunLifecycleTransitioned', terminalPayload, {
    eventId: 'terminal-1',
    payloadDigest: `digest:${JSON.stringify(terminalPayload)}`,
    durability: 'barrier',
  });
  harness.seedCreatedRun();
  for (const [sequence, from, to] of states) {
    const envelope = makeEnvelope(sequence, 'RunLifecycleTransitioned', lifecyclePayload(from, to));
    harness.records.push({
      sequence,
      writerEpoch: 1,
      leaseName: `run-writer:${runId}`,
      payloadLength: 1,
      payloadDigest: envelope.payloadDigest,
      frameDigest: `seed-frame:${sequence}`,
      byteRange: { start: sequence, end: sequence + 1 },
      payload: encoder.encode(JSON.stringify(envelope)),
    });
  }
  harness.records.push({
    sequence: 12,
    writerEpoch: 1,
    leaseName: `run-writer:${runId}`,
    payloadLength: 1,
    payloadDigest: terminal.payloadDigest,
    frameDigest: 'terminal-frame',
    byteRange: { start: 12, end: 13 },
    payload: encoder.encode(JSON.stringify(terminal)),
  });
  return terminalPayload;
};

describe('RunWriter terminal idempotency', () => {
  it('reports an identical terminal lifecycle envelope as committed without a second storage append', () => {
    const harness = createHarness();
    const terminalPayload = seedTerminal(harness);
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    const result = writer.ok
      ? writer.value.append([
          appendIntent('RunLifecycleTransitioned', terminalPayload, {
            eventId: 'terminal-1',
            durability: 'barrier',
          }),
        ])
      : writer;

    expect(result.ok).toBe(true);
    expect(harness.appendCalls).toHaveLength(0);
  });

  it('rejects a terminal re-append with a different event id or digest as illegal lifecycle mutation', () => {
    const harness = createHarness();
    const terminalPayload = seedTerminal(harness);
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    const result = writer.ok
      ? writer.value.append([
          appendIntent(
            'RunLifecycleTransitioned',
            { ...terminalPayload, reason: 'different terminal evidence' },
            {
              eventId: 'terminal-2',
              durability: 'barrier',
            },
          ),
        ])
      : writer;

    expectFailureCode(result, 'illegal-lifecycle-transition');
  });

  it('rejects an identical terminal re-append when the attempted envelope epoch differs from the bound lease', () => {
    const harness = createHarness();
    const terminalPayload = seedTerminal(harness);
    const lease = harness.acquireLease();
    const writer = harness.log.openWriter(runId, lease);
    expect(writer.ok).toBe(true);

    const result = writer.ok
      ? writer.value.append([
          appendIntent('RunLifecycleTransitioned', terminalPayload, {
            eventId: 'terminal-1',
            durability: 'barrier',
            writerEpoch: lease.epoch + 1,
          }),
        ])
      : writer;

    expectFailureCode(result, 'stale-writer-fenced');
    expect(harness.appendCalls).toHaveLength(0);
  });
});
