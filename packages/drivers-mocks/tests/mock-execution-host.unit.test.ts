import {
  type ContainmentStrength,
  type ExecutionHost,
  getAttestedContainmentStrength,
  type HostCapability,
  type HostCommandRequest,
  type HostInjectionContext,
  type HostProbeScope,
  type HostWorkspaceHandle,
  hostObservationSchema,
  isHostFailure,
  type SpawnWorkerRequest,
  type WorkspaceAttachment,
} from '@kit-vnext/contracts-execution-host';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createEgressLeakMockExecutionHost,
  createHostWontDieMockExecutionHost,
  createMockExecutionHost,
  type MockExecutionHost,
} from '../src/index.js';

const now = '2026-06-19T08:00:00.000Z';
const expiry = '2026-06-19T09:00:00.000Z';

const createIds = () => {
  let next = 0;
  return {
    nextId: (purpose: string) => `${purpose}-${++next}`,
  };
};

const createHost = (overrides: Partial<Parameters<typeof createMockExecutionHost>[0]> = {}) =>
  createMockExecutionHost({
    driverId: 'mock-execution-host',
    driverVersion: 'mock@1.0.0',
    platform: 'test-platform',
    clock: { nowIso: () => now },
    idGenerator: createIds(),
    attestationExpiry: expiry,
    ...overrides,
  });

const workspaceAttachment = (overrides: Partial<WorkspaceAttachment> = {}): WorkspaceAttachment => ({
  kind: 'workspace-mount',
  leaseId: 'lease-1',
  runId: 'run-1',
  repoId: 'repo-1',
  branchName: 'codex/task',
  mountRef: '/workspace/repo',
  cwd: '/workspace/repo',
  ...overrides,
});

const probeScope = (capabilities: readonly HostCapability[] = ['egress-confinement']): HostProbeScope => ({
  driverId: 'mock-execution-host',
  driverVersion: 'mock@1.0.0',
  platform: 'test-platform',
  freshnessKey: 'freshness-1',
  capabilities,
  workspaceKind: 'workspace-mount',
  egressPolicy: egressPolicy('runner'),
  at: now,
});

const egressPolicy = (audience: 'runner' | 'worker', operationId = 'op-1') => ({
  id: `egress-${audience}`,
  runId: 'run-1',
  operationId,
  audience,
  egressPolicyDigest: `sha256:egress-${audience}`,
  defaultAction: 'deny' as const,
  rules: [],
  negativeProbes: [
    {
      id: 'probe-block-example',
      host: 'blocked.example.test',
      protocol: 'https' as const,
      expected: 'blocked' as const,
      reason: 'prove deny-by-default',
    },
  ],
  requiredAttesters: [
    {
      point: 'execution-host' as const,
      capability: 'egress-confinement' as const,
      driverId: 'mock-execution-host',
      scopeDigest: 'scope-1',
      egressPolicyDigest: `sha256:egress-${audience}`,
      platform: 'test-platform',
      driverVersion: 'mock@1.0.0',
    },
  ],
  freshnessKey: 'freshness-1',
  expiresAt: expiry,
});

const plannedAuditEvent = (party: 'runner' | 'worker', operationId = 'op-1') => ({
  type: 'CredentialUsePlanned' as const,
  runId: 'run-1',
  taskId: 'task-1',
  operationId,
  credentialRefIds: ['cred-1'],
  party,
  phase: party === 'runner' ? 'verify' : 'worker',
  policyDigest: 'sha256:policy',
  credentialRefDigest: 'sha256:refs',
  scopeDigest: 'scope-1',
  attestationEventIds: [],
  evidenceRefs: [],
  prevEventHash: 'sha256:prev',
  eventHash: 'sha256:event',
  at: now,
  egressPolicyId: `egress-${party}`,
  expiresAt: expiry,
  reason: 'test',
});

