import { describe, expect, it } from 'vitest';

import { decideApproval } from '../../../../src/core/approval/decision/index.js';

import {
  allowGate,
  createBaseReplay,
  createIdGenerator,
  createPolicy,
  createProjections,
  createRequest,
  createGateRecordPayload,
  denyGate,
  evaluatedAt,
} from './shared.js';

describe('core-03-s2 assisted auto-grant gate outcomes', () => {
  it('grants only from a committed allow gate record', () => {
    const result = decideApproval({
      request: createRequest(),
      risk: 'low',
      mode: 'assisted',
      policy: createPolicy(),
      replay: createBaseReplay(),
      projections: createProjections(),
      evaluatedAt,
      ids: createIdGenerator('decision-01', 'grant-01'),
      autoGrantGate: allowGate(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.decision.decision).toBe('grant');
    expect(result.value.decision.capabilityGateEventId).toBe('evt-gate-allow-01');
    expect(result.value.decision.policyGrantPlan?.grantId).toBe('grant-01');
  });

  it('fails closed to human-required on committed gate deny', () => {
    const result = decideApproval({
      request: createRequest(),
      risk: 'low',
      mode: 'assisted',
      policy: createPolicy(),
      replay: createBaseReplay(),
      projections: createProjections(),
      evaluatedAt,
      ids: createIdGenerator('decision-02'),
      autoGrantGate: denyGate(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.decision.decision).toBe('human-required');
    expect(result.value.failureState).toBe('approval-gate-denied');
  });

  it('blocks on explicit gate append failure input', () => {
    const result = decideApproval({
      request: createRequest(),
      risk: 'low',
      mode: 'assisted',
      policy: createPolicy(),
      replay: createBaseReplay(),
      projections: createProjections(),
      evaluatedAt,
      ids: createIdGenerator('decision-03'),
      autoGrantGate: { status: 'append-failed' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.decision.decision).toBe('blocked');
    expect(result.value.failureState).toBe('approval-gate-unwritable');
  });

  it('fails closed when no committed gate record is available', () => {
    const result = decideApproval({
      request: createRequest(),
      risk: 'low',
      mode: 'assisted',
      policy: createPolicy(),
      replay: createBaseReplay(),
      projections: createProjections(),
      evaluatedAt,
      ids: createIdGenerator('decision-04'),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.decision.decision).toBe('human-required');
    expect(result.value.failureState).toBe('approval-gate-denied');
  });

  it('fails closed when the gate record does not match escalation-auto-grant for the request run', () => {
    const result = decideApproval({
      request: createRequest(),
      risk: 'low',
      mode: 'assisted',
      policy: createPolicy(),
      replay: createBaseReplay(),
      projections: createProjections(),
      evaluatedAt,
      ids: createIdGenerator('decision-05'),
      autoGrantGate: {
        status: 'allow',
        eventId: 'evt-gate-allow-bad',
        record: createGateRecordPayload({
          capability: 'orchestrator-decide',
          scope: { ...createGateRecordPayload().scope, runId: 'run-other' },
        }),
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.decision.decision).toBe('human-required');
    expect(result.value.failureState).toBe('approval-gate-denied');
  });

  it.each([
    [
      'operation',
      createGateRecordPayload({
        scope: { ...createGateRecordPayload().scope, operationId: 'op-other' },
      }),
    ],
    [
      'session',
      createGateRecordPayload({
        scope: { ...createGateRecordPayload().scope, sessionId: 'session-other' },
      }),
    ],
    [
      'policy',
      createGateRecordPayload({
        policyRef: 'policy:other',
      }),
    ],
    [
      'requested action',
      createGateRecordPayload({
        requestedAction: 'approval-human-escalate',
      }),
    ],
  ])('fails closed when the committed allow gate record mismatches the request %s scope', (_, record) => {
    const result = decideApproval({
      request: createRequest(),
      risk: 'low',
      mode: 'assisted',
      policy: createPolicy(),
      replay: createBaseReplay(),
      projections: createProjections(),
      evaluatedAt,
      ids: createIdGenerator('decision-06'),
      autoGrantGate: {
        status: 'allow',
        eventId: 'evt-gate-allow-mismatch',
        record,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.decision.decision).toBe('human-required');
    expect(result.value.failureState).toBe('approval-gate-denied');
  });
});
