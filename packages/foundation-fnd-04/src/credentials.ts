import { stableHash } from '@kit-vnext/foundation-fnd-01';
import { CREDENTIAL_AUDIT_GENESIS_HASH, withCredentialAuditHash } from './audit.js';
import {
  buildMaterialRedaction,
  buildPlannedRedactionSet,
  redactValue,
  redactionLabelFor,
  type RedactionRule,
} from './redaction.js';
import type {
  AuditBase,
  AuditWriter,
  CredentialAuditEvent,
  CredentialDenied,
  CredentialDenialReason,
  CredentialMaterialDestroyed,
  CredentialRef,
  CredentialScope,
  CredentialUseDenied,
  CredentialUseFinished,
  CredentialUsePlanned,
  CredentialUseStarted,
  CredentialsAndSecretsContract,
  CredentialsAndSecretsOptions,
  EgressCapabilityAttestation,
  EgressPolicy,
  EgressPolicyIssued,
  EgressRule,
  FinishCredentialUseInput,
  InjectionBinding,
  InjectionMode,
  InjectionPlan,
  IssueEgressPolicyResult,
  PlanInjectionResult,
  RedactedInput,
  RedactionApplied,
  RedactResult,
  RedactionSet,
  ResolveCredentialResult,
} from './types.js';

const DEFAULT_RUNNER_FORGE_PHASES = [
  'push',
  'pr-create',
  'pr-update',
  'pr',
  'evidence-refresh',
  'review-metadata',
  'merge',
  'forge:push',
  'forge:pr',
  'forge:evidence',
  'forge:review-metadata',
  'forge:merge',
];

type OperationContext = {
  readonly scope: CredentialScope;
  readonly refs: readonly CredentialRef[];
  readonly policy?: EgressPolicy;
  readonly attestationEventIds: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly materialHandles: readonly string[];
  readonly tempFilePaths: readonly string[];
  readonly redactionSetIds: readonly string[];
  readonly destroyed: boolean;
};

type AuditMetadata = {
  readonly refs: readonly CredentialRef[];
  readonly scope: CredentialScope;
  readonly policy?: EgressPolicy;
  readonly attestationEventIds?: readonly string[];
  readonly evidenceRefs?: readonly string[];
};

type AttestationMatch =
  | {
      readonly ok: true;
      readonly attestationEventIds: readonly string[];
      readonly evidenceRefs: readonly string[];
    }
  | { readonly ok: false };

const credentialRefDigest = (refs: readonly CredentialRef[]): string =>
  stableHash(
    refs.map((ref) => ({
      id: ref.id,
      kind: ref.kind,
      secretRefId: ref.secret.id,
      policyDigest: ref.policyDigest,
      allowedParties: ref.allowedParties,
      allowedPhases: ref.allowedPhases,
      allowedHosts: ref.allowedHosts,
    })),
  );

const policyDigestFor = (refs: readonly CredentialRef[], policy?: EgressPolicy): string =>
  stableHash({ credentialRefs: refs.map((ref) => ref.policyDigest), egressPolicyDigest: policy?.egressPolicyDigest });

const scopeDigest = (scope: CredentialScope): string => stableHash(scope);

const isExpired = (expiresAt: string, now: Date): boolean => Date.parse(expiresAt) <= now.getTime();

