import type { AgentCapability, AgentEvent, CapabilityAttestation } from 'sdk';

const at = '2026-06-22T10:00:00.000Z';
const expiry = '2026-06-22T11:00:00.000Z';

const session = {
  sessionId: 'agent-session-incident',
  runId: 'run-incident',
  providerSessionId: 'provider-session-incident',
  hostWorkerHandleId: 'worker-handle-incident',
  ownershipClass: 'owned',
  answerChannels: {},
  startedAt: at,
} as const;

const attestation = (
  capability: AgentCapability,
  result: CapabilityAttestation<AgentCapability>['result'] = 'positive',
): CapabilityAttestation<AgentCapability> => ({
  capability,
  probeMethod: 'testkit-incident',
  result,
  evidenceRef: `artifact://testkit/agent/incidents/${capability}`,
  scope: 'agent:testkit',
  expiry,
  driverVersion: '0.0.0',
  platform: 'testkit',
  freshnessKey: 'agent-incident',
  at,
});

export interface AgentIncidentFixture {
  readonly fixtureId: string;
  readonly events: readonly AgentEvent[];
  readonly attestations: readonly CapabilityAttestation<AgentCapability>[];
}

export const agentIncidentFixtures = {
  structuredToolExitMissing: {
    fixtureId: 'structured-tool-exit-missing',
    events: [
      { type: 'linked', session, at },
      {
        type: 'degraded',
        sessionId: session.sessionId,
        failure: {
          reason: 'structured-tool-exit-missing',
          message: 'Tool event did not carry an exit code.',
          retryable: false,
          evidenceRef: 'artifact://testkit/agent/incidents/structured-tool-exit-missing',
        },
        at,
      },
    ],
    attestations: [attestation('emitsStructuredToolExit', 'negative')],
  },
  guardianReviewUntrusted: {
    fixtureId: 'guardian-review-untrusted',
    events: [
      { type: 'linked', session, at },
      {
        type: 'degraded',
        sessionId: session.sessionId,
        failure: {
          reason: 'guardian-review-untrusted',
          message: 'Guardian review was not stable.',
          retryable: false,
          evidenceRef: 'artifact://testkit/agent/incidents/guardian-review-untrusted',
        },
        at,
      },
    ],
    attestations: [attestation('emitsGuardianReview', 'negative')],
  },
  linkageLost: {
    fixtureId: 'agent-linkage-lost',
    events: [
      {
        type: 'degraded',
        failure: {
          reason: 'agent-linkage-lost',
          message: 'Provider session linkage was lost before progress.',
          retryable: true,
          evidenceRef: 'artifact://testkit/agent/incidents/agent-linkage-lost',
        },
        at,
      },
    ],
    attestations: [attestation('canResumeOwned', 'positive')],
  },
} as const satisfies Record<string, AgentIncidentFixture>;
