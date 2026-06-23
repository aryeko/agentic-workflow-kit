import { describe, expect, it } from 'vitest';

import {
  capabilityAttestationFixture,
  commandResultFixture,
  hostAttestationDetailsFixture,
  hostCommandRequestFixture,
  hostFailureFixture,
  hostInjectionContextFixture,
  hostProbeScopeFixture,
  hostReleaseResultFixture,
  hostWorkspaceHandleFixture,
  spawnWorkerRequestFixture,
  terminationPolicyFixture,
  terminationProofFixture,
  terminationResultFixture,
  workerHandleFixture,
  workerLaunchFixture,
  workspaceAttachmentFixture,
} from './fixtures/shared.js';

describe('prov-04-s1 host DTO catalog', () => {
  it('constructs every DTO with the required fields', () => {
    const workspace = workspaceAttachmentFixture();
    const workspaceHandle = hostWorkspaceHandleFixture({ workspace });
    const injection = hostInjectionContextFixture();
    const launch = workerLaunchFixture();
    const spawnRequest = spawnWorkerRequestFixture({ workspace: workspaceHandle, injection, launch });
    const commandRequest = hostCommandRequestFixture({ workspace: workspaceHandle, injection });
    const commandResult = commandResultFixture({ operationId: commandRequest.operationId });
    const workerHandle = workerHandleFixture({ workspaceHandleId: workspaceHandle.handleId });
    const terminationPolicy = terminationPolicyFixture();
    const terminationProof = terminationProofFixture();
    const terminationResult = terminationResultFixture({ handleId: workerHandle.handleId, proof: terminationProof });
    const releaseResult = hostReleaseResultFixture({ workspaceHandleId: workspaceHandle.handleId });
    const failure = hostFailureFixture('worker-spawn-failed');
    const probeScope = hostProbeScopeFixture();
    const attestationDetails = hostAttestationDetailsFixture();
    const attestation = capabilityAttestationFixture();

    expect(workspace.branchName).toBe('codex/epic2-provider-contracts');
    expect(workspaceHandle.workspace.repoId).toBe(workspace.repoId);
    expect(injection.requiredAuditEvent.type).toBe('CredentialUsePlanned');
    expect(launch.environmentMode).toBe('closed');
    expect(spawnRequest.party).toBe('worker');
    expect(commandRequest.kind).toBe('verify');
    expect(commandResult.outputDigest).toBe('output-digest-01');
    expect(workerHandle.containmentRef).toContain('containment://');
    expect(terminationPolicy.forceKill).toBe(true);
    expect(terminationProof.evidenceRef).toBe('artifact://termination-proof');
    expect(terminationResult.proof.containmentEmpty).toBe(true);
    expect(releaseResult.credentialMaterialDestroyed).toBe(true);
    expect(failure.reason).toBe('worker-spawn-failed');
    expect(probeScope.capabilities).toEqual(['canKill', 'containmentStrength']);
    expect(attestationDetails.egressPolicyDigest).toBe('egress-policy-digest-01');
    expect(attestation.capability).toBe('containmentStrength');
  });
});
