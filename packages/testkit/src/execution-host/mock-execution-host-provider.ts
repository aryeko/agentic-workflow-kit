import { createHash } from 'node:crypto';

import type {
  CapabilityAttestation,
  CapabilityAttestationResult,
  CommandResult,
  ExecutionHostProvider,
  HostCapability,
  HostCommandRequest,
  HostFailure,
  HostFailureReason,
  HostObservation,
  HostProbeScope,
  HostReleaseResult,
  HostWorkspaceHandle,
  SpawnWorkerRequest,
  TerminationProof,
  TerminationResult,
  WorkerHandle,
  WorkspaceAttachment,
} from 'sdk';

const hostFailureReasons: readonly HostFailureReason[] = [
  'host-capability-unattested',
  'workspace-mount-unavailable',
  'workspace-cwd-outside-mount',
  'credential-injection-rejected',
  'egress-confinement-unattested',
  'worker-spawn-failed',
  'host-observation-incomplete',
  'termination-unproven',
  'runner-command-capture-incomplete',
  'credential-destroy-unconfirmed',
];

const defaultAt = '2026-06-22T10:00:00.000Z';
const defaultExpiry = '2026-06-22T11:00:00.000Z';

type JsonValue = boolean | null | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type MockExecutionHostCapabilities = Partial<
  Record<HostCapability, CapabilityAttestationResult | CapabilityAttestation<HostCapability>>
>;

export type MockExecutionHostScenario = 'positive' | 'degraded' | 'incomplete-capture' | 'termination';

export type MockCapturedCommand = {
  readonly operationId: string;
  readonly kind: HostCommandRequest['kind'];
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly timeoutSeconds: number;
  readonly commandDigest: string;
  readonly result: CommandResult | HostFailure;
};

export type MockExecutionHostProvider = ExecutionHostProvider & {
  readonly getAttachedWorkspaces: () => readonly HostWorkspaceHandle[];
  readonly getCapturedCommands: () => readonly MockCapturedCommand[];
  readonly getReleasedWorkspaces: () => readonly HostReleaseResult[];
  readonly getSpawnedWorkers: () => readonly WorkerHandle[];
  readonly getTerminations: () => readonly TerminationResult[];
};

export type MockExecutionHostProviderOptions = {
  readonly at?: string;
  readonly capabilities?: MockExecutionHostCapabilities;
  readonly commandResults?: Readonly<Record<string, CommandResult | HostFailure>>;
  readonly driverId?: string;
  readonly observations?: readonly HostObservation[];
  readonly platform?: string;
  readonly scenario?: MockExecutionHostScenario;
  readonly spawnFailure?: HostFailure;
  readonly terminationProof?: TerminationProof;
  readonly version?: string;
};

export const isHostFailure = (value: unknown): value is HostFailure =>
  typeof value === 'object' &&
  value !== null &&
  'reason' in value &&
  hostFailureReasons.includes((value as { readonly reason?: HostFailureReason }).reason as HostFailureReason);

const createHostFailure = (
  reason: HostFailureReason,
  overrides: Partial<Omit<HostFailure, 'reason'>> = {},
): HostFailure => ({
  reason,
  message: `${reason} occurred`,
  retryable: false,
  evidenceRef: `artifact://execution-host/${reason}`,
  at: defaultAt,
  ...overrides,
});

const clone = <T>(value: T): T => structuredClone(value) as T;

const scenarioOptions = (
  scenario: MockExecutionHostScenario | undefined,
): Partial<MockExecutionHostProviderOptions> => {
  if (scenario === undefined || scenario === 'positive') {
    return {};
  }

  if (scenario === 'degraded') {
    return {
      observations: [
        {
          type: 'host-failure',
          failure: createHostFailure('host-observation-incomplete'),
          at: defaultAt,
        },
      ],
    };
  }

  if (scenario === 'incomplete-capture') {
    return {
      commandResults: {
        'op-verify-01': createHostFailure('runner-command-capture-incomplete'),
      },
    };
  }

  return {
    terminationProof: {
      signalSent: true,
      graceObserved: true,
      forceKillSent: true,
      reaped: false,
      containmentEmpty: false,
      evidenceRef: 'artifact://execution-host/termination-unproven',
      checkedAt: defaultAt,
    },
  };
};

const canonicalJson = (value: JsonValue): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }

  const record = value as { readonly [key: string]: JsonValue };

  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
};

export const computeMockCommandDigest = (request: HostCommandRequest): string =>
  `sha256:${createHash('sha256')
    .update(
      canonicalJson({
        argv: [...request.argv],
        cwd: request.cwd,
        injection: {
          scopeDigest: request.injection.scopeDigest,
        },
        kind: request.kind,
        timeoutSeconds: request.timeoutSeconds,
      }),
    )
    .digest('hex')}`;

