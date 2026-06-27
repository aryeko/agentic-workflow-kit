import type {
  CompletionDecisionState,
  MergeDecisionState,
  PostMergeOutcomeState,
} from '../../completion/contracts/index.js';
import type { EvidenceEventRef } from '../../run-lifecycle/contracts/index.js';
import type { RecoveryClassification, RecoveryEvidenceSnapshot, RecoveryState } from '../contracts/index.js';
import type { LeaseSnapshot } from '../../../foundation/storage/index.js';

import { classifyActionSafety } from './action-safety.js';

const TERMINAL_LIFECYCLES = new Set<string>(['completed', 'blocked', 'failed', 'canceled']);
const EVIDENCE_REFRESH_COMPLETION_STATES = new Set<CompletionDecisionState>([
  'completion-pending-evidence',
  'forge-evidence-unavailable',
  'head-ambiguous',
]);
const EVIDENCE_REFRESH_MERGE_STATES = new Set<MergeDecisionState>([
  'merge-branch-not-fresh',
  'merge-forge-unavailable',
  'merge-head-ambiguous',
  'merge-protection-snapshot-stale',
]);
const EVIDENCE_REFRESH_POST_MERGE_STATES = new Set<PostMergeOutcomeState>(['post-merge-retryable-refused']);
const SUPERVISION_AMBIGUOUS_REASONS = new Set<string>([
  'agent-progress-unobservable',
  'event-cursor-unavailable',
  'session-linkage-ambiguous',
  'termination-unavailable',
  'termination-unproven',
  'tool-tracking-unavailable',
]);

const RECOVERY_REASONS: Readonly<Record<RecoveryState, string>> = Object.freeze({
  'clean-terminal': 'terminal lifecycle is already clean',
  'owned-session-resumable': 'current owned session can be resumed safely',
  'evidence-refresh-retryable': 'retryable completion or merge evidence needs refresh',
  'owned-worker-stale-terminable': 'owned worker is stale and can be terminated safely',
  'safe-empty-restartable': 'all recovery preconditions are empty or released',
  'stale-launch-clearable': 'expired story launch can be cleared safely',
  'operator-approval-needed': 'recovery requires operator involvement',
  'lease-unavailable': 'lease guarantees are degraded or unavailable',
  'log-unwritable': 'event log append health is unavailable',
  'log-corrupt': 'event log replay is corrupt',
  'launch-duplicate-active': 'another active story-launch lease already owns this task',
  'owner-ambiguous': 'session ownership or linkage is ambiguous',
  'termination-ambiguous': 'termination evidence is ambiguous or still unverified',
  'supervision-stale-ambiguous': 'supervision evidence is stale or ambiguous',
  'merge-outcome-ambiguous': 'post-merge outcome evidence is ambiguous',
  'provider-evidence-gap': 'required provider evidence is missing',
  'manual-edits-forbidden': 'manual repair evidence forbids recovery automation',
  'terminal-no-recovery': 'terminal summaries remain ambiguous after termination',
});

const dedupeEvidenceRefs = (evidenceRefs: readonly EvidenceEventRef[]): EvidenceEventRef[] => {
  const unique = new Map<string, EvidenceEventRef>();
  for (const evidenceRef of evidenceRefs) {
    unique.set(evidenceRef.eventId, evidenceRef);
  }

  return [...unique.values()].sort(
    (left, right) => left.sequence - right.sequence || left.eventId.localeCompare(right.eventId),
  );
};

const isExpired = (lease: LeaseSnapshot | undefined, observedAt: string): boolean =>
  lease !== undefined && lease.expiresAt.getTime() <= globalThis.Date.parse(observedAt);

const hasActiveWriterLease = (snapshot: RecoveryEvidenceSnapshot): boolean =>
  snapshot.leases.runWriter !== undefined && !isExpired(snapshot.leases.runWriter, snapshot.observedAt);

const hasConflictingTerminalEvidence = (snapshot: RecoveryEvidenceSnapshot): boolean =>
  snapshot.termination?.state === 'requested' ||
  snapshot.termination?.state === 'ambiguous' ||
  snapshot.termination?.state === 'confirmed' ||
  hasSupervisionAmbiguity(snapshot) ||
  snapshot.liveness?.terminal === true;

const hasRetryableEvidenceState = (snapshot: RecoveryEvidenceSnapshot): boolean =>
  (snapshot.completion?.latestDecisionState !== undefined &&
    EVIDENCE_REFRESH_COMPLETION_STATES.has(snapshot.completion.latestDecisionState)) ||
  (snapshot.completion?.latestMergeState !== undefined &&
    EVIDENCE_REFRESH_MERGE_STATES.has(snapshot.completion.latestMergeState)) ||
  (snapshot.completion?.postMergeOutcome !== undefined &&
    EVIDENCE_REFRESH_POST_MERGE_STATES.has(snapshot.completion.postMergeOutcome));

const hasSupervisionAmbiguity = (snapshot: RecoveryEvidenceSnapshot): boolean =>
  snapshot.liveness?.state === 'supervision-lost' ||
  (snapshot.liveness?.state === 'stale' &&
    (snapshot.liveness.reason === undefined || SUPERVISION_AMBIGUOUS_REASONS.has(snapshot.liveness.reason)));

const hasAmbiguousMergeOutcome = (snapshot: RecoveryEvidenceSnapshot): boolean =>
  snapshot.completion?.postMergeOutcome === 'post-merge-outcome-ambiguous';

