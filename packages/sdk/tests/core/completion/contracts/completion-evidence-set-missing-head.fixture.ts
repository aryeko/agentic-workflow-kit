import type { CompletionEvidenceSet } from '../../../../src/index.js';

const invalidEvidenceSet: CompletionEvidenceSet = {
  // @ts-expect-error CompletionEvidenceSet requires anchor.headSha.
  anchor: {
    runId: 'run-completion-01',
    evaluatedThrough: {
      runId: 'run-completion-01',
      afterSequence: 41,
    },
    evidenceRefs: [],
  },
  localGit: {
    eventId: 'evt-local-01',
    sequence: 41,
    payloadDigest: 'sha256:evidence-01',
    type: 'LocalGitEvidenceRecorded',
  },
  protectedPolicySnapshot: {
    eventId: 'evt-protected-policy-01',
    sequence: 40,
    payloadDigest: 'sha256:snapshot-01',
    type: 'ProtectedPolicySnapshotRecorded',
  },
};

void invalidEvidenceSet;
