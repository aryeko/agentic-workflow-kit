import {
  type ArtifactRef,
  type CommandResult,
  type ContainmentStrength,
  commandResultSchema,
  type ExecutionHost,
  type HostCapability,
  type HostCapabilityAttestation,
  type HostCommandRequest,
  type HostFailure,
  type HostFailureReason,
  type HostInjectionContext,
  type HostObservation,
  type HostProbeScope,
  type HostReleaseResult,
  type HostWorkspaceHandle,
  hostCapabilityAttestationSchema,
  hostObservationSchema,
  isContainmentStrength,
  isHostFailure,
  type SpawnWorkerRequest,
  type TerminationPolicy,
  type TerminationResult,
  type WorkerHandle,
  workspaceAttachmentSchema,
} from '@kit-vnext/contracts-execution-host';
import { stableHash } from '@kit-vnext/foundation-fnd-01';

export interface MockClock {
  nowIso(): string;
}

export interface MockIdGenerator {
  nextId(purpose: string): string;
}

export type MockOutputChunk = {
  readonly stream: 'stdout' | 'stderr';
  readonly text: string;
};

export type MockReleaseMode = 'destroy' | 'credential-destroy-unconfirmed';

export interface MockExecutionHostOptions {
  readonly driverId: string;
  readonly driverVersion: string;
  readonly platform: string;
  readonly clock: MockClock;
  readonly idGenerator: MockIdGenerator;
  readonly attestationExpiry: string;
  readonly canKill?: boolean;
  readonly containmentStrength?: ContainmentStrength | string;
  readonly actualContainmentStrength?: ContainmentStrength;
  readonly emitsStructuredToolExit?: boolean;
  readonly egressMode?: 'confined' | 'egress-leak';
  readonly termination?: {
    readonly hostWontDie?: boolean;
    readonly omitSteps?: readonly (keyof Omit<
      TerminationResult['proof'],
      'containmentEmpty' | 'evidenceRef' | 'checkedAt'
    >)[];
  };
  readonly commandCapture?: {
    readonly omitField?: keyof CommandResult;
    readonly stdout?: string;
    readonly stderr?: string;
    readonly exitCode?: number;
    readonly signal?: string;
  };
  readonly workerScript?: {
    readonly outputs?: readonly MockOutputChunk[];
    readonly corruptObservation?: boolean;
  };
  readonly secretMaterialsByOperation?: Readonly<Record<string, readonly string[]>>;
  readonly releaseMode?: MockReleaseMode;
}

export interface MockArtifactReadResult {
  readonly found: boolean;
  readonly ref: ArtifactRef;
  readonly text: string;
}

export interface MockExecutionHostInspection {
  readonly activeWorkerCount: number;
  readonly commandCount: number;
  readonly activeInjectedMaterialCount: number;
}

export interface MockExecutionHost extends ExecutionHost {
  readArtifact(ref: ArtifactRef): MockArtifactReadResult;
  inspect(): MockExecutionHostInspection;
}

type StoredArtifact = {
  readonly ref: ArtifactRef;
  readonly text: string;
};

type WorkerRecord = {
  readonly handle: WorkerHandle;
  readonly injection: HostInjectionContext;
};

export const createMockExecutionHost = (options: MockExecutionHostOptions): MockExecutionHost =>
  new InMemoryMockExecutionHost(options);

export const createHostWontDieMockExecutionHost = (
  options: Omit<MockExecutionHostOptions, 'canKill' | 'termination'>,
): MockExecutionHost =>
  createMockExecutionHost({
    ...options,
    canKill: false,
    termination: {
      hostWontDie: true,
    },
  });

export const createEgressLeakMockExecutionHost = (
  options: Omit<MockExecutionHostOptions, 'egressMode'>,
): MockExecutionHost =>
  createMockExecutionHost({
    ...options,
    egressMode: 'egress-leak',
  });

class InMemoryMockExecutionHost implements MockExecutionHost {
  readonly #options: MockExecutionHostOptions;
  readonly #artifacts = new Map<string, StoredArtifact>();
  readonly #attestations = new Map<string, HostCapabilityAttestation>();
  readonly #workspaces = new Map<string, HostWorkspaceHandle>();
  readonly #workers = new Map<string, WorkerRecord>();
  readonly #operationMaterials = new Map<string, ReadonlySet<string>>();
  readonly #commands: CommandResult[] = [];

