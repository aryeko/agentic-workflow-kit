import type {
  CommandResult,
  ExecutionHostProvider,
  HostCapability,
  HostFailureReason,
  HostObservation,
  TerminationProof,
} from 'sdk';

import { conformanceResult, failCheck, passCheck, type ConformanceResult } from '../conformance/index.js';
import {
  hostCommandRequestFixture,
  hostProbeScopeFixture,
  spawnWorkerRequestFixture,
  terminationPolicyFixture,
  workspaceAttachmentFixture,
} from '../fixtures/execution-host/index.js';
import { createMockExecutionHostProvider, isHostFailure } from './mock-execution-host-provider.js';

export type ExecutionHostConformanceResult = ConformanceResult<HostFailureReason>;

const collectObservations = async (
  observations: AsyncIterable<HostObservation>,
): Promise<readonly HostObservation[]> => {
  const collected: HostObservation[] = [];
  for await (const observation of observations) {
    collected.push(observation);
  }
  return collected;
};

const proofComplete = (proof: TerminationProof): boolean =>
  proof.signalSent && proof.graceObserved && proof.forceKillSent && proof.reaped && proof.containmentEmpty;

const isCommandResult = (value: unknown): value is CommandResult =>
  typeof value === 'object' && value !== null && 'commandDigest' in value && 'outputDigest' in value;

const hasFreshPositive = (provider: ExecutionHostProvider, capability: HostCapability): boolean => {
  const scope = hostProbeScopeFixture({
    capabilities: [capability],
    at: '2026-06-22T10:00:00.000Z',
  });
  return provider
    .probeCapabilities(scope)
    .some(
      (attestation) =>
        attestation.capability === capability &&
        attestation.result === 'positive' &&
        Date.parse(attestation.expiry) > Date.parse(scope.at),
    );
};

export const executionHostConformance = async (
  provider: ExecutionHostProvider,
): Promise<ExecutionHostConformanceResult> => {
  provider.probeCapabilities(
    hostProbeScopeFixture({
      capabilities: ['canKill', 'containmentStrength', 'emitsStructuredToolExit', 'egress-confinement'],
    }),
  );
  const workspace = provider.attachWorkspace(workspaceAttachmentFixture());
  if (isHostFailure(workspace)) {
    return conformanceResult([
      failCheck('workspace', workspace.reason, 'Provider could not attach the fixture workspace.'),
    ]);
  }

  const worker = provider.spawnWorker(spawnWorkerRequestFixture({ workspace }));
  if (isHostFailure(worker)) {
    return conformanceResult([failCheck('spawnWorker', worker.reason, 'Provider could not spawn fixture worker.')]);
  }

  const observations = await collectObservations(provider.observeWorker(worker));
  const command = provider.runCommand(hostCommandRequestFixture({ workspace }));
  const termination = provider.terminateWorker(worker, terminationPolicyFixture());
  const leakedCredential = observations.some(
    (observation) =>
      observation.type === 'output' &&
      (observation.outputRef.includes('API_TOKEN') || observation.digest.includes('API_TOKEN')),
  );

  return conformanceResult([
    observations.some((observation) => observation.type === 'output') &&
    observations.some((observation) => observation.type === 'structured-tool-exit') &&
    observations.some((observation) => observation.type === 'process-exit')
      ? passCheck<HostFailureReason>('host-observation')
      : failCheck('host-observation', 'host-observation-incomplete', 'Observation stream is incomplete.'),
    isCommandResult(command) && command.commandDigest.length > 0 && command.outputDigest.length > 0
      ? passCheck('command-capture')
      : failCheck('command-capture', 'runner-command-capture-incomplete', 'Command capture is incomplete.'),
    proofComplete(termination.proof)
      ? passCheck('termination-proof')
      : failCheck('termination-proof', 'termination-unproven', 'Termination proof is incomplete.'),
    leakedCredential
      ? failCheck('injection-separation', 'credential-injection-rejected', 'Runner credential marker leaked.')
      : passCheck('injection-separation'),
    hasFreshPositive(provider, 'canKill')
      ? passCheck('capability-freshness')
      : failCheck('capability-freshness', 'host-capability-unattested', 'canKill is not fresh-positive.'),
    hasFreshPositive(provider, 'egress-confinement')
      ? passCheck('egress-confinement')
      : failCheck('egress-confinement', 'egress-confinement-unattested', 'Egress confinement is not fresh-positive.'),
  ]);
};

export const brokenExecutionHostFixtures = {
  brokenTerminationProof: createMockExecutionHostProvider({ scenario: 'termination' }),
  brokenCommandCapture: createMockExecutionHostProvider({ scenario: 'incomplete-capture' }),
  leakyInjection: createMockExecutionHostProvider({
    observations: [
      {
        type: 'output',
        handleId: 'worker-handle-1',
        stream: 'stdout',
        outputRef: 'artifact://execution-host/API_TOKEN/leak',
        digest: 'sha256:API_TOKEN',
        redactionApplied: true,
        at: '2026-06-22T10:00:00.000Z',
      },
      {
        type: 'structured-tool-exit',
        handleId: 'worker-handle-1',
        tool: 'apply_patch',
        exitCode: 0,
        digest: 'sha256:tool-exit',
        at: '2026-06-22T10:00:00.000Z',
      },
      { type: 'process-exit', handleId: 'worker-handle-1', exitCode: 0, at: '2026-06-22T10:00:00.000Z' },
    ],
  }),
} as const;
