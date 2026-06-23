import { describe, expect, it } from 'vitest';

import {
  brokenForgeFixtures,
  createMockForgeProvider,
  forgeConformanceSuite,
  forgeIncidentFixtures,
} from '../../src/index.js';

describe('forge conformance helper', () => {
  it('passes exact-head reads and expected-head write refusals for the mock provider', () => {
    const result = forgeConformanceSuite({ provider: createMockForgeProvider() });

    expect(result.passed).toBe(true);
    expect(result.checks.map((check) => check.check)).toEqual(
      expect.arrayContaining(['forge-read-snapshot', 'forge-expected-head-writes']),
    );
  });

  it('fails deliberately broken Forge subjects', () => {
    const brokenWrite = forgeConformanceSuite({
      provider: createMockForgeProvider(),
      driftedProvider: brokenForgeFixtures.writesOnHeadMismatch,
    });
    const brokenRead = forgeConformanceSuite({ provider: brokenForgeFixtures.degradedAsAuthoritative });
    const degradedRead = forgeConformanceSuite({
      provider: createMockForgeProvider({ degradeEvidence: 'forge-state-unknown' }),
    });

    expect(brokenWrite.passed).toBe(false);
    expect(brokenWrite.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ token: 'forge-head-mismatch' })]),
    );
    expect(brokenRead.passed).toBe(false);
    expect(brokenRead.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ token: 'forge-state-unknown' })]),
    );
    expect(degradedRead.passed).toBe(false);
    expect(degradedRead.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ check: 'forge-read-degraded', token: 'forge-state-unknown' })]),
    );
  });

  it('catalogs adversarial incident fixtures for all Forge failure tokens', () => {
    const tokens = new Set(Object.values(forgeIncidentFixtures).map((fixture) => fixture.expectedToken));

    expect(tokens).toEqual(
      new Set([
        'forge-head-mismatch',
        'forge-credential-unavailable',
        'forge-auth-denied',
        'forge-state-unknown',
        'forge-protection-uninspectable',
        'forge-rulesets-unattested',
        'forge-merge-queue-unavailable',
        'forge-review-threads-uninspectable',
        'forge-admin-bypass-refused',
        'forge-ghes-capability-unknown',
        'forge-rate-limited',
        'forge-redaction-unavailable',
      ]),
    );
  });
});
