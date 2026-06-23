import type { HostFailureReason } from 'sdk';

export interface ExecutionHostIncidentFixture {
  readonly fixtureId: string;
  readonly expectedToken: HostFailureReason;
  readonly input: unknown;
}

export const executionHostIncidentFixtures = {
  commandCapture: {
    fixtureId: 'command-capture',
    expectedToken: 'runner-command-capture-incomplete',
    input: { operationId: 'op-verify-01', kind: 'verify' },
  },
  termination: {
    fixtureId: 'termination',
    expectedToken: 'termination-unproven',
    input: { initialSignal: 'SIGTERM', forceKill: true },
  },
  degradedObservation: {
    fixtureId: 'degraded-observation',
    expectedToken: 'host-observation-incomplete',
    input: { scenario: 'degraded' },
  },
  staleCapability: {
    fixtureId: 'stale-capability',
    expectedToken: 'host-capability-unattested',
    input: { capability: 'canKill' },
  },
  egressConfinement: {
    fixtureId: 'egress-confinement',
    expectedToken: 'egress-confinement-unattested',
    input: { capability: 'egress-confinement' },
  },
  injectionLeak: {
    fixtureId: 'injection-leak',
    expectedToken: 'credential-injection-rejected',
    input: { marker: 'API_TOKEN' },
  },
} as const satisfies Record<string, ExecutionHostIncidentFixture>;
