import { describe, expect, it } from 'vitest';

import type { ForgeActionResult } from '../../../src/index.js';

import { acceptedActionResultFixture, degradedResultFixture, refusedActionResultFixture } from './fixtures.js';

describe('prov-02-s1 forge action results', () => {
  it('discriminates accepted, refused, and degraded results by kind', () => {
    const results: ForgeActionResult[] = [
      acceptedActionResultFixture,
      refusedActionResultFixture,
      degradedResultFixture,
    ];

    const accepted = results.find((result) => result.kind === 'accepted');
    const refused = results.find((result) => result.kind === 'refused');
    const degraded = results.find((result) => result.kind === 'degraded');

    expect(accepted?.observedHeadSha).toBe(acceptedActionResultFixture.observedHeadSha);
    expect(refused?.token).toBe(refusedActionResultFixture.token);
    expect(degraded?.token).toBe(degradedResultFixture.token);
    expect(degraded?.observedFacts?.prState?.headRefOid).toBe(acceptedActionResultFixture.observedHeadSha);
  });
});
