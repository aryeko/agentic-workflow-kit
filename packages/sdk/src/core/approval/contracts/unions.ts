export type ApprovalMode = 'manual' | 'assisted';

export type ApprovalRisk = 'low' | 'medium' | 'high';

export type ApprovalState =
  | 'pending'
  | 'auto-granted'
  | 'human-required'
  | 'answered'
  | 'denied'
  | 'parked'
  | 'resumed'
  | 'expired'
  | 'blocked'
  | 'failed';

export type ApprovalSubject =
  | 'command'
  | 'file-change'
  | 'permission'
  | 'network'
  | 'input'
  | 'protected-policy-change'
  | 'other';

export type PolicyGrantScope = 'per-command' | 'per-command-prefix' | 'per-host' | 'session';
