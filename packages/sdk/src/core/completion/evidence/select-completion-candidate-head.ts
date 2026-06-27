import type { LocalGitEvidenceRecordedPayload } from '../../../foundation/workspace-repository/worktree/index.js';
import type { RunEventEnvelope, RunReplay } from '../../run-lifecycle/contracts/index.js';

import { toEvidenceEventRef } from './shared.js';
import type { CandidateHeadSelection } from './types.js';

type SelectCompletionCandidateHeadInput = {
  readonly replay: RunReplay;
  readonly leaseId: string;
  readonly afterSequence: number;
};

const isLocalGitEvent = (event: RunEventEnvelope): event is RunEventEnvelope<LocalGitEvidenceRecordedPayload> =>
  event.type === 'LocalGitEvidenceRecorded' &&
  typeof event.payload === 'object' &&
  event.payload !== null &&
  typeof (event.payload as { leaseId?: string }).leaseId === 'string' &&
  typeof (event.payload as { headSha?: string }).headSha === 'string';

export const selectCompletionCandidateHead = (input: SelectCompletionCandidateHeadInput): CandidateHeadSelection => {
  const candidates = input.replay.events
    .filter((event) => event.sequence <= input.afterSequence)
    .filter(isLocalGitEvent)
    .filter((event) => event.payload.leaseId === input.leaseId);

  if (candidates.length === 0) {
    return { ok: false, state: 'head-ambiguous', evidenceRefs: [] };
  }

  const latestSequence = Math.max(...candidates.map((event) => event.sequence));
  const latest = candidates.filter((event) => event.sequence === latestSequence);
  const evidenceRefs = latest.map(toEvidenceEventRef);

  if (latest.length !== 1) {
    return { ok: false, state: 'head-ambiguous', evidenceRefs };
  }

  const selected = latest[0];
  if (!selected.payload.clean) {
    return {
      ok: false,
      state: 'workspace-dirty',
      headSha: selected.payload.headSha,
      evidenceRefs,
    };
  }

  return {
    ok: true,
    headSha: selected.payload.headSha,
    localGit: toEvidenceEventRef(selected),
    localGitPayload: selected.payload,
    evidenceRefs,
  };
};
