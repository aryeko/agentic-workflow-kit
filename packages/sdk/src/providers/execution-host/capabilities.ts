import type { EgressPolicy, NegativeProbe } from '../../foundation/credentials-secrets/index.js';

export type HostCapability = 'canKill' | 'containmentStrength' | 'emitsStructuredToolExit' | 'egress-confinement';

export type ContainmentStrength = 'none' | 'process-group' | 'kernel-tree' | 'job-object';

export type CommandKind = 'repo-setup' | 'verify' | 'diagnostic';

export type HostFailureReason =
  | 'host-capability-unattested'
  | 'workspace-mount-unavailable'
  | 'workspace-cwd-outside-mount'
  | 'credential-injection-rejected'
  | 'egress-confinement-unattested'
  | 'worker-spawn-failed'
  | 'host-observation-incomplete'
  | 'termination-unproven'
  | 'runner-command-capture-incomplete'
  | 'credential-destroy-unconfirmed';

export type HostFailure = {
  readonly reason: HostFailureReason;
  readonly message: string;
  readonly retryable: boolean;
  readonly evidenceRef?: string;
  readonly at: string;
};

export type HostProbeScope = {
  readonly driverId: string;
  readonly driverVersion: string;
  readonly platform: string;
  readonly freshnessKey: string;
  readonly capabilities: HostCapability[];
  readonly workspaceKind?: 'local-worktree' | 'workspace-mount';
  readonly egressPolicy?: EgressPolicy;
  readonly at: string;
};

export type HostAttestationDetails = {
  readonly containmentStrength?: ContainmentStrength;
  readonly negativeProbeResults?: readonly NegativeProbe[];
  readonly egressPolicyDigest?: string;
};
