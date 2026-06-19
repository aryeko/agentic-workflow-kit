import { BUILT_IN_DEFAULTS } from './defaults.js';
import { getPath, hasPath, leafPaths, setPath } from './object-paths.js';
import type { NonEmptyArray, Result } from './result.js';
import { cloneJson, stableHash } from './stable-json.js';
import {
  KitConfigSchema,
  PolicyLayerPatchSchema,
  type ConfigSource,
  type ConfigurationPolicyAppendIntent,
  type FieldProvenance,
  type KitConfig,
  type PolicyLayer,
  type PolicyLayerPatch,
  type PolicyResolutionFailure,
  type PolicyResolutionFailureReason,
  type ResolutionContext,
  type ResolvedPolicy,
  type ResolvedPolicyResult,
  RunConfigInputSchema,
  type RunConfigInput,
} from './types.js';
import { adoptionIntents, configDiagnostic, markerOf, parseJson } from './adoption.js';

const asNonEmpty = <T>(items: readonly T[]): NonEmptyArray<T> => {
  if (items.length === 0) {
    throw new Error('expected non-empty array');
  }
  return items as NonEmptyArray<T>;
};

const hasDeferredCapability = (value: unknown): boolean => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((entry) => hasDeferredCapability(entry));
  }

  const record = value as Record<string, unknown>;
  if (record.capabilities && typeof record.capabilities === 'object' && record.capabilities !== null) {
    if (Object.hasOwn(record.capabilities as Record<string, unknown>, 'orchestrator-decide')) {
      return true;
    }
  }
  return Object.values(record).some((entry) => hasDeferredCapability(entry));
};

const failureIntent = (
  reason: PolicyResolutionFailureReason,
  occurredAt: string,
  blockingState = reason,
  correlationId?: string,
): ConfigurationPolicyAppendIntent => ({
  domain: 'fnd-01',
  type: 'PolicyResolutionFailed',
  occurredAt,
  payload: { reason, blockingState, at: occurredAt },
  durability: 'barrier',
  ...(correlationId ? { correlationId } : {}),
});

const fail = (
  reason: PolicyResolutionFailureReason,
  context: ResolutionContext,
  blockingState = reason,
): Result<ResolvedPolicyResult, PolicyResolutionFailure> => {
  const appendIntents = asNonEmpty([failureIntent(reason, context.occurredAt, blockingState, context.correlationId)]);
  return { ok: false, error: { reason, blockingState, appendIntents } };
};

const sourceForField = (
  path: string,
  profileName: string | undefined,
  profile: PolicyLayerPatch | undefined,
  overrides: PolicyLayerPatch | undefined,
  source: ConfigSource,
): Omit<FieldProvenance, 'fieldPath' | 'valueHash'> => {
  if (overrides && hasPath(overrides, path)) {
    return { sourceLayer: 'operator-override', sourceRef: `${source.path}#overrides` };
  }
  if (profile && hasPath(profile, path)) {
    return {
      sourceLayer: 'profile',
      ...(profileName ? { profile: profileName } : {}),
      sourceRef: `${source.path}#profiles.${profileName ?? 'selected'}`,
    };
  }
  return { sourceLayer: 'built-in-defaults', sourceRef: 'kit-vnext.config.v1#built-in-defaults' };
};

const resolveLeafValue = (
  path: string,
  profile: PolicyLayerPatch | undefined,
  overrides: PolicyLayerPatch | undefined,
) => {
  if (overrides && hasPath(overrides, path)) {
    return getPath(overrides, path);
  }
  if (profile && hasPath(profile, path)) {
    return getPath(profile, path);
  }
  return getPath(BUILT_IN_DEFAULTS, path);
};

const allLeafPaths = (
  profile: PolicyLayerPatch | undefined,
  overrides: PolicyLayerPatch | undefined,
): readonly string[] =>
  [...new Set([...leafPaths(BUILT_IN_DEFAULTS), ...leafPaths(profile ?? {}), ...leafPaths(overrides ?? {})])].sort();

