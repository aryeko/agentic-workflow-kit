import type { FieldProvenance, PolicySourceLayer } from '../provenance/index.js';

export type ConfigFieldResolved = {
  readonly runId: string;
  readonly fieldPath: string;
  readonly sourceLayer: PolicySourceLayer;
  readonly profile?: string;
  readonly sourceRef: string;
  readonly valueHash: string;
  readonly at: string;
};

export type ConfigResolved = {
  readonly runId: string;
  readonly resolvedPolicyHash: string;
  readonly fieldCount: number;
  readonly at: string;
};

export type PolicyResolutionFailureReason =
  | 'config-invalid'
  | 'profile-unknown'
  | 'override-invalid'
  | 'unsupported-deferred-capability'
  | 'provenance-write-failed';

export type PolicyResolutionFailed = {
  readonly reason: PolicyResolutionFailureReason;
  readonly blockingState: string;
  readonly at: string;
};

type AppendIntentBase<TType extends string, TPayload> = {
  readonly domain: 'fnd-01';
  readonly type: TType;
  readonly occurredAt: string;
  readonly payload: TPayload;
  readonly durability: 'durable' | 'barrier';
  readonly correlationId?: string;
};

export type ConfigFieldResolvedIntent = AppendIntentBase<'ConfigFieldResolved', ConfigFieldResolved>;
export type ConfigResolvedIntent = AppendIntentBase<'ConfigResolved', ConfigResolved>;
export type PolicyResolutionFailedIntent = AppendIntentBase<'PolicyResolutionFailed', PolicyResolutionFailed>;

export type ConfigurationPolicyAppendIntent =
  | ConfigFieldResolvedIntent
  | ConfigResolvedIntent
  | PolicyResolutionFailedIntent;

const withEnvelope = <TType extends ConfigurationPolicyAppendIntent['type'], TPayload>(
  type: TType,
  payload: TPayload,
  occurredAt: string,
  correlationId?: string,
): AppendIntentBase<TType, TPayload> => ({
  domain: 'fnd-01',
  type,
  occurredAt,
  payload,
  durability: 'durable',
  correlationId,
});

export const createConfigFieldResolvedIntent = ({
  occurredAt,
  correlationId,
  provenance,
  runId,
}: {
  readonly occurredAt: string;
  readonly correlationId?: string;
  readonly provenance: FieldProvenance;
  readonly runId: string;
}): ConfigFieldResolvedIntent =>
  withEnvelope(
    'ConfigFieldResolved',
    {
      runId,
      fieldPath: provenance.fieldPath,
      sourceLayer: provenance.sourceLayer,
      profile: provenance.profile,
      sourceRef: provenance.sourceRef,
      valueHash: provenance.valueHash,
      at: occurredAt,
    },
    occurredAt,
    correlationId,
  );

export const createConfigResolvedIntent = ({
  occurredAt,
  correlationId,
  fieldCount,
  resolvedPolicyHash,
  runId,
}: {
  readonly occurredAt: string;
  readonly correlationId?: string;
  readonly fieldCount: number;
  readonly resolvedPolicyHash: string;
  readonly runId: string;
}): ConfigResolvedIntent =>
  withEnvelope(
    'ConfigResolved',
    {
      runId,
      resolvedPolicyHash,
      fieldCount,
      at: occurredAt,
    },
    occurredAt,
    correlationId,
  );

export const createPolicyResolutionFailedIntent = ({
  blockingState,
  occurredAt,
  correlationId,
  reason,
}: {
  readonly blockingState: string;
  readonly occurredAt: string;
  readonly correlationId?: string;
  readonly reason: PolicyResolutionFailureReason;
}): PolicyResolutionFailedIntent =>
  withEnvelope(
    'PolicyResolutionFailed',
    {
      reason,
      blockingState,
      at: occurredAt,
    },
    occurredAt,
    correlationId,
  );
