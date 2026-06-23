type OperatorActorSchema = 'kit-vnext.operator-actor.v1';
type OperatorSurfaceClient = 'mcp' | 'cli';
type OperatorIdentityConfidence = 'verified-os' | 'unverified';
type UnavailableOsUserFailureReason = 'lookup-failed' | 'permission-denied' | 'ambiguous';

export type OsUserOperatorActorRef = {
  schema: OperatorActorSchema;
  kind: 'os-user';
  username: string;
  uid?: number;
  gid?: number;
  groups?: string[];
  hostname: string;
  processId: number;
  terminalRef?: string;
  surfaceClient: OperatorSurfaceClient;
  resolvedAt: string;
  identityConfidence: OperatorIdentityConfidence;
};

export type UnavailableOsUserOperatorActorRef = {
  schema: OperatorActorSchema;
  kind: 'os-user-unavailable';
  hostname: string;
  processId: number;
  terminalRef?: string;
  surfaceClient: OperatorSurfaceClient;
  resolvedAt: string;
  failureReason: UnavailableOsUserFailureReason;
  identityConfidence: 'unverified';
};

export type DeferredExternalTriggerActorRef = {
  schema: OperatorActorSchema;
  kind: 'external-trigger';
  principalRef: string;
  authEvidenceRef?: string;
  resolvedAt: string;
  identityConfidence: 'unverified';
};

export type OperatorActorRef =
  | OsUserOperatorActorRef
  | UnavailableOsUserOperatorActorRef
  | DeferredExternalTriggerActorRef;
