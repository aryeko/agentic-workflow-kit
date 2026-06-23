export type OperatorSurface = 'mcp' | 'cli' | 'external-trigger';

export type OperatorActionKind =
  | 'preview-run'
  | 'start-run'
  | 'inspect-run'
  | 'wait-run'
  | 'approval-decision'
  | 'stop-run'
  | 'handoff-run'
  | 'override-field'
  | 'request-recovery'
  | 'explain'
  | 'attention-ack';

export type OperatorEnvelopeErrorCode =
  | 'params-invalid'
  | 'target-invalid'
  | 'idempotency-invalid'
  | 'identity-unavailable'
  | 'params-digest-unavailable';

export type OperatorCommandStatus = 'completed' | 'accepted' | 'rejected' | 'deferred';
