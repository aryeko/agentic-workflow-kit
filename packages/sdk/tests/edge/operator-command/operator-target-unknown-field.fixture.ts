import type { OperatorCommandTarget } from '../../../src/edge/operator-command/index.js';

const invalidTarget: OperatorCommandTarget = {
  runId: 'run-123',
  sessionId: 'session-1',
};

void invalidTarget;
