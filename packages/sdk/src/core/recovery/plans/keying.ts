import { createHash } from 'node:crypto';

import type { RecoveryClassification, RecoveryPlan } from '../contracts/index.js';
import { deriveRecoveryPlanIdInput } from '../classifier/index.js';

import type { PlanRecoveryActionInput } from './types.js';

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

export const createRecoveryPlanId = (
  input: Pick<
    PlanRecoveryActionInput,
    'mode' | 'runId' | 'policyRef' | 'requestedAction' | 'scope' | 'evaluatedThrough'
  >,
  classification: Pick<RecoveryClassification, 'state'>,
): RecoveryPlan['planId'] => {
  const { digestSource } = deriveRecoveryPlanIdInput(input, classification);
  return `recovery-plan:${sha256(digestSource)}`;
};
