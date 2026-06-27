import type { ApprovalDecisionRecordedPayload } from '../../approval/contracts/index.js';
import type { EvidenceEventRef, Result, RunEventEnvelope } from '../../run-lifecycle/contracts/index.js';
import type { CompletionDecisionPayload } from '../contracts/index.js';

import { classifyChangedPaths } from './classify-changed-paths.js';
import { isVerificationFresh } from './is-verification-fresh.js';
import { selectCompletionCandidateHead } from './select-completion-candidate-head.js';
import {
  appendBarrierEvent,
  buildProtectedPolicySnapshotPayload,
  findLatestProtectedPolicySnapshot,
  matchesProtectedPolicySnapshotIdentity,
  toEventLogUnwritable,
} from './shared.js';
import type {
  CompletionEvaluationCommit,
  CompletionEvaluationFailure,
  CompletionEvaluatorDependencies,
  EvaluateCompletionInput,
} from './types.js';

const isProtectedPolicyApproval = (
  event: RunEventEnvelope,
): event is RunEventEnvelope<ApprovalDecisionRecordedPayload> => {
  if (event.type !== 'ApprovalDecisionRecorded') {
    return false;
  }

  const payload = event.payload as Partial<ApprovalDecisionRecordedPayload> | undefined;
  return (
    payload?.schema === 'kit-vnext.approval-decision-recorded.v1' &&
    payload.protectedPolicyBinding !== undefined &&
    payload.decision?.decision === 'grant'
  );
};

const hasProtectedPolicyApproval = (
  events: readonly RunEventEnvelope[],
  afterSequence: number,
  headSha: string,
  snapshotEventId: string | undefined,
): boolean =>
  events
    .filter((event) => event.sequence <= afterSequence)
    .filter(isProtectedPolicyApproval)
    .some((event) => {
      const binding = event.payload.protectedPolicyBinding;
      return (
        binding !== undefined &&
        binding.runId === event.runId &&
        binding.candidateHeadSha === headSha &&
        binding.protectedPolicySnapshotEventId === snapshotEventId
      );
    });

const buildDecisionPayload = (
  input: EvaluateCompletionInput,
  state: CompletionDecisionPayload['state'],
  evidenceRefs: readonly EvidenceEventRef[],
  headSha?: string,
): CompletionDecisionPayload => ({
  schema: 'kit-vnext.completion-decision-recorded.v1',
  runId: input.runId,
  state,
  ...(headSha === undefined ? {} : { headSha }),
  cursor: input.evaluatedThrough,
  evidenceRefs,
  evaluatedAt: input.evaluatedAt,
});

const appendCompletionDecision = async (
  payload: CompletionDecisionPayload,
  writer: CompletionEvaluatorDependencies['writer'],
): Promise<Result<CompletionEvaluationCommit, CompletionEvaluationFailure>> => {
  const appendResult = await appendBarrierEvent(writer, 'CompletionDecisionRecorded', payload.evaluatedAt, payload);
  if ('code' in appendResult) {
    return { ok: false, error: toEventLogUnwritable(appendResult) };
  }

  return {
    ok: true,
    value: {
      decision: payload,
      decisionEventId: appendResult.eventIds[0] ?? 'CompletionDecisionRecorded',
      appendReceipt: appendResult,
    },
  };
};

