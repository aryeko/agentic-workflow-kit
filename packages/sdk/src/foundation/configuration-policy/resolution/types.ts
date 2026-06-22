import type { ConfigurationPolicyAppendIntent, PolicyResolutionFailureReason } from '../events/index.js';
import type { FieldProvenance } from '../provenance/index.js';
import type { PolicyLayer, PolicyLayerPatch, Result, RunConfigInput } from '../schema/index.js';

export const resolvedPolicySchemaMarker = 'kit-vnext.resolved-policy.v1' as const;

export type NonEmptyArray<T> = readonly [T, ...T[]];

export type ConfigSource = {
  readonly path: string;
  readonly content: string;
};

export type ResolutionContext = {
  readonly runId: string;
  readonly occurredAt: string;
  readonly correlationId?: string;
  readonly confirmAppendIntents?: (appendIntents: readonly ConfigurationPolicyAppendIntent[]) => boolean;
};

export type ResolvedPolicy = {
  readonly schema: typeof resolvedPolicySchemaMarker;
  readonly policy: PolicyLayer;
  readonly provenance: Readonly<Record<string, FieldProvenance>>;
  readonly resolvedPolicyHash: string;
};

export type ResolvedPolicyResult = {
  readonly resolvedPolicy: ResolvedPolicy;
  readonly appendIntents: NonEmptyArray<ConfigurationPolicyAppendIntent>;
};

export type PolicyResolutionFailure = {
  readonly reason: PolicyResolutionFailureReason;
  readonly blockingState: string;
  readonly appendIntents?: NonEmptyArray<ConfigurationPolicyAppendIntent>;
  readonly issues?: readonly string[];
};

export interface ConfigurationPolicy {
  resolveRunPolicy(
    source: ConfigSource,
    input: RunConfigInput,
    context: ResolutionContext,
  ): Result<ResolvedPolicyResult, PolicyResolutionFailure>;
}

export type CreateConfigurationPolicyDependencies = {
  readonly hashText: (value: string) => string;
};

export type ResolvedLeaf = {
  readonly fieldPath: string;
  readonly value: unknown;
  readonly provenance: FieldProvenance;
};

export type ResolutionFailureInput = {
  readonly reason: PolicyResolutionFailureReason;
  readonly blockingState?: string;
  readonly issues?: readonly string[];
};

export type ParsedOverrides = {
  readonly profile?: string;
  readonly overridePatch?: PolicyLayerPatch;
};
