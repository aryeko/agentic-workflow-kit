import type { HostFailure } from './capabilities.js';

export type CommandResult = {
  readonly operationId: string;
  readonly commandDigest: string;
  readonly cwd: string;
  readonly exitCode?: number;
  readonly signal?: string;
  readonly stdoutRef?: string;
  readonly stderrRef?: string;
  readonly outputDigest: string;
  readonly redactionApplied: boolean;
  readonly startedAt: string;
  readonly finishedAt: string;
};

export type WorkerHandle = {
  readonly handleId: string;
  readonly runId: string;
  readonly operationId: string;
  readonly workspaceHandleId: string;
  readonly ownershipClass: 'owned' | 'owned-remote' | 'observe-only';
  readonly containmentRef: string;
  readonly startedAt: string;
};

export type HostObservation =
  | {
      readonly type: 'output';
      readonly handleId: string;
      readonly stream: 'stdout' | 'stderr';
      readonly outputRef: string;
      readonly digest: string;
      readonly redactionApplied: true;
      readonly at: string;
    }
  | {
      readonly type: 'structured-tool-exit';
      readonly handleId: string;
      readonly tool: string;
      readonly exitCode: number;
      readonly payloadRef?: string;
      readonly digest: string;
      readonly at: string;
    }
  | {
      readonly type: 'process-exit';
      readonly handleId: string;
      readonly exitCode?: number;
      readonly signal?: string;
      readonly at: string;
    }
  | {
      readonly type: 'host-failure';
      readonly handleId?: string;
      readonly failure: HostFailure;
      readonly at: string;
    };

export type TerminationPolicy = {
  readonly initialSignal: string;
  readonly graceSeconds: number;
  readonly forceKill: boolean;
  readonly proveEmptyTimeoutSeconds: number;
};

export type TerminationProof = {
  readonly signalSent: boolean;
  readonly graceObserved: boolean;
  readonly forceKillSent: boolean;
  readonly reaped: boolean;
  readonly containmentEmpty: boolean;
  readonly evidenceRef: string;
  readonly checkedAt: string;
};

export type TerminationResult = {
  readonly handleId: string;
  readonly terminalExitCode?: number;
  readonly terminalSignal?: string;
  readonly proof: TerminationProof;
};

export type HostReleaseResult = {
  readonly workspaceHandleId: string;
  readonly released: boolean;
  readonly credentialMaterialDestroyed: boolean;
  readonly evidenceRef: string;
  readonly at: string;
};
