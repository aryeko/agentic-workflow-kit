import { describe, expect, it } from 'vitest';

import { appendIntent, createHarness, expectFailureCode, runId } from './test-support.js';

describe('RunWriter fencing property', () => {
  it('never appends from superseded writer epochs', () => {
    for (const supersedeCount of [1, 2, 3]) {
      const harness = createHarness();
      harness.seedCreatedRun();
      const staleLease = harness.acquireLease();
      for (let index = 0; index < supersedeCount; index += 1) {
        harness.supersedeLease();
      }
      const writer = harness.log.openWriter(runId, staleLease);
      expect(writer.ok).toBe(true);

      const result = writer.ok ? writer.value.append([appendIntent('SiblingFact', { supersedeCount })]) : writer;

      expectFailureCode(result, 'stale-writer-fenced');
      expect(harness.appendCalls).toHaveLength(0);
    }
  });
});
