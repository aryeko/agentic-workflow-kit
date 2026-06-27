import type { AppendIntent, Result, RunAppendReceipt } from '../../run-lifecycle/contracts/index.js';
import type { MergeDecisionPayload } from '../contracts/index.js';

import { evaluateMergeState } from './merge-allowed.js';
import type {
  EvaluateMergeReadinessInput,
  MergeReadinessCommit,
  MergeReadinessDependencies,
  MergeReadinessFailure,
  MergeReadinessResult,
} from './types.js';

const appendMergeDecision = async (
  payload: MergeDecisionPayload,
  dependencies: MergeReadinessDependencies,
): Promise<Result<RunAppendReceipt, MergeReadinessFailure>> => {
  const appendIntent: AppendIntent<MergeDecisionPayload> = {
    domain: 'core-05',
    type: 'MergeDecisionRecorded',
    durability: 'barrier',
    payload,
    occurredAt: payload.evaluatedAt,
  };
  const result = await Promise.resolve(dependencies.writer.append([appendIntent]));
  if (result.ok) {
    return result;
  }

  return {
    ok: false,
    error: {
      token: 'merge-intent-unwritable',
      appendFailure: result.error,
    },
  };
};

export const evaluateMergeReadiness = async (
  input: EvaluateMergeReadinessInput,
  dependencies: MergeReadinessDependencies,
): MergeReadinessResult => {
  const details = evaluateMergeState(input);
  const payload: MergeDecisionPayload = {
    schema: 'kit-vnext.merge-decision-recorded.v1',
    runId: input.runId,
    state: details.state,
    headSha: input.candidateHeadSha,
    completionEventId: input.completionDecision.eventId,
    ...(details.gateRef === undefined ? {} : { gateRef: details.gateRef }),
    forgeRefs: details.forgeRefs,
    evaluatedAt: input.evaluatedAt,
  };

  const appendResult = await appendMergeDecision(payload, dependencies);
  if (!appendResult.ok) {
    return appendResult;
  }

  const commit: MergeReadinessCommit = {
    decision: payload,
    decisionEventId: appendResult.value.eventIds[0] ?? 'MergeDecisionRecorded',
    appendReceipt: appendResult.value,
  };

  return { ok: true, value: commit };
};
