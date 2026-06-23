import { describe, expect, it } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';

import {
  createAttestationEvent,
  createEvidenceEvent,
  createProjections,
  createReplay,
  createRequest,
  createScope,
  defaultEvidenceRefs,
} from './shared.js';

const hostScope = 'execution-host:local-runner';
const hostFreshnessKey = 'execution-host:local-runner';
const agentScope = 'agent:worker-session-1';
const agentFreshnessKey = 'agent:worker-session-1';

const createAutoRecoverRequest = () =>
  createRequest({
    capability: 'auto-recover',
    requestedAction: 'recover-run',
    scope: createScope({
      providerScopes: [
        {
          provider: 'Execution Host',
          scope: hostScope,
          freshnessKey: hostFreshnessKey,
        },
        {
          provider: 'Agent',
          scope: agentScope,
          freshnessKey: agentFreshnessKey,
        },
      ],
    }),
  });

const createAutoRecoverReplay = (containmentStrength?: string) => {
  const replayEvents = [
    createEvidenceEvent('evt-evidence-head', 1, defaultEvidenceRefs[0], { value: 'abc123' }),
    createEvidenceEvent('evt-evidence-verify', 2, defaultEvidenceRefs[1], { value: 'verified' }),
    createAttestationEvent('evt-host-kill', 3, 'Execution Host', 'canKill', {
      scope: hostScope,
      freshnessKey: hostFreshnessKey,
    }),
    createAttestationEvent('evt-host-containment', 4, 'Execution Host', 'containmentStrength', {
      scope: hostScope,
      freshnessKey: hostFreshnessKey,
      ...(containmentStrength === undefined ? {} : { details: { containmentStrength } }),
    }),
    createAttestationEvent('evt-agent-parentage', 5, 'Agent', 'preservesHostProcessParentage', {
      scope: agentScope,
      freshnessKey: agentFreshnessKey,
    }),
  ];

  return createReplay({
    events: replayEvents,
    lastSequence: replayEvents[replayEvents.length - 1]?.sequence ?? 0,
  });
};

describe('core-02-s2 containment floor evaluation', () => {
  it('denies containment attestations that omit the attested strength', () => {
    const payload = evaluateCapabilityGate(createAutoRecoverRequest(), createAutoRecoverReplay(), createProjections());

    expect(payload.decision).toBe('deny');
    expect(payload.failureReason).toBe('attestation-insufficient-containment');
  });

  it('denies containment attestations below the registry floor', () => {
    const payload = evaluateCapabilityGate(
      createAutoRecoverRequest(),
      createAutoRecoverReplay('none'),
      createProjections(),
    );

    expect(payload.decision).toBe('deny');
    expect(payload.failureReason).toBe('attestation-insufficient-containment');
  });

  it('allows containment attestations at the registry floor', () => {
    const payload = evaluateCapabilityGate(
      createAutoRecoverRequest(),
      createAutoRecoverReplay('process-group'),
      createProjections(),
    );

    expect(payload.decision).toBe('allow');
  });
});
