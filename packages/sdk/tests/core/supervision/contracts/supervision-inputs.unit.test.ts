import { describe, expect, it } from 'vitest';

import type {
  AgentEvent,
  ExecutionHostProvider,
  RunEventLog,
  SupervisionInputs,
  SupervisionTimerPolicy,
  SupervisionWaitRequest,
} from '../../../../src/index.js';

const createAgentEvents = async function* (): AsyncIterable<AgentEvent> {
  yield {
    type: 'progress',
    sessionId: 'session-01',
    message: 'working',
    at: '2026-06-24T10:00:05.000Z',
  };
};

describe('core-04-s1 supervision inputs', () => {
  it('constructs the supervision input, timer policy, and wait request shapes', () => {
    const runLog: RunEventLog = {
      createRun: () => {
        throw new Error('unused');
      },
      openWriter: () => {
        throw new Error('unused');
      },
      replay: () => {
        throw new Error('unused');
      },
      waitRunEvents: async () => {
        throw new Error('unused');
      },
      project: () => {
        throw new Error('unused');
      },
    };
    const host: ExecutionHostProvider = {
      probeCapabilities: () => {
        throw new Error('unused');
      },
      attachWorkspace: () => {
        throw new Error('unused');
      },
      spawnWorker: () => {
        throw new Error('unused');
      },
      observeWorker: () => {
        throw new Error('unused');
      },
      terminateWorker: () => {
        throw new Error('unused');
      },
      runCommand: () => {
        throw new Error('unused');
      },
      releaseWorkspace: () => {
        throw new Error('unused');
      },
    };
    const timers: SupervisionTimerPolicy = {
      startupMs: 120_000,
      idleMs: 900_000,
      noProgressMs: 2_700_000,
      perToolMs: 1_800_000,
      approvalSlaMs: 86_400_000,
      maxRuntimeMs: 28_800_000,
    };
    const inputs: SupervisionInputs = {
      runLog,
      agentEvents: createAgentEvents(),
      host,
      clock: () => '2026-06-24T10:00:00.000Z',
      timers,
    };
    const waitRequest: SupervisionWaitRequest = {
      runId: 'run-01',
      cursor: { runId: 'run-01', afterSequence: 12 },
      timeoutMs: 30_000,
      maxEvents: 25,
    };

    expect(inputs.clock()).toBe('2026-06-24T10:00:00.000Z');
    expect(inputs.timers.maxRuntimeMs).toBe(28_800_000);
    expect(waitRequest.cursor.afterSequence).toBe(12);
    expect(waitRequest.maxEvents).toBe(25);
  });
});