const normalizePath = (path: string): string => {
  const rooted = path.startsWith('/');
  const parts: string[] = [];

  for (const part of path.split('/')) {
    if (part === '' || part === '.') {
      continue;
    }

    if (part === '..') {
      parts.pop();
      continue;
    }

    parts.push(part);
  }

  const normalized = `${rooted ? '/' : ''}${parts.join('/')}`;

  return normalized.length === 0 ? (rooted ? '/' : '.') : normalized;
};

const resolveCwd = (cwdRoot: string, cwd: string): string =>
  normalizePath(cwd.startsWith('/') ? cwd : `${cwdRoot}/${cwd}`);

const isCwdContained = (cwdRoot: string, cwd: string): boolean => {
  const root = normalizePath(cwdRoot);
  const resolved = resolveCwd(root, cwd);

  return resolved === root || resolved.startsWith(`${root}/`);
};

const defaultCapabilities: Required<MockExecutionHostCapabilities> = {
  canKill: 'positive',
  containmentStrength: 'positive',
  emitsStructuredToolExit: 'positive',
  'egress-confinement': 'positive',
};

const egressAttestationKey = (
  scopeDigest: string,
  egressPolicyDigest: string,
  driverVersion: string,
  platform: string,
  freshnessKey: string,
): string => `${scopeDigest}:${egressPolicyDigest}:${driverVersion}:${platform}:${freshnessKey}`;

const hasBlockedNegativeProbeEvidence = (scope: HostProbeScope): boolean =>
  (scope.egressPolicy?.negativeProbes.length ?? 0) > 0 &&
  (scope.egressPolicy?.negativeProbes.every((probe) => probe.expected === 'blocked') ?? false) &&
  scope.egressPolicy?.freshnessKey === scope.freshnessKey;

const createAttestation = (
  capability: HostCapability,
  result: CapabilityAttestationResult | CapabilityAttestation<HostCapability>,
  scope: HostProbeScope,
): CapabilityAttestation<HostCapability> => {
  if (typeof result !== 'string') {
    return result;
  }

  const attestationResult =
    capability === 'egress-confinement' && result === 'positive' && !hasBlockedNegativeProbeEvidence(scope)
      ? 'negative'
      : result;

  return {
    capability,
    probeMethod: 'testkit-script',
    result: attestationResult,
    evidenceRef: `artifact://execution-host/capability/${capability}`,
    scope: 'execution-host',
    expiry: defaultExpiry,
    driverVersion: scope.driverVersion,
    platform: scope.platform,
    freshnessKey: scope.freshnessKey,
    at: scope.at,
    details: {
      ...(capability === 'containmentStrength' ? { containmentStrength: 'process-group' } : {}),
      ...(capability === 'egress-confinement' && scope.egressPolicy
        ? {
            egressPolicyDigest: scope.egressPolicy.egressPolicyDigest,
            negativeProbeResults: scope.egressPolicy.negativeProbes,
          }
        : {}),
    },
  };
};

const createWorkspaceHandle = (
  workspace: WorkspaceAttachment,
  handleId: string,
  cwdRoot: string,
  driverId: string,
  at: string,
): HostWorkspaceHandle => ({
  handleId,
  workspace,
  cwdRoot,
  driverId,
  attachedAt: at,
});

const defaultObservations = (handle: WorkerHandle, at: string): readonly HostObservation[] => [
  {
    type: 'output',
    handleId: handle.handleId,
    stream: 'stdout',
    outputRef: `artifact://execution-host/${handle.handleId}/stdout`,
    digest: `sha256:${handle.handleId}:stdout`,
    redactionApplied: true,
    at,
  },
  {
    type: 'structured-tool-exit',
    handleId: handle.handleId,
    tool: 'apply_patch',
    exitCode: 0,
    payloadRef: `artifact://execution-host/${handle.handleId}/tool-exit`,
    digest: `sha256:${handle.handleId}:tool-exit`,
    at,
  },
  {
    type: 'process-exit',
    handleId: handle.handleId,
    exitCode: 0,
    at,
  },
];

const withObservationHandle = (observation: HostObservation, handle: WorkerHandle): HostObservation => {
  if (observation.type === 'host-failure') {
    return { ...observation, handleId: observation.handleId ?? handle.handleId };
  }

  return { ...observation, handleId: handle.handleId };
};