const resolvePolicy = (
  source: ConfigSource,
  config: KitConfig,
  input: RunConfigInput,
  context: ResolutionContext,
): ResolvedPolicyResult => {
  const profile = input.profile ? config.profiles?.[input.profile] : undefined;
  const paths = allLeafPaths(profile, input.overrides);
  const policy = paths.reduce<unknown>(
    (current, path) => setPath(current, path, cloneJson(resolveLeafValue(path, profile, input.overrides))),
    {},
  ) as PolicyLayer;
  const provenance = Object.fromEntries(
    paths.map((path) => {
      const value = getPath(policy, path);
      const provenanceEntry: FieldProvenance = {
        fieldPath: path,
        ...sourceForField(path, input.profile, profile, input.overrides, source),
        valueHash: stableHash(value),
      };
      return [path, provenanceEntry];
    }),
  );
  const resolvedPolicy: ResolvedPolicy = {
    schema: 'kit-vnext.resolved-policy.v1',
    policy,
    provenance,
  };
  const fieldIntents = paths.map((path): ConfigurationPolicyAppendIntent => {
    const entry = provenance[path];
    return {
      domain: 'fnd-01',
      type: 'ConfigFieldResolved',
      occurredAt: context.occurredAt,
      payload: { ...entry, runId: context.runId, at: context.occurredAt },
      durability: 'durable',
      ...(context.correlationId ? { correlationId: context.correlationId } : {}),
    };
  });
  const summaryIntent: ConfigurationPolicyAppendIntent = {
    domain: 'fnd-01',
    type: 'ConfigResolved',
    occurredAt: context.occurredAt,
    payload: {
      runId: context.runId,
      resolvedPolicyHash: stableHash(resolvedPolicy),
      fieldCount: paths.length,
      at: context.occurredAt,
    },
    durability: 'barrier',
    ...(context.correlationId ? { correlationId: context.correlationId } : {}),
  };
  return {
    resolvedPolicy,
    appendIntents: asNonEmpty([...fieldIntents, summaryIntent]),
  };
};

export const resolveRunPolicy = (
  source: ConfigSource,
  input: RunConfigInput,
  context: ResolutionContext,
): Result<ResolvedPolicyResult, PolicyResolutionFailure> => {
  const rawConfig = parseJson(source);
  const marker = markerOf(rawConfig);
  if (marker !== 'kit-vnext.config.v1') {
    const diagnostic = configDiagnostic(source);
    const reason = diagnostic?.state ?? 'adoption-unknown-artifact';
    const appendIntents = adoptionIntents(diagnostic ? [diagnostic] : [], context.occurredAt).map((intent) => ({
      ...intent,
      ...(context.correlationId ? { correlationId: context.correlationId } : {}),
    }));
    return {
      ok: false,
      error: {
        reason,
        blockingState: reason,
        diagnostic,
        appendIntents: asNonEmpty(appendIntents),
      },
    };
  }

  if (hasDeferredCapability(rawConfig) || hasDeferredCapability(input.overrides)) {
    return fail('unsupported-deferred-capability', context);
  }

  const configResult = KitConfigSchema.safeParse(rawConfig);
  if (!configResult.success) {
    return fail('config-invalid', context);
  }

  const overrideResult = PolicyLayerPatchSchema.safeParse(input.overrides ?? {});
  if (!overrideResult.success) {
    return fail('override-invalid', context);
  }

  const inputResult = RunConfigInputSchema.safeParse({ ...input, overrides: overrideResult.data });
  if (!inputResult.success) {
    return fail('config-invalid', context);
  }

  if (inputResult.data.profile && !configResult.data.profiles?.[inputResult.data.profile]) {
    return fail('profile-unknown', context);
  }

  return { ok: true, value: resolvePolicy(source, configResult.data, inputResult.data, context) };
};
