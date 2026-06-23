import { describe, expect, it } from 'vitest';

import { isCapabilityAttestation } from 'sdk';
import type {
  CapabilityAttestation,
  CommandKind,
  CommandResult,
  ContainmentStrength,
  ExecutionHostProvider,
  HostAttestationDetails,
  HostCapability,
  HostCommandRequest,
  HostFailure,
  HostFailureReason,
  HostInjectionContext,
  HostObservation,
  HostProbeScope,
  HostReleaseResult,
  HostWorkspaceHandle,
  SpawnWorkerRequest,
  TerminationPolicy,
  TerminationProof,
  TerminationResult,
  WorkerHandle,
  WorkerLaunch,
  WorkspaceAttachment,
} from 'sdk';

import {
  capabilityAttestationFixture,
  commandResultFixture,
  executionHostProviderFixture,
  hostAttestationDetailsFixture,
  hostCommandRequestFixture,
  hostFailureFixture,
  hostInjectionContextFixture,
  hostProbeScopeFixture,
  hostReleaseResultFixture,
  hostWorkspaceHandleFixture,
  outputObservationFixture,
  spawnWorkerRequestFixture,
  terminationPolicyFixture,
  terminationProofFixture,
  terminationResultFixture,
  workerHandleFixture,
  workerLaunchFixture,
  workspaceAttachmentFixture,
} from './fixtures/shared.js';

describe('prov-04-s1 public sdk host imports', () => {
  it('imports the full execution-host surface from the sdk entrypoint', () => {
    const provider: ExecutionHostProvider = executionHostProviderFixture();
    const workspace: WorkspaceAttachment = workspaceAttachmentFixture();
    const workspaceHandle: HostWorkspaceHandle = hostWorkspaceHandleFixture({ workspace });
    const injection: HostInjectionContext = hostInjectionContextFixture();
    const launch: WorkerLaunch = workerLaunchFixture();
    const spawn: SpawnWorkerRequest = spawnWorkerRequestFixture({ workspace: workspaceHandle, injection, launch });
    const command: HostCommandRequest = hostCommandRequestFixture({ workspace: workspaceHandle, injection });
    const commandResult: CommandResult = commandResultFixture({ operationId: command.operationId });
    const worker: WorkerHandle = workerHandleFixture({ workspaceHandleId: workspaceHandle.handleId });
    const observation: HostObservation = outputObservationFixture({ handleId: worker.handleId });
    const terminationPolicy: TerminationPolicy = terminationPolicyFixture();
    const terminationProof: TerminationProof = terminationProofFixture();
    const terminationResult: TerminationResult = terminationResultFixture({
      handleId: worker.handleId,
      proof: terminationProof,
    });
    const releaseResult: HostReleaseResult = hostReleaseResultFixture({
      workspaceHandleId: workspaceHandle.handleId,
    });
    const failure: HostFailure = hostFailureFixture('worker-spawn-failed');
    const probeScope: HostProbeScope = hostProbeScopeFixture();
    const details: HostAttestationDetails = hostAttestationDetailsFixture();
    const attestation: CapabilityAttestation<'containmentStrength'> = capabilityAttestationFixture({
      details,
    });
    const capability: HostCapability = 'canKill';
    const containment: ContainmentStrength = 'process-group';
    const commandKind: CommandKind = 'verify';
    const failureReason: HostFailureReason = 'worker-spawn-failed';

    expect(provider.spawnWorker(spawn)).toBeDefined();
    expect(commandResult.outputDigest).toBe('output-digest-01');
    expect(observation.type).toBe('output');
    expect(terminationPolicy.initialSignal).toBe('SIGTERM');
    expect(terminationResult.proof.reaped).toBe(true);
    expect(releaseResult.workspaceHandleId).toBe(workspaceHandle.handleId);
    expect(failure.reason).toBe(failureReason);
    expect(probeScope.capabilities).toContain(capability);
    expect(details.containmentStrength).toBe(containment);
    expect(commandKind).toBe('verify');
    expect(isCapabilityAttestation(attestation)).toBe(true);
  });
});
