import { describe, expect, it } from 'vitest';

import type { HostFailure, HostObservation } from 'sdk';

import {
  createMockExecutionHostProvider,
  hostCommandRequestFixture,
  hostProbeScopeFixture,
  isHostFailure,
  spawnWorkerRequestFixture,
  terminationPolicyFixture,
  workspaceAttachmentFixture,
} from '../../src/index.js';

const collectObservations = async (
  observations: AsyncIterable<HostObservation>,
): Promise<readonly HostObservation[]> => {
  const collected: HostObservation[] = [];

  for await (const observation of observations) {
    collected.push(observation);
  }

  return collected;
};

describe('execution host mock testkit provider', () => {
  it('scripts capabilities, workspace lifecycle, worker observations, command capture, and release', async () => {
    const provider = createMockExecutionHostProvider();
    const capabilityAttestations = provider.probeCapabilities(
      hostProbeScopeFixture({
        capabilities: ['canKill', 'containmentStrength', 'emitsStructuredToolExit', 'egress-confinement'],
      }),
    );
    const workspace = provider.attachWorkspace(workspaceAttachmentFixture());

    expect(capabilityAttestations.map((attestation) => [attestation.capability, attestation.result])).toEqual([
      ['canKill', 'positive'],
      ['containmentStrength', 'positive'],
      ['emitsStructuredToolExit', 'positive'],
      ['egress-confinement', 'positive'],
    ]);
    expect(isHostFailure(workspace)).toBe(false);
    if (isHostFailure(workspace)) {
      throw new Error(workspace.message);
    }

    const worker = provider.spawnWorker(spawnWorkerRequestFixture({ workspace }));

    expect(isHostFailure(worker)).toBe(false);
    if (isHostFailure(worker)) {
      throw new Error(worker.message);
    }

    const observations = await collectObservations(provider.observeWorker(worker));

    expect(observations.map((observation) => observation.type)).toEqual([
      'output',
      'structured-tool-exit',
      'process-exit',
    ]);
    expect(observations[1]).toEqual(
      expect.objectContaining({
        type: 'structured-tool-exit',
        handleId: worker.handleId,
        tool: 'apply_patch',
        exitCode: 0,
      }),
    );

    const termination = provider.terminateWorker(worker, terminationPolicyFixture());
    const command = provider.runCommand(hostCommandRequestFixture({ workspace }));
    const release = provider.releaseWorkspace(workspace);

    expect(termination.proof).toEqual(
      expect.objectContaining({
        signalSent: true,
        graceObserved: true,
        reaped: true,
        containmentEmpty: true,
      }),
    );
    expect(isHostFailure(command)).toBe(false);
    if (isHostFailure(command)) {
      throw new Error(command.message);
    }
    expect(command).toEqual(
      expect.objectContaining({
        operationId: 'op-verify-01',
        cwd: workspace.cwdRoot,
        exitCode: 0,
        redactionApplied: true,
      }),
    );
    expect(provider.getCapturedCommands()).toEqual([
      expect.objectContaining({
        operationId: 'op-verify-01',
        argv: ['pnpm', 'check'],
        cwd: workspace.cwdRoot,
        commandDigest: command.commandDigest,
      }),
    ]);
    expect(release).toEqual(
      expect.objectContaining({
        workspaceHandleId: workspace.handleId,
        released: true,
        credentialMaterialDestroyed: true,
      }),
    );
  });

  it('omits missing capabilities so consumers can fail closed', () => {
    const provider = createMockExecutionHostProvider({
      capabilities: {
        canKill: 'positive',
      },
    });

    expect(
      provider.probeCapabilities(
        hostProbeScopeFixture({
          capabilities: ['canKill', 'egress-confinement'],
        }),
      ),
    ).toEqual([expect.objectContaining({ capability: 'canKill', result: 'positive' })]);
  });

  it('refuses cwd escape and workspace attachments without represented mount material', () => {
    const provider = createMockExecutionHostProvider();
    const missingMount = provider.attachWorkspace(
      workspaceAttachmentFixture({
        kind: 'workspace-mount',
        worktreePath: undefined,
        mountRef: undefined,
      }),
    );

    expect(missingMount).toEqual(
      expect.objectContaining<Partial<HostFailure>>({
        reason: 'workspace-mount-unavailable',
        retryable: false,
      }),
    );

    const workspace = provider.attachWorkspace(workspaceAttachmentFixture());

    expect(isHostFailure(workspace)).toBe(false);
    if (isHostFailure(workspace)) {
      throw new Error(workspace.message);
    }

    const escapedSpawn = provider.spawnWorker(
      spawnWorkerRequestFixture({
        workspace,
        cwd: '/tmp/worktrees/run-01/../outside',
      }),
    );
    const escapedCommand = provider.runCommand(
      hostCommandRequestFixture({
        workspace,
        cwd: '/tmp/outside',
      }),
    );

    expect(escapedSpawn).toEqual(expect.objectContaining({ reason: 'workspace-cwd-outside-mount' }));
    expect(escapedCommand).toEqual(expect.objectContaining({ reason: 'workspace-cwd-outside-mount' }));
  });

  it('scripts adversarial observations, incomplete command capture, and unproven termination', async () => {
    const provider = createMockExecutionHostProvider({
      commandResults: {
        'op-verify-01': {
          reason: 'runner-command-capture-incomplete',
          message: 'runner command omitted output digest',
          retryable: false,
          evidenceRef: 'artifact://runner-command-incomplete',
          at: '2026-06-22T10:07:00.000Z',
        },
      },
      observations: [
        {
          type: 'host-failure',
          failure: {
            reason: 'host-observation-incomplete',
            message: 'worker never emitted a terminal status',
            retryable: false,
            evidenceRef: 'artifact://observation-incomplete',
            at: '2026-06-22T10:03:00.000Z',
          },
          at: '2026-06-22T10:03:00.000Z',
        },
      ],
      terminationProof: {
        signalSent: true,
        graceObserved: true,
        forceKillSent: true,
        reaped: false,
        containmentEmpty: false,
        evidenceRef: 'artifact://termination-unproven',
        checkedAt: '2026-06-22T10:08:00.000Z',
      },
    });
    const workspace = provider.attachWorkspace(workspaceAttachmentFixture());
    provider.probeCapabilities(
      hostProbeScopeFixture({
        capabilities: ['egress-confinement'],
      }),
    );

    expect(isHostFailure(workspace)).toBe(false);
    if (isHostFailure(workspace)) {
      throw new Error(workspace.message);
    }

    const worker = provider.spawnWorker(spawnWorkerRequestFixture({ workspace }));

    expect(isHostFailure(worker)).toBe(false);
    if (isHostFailure(worker)) {
      throw new Error(worker.message);
    }

    const observations = await collectObservations(provider.observeWorker(worker));
    const command = provider.runCommand(hostCommandRequestFixture({ workspace }));
    const termination = provider.terminateWorker(worker, terminationPolicyFixture());

    expect(observations).toEqual([
      expect.objectContaining({
        type: 'host-failure',
        handleId: worker.handleId,
        failure: expect.objectContaining({ reason: 'host-observation-incomplete' }),
      }),
    ]);
    expect(command).toEqual(expect.objectContaining({ reason: 'runner-command-capture-incomplete' }));
    expect(termination.proof).toEqual(
      expect.objectContaining({
        reaped: false,
        containmentEmpty: false,
      }),
    );
  });

  it('fails closed when egress attestation evidence or injection binding is missing', () => {
    const provider = createMockExecutionHostProvider();
    const unscopedEgress = provider.probeCapabilities(
      hostProbeScopeFixture({
        capabilities: ['egress-confinement'],
        egressPolicy: undefined,
      }),
    );
    const workspace = provider.attachWorkspace(workspaceAttachmentFixture());

    expect(unscopedEgress).toEqual([expect.objectContaining({ capability: 'egress-confinement', result: 'negative' })]);
    expect(isHostFailure(workspace)).toBe(false);
    if (isHostFailure(workspace)) {
      throw new Error(workspace.message);
    }

    const unattestedWorker = provider.spawnWorker(spawnWorkerRequestFixture({ workspace }));

    expect(unattestedWorker).toEqual(expect.objectContaining({ reason: 'egress-confinement-unattested' }));

    provider.probeCapabilities(
      hostProbeScopeFixture({
        capabilities: ['egress-confinement'],
      }),
    );

    expect(
      provider.runCommand(
        hostCommandRequestFixture({
          workspace,
          injection: {
            ...hostCommandRequestFixture({ workspace }).injection,
            attestationEventIds: [],
          },
        }),
      ),
    ).toEqual(expect.objectContaining({ reason: 'egress-confinement-unattested' }));

    expect(
      provider.runCommand(
        hostCommandRequestFixture({
          workspace,
          injection: {
            ...hostCommandRequestFixture({ workspace }).injection,
            egressPolicy: {
              ...hostCommandRequestFixture({ workspace }).injection.egressPolicy,
              freshnessKey: 'stale-freshness-key',
            },
          },
        }),
      ),
    ).toEqual(expect.objectContaining({ reason: 'egress-confinement-unattested' }));
  });
});
