import { describe, expect, it } from 'vitest';

import {
  findLatestProtectedPolicySnapshot,
  isProtectedPolicySnapshotPayload,
  matchesProtectedPolicySnapshotIdentity,
} from '../../../../src/core/completion/evidence/shared.js';

import { createEvent } from './shared.js';

describe('core-05-s2 evidence helpers', () => {
  it('recognizes protected-policy snapshot payloads and ignores invalid shapes', () => {
    expect(isProtectedPolicySnapshotPayload(null)).toBe(false);
    expect(isProtectedPolicySnapshotPayload({ schema: 'kit-vnext.other' })).toBe(false);
    expect(
      isProtectedPolicySnapshotPayload({
        schema: 'kit-vnext.protected-policy-snapshot-recorded.v1',
      }),
    ).toBe(true);
  });

  it('returns the latest valid protected-policy snapshot at or before the cursor', () => {
    const older = createEvent('ProtectedPolicySnapshotRecorded', 5, {
      schema: 'kit-vnext.protected-policy-snapshot-recorded.v1',
      runId: 'run-completion-evidence-01',
      policyRef: 'policy:merge',
      policyDigest: 'sha256:older',
      baseSha: 'base-01',
      verifierCommandDigest: 'sha256:verify-old',
      protectedPathSets: [],
      recordedAt: '2026-06-27T09:05:00.000Z',
    });
    const invalid = createEvent('ProtectedPolicySnapshotRecorded', 6, { schema: 'kit-vnext.invalid' });
    const newer = createEvent('ProtectedPolicySnapshotRecorded', 7, {
      schema: 'kit-vnext.protected-policy-snapshot-recorded.v1',
      runId: 'run-completion-evidence-01',
      policyRef: 'policy:merge',
      policyDigest: 'sha256:newer',
      baseSha: 'base-01',
      verifierCommandDigest: 'sha256:verify-new',
      protectedPathSets: [],
      recordedAt: '2026-06-27T09:07:00.000Z',
    });

    const latest = findLatestProtectedPolicySnapshot([older, invalid, newer], 20);

    expect(latest?.ref.eventId).toBe(newer.eventId);
    expect(latest?.payload.verifierCommandDigest).toBe('sha256:verify-new');
  });

  it('matches protected-policy snapshot identity only for exact run, policy, and base values', () => {
    const snapshot = {
      runId: 'run-completion-evidence-01',
      policyRef: 'policy:merge',
      baseSha: 'base-01',
    };

    expect(matchesProtectedPolicySnapshotIdentity(snapshot, snapshot)).toBe(true);
    expect(matchesProtectedPolicySnapshotIdentity(snapshot, { ...snapshot, runId: 'run-other' })).toBe(false);
    expect(matchesProtectedPolicySnapshotIdentity(snapshot, { ...snapshot, policyRef: 'policy:other' })).toBe(false);
    expect(matchesProtectedPolicySnapshotIdentity(snapshot, { ...snapshot, baseSha: 'base-02' })).toBe(false);
  });
});
