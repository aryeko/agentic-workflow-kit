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

const provider = executionHostProviderFixture() satisfies ExecutionHostProvider;
const workspace = workspaceAttachmentFixture() satisfies WorkspaceAttachment;
const workspaceHandle = hostWorkspaceHandleFixture() satisfies HostWorkspaceHandle;
const injection = hostInjectionContextFixture() satisfies HostInjectionContext;
const launch = workerLaunchFixture() satisfies WorkerLaunch;
const spawnRequest = spawnWorkerRequestFixture() satisfies SpawnWorkerRequest;
const commandRequest = hostCommandRequestFixture() satisfies HostCommandRequest;
const commandResult = commandResultFixture() satisfies CommandResult;
const workerHandle = workerHandleFixture() satisfies WorkerHandle;
const observation = outputObservationFixture() satisfies HostObservation;
const terminationPolicy = terminationPolicyFixture() satisfies TerminationPolicy;
const terminationProof = terminationProofFixture() satisfies TerminationProof;
const terminationResult = terminationResultFixture() satisfies TerminationResult;
const releaseResult = hostReleaseResultFixture() satisfies HostReleaseResult;
const failure = hostFailureFixture('worker-spawn-failed') satisfies HostFailure;
const probeScope = hostProbeScopeFixture() satisfies HostProbeScope;
const details = hostAttestationDetailsFixture() satisfies HostAttestationDetails;
const attestation = capabilityAttestationFixture() satisfies CapabilityAttestation<'containmentStrength'>;
const capability: HostCapability = 'canKill';
const containment: ContainmentStrength = 'process-group';
const commandKind: CommandKind = 'verify';
const failureReason: HostFailureReason = 'worker-spawn-failed';

void provider;
void workspace;
void workspaceHandle;
void injection;
void launch;
void spawnRequest;
void commandRequest;
void commandResult;
void workerHandle;
void observation;
void terminationPolicy;
void terminationProof;
void terminationResult;
void releaseResult;
void failure;
void probeScope;
void details;
void attestation;
void capability;
void containment;
void commandKind;
void failureReason;