  constructor(options: MockExecutionHostOptions) {
    this.#options = options;
  }

  probeCapabilities(scope: HostProbeScope): readonly HostCapabilityAttestation[] {
    return scope.capabilities.map((capability) => this.#attestationFor(capability, scope));
  }

  attachWorkspace(workspace: unknown): HostWorkspaceHandle | HostFailure {
    const parsed = workspaceAttachmentSchema.safeParse(workspace);
    if (!parsed.success) {
      return this.#failure('workspace-mount-unavailable', 'workspace attachment is invalid', false);
    }

    const root = this.#workspaceRoot(parsed.data);
    if (parsed.data.cwd && !isInside(root, parsed.data.cwd)) {
      return this.#failure('workspace-cwd-outside-mount', 'workspace cwd escapes the mounted workspace', false);
    }

    const handle: HostWorkspaceHandle = {
      handleId: this.#options.idGenerator.nextId('host-workspace'),
      workspace: parsed.data,
      cwdRoot: normalizePath(root),
      driverId: this.#options.driverId,
      attachedAt: this.#options.clock.nowIso(),
    };
    this.#workspaces.set(handle.handleId, handle);
    return handle;
  }

  spawnWorker(request: SpawnWorkerRequest): WorkerHandle | HostFailure {
    const cwdFailure = this.#validateCwd(request.workspace, request.cwd);
    if (cwdFailure) {
      return cwdFailure;
    }

    const injectionFailure = this.#validateInjection('worker', request.operationId, request.injection);
    if (injectionFailure) {
      return injectionFailure;
    }

    this.#trackInjectedMaterial(request.injection);
    const handle: WorkerHandle = {
      handleId: this.#options.idGenerator.nextId('worker'),
      runId: request.runId,
      operationId: request.operationId,
      workspaceHandleId: request.workspace.handleId,
      ownershipClass: 'owned',
      containmentRef: this.#options.idGenerator.nextId('containment'),
      startedAt: this.#options.clock.nowIso(),
    };
    this.#workers.set(handle.handleId, { handle, injection: request.injection });
    return handle;
  }

  async *observeWorker(handle: WorkerHandle): AsyncIterable<HostObservation> {
    const worker = this.#workers.get(handle.handleId);
    if (!worker) {
      yield this.#hostFailureObservation(undefined, 'host-observation-incomplete', 'unknown worker handle');
      return;
    }

    if (this.#options.workerScript?.corruptObservation) {
      yield this.#hostFailureObservation(
        handle.handleId,
        'host-observation-incomplete',
        'scripted observation corrupted',
      );
      return;
    }

    for (const output of this.#workerOutputs()) {
      const redacted = this.#redact(output.text, worker.injection);
      const outputRef = this.#artifact(redacted, 'text/plain', 'host-output');
      const observation = hostObservationSchema.safeParse({
        type: 'output',
        handleId: handle.handleId,
        stream: output.stream,
        outputRef,
        digest: stableHash(redacted),
        redactionApplied: true,
        at: this.#options.clock.nowIso(),
      });

      if (!observation.success) {
        yield this.#hostFailureObservation(
          handle.handleId,
          'host-observation-incomplete',
          'output observation failed schema validation',
        );
        return;
      }

      yield observation.data;
    }

