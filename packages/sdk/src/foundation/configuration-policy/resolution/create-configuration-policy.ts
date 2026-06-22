import { diagnoseAdoption } from '../adoption/index.js';
import { builtInPolicyLayerDefaults } from '../defaults/index.js';
import {
  type ConfigurationPolicyAppendIntent,
  createConfigFieldResolvedIntent,
  createConfigResolvedIntent,
  createPolicyResolutionFailedIntent,
} from '../events/index.js';
import {
  buildFieldProvenance,
  isPlainRecord,
  stableCanonicalStringify,
  type PolicySourceLayer,
} from '../provenance/index.js';
import {
  validateKitConfig,
  validateRunConfigInput,
  type KitConfig,
  type PolicyLayer,
  type Result,
  type RunConfigInput,
} from '../schema/index.js';
import type {
  ConfigSource,
  ConfigurationPolicy,
  CreateConfigurationPolicyDependencies,
  ParsedOverrides,
  PolicyResolutionFailure,
  ResolutionContext,
  ResolutionFailureInput,
  ResolvedLeaf,
  ResolvedPolicy,
  ResolvedPolicyResult,
} from './types.js';
import { resolvedPolicySchemaMarker } from './types.js';

const ok = <T>(value: T): Result<T, PolicyResolutionFailure> => ({
  ok: true,
  value,
});

const fail = (error: PolicyResolutionFailure): Result<never, PolicyResolutionFailure> => ({
  ok: false,
  error,
});

const parseConfigSource = (source: ConfigSource): Result<KitConfig, PolicyResolutionFailure> => {
  try {
    const parsed = JSON.parse(source.content) as unknown;
    const validated = validateKitConfig(parsed);
    if (!validated.ok) {
      return fail({
        reason: validated.error.token,
        blockingState: validated.error.token,
        issues: validated.error.issues,
      });
    }

    return ok(validated.value);
  } catch (error) {
    return fail({
      reason: 'config-invalid',
      blockingState: 'config-invalid',
      issues: [error instanceof Error ? error.message : 'config source must be valid JSON'],
    });
  }
};

const parseInput = (input: RunConfigInput): Result<ParsedOverrides, PolicyResolutionFailure> => {
  const validatedInput = validateRunConfigInput(input);
  if (!validatedInput.ok) {
    if (validatedInput.error.token === 'unsupported-deferred-capability') {
      return fail({
        reason: 'unsupported-deferred-capability',
        blockingState: 'unsupported-deferred-capability',
        issues: validatedInput.error.issues,
      });
    }

    return fail({
      reason: 'override-invalid',
      blockingState: 'override-invalid',
      issues: validatedInput.error.issues,
    });
  }

  return ok({
    profile: validatedInput.value.profile,
    overridePatch: validatedInput.value.overrides,
  });
};

const sourceRefFor = (sourceLayer: PolicySourceLayer, sourcePath: string, profile?: string): string => {
  if (sourceLayer === 'operator-override') {
    return 'run-input.overrides';
  }

  if (sourceLayer === 'profile') {
    return `${sourcePath}#profiles.${profile ?? ''}`;
  }

  return `${resolvedPolicySchemaMarker}#built-in-defaults`;
};

const leafValue = (overrideValue: unknown, profileValue: unknown, defaultValue: unknown) => {
  if (overrideValue !== undefined) {
    return {
      sourceLayer: 'operator-override' as const,
      value: overrideValue,
    };
  }

  if (profileValue !== undefined) {
    return {
      sourceLayer: 'profile' as const,
      value: profileValue,
    };
  }

  return {
    sourceLayer: 'built-in-defaults' as const,
    value: defaultValue,
  };
};

