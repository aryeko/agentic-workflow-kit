import type {
  CredentialParty,
  CredentialUsePlanned,
  EgressPolicy,
  InjectionBinding,
  RedactionSet,
} from '../../foundation/credentials-secrets/index.js';

import type { CommandKind } from './capabilities.js';

export type WorkspaceAttachment = {
  readonly kind: 'local-worktree' | 'workspace-mount';
  readonly leaseId: string;
  readonly runId: string;
  readonly repoId: string;
  readonly branchName: string;
  readonly worktreePath?: string;
  readonly mountRef?: string;
};

export type HostWorkspaceHandle = {
  readonly handleId: string;
  readonly workspace: WorkspaceAttachment;
  readonly cwdRoot: string;
  readonly driverId: string;
  readonly attachedAt: string;
};

export type HostInjectionContext = {
  readonly operationId: string;
  readonly party: CredentialParty;
  readonly credentialRefIds: readonly string[];
  readonly bindings: readonly InjectionBinding[];
  readonly egressPolicy: EgressPolicy;
  readonly redactionSet: RedactionSet;
  readonly requiredAuditEvent: CredentialUsePlanned;
  readonly scopeDigest: string;
  readonly attestationEventIds: readonly string[];
  readonly expiresAt: string;
};

export type WorkerLaunch = {
  readonly agentDriverId: string;
  readonly executableRef: string;
  readonly argv: readonly string[];
  readonly environmentMode: 'closed';
  readonly stdio: 'pipe';
  readonly protocolHint?: string;
};

export type SpawnWorkerRequest = {
  readonly runId: string;
  readonly operationId: string;
  readonly party: 'worker';
  readonly workspace: HostWorkspaceHandle;
  readonly cwd: string;
  readonly launch: WorkerLaunch;
  readonly injection: HostInjectionContext;
  readonly timeoutSeconds: number;
};

export type HostCommandRequest = {
  readonly runId: string;
  readonly operationId: string;
  readonly party: CredentialParty;
  readonly kind: CommandKind;
  readonly workspace: HostWorkspaceHandle;
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly injection: HostInjectionContext;
  readonly timeoutSeconds: number;
};
