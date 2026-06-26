import type { SupervisorStoppedPayload } from '../../../../src/core/supervision/contracts/index.js';

const invalidPayload: SupervisorStoppedPayload = {
  schema: 'kit-vnext.supervisor-stopped.v1',
  runId: 'run-01',
  outcome: 'terminated',
  stoppedAt: '2026-06-24T10:16:21.000Z',
  summarizedEventIds: ['evt-expired-01'],
};

void invalidPayload;
