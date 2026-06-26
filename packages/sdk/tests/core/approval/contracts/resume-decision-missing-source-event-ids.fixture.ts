import type { ResumeDecision } from '../../../../src/core/approval/contracts/index.js';

const invalidResumeDecision: ResumeDecision = {
  schema: 'kit-vnext.approval-resume-decision.v1',
  requestId: 'request-01',
  runId: 'run-01',
  sessionId: 'session-01',
  decisionEventId: 'evt-decision-01',
  outcome: 'resume',
  evaluatedAt: '2026-06-26T09:04:00.000Z',
};

void invalidResumeDecision;
