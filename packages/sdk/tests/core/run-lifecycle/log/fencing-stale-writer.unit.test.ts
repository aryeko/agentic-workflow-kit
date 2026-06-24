import { describe, expect, it } from 'vitest';

import { appendIntent, createHarness, expectFailureCode, runId } from './test-support.js';

describe('RunWriter fencing', () => {
  it('rejects a writer whose bound lease no longer fences current without appending', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    const staleLease = harness.acquireLease();
    harness.supersedeLease();
    const writer = harness.log.openWriter(runId, staleLease);
    expect(writer.ok).toBe(true);
    harness.resetAppendCalls();

    const result = writer.ok ? writer.value.append([appendIntent('SiblingFact', { ok: true })]) : writer;

    expectFailureCode(result, 'stale-writer-fenced');
    expect(harness.appendCalls).toHaveLength(0);
  });

  it('rejects a writer whose lease expires after the initial fence before storage append', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    const lease = harness.acquireLease();
    const writer = harness.log.openWriter(runId, lease);
    expect(writer.ok).toBe(true);
    const originalFence = harness.leaseStore.fence;
    let fenceCalls = 0;
    harness.leaseStore.fence = (name, epoch, token) => {
      fenceCalls += 1;
      return fenceCalls === 1 && originalFence(name, epoch, token);
    };
    harness.resetAppendCalls();

    const result = writer.ok ? writer.value.append([appendIntent('SiblingFact', { ok: true })]) : writer;

    expectFailureCode(result, 'stale-writer-fenced');
    expect(harness.appendCalls).toHaveLength(0);
  });

  it('rejects an intent carrying a mismatched writer epoch before appending', () => {
    const harness = createHarness();
    harness.seedCreatedRun();
    const lease = harness.acquireLease();
    const writer = harness.log.openWriter(runId, lease);
    expect(writer.ok).toBe(true);

    const result = writer.ok
      ? writer.value.append([appendIntent('SiblingFact', { ok: true }, { writerEpoch: lease.epoch + 1 })])
      : writer;

    expectFailureCode(result, 'stale-writer-fenced');
    expect(harness.appendCalls).toHaveLength(0);
  });
});
