import type { OperatorCommandResult, PreviewRunView } from '../../../src/edge/operator-command/index.js';

const invalidResult: OperatorCommandResult<PreviewRunView> = {
  schema: 'kit-vnext.operator-command-result.v1',
  actionId: 'action-1',
  status: 'deferred',
  view: {
    workSource: {
      workSourceId: 'work-source:tracker',
    },
    profileName: 'standard',
    dryRun: true,
    candidateCount: 1,
  },
  attention: [
    {
      attentionId: 'attention-1',
    },
  ],
  errors: [],
};

void invalidResult;
