import { classifyRecovery } from '../../../../src/core/recovery/classifier/index.js';
import { describe, expect, it } from 'vitest';

import { createLeaseSnapshot, createSnapshot, evidenceEventRefFixture } from './shared.js';

describe('core-06-s2 recovery-stable-rule-order', () => {
  it.each([
    [
      'terminal beats log, lease, duplicate, and session rules',
      createSnapshot({
        state: { lifecycle: 'failed', currentSequence: 4, writerEpoch: 1, degradedHealth: 'interior-corrupt' },
        leases: {
          leaseHealth: 'network-fs-degraded',
          storyLaunch: createLeaseSnapshot({ holder: 'run-foreign-01', expiresAt: '2026-06-27T11:00:00.000Z' }),
        },
        ownership: {
          ownerState: 'owned',
          sessionId: 'session-owned-01',
          canResumeOwned: true,
          resumeEvidenceRef: evidenceEventRefFixture,
        },
      }),
      'clean-terminal',
    ],
    [
      'log health beats lease, duplicate, and restart candidates',
      createSnapshot({
        state: { lifecycle: 'running', currentSequence: 4, writerEpoch: 1, degradedHealth: 'interior-corrupt' },
        leases: {
          leaseHealth: 'read-only',
          storyLaunch: createLeaseSnapshot({ holder: 'run-foreign-01', expiresAt: '2026-06-27T11:00:00.000Z' }),
        },
      }),
      'log-corrupt',
    ],
    [
      'lease health beats duplicate and resumable ownership',
      createSnapshot({
        leases: {
          leaseHealth: 'network-fs-degraded',
          storyLaunch: createLeaseSnapshot({ holder: 'run-foreign-01', expiresAt: '2026-06-27T11:00:00.000Z' }),
        },
        ownership: {
          ownerState: 'owned',
          sessionId: 'session-owned-01',
          canResumeOwned: true,
          resumeEvidenceRef: evidenceEventRefFixture,
        },
      }),
      'lease-unavailable',
    ],
    [
      'duplicate launch beats retryable evidence and restart',
      createSnapshot({
        leases: {
          leaseHealth: 'ok',
          storyLaunch: createLeaseSnapshot({ holder: 'run-foreign-01', expiresAt: '2026-06-27T11:00:00.000Z' }),
        },
        completion: { latestMergeState: 'merge-forge-unavailable' },
      }),
      'launch-duplicate-active',
    ],
    [
      'owned resumable session beats retryable evidence and restart',
      createSnapshot({
        ownership: {
          ownerState: 'owned',
          sessionId: 'session-owned-01',
          canResumeOwned: true,
          resumeEvidenceRef: evidenceEventRefFixture,
        },
        launch: {
          linkage: 'known',
          currentSession: {
            linkOrdinal: 1,
            sessionId: 'session-owned-01',
            linkRole: 'primary',
            startedAt: '2026-06-27T10:00:00.000Z',
            sourceEventId: 'evt-session-linked-01',
          },
          linkHistory: [],
        },
        completion: { latestMergeState: 'merge-forge-unavailable' },
      }),
      'owned-session-resumable',
    ],
  ])('%s', (_name, snapshot, expectedState) => {
    expect(classifyRecovery(snapshot).state).toBe(expectedState);
  });
});

