import type { RunEventCursor } from '../../core/run-lifecycle/contracts/index.js';

import type { OperatorCommandStatus } from './unions.js';

export type OperatorEventRef = {
  eventId: string;
  sequence: number;
  payloadDigest: string;
  type: 'OperatorActionRecorded';
};

export type OperatorCommandError = {
  code: string;
  message: string;
  evidenceRefs: OperatorEventRef[];
};

export type OperatorCommandResult<TView> = {
  schema: 'kit-vnext.operator-command-result.v1';
  actionId: string;
  status: OperatorCommandStatus;
  operatorEventRef?: OperatorEventRef;
  runId?: string;
  cursor?: RunEventCursor;
  view?: TView;
  errors: OperatorCommandError[];
};
