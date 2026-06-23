import type { CapabilityAttestation } from '../attestation/index.js';

import type { HostCapability, HostFailure, HostProbeScope } from './capabilities.js';
import type { HostCommandRequest, HostWorkspaceHandle, SpawnWorkerRequest, WorkspaceAttachment } from './workspace.js';
import type {
  CommandResult,
  HostObservation,
  HostReleaseResult,
  TerminationPolicy,
  TerminationResult,
  WorkerHandle,
} from './worker.js';

export interface ExecutionHostProvider {
  probeCapabilities(scope: HostProbeScope): CapabilityAttestation<HostCapability>[];
  attachWorkspace(workspace: WorkspaceAttachment): HostWorkspaceHandle | HostFailure;
  spawnWorker(request: SpawnWorkerRequest): WorkerHandle | HostFailure;
  observeWorker(handle: WorkerHandle): AsyncIterable<HostObservation>;
  terminateWorker(handle: WorkerHandle, policy: TerminationPolicy): TerminationResult;
  runCommand(request: HostCommandRequest): CommandResult | HostFailure;
  releaseWorkspace(handle: HostWorkspaceHandle): HostReleaseResult;
}
