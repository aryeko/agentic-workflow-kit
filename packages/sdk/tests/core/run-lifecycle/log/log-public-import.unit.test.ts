import { describe, expect, it } from 'vitest';

import { createRunEventLog, type RunWriter } from '../../../../src/index.js';

import { createHarness, runId } from './test-support.js';

describe('RunEventLog public import', () => {
  it('imports the concrete factory through the sdk entrypoint and constructs a writer', () => {
    expect(typeof createRunEventLog).toBe('function');
    const harness = createHarness();
    const writer = harness.log.openWriter(runId, harness.acquireLease());

    expect(writer.ok).toBe(true);
    if (writer.ok) {
      const typedWriter: RunWriter = writer.value;
      expect(typeof typedWriter.append).toBe('function');
      expect(typeof typedWriter.renew).toBe('function');
    }
  });
});