describe('core-06-s2 resume and restart eligibility', () => {
  it('returns owned-session-resumable only for a current owned session with positive resume evidence', () => {
    const snapshot = createSnapshot({
      ownership: {
        ownerState: 'owned',
        sessionId: 'session-owned-01',
        canResumeOwned: true,
        resumeEvidenceRef: evidenceEventRefFixture,
      },
      launch: {
        linkage: 'known',
        currentSession: {
          linkOrdinal: 1,
          sessionId: 'session-owned-01',
          linkRole: 'primary',
          startedAt: '2026-06-27T10:00:00.000Z',
          sourceEventId: 'evt-session-linked-01',
        },
        linkHistory: [],
      },
    });

    expect(classifyRecovery(snapshot).state).toBe('owned-session-resumable');
  });

  it('denies superseded or conflicting-terminal resume cases', () => {
    const superseded = createSnapshot({
      ownership: {
        ownerState: 'owned',
        sessionId: 'session-old-01',
        canResumeOwned: true,
        resumeEvidenceRef: evidenceEventRefFixture,
      },
      launch: {
        linkage: 'known',
        currentSession: {
          linkOrdinal: 2,
          sessionId: 'session-new-01',
          linkRole: 'recovery',
          startedAt: '2026-06-27T10:15:00.000Z',
          sourceEventId: 'evt-session-linked-02',
          supersedesOrdinal: 1,
        },
        linkHistory: [],
      },
    });
    const conflictingTerminal = createSnapshot({
      ownership: {
        ownerState: 'owned',
        sessionId: 'session-owned-01',
        canResumeOwned: true,
        resumeEvidenceRef: evidenceEventRefFixture,
      },
      launch: {
        linkage: 'known',
        currentSession: {
          linkOrdinal: 1,
          sessionId: 'session-owned-01',
          linkRole: 'primary',
          startedAt: '2026-06-27T10:00:00.000Z',
          sourceEventId: 'evt-session-linked-01',
        },
        linkHistory: [],
      },
      liveness: {
        runId: 'run-recovery-01',
        state: 'active',
        currentSessionId: 'session-owned-01',
        timers: {},
        terminal: true,
      },
    });

    expect(classifyRecovery(superseded).state).not.toBe('owned-session-resumable');
    expect(classifyRecovery(conflictingTerminal).state).not.toBe('owned-session-resumable');
  });

  it('returns owned-worker-stale-terminable for a stale owned worker without a resumable session', () => {
    const snapshot = createSnapshot({
      ownership: {
        ownerState: 'owned',
        sessionId: 'session-owned-01',
        canResumeOwned: false,
      },
      launch: {
        linkage: 'known',
        currentSession: {
          linkOrdinal: 1,
          sessionId: 'session-owned-01',
          linkRole: 'primary',
          startedAt: '2026-06-27T10:00:00.000Z',
          sourceEventId: 'evt-session-linked-01',
        },
        linkHistory: [],
      },
      liveness: {
        runId: 'run-recovery-01',
        state: 'stale',
        reason: 'idle-timeout',
        currentSessionId: 'session-owned-01',
        timers: {},
        terminal: false,
      },
    });

    expect(classifyRecovery(snapshot).state).toBe('owned-worker-stale-terminable');
  });

  it('returns evidence-refresh-retryable for retryable completion or merge evidence gaps', () => {
    expect(
      classifyRecovery(createSnapshot({ completion: { latestDecisionState: 'completion-pending-evidence' } })).state,
    ).toBe('evidence-refresh-retryable');
  });

  it('returns stale-launch-clearable only for an expired launch with cleared ownership and writer evidence', () => {
    const snapshot = createSnapshot({
      leases: {
        leaseHealth: 'ok',
        storyLaunch: createLeaseSnapshot({ holder: 'run-stale-01', expiresAt: '2026-06-27T09:55:00.000Z' }),
      },
      workSource: {
        claimState: 'empty',
        evidenceRefs: [],
      },
    });

    expect(classifyRecovery(snapshot).state).toBe('stale-launch-clearable');
  });

  it.each([
    [
      'active writer',
      createSnapshot({
        leases: {
          leaseHealth: 'ok',
          runWriter: createLeaseSnapshot({
            name: 'run-writer:run-recovery-01',
            expiresAt: '2026-06-27T11:00:00.000Z',
          }),
        },
      }),
      false,
    ],
    ['active owner', createSnapshot({ ownership: { ownerState: 'foreign', sessionId: 'session-foreign-01' } }), false],
    [
      'unverified termination',
      createSnapshot({ termination: { state: 'requested', evidenceRefs: [evidenceEventRefFixture] } }),
      false,
    ],
    [
      'pending approval',
      createSnapshot({ approval: { state: 'pending', evidenceRefs: [evidenceEventRefFixture] } }),
      false,
    ],
    [
      'claimed work source',
      createSnapshot({ workSource: { claimState: 'claimed', evidenceRefs: [evidenceEventRefFixture] } }),
      false,
    ],
    ['safe empty', createSnapshot(), true],
  ])('restart-safe-empty-only: %s', (_name, snapshot, expectedSafeEmpty) => {
    expect(classifyRecovery(snapshot).state === 'safe-empty-restartable').toBe(expectedSafeEmpty);
  });

  it('deduplicates and sorts evidence refs deterministically', () => {
    const sorted = classifyRecovery(
      createSnapshot({
        evidenceRefs: [
          {
            eventId: 'evt-b',
            sequence: 10,
            payloadDigest: 'sha256:b',
            type: 'RecoveryEvidenceRecorded',
          },
          {
            eventId: 'evt-a',
            sequence: 10,
            payloadDigest: 'sha256:a',
            type: 'RecoveryEvidenceRecorded',
          },
          {
            eventId: 'evt-a',
            sequence: 10,
            payloadDigest: 'sha256:a',
            type: 'RecoveryEvidenceRecorded',
          },
        ],
      }),
    ).evidenceRefs;

    expect(sorted.map((ref) => ref.eventId)).toEqual(['evt-a', 'evt-b']);
  });
});