const validateInjection = (
  request: Pick<HostCommandRequest | SpawnWorkerRequest, 'injection' | 'operationId' | 'party'>,
  driverId: string,
  driverVersion: string,
  platform: string,
  positiveEgressAttestationKeys: readonly string[],
): HostFailure | undefined => {
  if (
    request.injection.operationId !== request.operationId ||
    request.injection.party !== request.party ||
    request.injection.egressPolicy.audience !== request.party ||
    request.injection.egressPolicy.operationId !== request.operationId ||
    request.injection.requiredAuditEvent.operationId !== request.operationId ||
    request.injection.requiredAuditEvent.party !== request.party ||
    request.injection.requiredAuditEvent.scopeDigest !== request.injection.scopeDigest ||
    request.injection.requiredAuditEvent.egressPolicyId !== request.injection.egressPolicy.id ||
    request.injection.egressPolicy.freshnessKey.length === 0
  ) {
    return createHostFailure('credential-injection-rejected');
  }

  const requiredAttester = request.injection.egressPolicy.requiredAttesters.find(
    (attester) =>
      attester.point === 'execution-host' &&
      attester.capability === 'egress-confinement' &&
      attester.driverId === driverId &&
      attester.scopeDigest === request.injection.scopeDigest &&
      attester.egressPolicyDigest === request.injection.egressPolicy.egressPolicyDigest,
  );

  if (
    requiredAttester === undefined ||
    request.injection.attestationEventIds.length === 0 ||
    request.injection.requiredAuditEvent.attestationEventIds.length === 0 ||
    request.injection.attestationEventIds.some(
      (attestationId) => !request.injection.requiredAuditEvent.attestationEventIds.includes(attestationId),
    ) ||
    request.injection.egressPolicy.negativeProbes.length === 0 ||
    request.injection.egressPolicy.negativeProbes.some((probe) => probe.expected !== 'blocked')
  ) {
    return createHostFailure('egress-confinement-unattested');
  }

  const key = egressAttestationKey(
    requiredAttester.scopeDigest,
    requiredAttester.egressPolicyDigest,
    driverVersion,
    platform,
    request.injection.egressPolicy.freshnessKey,
  );

  if (!positiveEgressAttestationKeys.includes(key)) {
    return createHostFailure('egress-confinement-unattested');
  }

  return undefined;
};

