import type { RecoveryClassification, RecoveryPlanInput, RecoveryState } from '../contracts/index.js';
import type { CapabilityGateScope } from '../../capability/evaluator/index.js';

type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalValue[]
  | { readonly [key: string]: CanonicalValue };

export interface RecoveryPlanIdInput {
  readonly mode: RecoveryPlanInput['mode'];
  readonly runId: string;
  readonly policyRef: string;
  readonly requestedAction: RecoveryPlanInput['requestedAction'];
  readonly scope: CapabilityGateScope;
  readonly classificationState: RecoveryState;
  readonly evaluatedThrough: RecoveryPlanInput['evaluatedThrough'];
  readonly digestSource: string;
}

const canonicalize = (value: unknown): CanonicalValue => {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)] as const),
    );
  }

  return null;
};

export const deriveRecoveryPlanIdInput = (
  input: RecoveryPlanInput,
  classification: Pick<RecoveryClassification, 'state'>,
): RecoveryPlanIdInput => {
  const digestShape = {
    mode: input.mode,
    runId: input.runId,
    policyRef: input.policyRef,
    requestedAction: input.requestedAction,
    scope: input.scope,
    classificationState: classification.state,
    evaluatedThrough: input.evaluatedThrough,
  };

  return {
    ...digestShape,
    digestSource: JSON.stringify(canonicalize(digestShape)),
  };
};
