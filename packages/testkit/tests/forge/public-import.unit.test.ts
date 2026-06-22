import { describe, expect, it } from 'vitest';

import type { ForgeProvider } from 'sdk';

import { createForgeTestkitFixtures, createMockForgeProvider } from '../../src/index.js';

describe('testkit Forge public import surface', () => {
  it('exports a ForgeProvider-compatible mock and fixtures', () => {
    const fixtures = createForgeTestkitFixtures();
    const provider: ForgeProvider = createMockForgeProvider();

    expect(provider.collectEvidence(fixtures.evidenceRequest)).toMatchObject({
      expectedHeadSha: fixtures.pullRequest.headSha,
    });
    expect(typeof createMockForgeProvider).toBe('function');
  });
});