const hasTerminationAmbiguity = (snapshot: RecoveryEvidenceSnapshot): boolean =>
  snapshot.termination?.state === 'ambiguous' || snapshot.termination?.state === 'requested';

const hasProviderGap = (snapshot: RecoveryEvidenceSnapshot): boolean =>
  snapshot.providerGaps.length > 0 ||
  snapshot.approval?.state === 'unknown' ||
  snapshot.approval?.state === 'ambiguous' ||
  snapshot.process?.state === 'unknown' ||
  snapshot.process?.state === 'ambiguous' ||
  snapshot.workSource?.claimState === 'unknown' ||
  snapshot.workSource?.claimState === 'ambiguous';

const classifyState = (snapshot: RecoveryEvidenceSnapshot): RecoveryState => {
  if (snapshot.state.lifecycle !== null && TERMINAL_LIFECYCLES.has(snapshot.state.lifecycle)) {
    return snapshot.completion?.postMergeOutcome === 'post-merge-outcome-ambiguous'
      ? 'terminal-no-recovery'
      : 'clean-terminal';
  }

  if (snapshot.state.degradedHealth === 'interior-corrupt') {
    return 'log-corrupt';
  }
  if (snapshot.state.degradedHealth === 'event-log-unavailable') {
    return 'log-unwritable';
  }
  if (snapshot.leases.leaseHealth !== 'ok') {
    return 'lease-unavailable';
  }
  if (
    snapshot.leases.storyLaunch !== undefined &&
    !isExpired(snapshot.leases.storyLaunch, snapshot.observedAt) &&
    snapshot.leases.storyLaunch.holder !== snapshot.runId
  ) {
    return 'launch-duplicate-active';
  }
  if ((snapshot.manualEditRefs?.length ?? 0) > 0) {
    return 'manual-edits-forbidden';
  }
  if (
    snapshot.launch.linkage === 'unknown' ||
    snapshot.launch.linkage === 'ambiguous' ||
    snapshot.ownership?.ownerState === 'unknown' ||
    snapshot.ownership?.ownerState === 'ambiguous' ||
    (snapshot.ownership?.ownerState === 'owned' && snapshot.ownership.sessionId === undefined)
  ) {
    return 'owner-ambiguous';
  }
  if (hasTerminationAmbiguity(snapshot)) {
    return 'termination-ambiguous';
  }
  if (hasSupervisionAmbiguity(snapshot)) {
    return 'supervision-stale-ambiguous';
  }
  if (
    snapshot.ownership?.ownerState === 'owned' &&
    snapshot.ownership.sessionId !== undefined &&
    snapshot.launch.currentSession?.sessionId === snapshot.ownership.sessionId &&
    snapshot.ownership.canResumeOwned === true &&
    snapshot.ownership.resumeEvidenceRef !== undefined &&
    !hasConflictingTerminalEvidence(snapshot)
  ) {
    return 'owned-session-resumable';
  }
  if (
    snapshot.ownership?.ownerState === 'owned' &&
    snapshot.launch.currentSession?.sessionId === snapshot.ownership.sessionId &&
    snapshot.liveness?.state === 'stale' &&
    snapshot.termination?.state === 'none' &&
    snapshot.liveness.reason !== 'termination-unavailable' &&
    snapshot.liveness.reason !== 'termination-unproven' &&
    !hasConflictingTerminalEvidence(snapshot)
  ) {
    return 'owned-worker-stale-terminable';
  }
  if (hasRetryableEvidenceState(snapshot)) {
    return 'evidence-refresh-retryable';
  }
  if (
    snapshot.leases.storyLaunch !== undefined &&
    isExpired(snapshot.leases.storyLaunch, snapshot.observedAt) &&
    !hasActiveWriterLease(snapshot) &&
    snapshot.ownership?.ownerState === 'none' &&
    snapshot.process?.state === 'empty' &&
    snapshot.approval?.state === 'none' &&
    (snapshot.workSource?.claimState === 'empty' || snapshot.workSource?.claimState === 'released') &&
    !hasTerminationAmbiguity(snapshot) &&
    !hasAmbiguousMergeOutcome(snapshot) &&
    !hasProviderGap(snapshot)
  ) {
    return 'stale-launch-clearable';
  }
  if (
    snapshot.leases.storyLaunch === undefined &&
    !hasActiveWriterLease(snapshot) &&
    snapshot.ownership?.ownerState === 'none' &&
    snapshot.process?.state === 'empty' &&
    snapshot.approval?.state === 'none' &&
    (snapshot.workSource?.claimState === 'empty' || snapshot.workSource?.claimState === 'released') &&
    !hasTerminationAmbiguity(snapshot) &&
    !hasAmbiguousMergeOutcome(snapshot) &&
    !hasProviderGap(snapshot)
  ) {
    return 'safe-empty-restartable';
  }
  if (hasAmbiguousMergeOutcome(snapshot)) {
    return 'merge-outcome-ambiguous';
  }
  if (hasProviderGap(snapshot)) {
    return 'provider-evidence-gap';
  }
  return 'operator-approval-needed';
};

export const classifyRecovery = (snapshot: RecoveryEvidenceSnapshot): RecoveryClassification => {
  const state = classifyState(snapshot);
  const actionSafety = classifyActionSafety(state);

  return {
    state,
    ...actionSafety,
    reason: RECOVERY_REASONS[state],
    evidenceRefs: dedupeEvidenceRefs(snapshot.evidenceRefs),
  };
};
