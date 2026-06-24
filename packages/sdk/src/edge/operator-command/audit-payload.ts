import type { OperatorActorRef } from './actor.js';
import type { OperatorCommandTarget, OperatorEnvelopeError } from './envelope.js';
import type { OperatorActionKind, OperatorSurface } from './unions.js';

type OperatorActionResultIntent = 'read' | 'mutate' | 'reject' | 'defer';

export type OperatorActionRecordedPayload = {
  schema: 'kit-vnext.operator-action-recorded.v1';
  actionId: string;
  actionKind: OperatorActionKind;
  commandName: string;
  surface: OperatorSurface;
  actor: OperatorActorRef;
  target: OperatorCommandTarget;
  paramsDigest: string;
  idempotencyKey: string;
  requestedAt: string;
  acceptedAt: string;
  reasonDigest?: string;
  resultIntent: OperatorActionResultIntent;
  envelopeErrors?: OperatorEnvelopeError[];
};
