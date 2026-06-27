import {
  BLOCKER_EVIDENCE_ELIGIBLE_COMPLETION_STATES,
  BLOCKER_EVIDENCE_ELIGIBLE_MERGE_STATES,
} from '../contracts/index.js';
import type { CompletionDecisionState, MergeDecisionState } from '../contracts/index.js';

import { resolveExactHead, uniqueEvidenceRefs } from './shared.js';
import { recordForgeOperationIntent } from './record-forge-operation-intent.js';
import type {
  BlockerEvidenceIntentResult,
  CompletionBlockerEligibility,
  MergeBlockerEligibility,
  RecordBlockerEvidenceIntentInput,
  IntentsDependencies,
} from './types.js';

const completionEligibility = (
  state: CompletionDecisionState,
): CompletionBlockerEligibility | { eligible: false; token: CompletionDecisionState } =>
  BLOCKER_EVIDENCE_ELIGIBLE_COMPLETION_STATES.includes(
    state as (typeof BLOCKER_EVIDENCE_ELIGIBLE_COMPLETION_STATES)[number],
  )
    ? { eligible: true, blockerState: state as CompletionBlockerEligibility['blockerState'] }
    : { eligible: false, token: state };

const mergeEligibility = (
  state: MergeDecisionState,
): MergeBlockerEligibility | { eligible: false; token: MergeDecisionState } =>
  BLOCKER_EVIDENCE_ELIGIBLE_MERGE_STATES.includes(state as (typeof BLOCKER_EVIDENCE_ELIGIBLE_MERGE_STATES)[number])
    ? { eligible: true, blockerState: state as MergeBlockerEligibility['blockerState'] }
    : { eligible: false, token: state };

export const recordBlockerEvidenceIntent = async (
  input: RecordBlockerEvidenceIntentInput,
  dependencies: IntentsDependencies,
): BlockerEvidenceIntentResult => {
  if (!input.runnerMayPush || !input.runnerMayOpenPr) {
    return { ok: false, error: { token: 'merge-policy-disabled' } };
  }

  if (input.decision.kind === 'completion') {
    const eligibility = completionEligibility(input.decision.decision.state);
    if (!eligibility.eligible) {
      return { ok: false, error: { token: eligibility.token } };
    }

    const exactHead = resolveExactHead(input.decision.decision.headSha, input.localHead, 'head-ambiguous');
    if (!exactHead.ok) {
      return { ok: false, error: { token: exactHead.token } };
    }

    return recordForgeOperationIntent(
      {
        runId: input.runId,
        recordedAt: input.recordedAt,
        operation: input.operation,
        policyRef: input.policyRef,
        decisionEventId: input.decision.eventId,
        expectedHeadSha: exactHead.expectedHeadSha,
        localHead: input.localHead,
        evidenceRefs: uniqueEvidenceRefs([
          ...input.decision.decision.evidenceRefs,
          ...(input.localHead.evidenceRefs ?? []),
        ]),
        purpose: 'blocker-evidence-pr',
        blockerState: eligibility.blockerState,
      },
      dependencies,
    );
  }

  const eligibility = mergeEligibility(input.decision.decision.state);
  if (!eligibility.eligible) {
    return { ok: false, error: { token: eligibility.token } };
  }

  const exactHead = resolveExactHead(input.decision.decision.headSha, input.localHead, 'merge-head-ambiguous');
  if (!exactHead.ok) {
    return { ok: false, error: { token: exactHead.token } };
  }

  return recordForgeOperationIntent(
    {
      runId: input.runId,
      recordedAt: input.recordedAt,
      operation: input.operation,
      policyRef: input.policyRef,
      decisionEventId: input.decision.eventId,
      expectedHeadSha: exactHead.expectedHeadSha,
      localHead: input.localHead,
      evidenceRefs: uniqueEvidenceRefs([...input.decision.decision.forgeRefs, ...(input.localHead.evidenceRefs ?? [])]),
      purpose: 'blocker-evidence-pr',
      blockerState: eligibility.blockerState,
    },
    dependencies,
  );
};
