import { describe, expect, it } from 'vitest';

import type { ForgeProvider } from 'sdk';

import { createForgeTestkitFixtures, createMockForgeProvider, type ForgeScenario } from 'testkit';

describe('testkit Forge public import surface', () => {
  it('exports a ForgeProvider-compatible mock and fixtures', () => {
    const fixtures = createForgeTestkitFixtures();
    const scenario = {} satisfies ForgeScenario;
    const provider: ForgeProvider = createMockForgeProvider(scenario);

    expect(provider.collectEvidence(fixtures.evidenceRequest)).toMatchObject({
      expectedHeadSha: fixtures.pullRequest.headSha,
    });
    expect(typeof createMockForgeProvider).toBe('function');
  });
});
