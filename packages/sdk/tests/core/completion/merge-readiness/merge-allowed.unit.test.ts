import { describe, expect, it } from 'vitest';

import { mergeAllowed } from '../../../../src/core/completion/merge-readiness/index.js';

import {
  createGateRecord,
  createMergeAllowedInput,
  createForgeSnapshot,
  providerScopes,
  pullRequestRef,
} from './shared.js';

describe('core-05-s3 merge readiness predicate', () => {
  it('merge-all-conditions-required toggles each predicate branch away from merge-ready', () => {
    const baseline = createMergeAllowedInput();
    expect(mergeAllowed(baseline)).toBe('merge-ready');

    const cases = [
      () =>
        createMergeAllowedInput({
          completionDecision: { ...baseline.completionDecision, state: 'completion-pending-evidence' },
        }),
      () => createMergeAllowedInput({ policy: { ...baseline.policy, runnerMayMerge: false } }),
      () => createMergeAllowedInput({ local: { ...baseline.local, clean: false } }),
      () => createMergeAllowedInput({ local: { ...baseline.local, changedFilesAllowed: false } }),
      () => createMergeAllowedInput({ local: { ...baseline.local, verificationFresh: false } }),
      () =>
        createMergeAllowedInput({
          forge: { ...baseline.forge, snapshot: createForgeSnapshot({ expectedHeadSha: 'head-other-01' }) },
        }),
      () =>
        createMergeAllowedInput({
          forge: {
            ...baseline.forge,
            snapshot: createForgeSnapshot({
              statusChecks: {
                state: 'SUCCESS',
                contexts: [{ name: 'check', state: 'SUCCESS', conclusion: 'SUCCESS' }],
              },
            }),
          },
        }),
      () =>
        createMergeAllowedInput({
          forge: {
            ...baseline.forge,
            snapshot: createForgeSnapshot({
              prState: { ...createForgeSnapshot().prState, reviewDecision: 'REVIEW_REQUIRED' },
            }),
          },
        }),
      () =>
        createMergeAllowedInput({
          forge: {
            ...baseline.forge,
            snapshot: createForgeSnapshot({
              reviewThreads: {
                threads: [
                  {
                    id: 'thread-1',
                    isResolved: false,
                    viewerCanResolve: false,
                    path: 'packages/sdk/src/index.ts',
                    comments: [],
                  },
                ],
              },
            }),
          },
        }),
      () => createMergeAllowedInput({ forge: { ...baseline.forge, protectionFresh: false } }),
      () => createMergeAllowedInput({ gate: { ...baseline.gate, record: createGateRecord({ decision: 'deny' }) } }),
    ];

    for (const build of cases) {
      expect(mergeAllowed(build())).not.toBe('merge-ready');
    }
  });

  it('returns required-check-missing and required-check-failed exactly', () => {
    const missing = createMergeAllowedInput({
      forge: {
        ...createMergeAllowedInput().forge,
        snapshot: createForgeSnapshot({
          statusChecks: { state: 'SUCCESS', contexts: [{ name: 'check', state: 'SUCCESS', conclusion: 'SUCCESS' }] },
        }),
      },
    });
    expect(mergeAllowed(missing)).toBe('merge-required-check-missing');

    const failed = createMergeAllowedInput({
      forge: {
        ...createMergeAllowedInput().forge,
        snapshot: createForgeSnapshot({
          statusChecks: {
            state: 'FAILURE',
            contexts: [
              { name: 'check', state: 'SUCCESS', conclusion: 'SUCCESS' },
              { name: 'lint', state: 'FAILURE', conclusion: 'FAILURE' },
            ],
          },
        }),
      },
    });
    expect(mergeAllowed(failed)).toBe('merge-required-check-failed');
  });

  it('merge-denial-state-matrix covers each named deny literal', () => {
    const matrix = [
      [
        'merge-review-not-approved',
        createMergeAllowedInput({
          forge: {
            ...createMergeAllowedInput().forge,
            snapshot: createForgeSnapshot({
              prState: { ...createForgeSnapshot().prState, reviewDecision: 'REVIEW_REQUIRED' },
            }),
          },
        }),
      ],
      [
        'merge-unresolved-review-threads',
        createMergeAllowedInput({
          forge: {
            ...createMergeAllowedInput().forge,
            snapshot: createForgeSnapshot({
              reviewThreads: {
                threads: [
                  {
                    id: 'thread-1',
                    isResolved: false,
                    viewerCanResolve: true,
                    path: 'packages/sdk/src/index.ts',
                    comments: [],
                  },
                ],
              },
            }),
          },
        }),
      ],
      [
        'merge-protection-snapshot-stale',
        createMergeAllowedInput({ forge: { ...createMergeAllowedInput().forge, protectionFresh: false } }),
      ],
      [
        'merge-branch-not-fresh',
        createMergeAllowedInput({
          forge: {
            ...createMergeAllowedInput().forge,
            snapshot: createForgeSnapshot({
              prState: { ...createForgeSnapshot().prState, baseRefOid: 'base-other-01' },
            }),
          },
        }),
      ],
      [
        'merge-head-ambiguous',
        createMergeAllowedInput({
          candidateHeadSha: undefined,
          completionDecision: { ...createMergeAllowedInput().completionDecision, headSha: undefined },
          local: { ...createMergeAllowedInput().local, headSha: undefined },
        }),
      ],
      [
        'merge-forge-unavailable',
        createMergeAllowedInput({ forge: { ...createMergeAllowedInput().forge, snapshot: undefined } }),
      ],
      [
        'merge-capability-denied',
        createMergeAllowedInput({ gate: { ...createMergeAllowedInput().gate, record: undefined } }),
      ],
    ] as const;

    for (const [expected, input] of matrix) {
      expect(mergeAllowed(input)).toBe(expected);
    }
  });

  it('accepts only a same-scope auto-merge gate record', () => {
    const allowed = createMergeAllowedInput();
    expect(mergeAllowed(allowed)).toBe('merge-ready');

    const mismatchedHead = createMergeAllowedInput({
      gate: {
        ...allowed.gate,
        record: createGateRecord({ scope: { ...createGateRecord().scope, expectedHeadSha: 'head-other-01' } }),
      },
    });
    expect(mergeAllowed(mismatchedHead)).toBe('merge-capability-denied');

    const mismatchedScope = createMergeAllowedInput({
      gate: {
        ...allowed.gate,
        pullRequestRef,
        providerScopes: [...providerScopes],
        record: createGateRecord({
          scope: {
            ...createGateRecord().scope,
            pullRequestRef: 'pr:999',
          },
        }),
      },
    });
    expect(mergeAllowed(mismatchedScope)).toBe('merge-capability-denied');
  });

  it('maps disabled policy and ambiguous head evidence exactly', () => {
    const disabled = createMergeAllowedInput({
      policy: { ...createMergeAllowedInput().policy, runnerMayMerge: false },
    });
    expect(mergeAllowed(disabled)).toBe('merge-policy-disabled');

    const ambiguous = createMergeAllowedInput({
      completionDecision: { ...createMergeAllowedInput().completionDecision, headSha: undefined },
    });
    expect(mergeAllowed(ambiguous)).toBe('merge-head-ambiguous');
  });
});
