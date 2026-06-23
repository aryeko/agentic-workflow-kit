import { describe, expect, it } from 'vitest';

import {
  agentConformance,
  agentIncidentFixtures,
  brokenExecutionHostFixtures,
  brokenForgeFixtures,
  brokenWorkSourceFixtures,
  executionHostConformance,
  executionHostIncidentFixtures,
  forgeConformanceSuite,
  forgeIncidentFixtures,
  workSourceConformance,
  workSourceIncidentFixtures,
} from '../src/index.js';

describe('testkit conformance public imports', () => {
  it('exports conformance helpers, incident catalogs, and broken fixtures from the public entrypoint', () => {
    expect(agentConformance).toBeTypeOf('function');
    expect(forgeConformanceSuite).toBeTypeOf('function');
    expect(executionHostConformance).toBeTypeOf('function');
    expect(workSourceConformance).toBeTypeOf('function');
    expect(Object.keys(agentIncidentFixtures).length).toBeGreaterThan(0);
    expect(Object.keys(forgeIncidentFixtures).length).toBeGreaterThan(0);
    expect(Object.keys(executionHostIncidentFixtures).length).toBeGreaterThan(0);
    expect(Object.keys(workSourceIncidentFixtures).length).toBeGreaterThan(0);
    expect(brokenForgeFixtures.writesOnHeadMismatch).toBeDefined();
    expect(brokenExecutionHostFixtures.leakyInjection).toBeDefined();
    expect(brokenWorkSourceFixtures.doubleClaimWinner).toBeDefined();
  });
});