    yield {
      type: 'process-exit',
      handleId: handle.handleId,
      exitCode: 0,
      at: this.#options.clock.nowIso(),
    };
  }

  terminateWorker(handle: WorkerHandle, policy: TerminationPolicy): TerminationResult {
    const omitted = new Set(this.#options.termination?.omitSteps ?? []);
    const proofBase = {
      signalSent: !omitted.has('signalSent'),
      graceObserved: !omitted.has('graceObserved'),
      forceKillSent: policy.forceKill && !omitted.has('forceKillSent'),
      reaped: !this.#options.termination?.hostWontDie && !omitted.has('reaped'),
    };
    const containmentEmpty =
      proofBase.signalSent && proofBase.graceObserved && proofBase.forceKillSent && proofBase.reaped;
    const evidenceRef = this.#artifact(
      { handleId: handle.handleId, policy, proof: proofBase, containmentEmpty },
      'application/json',
      'termination-proof',
    );
    const failure = containmentEmpty
      ? undefined
      : this.#failure('termination-unproven', 'termination ladder did not prove empty containment', true);

    return {
      handleId: handle.handleId,
      terminalExitCode: containmentEmpty ? 0 : undefined,
      proof: {
        ...proofBase,
        containmentEmpty,
        evidenceRef,
        checkedAt: this.#options.clock.nowIso(),
      },
      ...(failure ? { failure } : {}),
    };
  }

  runCommand(request: HostCommandRequest): CommandResult | HostFailure {
    const cwdFailure = this.#validateCwd(request.workspace, request.cwd);
    if (cwdFailure) {
      return cwdFailure;
    }

    const injectionFailure = this.#validateInjection(request.party, request.operationId, request.injection);
    if (injectionFailure) {
      return injectionFailure;
    }

    this.#trackInjectedMaterial(request.injection);
    const stdout = this.#redact(
      this.#options.commandCapture?.stdout ?? `mock stdout for ${request.operationId}`,
      request.injection,
    );
    const stderr = this.#redact(this.#options.commandCapture?.stderr ?? '', request.injection);
    const stdoutRef = this.#artifact(stdout, 'text/plain', 'runner-command-stdout');
    const stderrRef = this.#artifact(stderr, 'text/plain', 'runner-command-stderr');
    const exitShape =
      this.#options.commandCapture?.signal !== undefined
        ? { signal: this.#options.commandCapture.signal }
        : { exitCode: this.#options.commandCapture?.exitCode ?? 0 };
    const commandResult = {
      operationId: request.operationId,
      commandDigest: stableHash({
        argv: request.argv,
        cwd: request.cwd,
        kind: request.kind,
      }),
      cwd: request.cwd,
      ...exitShape,
      stdoutRef,
      stderrRef,
      outputDigest: stableHash({ stdout: stdoutRef.digest, stderr: stderrRef.digest }),
      redactionApplied: true,
      startedAt: this.#options.clock.nowIso(),
      finishedAt: this.#options.clock.nowIso(),
    } satisfies CommandResult;
    const candidate = this.#options.commandCapture?.omitField
      ? omitField(commandResult, this.#options.commandCapture.omitField)
      : commandResult;
    const parsed = commandResultSchema.safeParse(candidate);

    if (!parsed.success) {
      return this.#failure('runner-command-capture-incomplete', 'runner command capture is incomplete', false);
    }

    this.#commands.push(parsed.data);
    return parsed.data;
  }

  releaseWorkspace(handle: HostWorkspaceHandle): HostReleaseResult {
    const failed = this.#options.releaseMode === 'credential-destroy-unconfirmed';
    if (!failed) {
      this.#operationMaterials.clear();
    }

    const credentialMaterialDestroyed = this.#operationMaterials.size === 0;
    const failure = credentialMaterialDestroyed
      ? undefined
      : this.#failure('credential-destroy-unconfirmed', 'credential material destruction could not be confirmed', true);
    return {
      workspaceHandleId: handle.handleId,
      released: true,
      credentialMaterialDestroyed,
      evidenceRef: this.#artifact(
        {
          workspaceHandleId: handle.handleId,
          credentialMaterialDestroyed,
        },
        'application/json',
        'workspace-release',
      ),
      at: this.#options.clock.nowIso(),
      ...(failure ? { failure } : {}),
    };
  }

  readArtifact(ref: ArtifactRef): MockArtifactReadResult {
    const stored = this.#artifacts.get(ref.id);
    return {
      found: Boolean(stored),
      ref,
      text: stored?.text ?? '',
    };
  }

  inspect(): MockExecutionHostInspection {
    return {
      activeWorkerCount: this.#workers.size,
      commandCount: this.#commands.length,
      activeInjectedMaterialCount: [...this.#operationMaterials.values()].reduce((count, set) => count + set.size, 0),
    };
  }

  #attestationFor(capability: HostCapability, scope: HostProbeScope): HostCapabilityAttestation {
    const details = this.#attestationDetails(capability, scope);
    const result = this.#attestationResult(capability, scope);
    const evidenceRef = this.#artifact(
      { capability, result, details, ...this.#attestationEvidence(capability) },
      'application/json',
      'capability-attestation',
    );
    const scopeRecord = compactRecord({
      driverId: scope.driverId,
      workspaceKind: scope.workspaceKind,
      freshnessKey: scope.freshnessKey,
      egressPolicyDigest: scope.egressPolicy?.egressPolicyDigest,
      scopeDigest: scope.egressPolicy?.requiredAttesters[0]?.scopeDigest,
    });
    const parsed = hostCapabilityAttestationSchema.parse({
      capability,
      probeMethod: `mock-${capability}-probe`,
      result,
      evidenceRef,
      scope: scopeRecord,
      expiry: this.#options.attestationExpiry,
      driverVersion: this.#options.driverVersion,
      platform: this.#options.platform,
      freshnessKey: scope.freshnessKey,
      at: this.#options.clock.nowIso(),
      ...(details ? { details } : {}),
    });
    this.#attestations.set(parsed.evidenceRef.id, parsed);
    return parsed;
  }

  #attestationResult(capability: HostCapability, scope: HostProbeScope): 'positive' | 'negative' {
    if (capability === 'canKill') {
      return this.#canKill() ? 'positive' : 'negative';
    }
    if (capability === 'containmentStrength') {
      return isContainmentStrength(this.#reportedContainmentStrength()) ? 'positive' : 'negative';
    }
    if (capability === 'emitsStructuredToolExit') {
      return this.#options.emitsStructuredToolExit === false ? 'negative' : 'positive';
    }
    if (!scope.egressPolicy || scope.egressPolicy.negativeProbes.length === 0) {
      return 'negative';
    }
    return this.#options.egressMode === 'egress-leak' ? 'negative' : 'positive';
  }

  #attestationDetails(capability: HostCapability, scope: HostProbeScope): HostCapabilityAttestation['details'] {
    if (capability === 'containmentStrength') {
      return {
        containmentStrength: this.#reportedContainmentStrength(),
      };
    }
    if (capability === 'egress-confinement') {
      return {
        egressPolicyDigest: scope.egressPolicy?.egressPolicyDigest ?? 'sha256:missing-egress-policy',
        negativeProbeResults: (scope.egressPolicy?.negativeProbes ?? []).map((probe) => ({
          id: probe.id,
          host: probe.host,
          protocol: probe.protocol,
          expected: probe.expected,
          observed: this.#options.egressMode === 'egress-leak' ? 'reachable' : 'blocked',
          reason: probe.reason,
        })),
      };
    }
    return undefined;
  }

  #reportedContainmentStrength(): string {
    return this.#options.containmentStrength ?? 'process-group';
  }

  #attestationEvidence(capability: HostCapability): Readonly<Record<string, string>> {
    if (capability !== 'containmentStrength' || !this.#options.actualContainmentStrength) {
      return {};
    }

    return {
      actualContainmentStrength: this.#options.actualContainmentStrength,
    };
  }

  #canKill(): boolean {
    return (
      this.#options.canKill !== false &&
      this.#options.termination?.hostWontDie !== true &&
      (this.#options.termination?.omitSteps?.length ?? 0) === 0
    );
  }

  #validateCwd(workspace: HostWorkspaceHandle, cwd: string): HostFailure | undefined {
    return isInside(workspace.cwdRoot, cwd)
      ? undefined
      : this.#failure('workspace-cwd-outside-mount', 'operation cwd escapes the mounted workspace', false);
  }

  #validateInjection(
    party: HostInjectionContext['party'],
    operationId: string,
    injection: HostInjectionContext,
  ): HostFailure | undefined {
    if (
      injection.party !== party ||
      injection.egressPolicy.audience !== party ||
      injection.operationId !== operationId
    ) {
      return this.#failure(
        'credential-injection-rejected',
        'credential injection context does not match request',
        false,
      );
    }

    return this.#hasPositiveEgressAttestation(injection)
      ? undefined
      : this.#failure('egress-confinement-unattested', 'egress confinement is not positively attested', false);
  }

  #hasPositiveEgressAttestation(injection: HostInjectionContext): boolean {
    const policy = injection.egressPolicy;
    return injection.attestationEventIds.some((attestationId) => {
      const attestation = this.#attestations.get(attestationId);
      return (
        attestation?.capability === 'egress-confinement' &&
        attestation.result === 'positive' &&
        attestation.driverVersion === this.#options.driverVersion &&
        attestation.platform === this.#options.platform &&
        attestation.freshnessKey === policy.freshnessKey &&
        attestation.details?.egressPolicyDigest === policy.egressPolicyDigest &&
        attestation.scope.scopeDigest === injection.scopeDigest &&
        Date.parse(attestation.expiry) >= Date.parse(this.#options.clock.nowIso())
      );
    });
  }

  #trackInjectedMaterial(injection: HostInjectionContext): void {
    const materials = new Set([
      ...injection.credentialRefIds,
      ...(this.#options.secretMaterialsByOperation?.[injection.operationId] ?? []),
    ]);
    this.#operationMaterials.set(injection.operationId, materials);
  }

  #workerOutputs(): readonly MockOutputChunk[] {
    return this.#options.workerScript?.outputs ?? [{ stream: 'stdout', text: 'mock worker output' }];
  }

  #redact(text: string, injection: HostInjectionContext): string {
    const secretMaterials = this.#options.secretMaterialsByOperation?.[injection.operationId] ?? [];
    const labels = Object.entries(injection.redactionSet.labels).flat();
    const tokens = [...new Set([...secretMaterials, ...labels].filter((value) => value.length > 0))];

    return tokens.reduce((redacted, token) => redacted.split(token).join('***'), text);
  }

  #workspaceRoot(workspace: {
    readonly leaseId: string;
    readonly worktreePath?: string;
    readonly mountRef?: string;
  }): string {
    return workspace.worktreePath ?? workspace.mountRef ?? `/workspace/${workspace.leaseId}`;
  }

  #failure(reason: HostFailureReason, message: string, retryable: boolean): HostFailure {
    return {
      reason,
      message,
      retryable,
      evidenceRef: this.#artifact({ reason, message }, 'application/json', 'host-failure'),
      at: this.#options.clock.nowIso(),
    };
  }

  #hostFailureObservation(
    handleId: string | undefined,
    reason: HostFailureReason,
    message: string,
  ): Extract<HostObservation, { type: 'host-failure' }> {
    return {
      type: 'host-failure',
      ...(handleId ? { handleId } : {}),
      failure: this.#failure(reason, message, false),
      at: this.#options.clock.nowIso(),
    };
  }

  #artifact(content: unknown, mediaType: string, producer: string): ArtifactRef {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const ref: ArtifactRef = {
      id: this.#options.idGenerator.nextId(producer),
      digest: stableHash(text),
      size: new TextEncoder().encode(text).length,
      mediaType,
      retentionClass: 'short-lived',
      classification: 'internal',
      redactionState: 'redacted',
    };
    this.#artifacts.set(ref.id, { ref, text });
    return ref;
  }
}

const omitField = <T extends Record<string, unknown>, K extends keyof T>(value: T, field: K): Omit<T, K> => {
  const { [field]: _omitted, ...rest } = value;
  return rest;
};

const compactRecord = (
  value: Readonly<Record<string, string | number | boolean | null | undefined>>,
): Readonly<Record<string, string | number | boolean | null>> =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Readonly<
    Record<string, string | number | boolean | null>
  >;

const normalizePath = (value: string): string => {
  const path = value.replace(/\\/g, '/');
  const absolute = path.startsWith('/');
  const parts = path.split('/').filter((part) => part.length > 0 && part !== '.');
  const normalized: string[] = [];

  for (const part of parts) {
    if (part === '..') {
      normalized.pop();
    } else {
      normalized.push(part);
    }
  }

  const joined = normalized.join('/');
  return absolute ? `/${joined}` : joined;
};

const isInside = (root: string, candidate: string): boolean => {
  const normalizedRoot = normalizePath(root);
  const normalizedCandidate = normalizePath(candidate);

  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}/`);
};

void isHostFailure;
