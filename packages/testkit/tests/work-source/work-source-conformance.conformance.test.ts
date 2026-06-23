import { describe, expect, it } from 'vitest';

import {
  brokenWorkSourceFixtures,
  createMockWorkSourceProvider,
  workSourceConformance,
  workSourceIncidentFixtures,
} from '../../src/index.js';

const isWorkSourceError = (value: unknown): value is { readonly kind: string } =>
  typeof value === 'object' && value !== null && 'kind' in value;

describe('work source conformance helper', () => {
  it('passes status authority and race-safe mutation checks for the mock backlog', () => {
    const result = workSourceConformance(
      createMockWorkSourceProvider(workSourceIncidentFixtures.claimStatusRace.options),
    );

    expect(result.passed).toBe(true);
    expect(result.checks.map((check) => check.check)).toEqual(
      expect.arrayContaining(['status-authority-separation', 'race-safe-claim']),
    );
  });

  it('fails deliberately broken Work Source providers', () => {
    const doubleClaim = workSourceConformance(brokenWorkSourceFixtures.doubleClaimWinner);
    const statusAuthority = workSourceConformance(brokenWorkSourceFixtures.ignoresStatusAuthority);

    expect(doubleClaim.checks).toEqual(expect.arrayContaining([expect.objectContaining({ token: 'claim-conflict' })]));
    expect(statusAuthority.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ token: 'status-authority-conflict' })]),
    );
  });

  it('replays malformed and degraded fixture outcomes deterministically', () => {
    const malformed = createMockWorkSourceProvider(workSourceIncidentFixtures.malformedTask.options);
    const degraded = createMockWorkSourceProvider(workSourceIncidentFixtures.degradedStorage.options);

    expect(malformed.nextEligible({ trackIds: ['track-a'] })).toEqual(
      expect.objectContaining({ kind: 'dependency-unresolved' }),
    );
    expect(malformed.listTasks('track-malformed')).toEqual(expect.objectContaining({ kind: 'track-malformed' }));
    expect(isWorkSourceError(degraded.listTracks())).toBe(true);
    expect(degraded.listTracks()).toEqual(expect.objectContaining({ kind: 'work-source-unavailable' }));
  });
});
