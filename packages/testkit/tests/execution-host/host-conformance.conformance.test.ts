import { describe, expect, it } from 'vitest';

import {
  brokenExecutionHostFixtures,
  createMockExecutionHostProvider,
  executionHostConformance,
  executionHostIncidentFixtures,
} from '../../src/index.js';

describe('execution host conformance helper', () => {
  it('passes the positive mock across observation, command, injection, termination, and freshness checks', async () => {
    const result = await executionHostConformance(createMockExecutionHostProvider());

    expect(result.passed).toBe(true);
    expect(result.checks.map((check) => check.check)).toEqual(
      expect.arrayContaining(['host-observation', 'command-capture', 'termination-proof', 'injection-separation']),
    );
  });

  it('fails broken termination proof, command capture, and injection leak providers', async () => {
    const termination = await executionHostConformance(brokenExecutionHostFixtures.brokenTerminationProof);
    const capture = await executionHostConformance(brokenExecutionHostFixtures.brokenCommandCapture);
    const leak = await executionHostConformance(brokenExecutionHostFixtures.leakyInjection);

    expect(termination.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ token: 'termination-unproven' })]),
    );
    expect(capture.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ token: 'runner-command-capture-incomplete' })]),
    );
    expect(leak.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ token: 'credential-injection-rejected' })]),
    );
  });

  it('catalogs host incident fixture categories', () => {
    expect(Object.values(executionHostIncidentFixtures).map((fixture) => fixture.expectedToken)).toEqual(
      expect.arrayContaining([
        'host-observation-incomplete',
        'termination-unproven',
        'runner-command-capture-incomplete',
        'credential-injection-rejected',
        'egress-confinement-unattested',
      ]),
    );
  });
});
