import { describe, expect, it } from 'vitest';

import {
  classifyChangedPaths,
  evaluateCompletion,
  selectCompletionCandidateHead,
} from '../../../../src/core/completion/evidence/index.js';

import {
  createEvent,
  createLocalGitPayload,
  createReplay,
  createWriter,
  cursor,
  projections,
  runId,
} from './shared.js';

describe('core-05-s2 candidate head and changed-path gate', () => {
  it('candidate-single-clean-head selects the latest clean head for the active lease', () => {
    const replay = createReplay(
      createEvent('LocalGitEvidenceRecorded', 4, createLocalGitPayload({ headSha: 'old-head' })),
      createEvent('LocalGitEvidenceRecorded', 6, createLocalGitPayload({ headSha: 'new-head' })),
    );

    const result = selectCompletionCandidateHead({ replay, leaseId: 'lease-01', afterSequence: 20 });

    expect(result).toMatchObject({ ok: true, headSha: 'new-head' });
  });

  it('candidate-ambiguous-heads fails closed when multiple latest heads exist', () => {
    const replay = createReplay(
      createEvent('LocalGitEvidenceRecorded', 6, createLocalGitPayload({ headSha: 'head-a' })),
      createEvent('LocalGitEvidenceRecorded', 6, createLocalGitPayload({ headSha: 'head-b' })),
    );

    const result = selectCompletionCandidateHead({ replay, leaseId: 'lease-01', afterSequence: 20 });

    expect(result).toEqual({
      ok: false,
      state: 'head-ambiguous',
      evidenceRefs: expect.arrayContaining([expect.objectContaining({ type: 'LocalGitEvidenceRecorded' })]),
    });
  });

  it('candidate-dirty-worktree returns workspace-dirty for the latest dirty evidence', () => {
    const replay = createReplay(createEvent('LocalGitEvidenceRecorded', 7, createLocalGitPayload({ clean: false })));

    const result = selectCompletionCandidateHead({ replay, leaseId: 'lease-01', afterSequence: 20 });

    expect(result).toMatchObject({ ok: false, state: 'workspace-dirty', headSha: 'head-01' });
  });

  it('returns head-ambiguous when the active lease has no usable local git evidence', () => {
    const replay = createReplay(
      createEvent('LocalGitEvidenceRecorded', 7, createLocalGitPayload({ leaseId: 'lease-02' })),
    );

    const result = selectCompletionCandidateHead({ replay, leaseId: 'lease-01', afterSequence: 20 });

    expect(result).toEqual({ ok: false, state: 'head-ambiguous', evidenceRefs: [] });
  });

  it('changed-path-gate-matrix classifies all five classes and maps gate states', () => {
    const classification = classifyChangedPaths({
      changedPaths: [
        'packages/sdk/src/core/completion/evidence/evaluate-completion.ts',
        '.github/workflows/check.yml',
        '.codex/agentic-workflow-kit/runs/123/events.jsonl',
        'README.md',
      ],
      allowedChangePaths: ['packages/sdk/src/core/completion/evidence/**'],
      protectedPathSets: [{ label: 'ci', digest: 'sha256:ci', paths: ['.github/workflows/**'] }],
      runnerEvidencePaths: ['.codex/agentic-workflow-kit/runs/**'],
      protectedPolicyApproved: false,
    });

    expect(classification.classifications).toEqual([
      { path: 'packages/sdk/src/core/completion/evidence/evaluate-completion.ts', class: 'allowed-task-change' },
      { path: '.github/workflows/check.yml', class: 'protected-policy-change' },
      { path: '.codex/agentic-workflow-kit/runs/123/events.jsonl', class: 'runner-evidence-change' },
      { path: 'README.md', class: 'outside-allowlist' },
    ]);
    expect(classification.state).toBe('changed-files-outside-allowlist');

    const absent = classifyChangedPaths({ changedPaths: ['README.md'] });
    expect(absent.classifications).toEqual([{ path: 'README.md', class: 'unclassified' }]);
    expect(absent.state).toBe('changed-file-policy-absent');

    const protectedOnly = classifyChangedPaths({
      changedPaths: ['.github/workflows/check.yml'],
      allowedChangePaths: ['packages/sdk/src/core/completion/evidence/**'],
      protectedPathSets: [{ label: 'ci', digest: 'sha256:ci', paths: ['.github/workflows/**'] }],
      protectedPolicyApproved: false,
    });
    expect(protectedOnly.state).toBe('protected-policy-change-unapproved');
  });

  it('supports single-segment star and question-mark path patterns', () => {
    const classification = classifyChangedPaths({
      changedPaths: ['artifacts/run-1.json', 'packages/sdk/src/file-a.ts'],
      allowedChangePaths: ['packages/sdk/src/file-?.ts'],
      protectedPathSets: [{ label: 'ci', digest: 'sha256:none', paths: ['never/**'] }],
      runnerEvidencePaths: ['artifacts/*.json'],
      protectedPolicyApproved: true,
    });

    expect(classification.classifications).toEqual([
      { path: 'artifacts/run-1.json', class: 'runner-evidence-change' },
      { path: 'packages/sdk/src/file-a.ts', class: 'allowed-task-change' },
    ]);
    expect(classification.state).toBeUndefined();
  });

  it('records the protected-policy snapshot payload when launch-time snapshot input is supplied', async () => {
    const replay = createReplay(createEvent('LocalGitEvidenceRecorded', 6, createLocalGitPayload()));
    const writer = createWriter();

    const result = await evaluateCompletion(
      {
        runId,
        evaluatedAt: '2026-06-27T09:10:00.000Z',
        evaluatedThrough: cursor,
        leaseId: 'lease-01',
        policyRef: 'policy:merge',
        allowedChangePaths: ['packages/sdk/src/core/completion/evidence/**'],
        protectedPolicySnapshot: {
          runId,
          policyRef: 'policy:merge',
          policyDigest: 'sha256:policy',
          baseSha: 'base-01',
          verifierCommandDigest: 'sha256:verify-command',
          protectedPathSets: [{ label: 'ci', digest: 'sha256:ci', paths: ['.github/workflows/**'] }],
          recordedAt: '2026-06-27T09:09:00.000Z',
        },
      },
      { replay, projections, writer },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.token);
    }

    expect(writer.appendCalls[0]?.[0]).toMatchObject({
      type: 'ProtectedPolicySnapshotRecorded',
      durability: 'barrier',
      payload: {
        schema: 'kit-vnext.protected-policy-snapshot-recorded.v1',
        policyRef: 'policy:merge',
        baseSha: 'base-01',
        verifierCommandDigest: 'sha256:verify-command',
        protectedPathSets: [{ label: 'ci', digest: 'sha256:ci', paths: ['.github/workflows/**'] }],
      },
    });
  });

  it('maps protected-policy changes through evaluateCompletion when approval is missing', async () => {
    const replay = createReplay(
      createEvent(
        'LocalGitEvidenceRecorded',
        6,
        createLocalGitPayload({ changedPaths: ['.github/workflows/check.yml'] }),
      ),
      createEvent('ProtectedPolicySnapshotRecorded', 7, {
        schema: 'kit-vnext.protected-policy-snapshot-recorded.v1',
        runId,
        policyRef: 'policy:merge',
        policyDigest: 'sha256:policy',
        baseSha: 'base-01',
        verifierCommandDigest: 'sha256:verify-command',
        protectedPathSets: [{ label: 'ci', digest: 'sha256:ci', paths: ['.github/workflows/**'] }],
        recordedAt: '2026-06-27T09:09:00.000Z',
      }),
    );

    const result = await evaluateCompletion(
      {
        runId,
        evaluatedAt: '2026-06-27T09:10:00.000Z',
        evaluatedThrough: cursor,
        leaseId: 'lease-01',
        policyRef: 'policy:merge',
        allowedChangePaths: ['packages/sdk/src/core/completion/evidence/**'],
      },
      { replay, projections, writer: createWriter() },
    );

    expect(result.ok && result.value.decision.state).toBe('protected-policy-change-unapproved');
  });
});
