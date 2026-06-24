import { describe, expect, it } from 'vitest';

import { project, replay, waitRunEvents } from '../../../../src/index.js';

import { createHarness, digestPayload, runId } from './test-support.js';

describe('RunEventLog read-method delegation', () => {
  it('returns replay, projection, and cursor-wait results equivalent to direct owning-module calls', async () => {
    const harness = createHarness();
    harness.seedCreatedRun();

    const directReplay = replay(runId, harness.eventLogStore, digestPayload);
    const facadeReplay = harness.log.replay(runId);
    expect(facadeReplay).toEqual(directReplay);

    const replayDependency = (requestedRunId: string) => replay(requestedRunId, harness.eventLogStore, digestPayload);
    const directProject = project(runId, replayDependency);
    const facadeProject = harness.log.project(runId);
    expect(facadeProject).toEqual(directProject);

    const request = {
      runId,
      cursor: { runId, afterSequence: 0 },
      timeoutMs: 0,
      maxEvents: 1,
    };
    const directWait = await waitRunEvents(request, replayDependency, () => 0);
    const facadeWait = await harness.log.waitRunEvents(request);
    expect(facadeWait).toEqual(directWait);
  });
});
