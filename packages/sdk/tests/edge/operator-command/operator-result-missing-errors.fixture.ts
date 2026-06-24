import type { OperatorCommandResult, PreviewRunView } from '../../../src/edge/operator-command/index.js';

const invalidResult: OperatorCommandResult<PreviewRunView> = {
  schema: 'kit-vnext.operator-command-result.v1',
  actionId: 'action-1',
  status: 'completed',
  view: {
    workSource: {
      workSourceId: 'work-source:tracker',
    },
    profileName: 'standard',
    dryRun: true,
    candidateCount: 1,
  },
};

void invalidResult;
