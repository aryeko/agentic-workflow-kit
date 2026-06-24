import type { RunProjections } from 'sdk';

type RunProjectionsOverrides = {
  state?: Partial<RunProjections['state']>;
  summary?: Partial<RunProjections['summary']>;
  metrics?: Partial<RunProjections['metrics']>;
  launch?: Partial<RunProjections['launch']>;
};

export const buildFixtureRunProjections = (overrides: RunProjectionsOverrides = {}): RunProjections => ({
  state: {
    lifecycle: 'running',
    currentSequence: 7,
    degradedHealth: 'ok',
    ...overrides.state,
  },
  summary: {
    runId: 'run-123',
    taskId: 'task-123',
    status: 'running',
    ownerSessionId: 'session-123',
    artifactRefs: ['artifact://run-123'],
    unknownEvents: [],
    ...overrides.summary,
  },
  metrics: {
    eventCount: 7,
    retryCount: 0,
    parkedMs: 0,
    firstRecordedAt: '2026-01-01T00:00:00.000Z',
    lastRecordedAt: '2026-01-01T00:05:00.000Z',
    ...overrides.metrics,
  },
  launch: {
    policyDigest: 'policy-digest-123',
    taskSnapshotDigest: 'snapshot-digest-123',
    linkage: 'known',
    linkHistory: [],
    ...overrides.launch,
  },
});