const injection = (
  party: 'runner' | 'worker',
  operationId = 'op-1',
  attestationEventIds: readonly string[] = [],
): HostInjectionContext => ({
  operationId,
  party,
  credentialRefIds: ['cred-1'],
  bindings: [
    {
      mode: 'env',
      nameOrPath: 'KIT_CREDENTIAL_CRED_1',
      redactionLabel: 'credential:cred-1',
    },
  ],
  egressPolicy: egressPolicy(party, operationId),
  redactionSet: {
    id: `redaction-${party}`,
    state: 'materialized',
    credentialRefIds: ['cred-1'],
    labels: {},
    fingerprintIds: ['fingerprint-1'],
    expiresAt: expiry,
  },
  requiredAuditEvent: plannedAuditEvent(party, operationId),
  scopeDigest: 'scope-1',
  attestationEventIds,
  expiresAt: expiry,
});

const attach = (host: MockExecutionHost, attachment = workspaceAttachment()): HostWorkspaceHandle => {
  const attached = host.attachWorkspace(attachment);
  if (isHostFailure(attached)) {
    throw new Error(attached.reason);
  }
  return attached;
};

const attestedInjection = (host: MockExecutionHost, party: 'runner' | 'worker', operationId = 'op-1') => {
  const [attestation] = host.probeCapabilities({
    ...probeScope(['egress-confinement']),
    egressPolicy: egressPolicy(party, operationId),
  });
  if (!attestation.eventId) {
    throw new Error('missing attestation event id');
  }
  return injection(party, operationId, [attestation.eventId]);
};

const commandRequest = (host: MockExecutionHost, workspace = attach(host)): HostCommandRequest => ({
  runId: 'run-1',
  operationId: 'op-1',
  party: 'runner',
  kind: 'verify',
  workspace,
  argv: ['pnpm', 'check'],
  cwd: '/workspace/repo',
  injection: attestedInjection(host, 'runner'),
  timeoutSeconds: 60,
});

const spawnRequest = (host: MockExecutionHost, workspace = attach(host)): SpawnWorkerRequest => ({
  runId: 'run-1',
  operationId: 'op-1',
  party: 'worker',
  workspace,
  cwd: '/workspace/repo',
  launch: {
    agentDriverId: 'mock-agent',
    executableRef: 'codex',
    argv: ['run'],
    environmentMode: 'closed',
    stdio: 'pipe',
  },
  injection: attestedInjection(host, 'worker'),
  timeoutSeconds: 60,
});

const collect = async <T>(iterable: AsyncIterable<T>): Promise<T[]> => {
  const values: T[] = [];
  for await (const value of iterable) {
    values.push(value);
  }
  return values;
};