const resolveNode = ({
  defaultValue,
  fieldPath,
  hashText,
  overrideValue,
  profileName,
  profileValue,
  sourcePath,
}: {
  readonly defaultValue: unknown;
  readonly fieldPath: string;
  readonly hashText: (value: string) => string;
  readonly overrideValue: unknown;
  readonly profileName?: string;
  readonly profileValue: unknown;
  readonly sourcePath: string;
}): {
  readonly leafs: readonly ResolvedLeaf[];
  readonly value: unknown;
} => {
  const shouldRecurse = isPlainRecord(defaultValue) || isPlainRecord(profileValue) || isPlainRecord(overrideValue);

  if (!shouldRecurse) {
    const resolved = leafValue(overrideValue, profileValue, defaultValue);
    const sourceRef = sourceRefFor(resolved.sourceLayer, sourcePath, profileName);

    return {
      value: resolved.value,
      leafs: [
        {
          fieldPath,
          value: resolved.value,
          provenance: buildFieldProvenance({
            fieldPath,
            profile: resolved.sourceLayer === 'profile' ? profileName : undefined,
            sourceLayer: resolved.sourceLayer,
            sourceRef,
            value: resolved.value,
            hashText,
          }),
        },
      ],
    };
  }

  const keys = new Set<string>([
    ...Object.keys(isPlainRecord(defaultValue) ? defaultValue : {}),
    ...Object.keys(isPlainRecord(profileValue) ? profileValue : {}),
    ...Object.keys(isPlainRecord(overrideValue) ? overrideValue : {}),
  ]);
  const orderedKeys = [...keys].sort();
  const resolvedObject: Record<string, unknown> = {};
  const leafs: ResolvedLeaf[] = [];

  for (const key of orderedKeys) {
    const childPath = fieldPath === '' ? key : `${fieldPath}.${key}`;
    const child = resolveNode({
      defaultValue: isPlainRecord(defaultValue) ? defaultValue[key] : undefined,
      fieldPath: childPath,
      hashText,
      overrideValue: isPlainRecord(overrideValue) ? overrideValue[key] : undefined,
      profileName,
      profileValue: isPlainRecord(profileValue) ? profileValue[key] : undefined,
      sourcePath,
    });

    if (child.value !== undefined) {
      resolvedObject[key] = child.value;
    }
    leafs.push(...child.leafs);
  }

  return {
    value: resolvedObject,
    leafs,
  };
};

const failureResult = (
  context: ResolutionContext,
  input: ResolutionFailureInput,
): Result<never, PolicyResolutionFailure> => {
  const appendIntents = [
    createPolicyResolutionFailedIntent({
      blockingState: input.blockingState ?? input.reason,
      occurredAt: context.occurredAt,
      correlationId: context.correlationId,
      reason: input.reason,
    }),
  ] as const;

  return fail({
    reason: input.reason,
    blockingState: input.blockingState ?? input.reason,
    appendIntents,
    issues: input.issues,
  });
};

export const createConfigurationPolicy = ({
  hashText,
}: CreateConfigurationPolicyDependencies): ConfigurationPolicy => ({
  diagnoseAdoption,

  resolveRunPolicy(source, input, context) {
    const parsedConfig = parseConfigSource(source);
    if (!parsedConfig.ok) {
      return failureResult(context, parsedConfig.error);
    }

    const parsedInput = parseInput(input);
    if (!parsedInput.ok) {
      return failureResult(context, parsedInput.error);
    }

    if (parsedInput.value.profile && !parsedConfig.value.profiles?.[parsedInput.value.profile]) {
      return failureResult(context, {
        reason: 'profile-unknown',
      });
    }

    const profilePatch = parsedInput.value.profile
      ? parsedConfig.value.profiles?.[parsedInput.value.profile]
      : undefined;
    const resolved = resolveNode({
      defaultValue: builtInPolicyLayerDefaults,
      fieldPath: '',
      hashText,
      overrideValue: parsedInput.value.overridePatch,
      profileName: parsedInput.value.profile,
      profileValue: profilePatch,
      sourcePath: source.path,
    });
    const policy = resolved.value as PolicyLayer;
    const provenance = Object.fromEntries(resolved.leafs.map((leaf) => [leaf.fieldPath, leaf.provenance] as const));
    const resolvedPolicyHash = hashText(
      stableCanonicalStringify({
        schema: resolvedPolicySchemaMarker,
        policy,
        provenance,
      }),
    );
    const resolvedPolicy: ResolvedPolicy = {
      schema: resolvedPolicySchemaMarker,
      policy,
      provenance,
      resolvedPolicyHash,
    };
    const appendIntents = [
      ...resolved.leafs.map((leaf) =>
        createConfigFieldResolvedIntent({
          occurredAt: context.occurredAt,
          correlationId: context.correlationId,
          provenance: leaf.provenance,
          runId: context.runId,
        }),
      ),
      createConfigResolvedIntent({
        occurredAt: context.occurredAt,
        correlationId: context.correlationId,
        fieldCount: resolved.leafs.length,
        resolvedPolicyHash,
        runId: context.runId,
      }),
    ] as unknown as [ConfigurationPolicyAppendIntent, ...ConfigurationPolicyAppendIntent[]];

    if (context.confirmAppendIntents && !context.confirmAppendIntents(appendIntents)) {
      return failureResult(context, {
        reason: 'provenance-write-failed',
      });
    }

    const result: ResolvedPolicyResult = {
      resolvedPolicy,
      appendIntents,
    };

    return ok(result);
  },
});