export const evaluateCompletion = async (
  input: EvaluateCompletionInput,
  dependencies: CompletionEvaluatorDependencies,
): Promise<Result<CompletionEvaluationCommit, CompletionEvaluationFailure>> => {
  const candidate = selectCompletionCandidateHead({
    replay: dependencies.replay,
    leaseId: input.leaseId,
    afterSequence: input.evaluatedThrough.afterSequence,
  });
  if (!candidate.ok) {
    return appendCompletionDecision(
      buildDecisionPayload(input, candidate.state, candidate.evidenceRefs, candidate.headSha),
      dependencies.writer,
    );
  }

  const expectedSnapshotIdentity = {
    runId: input.runId,
    policyRef: input.policyRef,
    baseSha: candidate.localGitPayload.baseSha,
  };

  let snapshot = findLatestProtectedPolicySnapshot(dependencies.replay.events, input.evaluatedThrough.afterSequence);
  let protectedPolicySnapshot: EvaluateCompletionInput['protectedPolicySnapshot'] extends never
    ? never
    : ReturnType<typeof buildProtectedPolicySnapshotPayload> | undefined;
  if (snapshot !== undefined && !matchesProtectedPolicySnapshotIdentity(snapshot.payload, expectedSnapshotIdentity)) {
    return appendCompletionDecision(
      buildDecisionPayload(
        input,
        'changed-file-policy-absent',
        [...candidate.evidenceRefs, snapshot.ref],
        candidate.headSha,
      ),
      dependencies.writer,
    );
  }

  if (snapshot === undefined && input.protectedPolicySnapshot !== undefined) {
    if (!matchesProtectedPolicySnapshotIdentity(input.protectedPolicySnapshot, expectedSnapshotIdentity)) {
      return appendCompletionDecision(
        buildDecisionPayload(input, 'changed-file-policy-absent', candidate.evidenceRefs, candidate.headSha),
        dependencies.writer,
      );
    }

    protectedPolicySnapshot = buildProtectedPolicySnapshotPayload(input.protectedPolicySnapshot);
    const snapshotAppend = await appendBarrierEvent(
      dependencies.writer,
      'ProtectedPolicySnapshotRecorded',
      protectedPolicySnapshot.recordedAt,
      protectedPolicySnapshot,
    );
    if ('code' in snapshotAppend) {
      return { ok: false, error: toEventLogUnwritable(snapshotAppend) };
    }

    snapshot = {
      ref: {
        eventId: snapshotAppend.eventIds[0] ?? 'ProtectedPolicySnapshotRecorded',
        sequence: snapshotAppend.firstSequence,
        payloadDigest: snapshotAppend.payloadDigests[0] ?? 'sha256:protected-policy-snapshot',
        type: 'ProtectedPolicySnapshotRecorded',
      },
      payload: protectedPolicySnapshot,
    };
  }

  const pathGate = classifyChangedPaths({
    changedPaths: candidate.localGitPayload.changedPaths,
    allowedChangePaths: input.allowedChangePaths,
    protectedPathSets: snapshot?.payload.protectedPathSets,
    runnerEvidencePaths: input.runnerEvidencePaths,
    protectedPolicyApproved: hasProtectedPolicyApproval(
      dependencies.replay.events,
      input.evaluatedThrough.afterSequence,
      candidate.headSha,
      snapshot?.ref.eventId,
    ),
  });
  if (pathGate.state !== undefined) {
    const evidenceRefs = [...candidate.evidenceRefs, ...(snapshot === undefined ? [] : [snapshot.ref])];
    return appendCompletionDecision(
      buildDecisionPayload(input, pathGate.state, evidenceRefs, candidate.headSha),
      dependencies.writer,
    );
  }

  const verification =
    snapshot === undefined
      ? { fresh: false, evidenceRefs: [] as readonly EvidenceEventRef[] }
      : isVerificationFresh({
          verification: input.verification,
          expectedHeadSha: candidate.headSha,
          expectedCommandDigest: snapshot.payload.verifierCommandDigest,
        });

  const sharedEvidenceRefs = [
    ...candidate.evidenceRefs,
    ...(snapshot === undefined ? [] : [snapshot.ref]),
    ...(verification.evidenceRefs ?? []),
    ...(input.workerClaim === undefined ? [] : [input.workerClaim.ref]),
  ];
  const uniqueEvidenceRefs = [...new Map(sharedEvidenceRefs.map((ref) => [ref.eventId, ref])).values()];
  const claimTargetsExactHead =
    input.workerClaim?.claim.headSha === undefined || input.workerClaim.claim.headSha === candidate.headSha;
  const claimsDone = input.workerClaim?.claim.assertsDone === true;

  if (claimsDone && (!claimTargetsExactHead || !verification.fresh)) {
    return appendCompletionDecision(
      buildDecisionPayload(input, 'claim-evidence-mismatch', uniqueEvidenceRefs, candidate.headSha),
      dependencies.writer,
    );
  }

  if (
    verification.fresh &&
    input.workerClaim?.claim.assertsMergeReady === true &&
    input.forgeEvidenceAvailable !== true
  ) {
    return appendCompletionDecision(
      buildDecisionPayload(input, 'forge-evidence-unavailable', uniqueEvidenceRefs, candidate.headSha),
      dependencies.writer,
    );
  }

  if (!verification.fresh && input.verification === undefined) {
    return appendCompletionDecision(
      buildDecisionPayload(input, 'completion-pending-evidence', uniqueEvidenceRefs, candidate.headSha),
      dependencies.writer,
    );
  }

  if (!verification.fresh && verification.state !== undefined) {
    return appendCompletionDecision(
      buildDecisionPayload(input, verification.state, uniqueEvidenceRefs, candidate.headSha),
      dependencies.writer,
    );
  }

  const result = await appendCompletionDecision(
    buildDecisionPayload(input, 'completion-verified', uniqueEvidenceRefs, candidate.headSha),
    dependencies.writer,
  );
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    value: {
      ...result.value,
      ...(protectedPolicySnapshot === undefined ? {} : { protectedPolicySnapshot }),
      ...(snapshot === undefined ? {} : { protectedPolicySnapshotEventId: snapshot.ref.eventId }),
    },
  };
};