describe('Mock Execution Host', () => {
  it('AC-11 structurally satisfies ExecutionHost with all seven method return types', async () => {
    const host = createHost() satisfies ExecutionHost;
    const workspace = attach(host);
    const worker = host.spawnWorker(spawnRequest(host, workspace));
    if (isHostFailure(worker)) {
      throw new Error(worker.reason);
    }

    const probeResult: ReturnType<ExecutionHost['probeCapabilities']> = host.probeCapabilities(probeScope());
    const attachResult: ReturnType<ExecutionHost['attachWorkspace']> = workspace;
    const spawnResult: ReturnType<ExecutionHost['spawnWorker']> = worker;
    const observeResult: ReturnType<ExecutionHost['observeWorker']> = host.observeWorker(worker);
    const terminateResult: ReturnType<ExecutionHost['terminateWorker']> = host.terminateWorker(worker, {
      initialSignal: 'SIGTERM',
      graceSeconds: 1,
      forceKill: true,
      proveEmptyTimeoutSeconds: 1,
    });
    const commandResult: ReturnType<ExecutionHost['runCommand']> = host.runCommand(commandRequest(host, workspace));
    const releaseResult: ReturnType<ExecutionHost['releaseWorkspace']> = host.releaseWorkspace(workspace);

    expect(probeResult).toHaveLength(1);
    expect(attachResult.handleId).toBe(workspace.handleId);
    expect(spawnResult.handleId).toBe(worker.handleId);
    expect(await collect(observeResult)).not.toHaveLength(0);
    expect(terminateResult.proof.containmentEmpty).toBe(true);
    expect(isHostFailure(commandResult)).toBe(false);
    expect(releaseResult.released).toBe(true);
  });

  it('AC-2 proves termination only after the full ladder and host-wont-die returns negative canKill', () => {
    const host = createHost();
    const worker = host.spawnWorker(spawnRequest(host));
    if (isHostFailure(worker)) {
      throw new Error(worker.reason);
    }

    expect(
      host.terminateWorker(worker, {
        initialSignal: 'SIGTERM',
        graceSeconds: 1,
        forceKill: true,
        proveEmptyTimeoutSeconds: 1,
      }),
    ).toMatchObject({
      proof: {
        signalSent: true,
        graceObserved: true,
        forceKillSent: true,
        reaped: true,
        containmentEmpty: true,
      },
    });

    expect(
      host.terminateWorker(worker, {
        initialSignal: 'SIGTERM',
        graceSeconds: 1,
        forceKill: false,
        proveEmptyTimeoutSeconds: 1,
      }),
    ).toMatchObject({
      proof: {
        signalSent: true,
        graceObserved: true,
        forceKillSent: false,
        reaped: true,
        containmentEmpty: true,
      },
    });

    expect(
      host.terminateWorker(
        {
          ...worker,
          handleId: 'worker-stale',
        },
        {
          initialSignal: 'SIGTERM',
          graceSeconds: 1,
          forceKill: true,
          proveEmptyTimeoutSeconds: 1,
        },
      ),
    ).toMatchObject({
      proof: {
        containmentEmpty: false,
      },
      failure: {
        reason: 'termination-unproven',
      },
    });

    expect(
      host.terminateWorker(
        {
          ...worker,
          containmentRef: 'containment-forged',
        },
        {
          initialSignal: 'SIGTERM',
          graceSeconds: 1,
          forceKill: true,
          proveEmptyTimeoutSeconds: 1,
        },
      ),
    ).toMatchObject({
      proof: {
        containmentEmpty: false,
      },
      failure: {
        reason: 'termination-unproven',
      },
    });

    const wontDie = createHostWontDieMockExecutionHost({
      driverId: 'mock-execution-host',
      driverVersion: 'mock@1.0.0',
      platform: 'test-platform',
      clock: { nowIso: () => now },
      idGenerator: createIds(),
      attestationExpiry: expiry,
    });
    const [canKill] = wontDie.probeCapabilities({ ...probeScope(['canKill']), egressPolicy: undefined });
    expect(canKill).toMatchObject({ capability: 'canKill', result: 'negative' });

    const stuckWorker = wontDie.spawnWorker(spawnRequest(wontDie));
    if (isHostFailure(stuckWorker)) {
      throw new Error(stuckWorker.reason);
    }
    expect(
      wontDie.terminateWorker(stuckWorker, {
        initialSignal: 'SIGTERM',
        graceSeconds: 1,
        forceKill: true,
        proveEmptyTimeoutSeconds: 1,
      }),
    ).toMatchObject({
      proof: {
        containmentEmpty: false,
      },
      failure: {
        reason: 'termination-unproven',
      },
    });
  });

  it('AC-3 returns complete command capture and maps incomplete capture to HostFailure', () => {
    const host = createHost();
    const result = host.runCommand(commandRequest(host));

    expect(result).toMatchObject({
      operationId: 'op-1',
      cwd: '/workspace/repo',
      exitCode: 0,
      redactionApplied: true,
      startedAt: now,
      finishedAt: now,
    });
    expect(isHostFailure(result)).toBe(false);
    if (!isHostFailure(result)) {
      expect(result.commandDigest).toMatch(/^sha256:/);
      expect(result.outputDigest).toMatch(/^sha256:/);
      expect(result.stdoutRef.redactionState).toBe('redacted');
      expect(result.stderrRef.redactionState).toBe('redacted');
    }

    const incomplete = createHost({ commandCapture: { omitField: 'outputDigest' } });
    expect(incomplete.runCommand(commandRequest(incomplete))).toMatchObject({
      reason: 'runner-command-capture-incomplete',
    });
  });

  it('AC-4 egress-leak probe is negative and later egress-required operations fail closed', () => {
    const host = createEgressLeakMockExecutionHost({
      driverId: 'mock-execution-host',
      driverVersion: 'mock@1.0.0',
      platform: 'test-platform',
      clock: { nowIso: () => now },
      idGenerator: createIds(),
      attestationExpiry: expiry,
    });
    const [attestation] = host.probeCapabilities(probeScope(['egress-confinement']));

    expect(attestation).toMatchObject({
      capability: 'egress-confinement',
      result: 'negative',
      details: {
        egressPolicyDigest: 'sha256:egress-runner',
      },
    });
    expect(host.runCommand(commandRequest(host))).toMatchObject({
      reason: 'egress-confinement-unattested',
    });

    const missingPolicyHost = createHost();
    const [missingPolicyAttestation] = missingPolicyHost.probeCapabilities({
      ...probeScope(['egress-confinement']),
      egressPolicy: undefined,
    });
    expect(missingPolicyAttestation).toMatchObject({
      capability: 'egress-confinement',
      result: 'negative',
      details: {
        egressPolicyDigest: 'sha256:missing-egress-policy',
        negativeProbeResults: [],
      },
    });

    const noProbeHost = createHost();
    const policyWithoutNegativeProbes = {
      ...egressPolicy('runner'),
      negativeProbes: [],
      egressPolicyDigest: 'sha256:no-probes',
    };
    const [noProbeAttestation] = noProbeHost.probeCapabilities({
      ...probeScope(['egress-confinement']),
      egressPolicy: policyWithoutNegativeProbes,
    });
    expect(noProbeAttestation).toMatchObject({
      capability: 'egress-confinement',
      result: 'negative',
      details: {
        egressPolicyDigest: 'sha256:no-probes',
        negativeProbeResults: [],
      },
    });

    const requestWithNegativeAttestation = commandRequest(noProbeHost);
    expect(
      noProbeHost.runCommand({
        ...requestWithNegativeAttestation,
        injection: {
          ...requestWithNegativeAttestation.injection,
          attestationEventIds: noProbeAttestation.eventId ? [noProbeAttestation.eventId] : [],
        },
      }),
    ).toMatchObject({
      reason: 'egress-confinement-unattested',
    });
  });

  it('AC-4 accepts planner attestation event ids but not evidence artifact ids', () => {
    const host = createHost();
    const [attestation] = host.probeCapabilities(probeScope(['egress-confinement']));
    if (!attestation.eventId) {
      throw new Error('missing attestation event id');
    }

    const workspace = attach(host);
    const request = commandRequest(host, workspace);

    expect(
      host.runCommand({
        ...request,
        injection: injection('runner', 'op-1', [attestation.eventId]),
      }),
    ).toMatchObject({
      operationId: 'op-1',
    });

    expect(
      host.runCommand({
        ...request,
        injection: injection('runner', 'op-1', [attestation.evidenceRef.id]),
      }),
    ).toMatchObject({
      reason: 'egress-confinement-unattested',
    });
  });

  it('AC-5 reports each containment strength, treats unknown as negative, and consumes attested value only', () => {
    const strengths: ContainmentStrength[] = ['none', 'process-group', 'kernel-tree', 'job-object'];

    for (const strength of strengths) {
      const host = createHost({ containmentStrength: strength });
      const [attestation] = host.probeCapabilities({ ...probeScope(['containmentStrength']), egressPolicy: undefined });
      expect(attestation).toMatchObject({
        result: 'positive',
        details: {
          containmentStrength: strength,
        },
      });
      expect(getAttestedContainmentStrength(attestation)).toBe(strength);
    }

    const unknown = createHost({ containmentStrength: 'namespace-jail' });
    const [unknownAttestation] = unknown.probeCapabilities({
      ...probeScope(['containmentStrength']),
      egressPolicy: undefined,
    });
    expect(unknownAttestation).toMatchObject({
      result: 'negative',
      details: {
        containmentStrength: 'namespace-jail',
      },
    });

    const falseContainment = createHost({ containmentStrength: 'kernel-tree', actualContainmentStrength: 'none' });
    const [falseContainmentAttestation] = falseContainment.probeCapabilities({
      ...probeScope(['containmentStrength']),
      egressPolicy: undefined,
    });
    expect(getAttestedContainmentStrength(falseContainmentAttestation)).toBe('kernel-tree');
    expect(falseContainment.readArtifact(falseContainmentAttestation.evidenceRef).text).toContain(
      '"actualContainmentStrength":"none"',
    );
  });

  it('AC-6 rejects worker and runner requests with mismatched injection party, audience, or operation', () => {
    const spawnMismatchCases = [
      (context: HostInjectionContext) => ({ ...context, party: 'runner' as const }),
      (context: HostInjectionContext): HostInjectionContext => ({
        ...context,
        egressPolicy: { ...context.egressPolicy, audience: 'runner' as const },
      }),
      (context: HostInjectionContext) => ({ ...context, operationId: 'op-other' }),
    ];
    const commandMismatchCases = [
      (context: HostInjectionContext) => ({ ...context, party: 'worker' as const }),
      (context: HostInjectionContext): HostInjectionContext => ({
        ...context,
        egressPolicy: { ...context.egressPolicy, audience: 'worker' as const },
      }),
      (context: HostInjectionContext) => ({ ...context, operationId: 'op-other' }),
    ];

    for (const mutate of spawnMismatchCases) {
      const spawnHost = createHost();
      const spawn = spawnRequest(spawnHost);
      expect(spawnHost.spawnWorker({ ...spawn, injection: mutate(spawn.injection) })).toMatchObject({
        reason: 'credential-injection-rejected',
      });
      expect(spawnHost.inspect().activeWorkerCount).toBe(0);
    }

    for (const mutate of commandMismatchCases) {
      const commandHost = createHost();
      const command = commandRequest(commandHost);
      expect(commandHost.runCommand({ ...command, injection: mutate(command.injection) })).toMatchObject({
        reason: 'credential-injection-rejected',
      });
      expect(commandHost.inspect().commandCount).toBe(0);
    }
  });

  it('AC-6 rejects expired injection, egress policy, and redaction contexts before tracking material', () => {
    const expired = '2026-06-19T07:59:59.999Z';
    const expiryCases = [
      (context: HostInjectionContext): HostInjectionContext => ({ ...context, expiresAt: expired }),
      (context: HostInjectionContext): HostInjectionContext => ({
        ...context,
        egressPolicy: { ...context.egressPolicy, expiresAt: expired },
      }),
      (context: HostInjectionContext): HostInjectionContext => ({
        ...context,
        redactionSet: { ...context.redactionSet, expiresAt: expired },
      }),
    ];

    for (const mutate of expiryCases) {
      const commandHost = createHost();
      const command = commandRequest(commandHost);
      expect(commandHost.runCommand({ ...command, injection: mutate(command.injection) })).toMatchObject({
        reason: 'credential-injection-rejected',
      });
      expect(commandHost.inspect().commandCount).toBe(0);
      expect(commandHost.inspect().activeInjectedMaterialCount).toBe(0);

      const spawnHost = createHost();
      const spawn = spawnRequest(spawnHost);
      expect(spawnHost.spawnWorker({ ...spawn, injection: mutate(spawn.injection) })).toMatchObject({
        reason: 'credential-injection-rejected',
      });
      expect(spawnHost.inspect().activeWorkerCount).toBe(0);
      expect(spawnHost.inspect().activeInjectedMaterialCount).toBe(0);
    }
  });

  it('AC-7 rejects attachWorkspace when cwd escapes the mount', () => {
    const host = createHost();

    expect(
      host.attachWorkspace(
        workspaceAttachment({
          mountRef: '/workspace/repo',
          cwd: '/workspace/repo/../outside',
        }),
      ),
    ).toMatchObject({
      reason: 'workspace-cwd-outside-mount',
    });

    const commandHost = createHost();
    const command = commandRequest(commandHost);
    expect(commandHost.runCommand({ ...command, cwd: '/workspace/outside' })).toMatchObject({
      reason: 'workspace-cwd-outside-mount',
    });
  });

  it('AC-8 emits redacted output observations and host-failure observations for corrupted output', async () => {
    const secret = 'SECRET123';
    const host = createHost({
      workerScript: {
        outputs: [{ stream: 'stdout', text: `visible ${secret}` }],
      },
      secretMaterialsByOperation: {
        'op-1': [secret],
      },
    });
    const worker = host.spawnWorker(spawnRequest(host));
    if (isHostFailure(worker)) {
      throw new Error(worker.reason);
    }

    const observations = await collect(host.observeWorker(worker));
    const [output] = observations.filter((observation) => observation.type === 'output');
    expect(hostObservationSchema.parse(output)).toMatchObject({
      type: 'output',
      redactionApplied: true,
    });
    if (output?.type !== 'output') {
      throw new Error('missing output observation');
    }
    expect(host.readArtifact(output.outputRef).text).not.toContain(secret);

    const corrupt = createHost({
      workerScript: {
        corruptObservation: true,
      },
    });
    const corruptWorker = corrupt.spawnWorker(spawnRequest(corrupt));
    if (isHostFailure(corruptWorker)) {
      throw new Error(corruptWorker.reason);
    }
    expect(await collect(corrupt.observeWorker(corruptWorker))).toEqual([
      expect.objectContaining({
        type: 'host-failure',
        failure: expect.objectContaining({
          reason: 'host-observation-incomplete',
        }),
      }),
    ]);

    const invalidOutput = createHost({
      workerScript: {
        outputs: [{ stream: 'invalid', text: 'bad stream' } as never],
      },
    });
    const invalidWorker = invalidOutput.spawnWorker(spawnRequest(invalidOutput));
    if (isHostFailure(invalidWorker)) {
      throw new Error(invalidWorker.reason);
    }
    expect(await collect(invalidOutput.observeWorker(invalidWorker))).toEqual([
      expect.objectContaining({
        type: 'host-failure',
        failure: expect.objectContaining({
          reason: 'host-observation-incomplete',
        }),
      }),
    ]);
  });

  it('AC-8 property: arbitrary injected secret never appears in captured artifacts', async () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('');

    await fc.assert(
      fc.asyncProperty(fc.array(fc.constantFrom(...chars), { minLength: 1, maxLength: 24 }), async (parts) => {
        const secret = parts.join('');
        const host = createHost({
          workerScript: {
            outputs: [{ stream: 'stdout', text: `before ${secret} after` }],
          },
          secretMaterialsByOperation: {
            'op-1': [secret],
          },
        });
        const worker = host.spawnWorker(spawnRequest(host));
        if (isHostFailure(worker)) {
          throw new Error(worker.reason);
        }
        const observations = await collect(host.observeWorker(worker));
        const outputRefs = observations.flatMap((observation) =>
          observation.type === 'output' ? [observation.outputRef] : [],
        );

        expect(outputRefs).not.toHaveLength(0);
        for (const ref of outputRefs) {
          expect(host.readArtifact(ref).text).not.toContain(secret);
        }
      }),
      { numRuns: 100, seed: 20260619 },
    );
  });

  it('AC-9 releaseWorkspace confirms credential destruction only when all injected material is gone', () => {
    const host = createHost();
    const workspace = attach(host);
    const worker = host.spawnWorker(spawnRequest(host, workspace));
    if (isHostFailure(worker)) {
      throw new Error(worker.reason);
    }

    expect(host.inspect().activeInjectedMaterialCount).toBeGreaterThan(0);
    expect(host.releaseWorkspace(workspace)).toMatchObject({
      released: true,
      credentialMaterialDestroyed: true,
    });
    expect(host.inspect().activeInjectedMaterialCount).toBe(0);

    const failed = createHost({ releaseMode: 'credential-destroy-unconfirmed' });
    const failedWorkspace = attach(failed);
    const failedWorker = failed.spawnWorker(spawnRequest(failed, failedWorkspace));
    if (isHostFailure(failedWorker)) {
      throw new Error(failedWorker.reason);
    }
    expect(failed.releaseWorkspace(failedWorkspace)).toMatchObject({
      released: true,
      credentialMaterialDestroyed: false,
      failure: {
        reason: 'credential-destroy-unconfirmed',
      },
    });
  });

  it('AC-10 probeCapabilities returns only scoped capabilities and empty scope returns none', () => {
    const host = createHost();

    expect(host.probeCapabilities({ ...probeScope([]), egressPolicy: undefined })).toEqual([]);
    expect(
      host
        .probeCapabilities({ ...probeScope(['canKill', 'emitsStructuredToolExit']), egressPolicy: undefined })
        .map((attestation) => attestation.capability),
    ).toEqual(['canKill', 'emitsStructuredToolExit']);
  });
});
