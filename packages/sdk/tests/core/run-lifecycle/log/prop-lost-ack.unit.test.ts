import { describe, expect, it } from 'vitest';

import { appendIntent, createHarness, runId } from './test-support.js';

describe('RunWriter lost acknowledgement recovery property', () => {
  it('replay-decides recovery over committed, absent, and conflict states', () => {
    const cases = [
      { commit: 'exact', ok: true, appendCalls: 1 },
      { commit: 'absent', ok: true, appendCalls: 2 },
      { commit: 'conflict', ok: false, appendCalls: 1 },
    ] as const;

    for (const recoveryCase of cases) {
      const harness = createHarness({
        appendOutcomes: [{ code: 'partial-ack-unknown', commit: recoveryCase.commit }],
      });
      harness.seedCreatedRun();
      const writer = harness.log.openWriter(runId, harness.acquireLease());
      expect(writer.ok).toBe(true);

      const result = writer.ok ? writer.value.append([appendIntent('SiblingFact', { recoveryCase })]) : writer;

      expect(result.ok).toBe(recoveryCase.ok);
      expect(harness.appendCalls).toHaveLength(recoveryCase.appendCalls);
    }
  });
});
