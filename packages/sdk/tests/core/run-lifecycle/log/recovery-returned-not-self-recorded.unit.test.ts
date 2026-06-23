import { describe, expect, it } from 'vitest';

import { appendIntent, createHarness, expectFailureCode, runId } from './test-support.js';

describe('RunWriter corrupt or unavailable replay failures', () => {
  it('returns interior-corrupt and authors no RunAppendRejected envelope', () => {
    const harness = createHarness({ replayHealth: 'log-interior-corrupt' });
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    const result = writer.ok ? writer.value.append([appendIntent('SiblingFact', { ok: true })]) : writer;

    expectFailureCode(result, 'interior-corrupt');
    expect(harness.appendCalls).toHaveLength(0);
    expect(harness.records.map((record) => harness.decode(record.payload).type)).not.toContain('RunAppendRejected');
  });

  it('returns event-log-unavailable and authors no RunAppendRejected envelope', () => {
    const harness = createHarness({ replayHealth: 'network-fs-degraded' });
    harness.seedCreatedRun();
    const writer = harness.log.openWriter(runId, harness.acquireLease());
    expect(writer.ok).toBe(true);

    const result = writer.ok ? writer.value.append([appendIntent('SiblingFact', { ok: true })]) : writer;

    expectFailureCode(result, 'event-log-unavailable');
    expect(harness.appendCalls).toHaveLength(0);
    expect(harness.records.map((record) => harness.decode(record.payload).type)).not.toContain('RunAppendRejected');
  });
});
