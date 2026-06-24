import type { OperatorActorRef } from './actor.js';
import type { OperatorActionKind, OperatorEnvelopeErrorCode, OperatorSurface } from './unions.js';

export type OperatorCommandTarget = {
  runId?: string;
  taskId?: string;
  trackId?: string;
  approvalRequestId?: string;
  attentionId?: string;
};

export type OperatorEnvelopeError = {
  code: OperatorEnvelopeErrorCode;
  field?: string;
  message: string;
};

export type OperatorCommandEnvelope<TParams> = {
  schema: 'kit-vnext.operator-command.v1';
  actionId: string;
  actionKind: OperatorActionKind;
  commandName: string;
  surface: OperatorSurface;
  actor: OperatorActorRef;
  target: OperatorCommandTarget;
  params: TParams;
  paramsDigest: string;
  idempotencyKey: string;
  requestedAt: string;
  reason?: string;
  correlationId?: string;
  dryRun?: boolean;
  envelopeErrors?: OperatorEnvelopeError[];
};