const parseIsoMs = (iso: string): number | undefined => {
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const credentialEnvName = (ref: CredentialRef): string =>
  `KIT_CREDENTIAL_${ref.id
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()}`;

const bindingFor = (ref: CredentialRef, scope: CredentialScope, mode: InjectionMode): InjectionBinding => ({
  mode,
  nameOrPath:
    mode === 'env'
      ? credentialEnvName(ref)
      : `/tmp/kit-vnext-credentials/${encodeURIComponent(scope.operationId)}/${encodeURIComponent(ref.id)}`,
  redactionLabel: redactionLabelFor(ref),
});

const sourceRulesFor = (refs: readonly CredentialRef[], scope: CredentialScope, sourceRules: readonly EgressRule[]) => {
  const refIds = new Set(refs.map((ref) => ref.id));
  const scopedHosts = new Set(scope.hosts ?? []);
  return sourceRules.filter(
    (rule) =>
      rule.phase === scope.phase &&
      rule.credentialRefIds.length > 0 &&
      rule.credentialRefIds.every((credentialRefId) => refIds.has(credentialRefId)) &&
      rule.hosts.some((host) => scopedHosts.has(host)),
  );
};

const probeIds = (policy: EgressPolicy): readonly string[] => policy.negativeProbes.map((probe) => probe.id);

const hasAllProbeIds = (attestation: EgressCapabilityAttestation, policy: EgressPolicy): boolean => {
  const attested = new Set(attestation.negativeProbeIds);
  return probeIds(policy).every((id) => attested.has(id));
};

const commandPrefixAllowed = (scopePrefix: string, allowedPrefixes: readonly string[] | undefined): boolean =>
  (allowedPrefixes ?? []).some(
    (allowedPrefix) => scopePrefix === allowedPrefix || scopePrefix.startsWith(`${allowedPrefix} `),
  );

const eventWithHash = <T extends CredentialAuditEvent>(event: Omit<T, 'eventHash'>): T =>
  withCredentialAuditHash(event) as unknown as T;

class CredentialsAndSecrets implements CredentialsAndSecretsContract {
  readonly #options: CredentialsAndSecretsOptions;
  #prevEventHash = CREDENTIAL_AUDIT_GENESIS_HASH;
  readonly #operationContexts = new Map<string, OperationContext>();
  readonly #redactionRules = new Map<string, readonly RedactionRule[]>();
  readonly #redactionContexts = new Map<string, OperationContext>();

  constructor(options: CredentialsAndSecretsOptions) {
    this.#options = options;
  }

  resolveCredential(ref: CredentialRef, scope: CredentialScope): ResolveCredentialResult {
    const scopeDenial = this.#scopeDenial([ref], scope);
    if (scopeDenial) {
      return this.#deny(scopeDenial, { refs: [ref], scope });
    }

    const policy = this.#issueEgressPolicyData([ref], scope);
    if (!policy.ok) {
      return this.#deny(policy.reason, { refs: [ref], scope });
    }

    const attestations = this.#matchingAttestations(policy.value);
    if (!attestations.ok) {
      return this.#deny('egress-policy-unattested', { refs: [ref], scope, policy: policy.value });
    }

    const resolved = this.#options.secretResolver.resolve(ref);
    if (!resolved.ok) {
      return this.#deny('credential-ref-unresolved', {
        refs: [ref],
        scope,
        policy: policy.value,
        attestationEventIds: attestations.attestationEventIds,
        evidenceRefs: attestations.evidenceRefs,
      });
    }

    const mode = this.#injectionMode(ref, scope);
    const binding = bindingFor(ref, scope, mode);
    const redaction = buildMaterialRedaction(
      this.#options.idGenerator.nextId('redaction-set'),
      ref,
      resolved.value.material,
      this.#options.fingerprintKey,
      scope.expiresAt,
      mode === 'file' ? [binding.nameOrPath] : [],
    );
    const auditEvent = this.#recordEvent<CredentialUseStarted>({
      type: 'CredentialUseStarted',
      ...this.#auditBase({
        refs: [ref],
        scope,
        policy: policy.value,
        attestationEventIds: attestations.attestationEventIds,
        evidenceRefs: attestations.evidenceRefs,
      }),
      injectionModes: [mode],
      redactionFingerprintIds: redaction.redactionSet.fingerprintIds,
    });
    if (!auditEvent.ok) {
      this.#options.secretResolver.destroy?.(resolved.value.materialHandle);
      return this.#denyWithoutAppend('audit-write-unavailable', { refs: [ref], scope, policy: policy.value });
    }

    const context = this.#mergeOperationContext(scope.operationId, {
      scope,
      refs: [ref],
      policy: policy.value,
      attestationEventIds: attestations.attestationEventIds,
      evidenceRefs: attestations.evidenceRefs,
      materialHandles: [resolved.value.materialHandle],
      tempFilePaths: mode === 'file' ? [binding.nameOrPath] : [],
      redactionSetIds: [redaction.redactionSet.id],
      destroyed: false,
    });
    this.#redactionRules.set(redaction.redactionSet.id, redaction.rules);
    this.#redactionContexts.set(redaction.redactionSet.id, context);

    return {
      ok: true,
      credentialRefId: ref.id,
      materialHandle: resolved.value.materialHandle,
      redactionSet: redaction.redactionSet,
      auditEvent: auditEvent.value,
    };
  }

  planInjection(refs: readonly CredentialRef[], scope: CredentialScope): PlanInjectionResult {
    const scopeDenial = this.#scopeDenial(refs, scope);
    if (scopeDenial) {
      return this.#deny(scopeDenial, { refs, scope });
    }

    const policy = this.#issueEgressPolicyData(refs, scope);
    if (!policy.ok) {
      return this.#deny(policy.reason, { refs, scope });
    }

    const attestations = this.#matchingAttestations(policy.value);
    if (!attestations.ok) {
      return this.#deny('egress-policy-unattested', { refs, scope, policy: policy.value });
    }

    const bindings = refs.map((ref) => bindingFor(ref, scope, this.#injectionMode(ref, scope)));
    const redactionSet = buildPlannedRedactionSet(
      this.#options.idGenerator.nextId('redaction-set'),
      refs,
      scope.expiresAt,
    );
    const planned = this.#recordEvent<CredentialUsePlanned>({
      type: 'CredentialUsePlanned',
      ...this.#auditBase({
        refs,
        scope,
        policy: policy.value,
        attestationEventIds: attestations.attestationEventIds,
        evidenceRefs: attestations.evidenceRefs,
      }),
      egressPolicyId: policy.value.id,
      expiresAt: scope.expiresAt,
      reason: 'scoped-injection-planned',
    });
    if (!planned.ok) {
      return this.#denyWithoutAppend('audit-write-unavailable', { refs, scope, policy: policy.value });
    }

    const context = this.#mergeOperationContext(scope.operationId, {
      scope,
      refs,
      policy: policy.value,
      attestationEventIds: attestations.attestationEventIds,
      evidenceRefs: attestations.evidenceRefs,
      materialHandles: [],
      tempFilePaths: bindings.filter((binding) => binding.mode === 'file').map((binding) => binding.nameOrPath),
      redactionSetIds: [redactionSet.id],
      destroyed: false,
    });
    this.#redactionContexts.set(redactionSet.id, context);

    return {
      ok: true,
      operationId: scope.operationId,
      party: scope.party,
      bindings,
      credentialRefIds: refs.map((ref) => ref.id),
      egressPolicy: policy.value,
      redactionSet,
      requiredAuditEvent: planned.value,
    };
  }

  redact<T extends RedactedInput>(value: T, redactionSet: RedactionSet): RedactResult<T> {
    const rules = this.#redactionRules.get(redactionSet.id);
    const context = this.#redactionContexts.get(redactionSet.id);
    if (redactionSet.state !== 'materialized' || !rules || !context) {
      return this.#deny('redaction-unavailable', {
        refs: [],
        scope: this.#fallbackScope(redactionSet.id),
      }) as RedactResult<T>;
    }

    const redacted = redactValue(value, rules);
    const auditEvent = this.#recordEvent<RedactionApplied>({
      type: 'RedactionApplied',
      ...this.#auditBase({
        refs: context.refs,
        scope: context.scope,
        policy: context.policy,
        attestationEventIds: context.attestationEventIds,
        evidenceRefs: context.evidenceRefs,
      }),
      sink: 'structured-output',
      replacementCount: redacted.replacementCount,
      redactionFingerprintIds: redactionSet.fingerprintIds,
    });
    if (!auditEvent.ok) {
      return this.#denyWithoutAppend('audit-write-unavailable', {
        refs: context.refs,
        scope: context.scope,
        policy: context.policy,
      }) as RedactResult<T>;
    }

    return {
      ok: true,
      value: redacted.value,
      replacementCount: redacted.replacementCount,
      redactionFingerprintIds: redactionSet.fingerprintIds,
      auditEvent: auditEvent.value,
    };
  }

  destroy(operationId: string): CredentialMaterialDestroyed {
    const context = this.#operationContexts.get(operationId) ?? this.#unknownContext(operationId);
    const handlesDropped = context.materialHandles.every((handle) => {
      const result = this.#options.secretResolver.destroy?.(handle);
      return !result || result.ok;
    });
    const tempFilesRemoved =
      context.tempFilePaths.length === 0
        ? true
        : (this.#options.tempFileRemover?.remove(context.tempFilePaths).ok ?? false);

    for (const redactionSetId of context.redactionSetIds) {
      this.#redactionRules.delete(redactionSetId);
      this.#redactionContexts.delete(redactionSetId);
    }

    const updatedContext = { ...context, destroyed: handlesDropped && tempFilesRemoved };
    this.#operationContexts.set(operationId, updatedContext);

    const event = this.#recordEvent<CredentialMaterialDestroyed>({
      type: 'CredentialMaterialDestroyed',
      ...this.#auditBase({
        refs: context.refs,
        scope: context.scope,
        policy: context.policy,
        attestationEventIds: context.attestationEventIds,
        evidenceRefs: context.evidenceRefs,
      }),
      tempFilesRemoved,
      memoryHandlesDropped: handlesDropped,
    });

    return event.ok
      ? event.value
      : this.#uncommittedDestroyed(context, {
          tempFilesRemoved,
          memoryHandlesDropped: false,
        });
  }

  issueEgressPolicy(refs: readonly CredentialRef[], scope: CredentialScope): IssueEgressPolicyResult {
    const scopeDenial = this.#scopeDenial(refs, scope);
    if (scopeDenial) {
      return this.#deny(scopeDenial, { refs, scope });
    }

    const policy = this.#issueEgressPolicyData(refs, scope);
    if (!policy.ok) {
      return this.#deny(policy.reason, { refs, scope });
    }

    const issued = this.#recordEvent<EgressPolicyIssued>({
      type: 'EgressPolicyIssued',
      ...this.#auditBase({ refs, scope, policy: policy.value }),
      policyId: policy.value.id,
      egressPolicyDigest: policy.value.egressPolicyDigest,
      audience: policy.value.audience,
      hosts: policy.value.rules.flatMap((rule) => rule.hosts),
      negativeProbeIds: probeIds(policy.value),
      freshnessKey: policy.value.freshnessKey,
      expiresAt: policy.value.expiresAt,
    });
    if (!issued.ok) {
      return this.#denyWithoutAppend('audit-write-unavailable', { refs, scope, policy: policy.value });
    }

    return policy.value;
  }

  finishCredentialUse(operationId: string, input: FinishCredentialUseInput): CredentialUseFinished {
    const context = this.#operationContexts.get(operationId) ?? this.#unknownContext(operationId);
    const event = this.#recordEvent<CredentialUseFinished>({
      type: 'CredentialUseFinished',
      ...this.#auditBase({
        refs: context.refs,
        scope: context.scope,
        policy: context.policy,
        attestationEventIds: context.attestationEventIds,
        evidenceRefs: context.evidenceRefs,
      }),
      result: input.result,
      providerStatus: input.providerStatus,
      exitCode: input.exitCode,
      destroyed: context.destroyed,
    });

    return event.ok
      ? event.value
      : eventWithHash<CredentialUseFinished>({
          type: 'CredentialUseFinished',
          ...this.#auditBase({
            refs: context.refs,
            scope: context.scope,
            policy: context.policy,
            attestationEventIds: context.attestationEventIds,
            evidenceRefs: context.evidenceRefs,
          }),
          result: input.result,
          providerStatus: input.providerStatus,
          exitCode: input.exitCode,
          destroyed: context.destroyed,
        });
  }

  #scopeDenial(refs: readonly CredentialRef[], scope: CredentialScope): CredentialDenialReason | undefined {
    const now = this.#options.clock.now();
    const expiresAtMs = parseIsoMs(scope.expiresAt);
    if (
      refs.length === 0 ||
      !expiresAtMs ||
      isExpired(scope.expiresAt, now) ||
      !scope.hosts ||
      scope.hosts.length === 0
    ) {
      return 'credential-scope-denied';
    }

    const runnerForgePhases = this.#options.runnerForgePhases ?? DEFAULT_RUNNER_FORGE_PHASES;
    const operationHosts = [...new Set(scope.hosts)];
    for (const ref of refs) {
      if (scope.party === 'worker' && ref.kind === 'forge') {
        return 'worker-forge-credential-denied';
      }
      if (!ref.allowedParties.includes(scope.party) || !ref.allowedPhases.includes(scope.phase)) {
        return 'credential-scope-denied';
      }
      if (expiresAtMs > now.getTime() + ref.ttlSeconds * 1000) {
        return 'credential-scope-denied';
      }
      if (
        ref.allowedCommandPrefixes &&
        ref.allowedCommandPrefixes.length > 0 &&
        (!scope.commandPrefix || !commandPrefixAllowed(scope.commandPrefix, ref.allowedCommandPrefixes))
      ) {
        return 'credential-scope-denied';
      }
      if (!operationHosts.every((host) => ref.allowedHosts.includes(host))) {
        return 'credential-scope-denied';
      }
      if (ref.kind === 'forge' && (scope.party !== 'runner' || !runnerForgePhases.includes(scope.phase))) {
        return 'credential-scope-denied';
      }
    }

    return undefined;
  }

  #issueEgressPolicyData(
    refs: readonly CredentialRef[],
    scope: CredentialScope,
  ):
    | { readonly ok: true; readonly value: EgressPolicy }
    | { readonly ok: false; readonly reason: CredentialDenialReason } {
    const sourceRules = sourceRulesFor(refs, scope, this.#options.egress.rules);
    const rules = sourceRules.map((rule) => ({
      credentialRefIds: [...rule.credentialRefIds],
      protocols: [...rule.protocols],
      hosts: rule.hosts.filter((host) => scope.hosts?.includes(host)),
      ports: rule.ports ? [...rule.ports] : undefined,
      phase: rule.phase,
      purpose: rule.purpose,
    }));
    const coveredRefIds = new Set(rules.flatMap((rule) => rule.credentialRefIds));
    const coveredHosts = new Set(rules.flatMap((rule) => rule.hosts));

    if (
      rules.length === 0 ||
      this.#options.egress.requiredAttesters.length === 0 ||
      this.#options.egress.negativeProbes.length === 0 ||
      !refs.every((ref) => coveredRefIds.has(ref.id)) ||
      !(scope.hosts ?? []).every((host) => coveredHosts.has(host))
    ) {
      return { ok: false, reason: 'egress-policy-unattested' };
    }

    const hostsOutsideRefPolicy = rules.some((rule) =>
      rule.credentialRefIds.some((credentialRefId) => {
        const ref = refs.find((candidate) => candidate.id === credentialRefId);
        return !ref || rule.hosts.some((host) => !ref.allowedHosts.includes(host));
      }),
    );
    if (hostsOutsideRefPolicy) {
      return { ok: false, reason: 'credential-scope-denied' };
    }

    const negativeProbes = this.#options.egress.negativeProbes.map((probe) => ({
      id: stableHash(probe),
      ...probe,
    }));
    const baseDigest = stableHash({
      audience: scope.party,
      operationId: scope.operationId,
      refs: refs.map((ref) => ({ id: ref.id, policyDigest: ref.policyDigest })),
      rules,
      negativeProbes,
      requiredAttesters: this.#options.egress.requiredAttesters,
      scopeDigest: scopeDigest(scope),
    });
    const freshnessKey = stableHash({ egressPolicyDigest: baseDigest, scopeDigest: scopeDigest(scope) });
    const requiredAttesters = this.#options.egress.requiredAttesters.map((attester) => {
      const metadata = this.#options.attesterMetadata[attester.driverId];
      return {
        point: attester.point,
        capability: attester.capability,
        driverId: attester.driverId,
        scopeDigest: scopeDigest(scope),
        egressPolicyDigest: baseDigest,
        platform: metadata?.platform ?? 'unknown',
        driverVersion: metadata?.driverVersion ?? 'unknown',
      };
    });

    return {
      ok: true,
      value: {
        id: this.#options.idGenerator.nextId('egress-policy'),
        runId: scope.runId,
        operationId: scope.operationId,
        audience: scope.party,
        egressPolicyDigest: baseDigest,
        defaultAction: 'deny',
        rules,
        negativeProbes,
        requiredAttesters,
        freshnessKey,
        expiresAt: scope.expiresAt,
      },
    };
  }

  #matchingAttestations(policy: EgressPolicy): AttestationMatch {
    if (policy.requiredAttesters.length === 0) {
      return { ok: true, attestationEventIds: [], evidenceRefs: [] };
    }

    const matched = policy.requiredAttesters.map((required) =>
      (this.#options.attestations ?? []).find(
        (attestation) =>
          attestation.result === 'positive' &&
          attestation.capability === required.capability &&
          attestation.point === required.point &&
          attestation.driverId === required.driverId &&
          attestation.scopeDigest === required.scopeDigest &&
          attestation.egressPolicyDigest === required.egressPolicyDigest &&
          attestation.freshnessKey === policy.freshnessKey &&
          attestation.platform === required.platform &&
          attestation.driverVersion === required.driverVersion &&
          attestation.evidenceRef.length > 0 &&
          !isExpired(attestation.expiresAt, this.#options.clock.now()) &&
          hasAllProbeIds(attestation, policy),
      ),
    );

    if (matched.some((attestation) => !attestation)) {
      return { ok: false };
    }

    return {
      ok: true,
      attestationEventIds: matched.map((attestation) => attestation?.eventId ?? ''),
      evidenceRefs: matched.map((attestation) => attestation?.evidenceRef ?? ''),
    };
  }

  #injectionMode(ref: CredentialRef, scope: CredentialScope): InjectionMode {
    return this.#options.injectionModeFor?.(ref, scope) ?? 'env';
  }

  #mergeOperationContext(operationId: string, next: OperationContext): OperationContext {
    const previous = this.#operationContexts.get(operationId);
    const merged: OperationContext = previous
      ? {
          ...next,
          refs: [...previous.refs, ...next.refs],
          materialHandles: [...previous.materialHandles, ...next.materialHandles],
          tempFilePaths: [...previous.tempFilePaths, ...next.tempFilePaths],
          redactionSetIds: [...previous.redactionSetIds, ...next.redactionSetIds],
          destroyed: previous.destroyed && next.destroyed,
        }
      : next;
    this.#operationContexts.set(operationId, merged);
    return merged;
  }

  #auditBase(metadata: AuditMetadata): Omit<AuditBase, 'prevEventHash' | 'eventHash' | 'at'> & {
    readonly prevEventHash: string;
    readonly at: string;
  } {
    return {
      runId: metadata.scope.runId,
      taskId: metadata.scope.taskId,
      operationId: metadata.scope.operationId,
      credentialRefIds: metadata.refs.map((ref) => ref.id),
      party: metadata.scope.party,
      phase: metadata.scope.phase,
      policyDigest: policyDigestFor(metadata.refs, metadata.policy),
      credentialRefDigest: credentialRefDigest(metadata.refs),
      scopeDigest: scopeDigest(metadata.scope),
      grantEventId: metadata.scope.grantEventId,
      attestationEventIds: metadata.attestationEventIds ?? [],
      evidenceRefs: metadata.evidenceRefs ?? [],
      prevEventHash: this.#prevEventHash,
      at: this.#options.clock.now().toISOString(),
    };
  }

  #recordEvent<T extends CredentialAuditEvent>(
    event: Omit<T, 'eventHash'>,
  ): { readonly ok: true; readonly value: T } | { readonly ok: false } {
    const hashed = eventWithHash(event) as T;
    const auditWriter = (this.#options as { readonly auditWriter?: AuditWriter }).auditWriter;
    const written = auditWriter?.append(hashed);
    if (!written?.ok) {
      return { ok: false };
    }
    this.#prevEventHash = hashed.eventHash;
    return { ok: true, value: hashed };
  }

  #deny(reason: CredentialDenialReason, metadata: AuditMetadata): CredentialDenied {
    const event = this.#recordEvent<CredentialUseDenied>({
      type: 'CredentialUseDenied',
      ...this.#auditBase(metadata),
      reason,
    });
    return event.ok
      ? { ok: false, reason, auditEvent: event.value }
      : this.#denyWithoutAppend('audit-write-unavailable', metadata);
  }

  #denyWithoutAppend(reason: CredentialDenialReason, metadata: AuditMetadata): CredentialDenied {
    const auditEvent = eventWithHash<CredentialUseDenied>({
      type: 'CredentialUseDenied',
      ...this.#auditBase(metadata),
      reason,
    });
    return { ok: false, reason, auditEvent };
  }

  #fallbackScope(operationId: string): CredentialScope {
    return {
      runId: 'unknown',
      taskId: 'unknown',
      operationId,
      party: 'runner',
      phase: 'unknown',
      expiresAt: this.#options.clock.now().toISOString(),
    };
  }

  #unknownContext(operationId: string): OperationContext {
    return {
      scope: this.#fallbackScope(operationId),
      refs: [],
      attestationEventIds: [],
      evidenceRefs: [],
      materialHandles: [],
      tempFilePaths: [],
      redactionSetIds: [],
      destroyed: false,
    };
  }

  #uncommittedDestroyed(
    context: OperationContext,
    flags: Pick<CredentialMaterialDestroyed, 'memoryHandlesDropped' | 'tempFilesRemoved'>,
  ): CredentialMaterialDestroyed {
    return eventWithHash<CredentialMaterialDestroyed>({
      type: 'CredentialMaterialDestroyed',
      ...this.#auditBase({
        refs: context.refs,
        scope: context.scope,
        policy: context.policy,
        attestationEventIds: context.attestationEventIds,
        evidenceRefs: context.evidenceRefs,
      }),
      ...flags,
    });
  }
}

export const createCredentialsAndSecrets = (options: CredentialsAndSecretsOptions): CredentialsAndSecretsContract =>
  new CredentialsAndSecrets(options);

export const buildClosedInjectionEnvironment = (
  plan: InjectionPlan,
  _inheritedEnvironment: Readonly<Record<string, string | undefined>> = {},
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    plan.bindings
      .filter((binding) => binding.mode === 'env')
      .map((binding) => [binding.nameOrPath, binding.redactionLabel]),
  );