export const createMockExecutionHostProvider = (
  inputOptions: MockExecutionHostProviderOptions = {},
): MockExecutionHostProvider => {
  const scenarioDefaults = scenarioOptions(inputOptions.scenario);
  const options: MockExecutionHostProviderOptions = {
    ...scenarioDefaults,
    ...inputOptions,
    commandResults: {
      ...scenarioDefaults.commandResults,
      ...inputOptions.commandResults,
    },
  };
  const at = options.at ?? defaultAt;
  const driverId = options.driverId ?? 'testkit-execution-host';
  const driverVersion = options.version ?? '0.0.0';
  const platform = options.platform ?? 'darwin-arm64';
  const capabilities = options.capabilities ?? defaultCapabilities;
  let attachedWorkspaces: readonly HostWorkspaceHandle[] = [];
  let capturedCommands: readonly MockCapturedCommand[] = [];
  let releasedWorkspaces: readonly HostReleaseResult[] = [];
  let spawnedWorkers: readonly WorkerHandle[] = [];
  let terminations: readonly TerminationResult[] = [];
  let positiveEgressAttestationKeys: readonly string[] = [];

  const attachWorkspace = (workspace: WorkspaceAttachment): HostWorkspaceHandle | HostFailure => {
    const cwdRoot =
      workspace.kind === 'local-worktree'
        ? workspace.worktreePath
        : workspace.mountRef === undefined
          ? undefined
          : `workspace-mount://${workspace.mountRef}`;

    if (cwdRoot === undefined || cwdRoot.length === 0) {
      return createHostFailure('workspace-mount-unavailable', { at });
    }

    const handle = createWorkspaceHandle(
      workspace,
      `workspace-handle-${attachedWorkspaces.length + 1}`,
      cwdRoot,
      driverId,
      at,
    );
    attachedWorkspaces = [...attachedWorkspaces, handle];

    return handle;
  };

  const spawnWorker = (request: SpawnWorkerRequest): WorkerHandle | HostFailure => {
    if (!attachedWorkspaces.some((workspace) => workspace.handleId === request.workspace.handleId)) {
      return createHostFailure('workspace-mount-unavailable', { at });
    }

    if (!isCwdContained(request.workspace.cwdRoot, request.cwd)) {
      return createHostFailure('workspace-cwd-outside-mount', { at });
    }

    const injectionFailure = validateInjection(
      request,
      driverId,
      driverVersion,
      platform,
      positiveEgressAttestationKeys,
    );

    if (injectionFailure !== undefined) {
      return injectionFailure;
    }

    if (options.spawnFailure !== undefined) {
      return options.spawnFailure;
    }

    const worker: WorkerHandle = {
      handleId: `worker-handle-${spawnedWorkers.length + 1}`,
      runId: request.runId,
      operationId: request.operationId,
      workspaceHandleId: request.workspace.handleId,
      ownershipClass: 'owned',
      containmentRef: `containment://${request.operationId}`,
      startedAt: at,
    };
    spawnedWorkers = [...spawnedWorkers, worker];

    return worker;
  };

  const runCommand = (request: HostCommandRequest): CommandResult | HostFailure => {
    const commandDigest = computeMockCommandDigest(request);

    if (!attachedWorkspaces.some((workspace) => workspace.handleId === request.workspace.handleId)) {
      return createHostFailure('workspace-mount-unavailable', { at });
    }

    if (!isCwdContained(request.workspace.cwdRoot, request.cwd)) {
      return createHostFailure('workspace-cwd-outside-mount', { at });
    }

    const injectionFailure = validateInjection(
      request,
      driverId,
      driverVersion,
      platform,
      positiveEgressAttestationKeys,
    );

    if (injectionFailure !== undefined) {
      return injectionFailure;
    }

    const scriptedResult = options.commandResults?.[request.operationId];
    const result =
      scriptedResult ??
      ({
        operationId: request.operationId,
        commandDigest,
        cwd: request.cwd,
        exitCode: 0,
        stdoutRef: `artifact://execution-host/${request.operationId}/stdout`,
        stderrRef: `artifact://execution-host/${request.operationId}/stderr`,
        outputDigest: `sha256:${createHash('sha256').update(`${request.operationId}:output`).digest('hex')}`,
        redactionApplied: true,
        startedAt: at,
        finishedAt: at,
      } satisfies CommandResult);
    const capturedResult = isHostFailure(result)
      ? result
      : { ...result, commandDigest, cwd: request.cwd, operationId: request.operationId };

    capturedCommands = [
      ...capturedCommands,
      {
        operationId: request.operationId,
        kind: request.kind,
        argv: [...request.argv],
        cwd: request.cwd,
        timeoutSeconds: request.timeoutSeconds,
        commandDigest,
        result: capturedResult,
      },
    ];

    return capturedResult;
  };

  const provider: MockExecutionHostProvider = {
    probeCapabilities: (scope) =>
      scope.capabilities.flatMap((capability) => {
        const result = capabilities[capability];
        const attestation = result === undefined ? undefined : createAttestation(capability, result, scope);

        if (
          attestation?.capability === 'egress-confinement' &&
          attestation.result === 'positive' &&
          scope.egressPolicy !== undefined
        ) {
          const matchingAttesters = scope.egressPolicy.requiredAttesters.filter(
            (attester) =>
              attester.point === 'execution-host' &&
              attester.capability === 'egress-confinement' &&
              attester.driverId === driverId &&
              attester.egressPolicyDigest === scope.egressPolicy?.egressPolicyDigest,
          );

          positiveEgressAttestationKeys = [
            ...positiveEgressAttestationKeys,
            ...matchingAttesters.map((attester) =>
              egressAttestationKey(
                attester.scopeDigest,
                attester.egressPolicyDigest,
                driverVersion,
                platform,
                scope.freshnessKey,
              ),
            ),
          ];
        }

        return attestation === undefined ? [] : [attestation];
      }),
    attachWorkspace,
    spawnWorker,
    observeWorker: async function* observeWorker(handle) {
      const observations =
        options.observations === undefined
          ? defaultObservations(handle, at)
          : options.observations.map((item) => withObservationHandle(item, handle));

      for (const observation of observations) {
        await Promise.resolve();
        yield observation;
      }
    },
    terminateWorker: (handle, policy) => {
      const forceKillSent = policy.forceKill;
      const result: TerminationResult = {
        handleId: handle.handleId,
        terminalExitCode: options.terminationProof?.containmentEmpty === false ? undefined : 0,
        terminalSignal: options.terminationProof?.containmentEmpty === false ? policy.initialSignal : undefined,
        proof: options.terminationProof ?? {
          signalSent: true,
          graceObserved: true,
          forceKillSent,
          reaped: true,
          containmentEmpty: true,
          evidenceRef: `artifact://execution-host/${handle.handleId}/termination-proof`,
          checkedAt: at,
        },
      };
      terminations = [...terminations, result];

      return result;
    },
    runCommand,
    releaseWorkspace: (handle) => {
      const result: HostReleaseResult = {
        workspaceHandleId: handle.handleId,
        released: true,
        credentialMaterialDestroyed: true,
        evidenceRef: `artifact://execution-host/${handle.handleId}/release`,
        at,
      };
      releasedWorkspaces = [...releasedWorkspaces, result];

      return result;
    },
    getAttachedWorkspaces: () => attachedWorkspaces.map((workspace) => clone(workspace)),
    getCapturedCommands: () => capturedCommands.map((command) => clone(command)),
    getReleasedWorkspaces: () => releasedWorkspaces.map((release) => clone(release)),
    getSpawnedWorkers: () => spawnedWorkers.map((worker) => clone(worker)),
    getTerminations: () => terminations.map((termination) => clone(termination)),
  };

  return provider;
};
