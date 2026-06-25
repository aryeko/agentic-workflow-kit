import { createRedactionSet } from '../redaction/index.js';
import { validateCredentialScopeUse } from '../scopes/index.js';
import { issueEgressPolicy } from '../egress/index.js';
import { createPlannedAuditEvent, denyCredential } from './operation-audit.js';
import type {
  CredentialBindingTemplate,
  CredentialGrant,
  InjectionBinding,
  PlanInjectionDependencies,
  PlanInjectionInput,
  PlanInjectionResult,
} from './injection-types.js';

const parseTimestamp = (value: string): number => globalThis.Date.parse(value);

const createRedactionLabel = (credentialRefId: string): string => `[REDACTED:credential:${credentialRefId}]`;

const toBindings = (
  templates: readonly CredentialBindingTemplate[],
  refs: readonly PlanInjectionInput['refs'][number][],
): readonly InjectionBinding[] =>
  refs.map((ref) => {
    const template = templates.find((candidate) => candidate.credentialRefId === ref.id);
    if (template === undefined) {
      throw new Error(`Missing binding template for credential ref ${ref.id}.`);
    }

    return {
      mode: template.mode,
      nameOrPath: template.nameOrPath,
      redactionLabel: createRedactionLabel(ref.id),
    };
  });

const denyScope = (input: PlanInjectionInput, dependencies: PlanInjectionDependencies): PlanInjectionResult =>
  denyCredential(
    'credential-scope-denied',
    {
      refs: input.refs,
      scope: input.scope,
      at: dependencies.at,
      prevEventHash: dependencies.prevEventHash,
    },
    dependencies,
  );

const grantExpandsScope = (
  ref: PlanInjectionInput['refs'][number],
  grant: CredentialGrant,
  input: PlanInjectionInput,
  bindings: readonly InjectionBinding[],
  host: string | undefined,
  egressPolicyDigest: string,
): boolean => {
  if (grant.allowedParties !== undefined) {
    if (
      !grant.allowedParties.includes(input.scope.party) ||
      grant.allowedParties.some((party) => !ref.allowedParties.includes(party))
    ) {
      return true;
    }
  }

  if (grant.allowedPhases !== undefined) {
    if (
      !grant.allowedPhases.includes(input.scope.phase) ||
      grant.allowedPhases.some((phase) => !ref.allowedPhases.includes(phase))
    ) {
      return true;
    }
  }

  if (grant.allowedHosts !== undefined) {
    if (
      (host !== undefined && !grant.allowedHosts.includes(host)) ||
      grant.allowedHosts.some((candidate) => !ref.allowedHosts.includes(candidate))
    ) {
      return true;
    }
  }

  if (grant.commandPrefix !== undefined) {
    if (input.scope.commandPrefix === undefined || grant.commandPrefix !== input.scope.commandPrefix) {
      return true;
    }
  }

  if (grant.expiresAt !== undefined) {
    if (parseTimestamp(grant.expiresAt) > parseTimestamp(input.scope.expiresAt)) {
      return true;
    }
  }

  if (grant.injectionModes !== undefined) {
    if (grant.injectionModes.some((mode) => !bindings.some((binding) => binding.mode === mode))) {
      return true;
    }
  }

  if (grant.credentialKinds !== undefined) {
    if (!grant.credentialKinds.includes(ref.kind) || grant.credentialKinds.some((kind) => kind !== ref.kind)) {
      return true;
    }
  }

  if (grant.egressPolicyDigest !== undefined && grant.egressPolicyDigest !== egressPolicyDigest) {
    return true;
  }

  return false;
};

export const planInjection = (
  input: PlanInjectionInput,
  dependencies: PlanInjectionDependencies,
): PlanInjectionResult => {
  for (const ref of input.refs) {
    const validation = validateCredentialScopeUse(ref, input.scope, {
      hashText: dependencies.hashText,
      now: dependencies.now,
      issuedAt: dependencies.issuedAt,
      host: dependencies.host,
      command: dependencies.command,
    });
    if (!validation.ok) {
      return denyCredential(
        validation.error.token,
        {
          refs: [ref],
          scope: input.scope,
          at: dependencies.at,
          prevEventHash: dependencies.prevEventHash,
        },
        dependencies,
      );
    }
  }

  if (!dependencies.auditSinkAvailable) {
    return denyCredential(
      'audit-write-unavailable',
      {
        refs: input.refs,
        scope: input.scope,
        at: dependencies.at,
        prevEventHash: dependencies.prevEventHash,
      },
      dependencies,
    );
  }

  const egressPolicy = issueEgressPolicy(
    {
      refs: input.refs,
      scope: input.scope,
      egressSource: input.egressSource,
    },
    {
      hashText: dependencies.hashText,
      at: dependencies.at,
      prevEventHash: dependencies.prevEventHash,
    },
  );
  if (!egressPolicy.ok) {
    return egressPolicy;
  }

  const host = dependencies.host;
  if (host !== undefined && !egressPolicy.value.rules.some((rule) => rule.hosts.includes(host))) {
    return denyScope(input, dependencies);
  }

  const bindings = toBindings(input.bindingTemplates, input.refs);

  if (input.grant !== undefined) {
    for (const ref of input.refs) {
      if (
        grantExpandsScope(ref, input.grant, input, bindings, dependencies.host, egressPolicy.value.egressPolicyDigest)
      ) {
        return denyScope(input, dependencies);
      }
    }
  }

  const secrets = input.refs.map((ref) => {
    const resolved = dependencies.resolveSecretMaterial(ref);
    if (resolved === undefined) {
      return undefined;
    }

    return {
      credentialRefId: ref.id,
      label: createRedactionLabel(ref.id),
      fingerprintId: resolved.fingerprintId,
      secret: resolved.material,
      ...(resolved.tempFilePaths === undefined ? {} : { tempFilePaths: resolved.tempFilePaths }),
    };
  });

  if (secrets.some((secret) => secret === undefined)) {
    return denyCredential(
      'credential-ref-unresolved',
      {
        refs: input.refs,
        scope: input.scope,
        at: dependencies.at,
        prevEventHash: dependencies.prevEventHash,
      },
      dependencies,
    );
  }

  const redactionSet = createRedactionSet({
    id: `redaction-set:${dependencies.hashText(
      JSON.stringify({
        operationId: input.scope.operationId,
        credentialRefIds: input.refs.map((ref) => ref.id),
      }),
    )}`,
    expiresAt: input.scope.expiresAt,
    secrets: secrets.filter((secret): secret is NonNullable<typeof secret> => secret !== undefined),
  });
  const requiredAuditEvent = createPlannedAuditEvent(
    {
      refs: input.refs,
      scope: input.scope,
      egressPolicy: egressPolicy.value,
      at: dependencies.at,
      prevEventHash: dependencies.prevEventHash,
    },
    dependencies,
  );

  return {
    ok: true,
    operationId: input.scope.operationId,
    party: input.scope.party,
    bindings,
    credentialRefIds: input.refs.map((ref) => ref.id),
    egressPolicy: egressPolicy.value,
    redactionSet,
    requiredAuditEvent,
  };
};
