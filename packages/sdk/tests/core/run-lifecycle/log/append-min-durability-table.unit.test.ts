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

describe('RunWriter minimum durability validation', () => {
  it('rejects a terminal lifecycle transition requested as durable even with a barrier sibling', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
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
    for (const [sequence, from, to] of states) {
      const envelope = makeEnvelope(sequence, 'RunLifecycleTransitioned', lifecyclePayload(from, to));
      harness.records.push({
        sequence,
        writerEpoch: 1,
        leaseName: `run-writer:${runId}`,
        payloadLength: 1,
        payloadDigest: `seed:${sequence}`,
        frameDigest: `seed-frame:${sequence}`,
        byteRange: { start: sequence, end: sequence + 1 },
        payload: encoder.encode(JSON.stringify(envelope)),
      });
    }
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    const result = writer.ok
      ? writer.value.append([
          appendIntent('SiblingBarrierFact', { barrier: true }, { durability: 'barrier' }),
          appendIntent('RunLifecycleTransitioned', lifecyclePayload('settling', 'completed', { terminal: true }), {
            durability: 'durable',
          }),
        ])
      : writer;

    expectFailureCode(result, 'durability-insufficient');
    expect(harness.appendCalls).toHaveLength(1);
    expect(harness.appendCalls[0].batch.durability).toBe('durable');
    expect(harness.appendCalls[0].envelopes[0].type).toBe('RunAppendRejected');
    expect(harness.appendCalls[0].envelopes[0].payload).toMatchObject({
      attemptedType: 'RunLifecycleTransitioned',
      failureCode: 'durability-insufficient',
    });
  });
});
