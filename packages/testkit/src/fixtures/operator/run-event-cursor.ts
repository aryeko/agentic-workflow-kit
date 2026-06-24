import type { RunEventCursor } from 'sdk';

export const buildFixtureRunEventCursor = (overrides: Partial<RunEventCursor> = {}): RunEventCursor => ({
  runId: 'run-123',
  afterSequence: 4,
  ...overrides,
});
