import type {
  AppendIntent,
  ApprovalDecisionRecordedPayload,
  ApprovalRiskClassifiedPayload,
  Decision,
  ProtectedPolicyApprovalBinding,
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunWriter,
} from 'sdk';
import { expect } from 'vitest';

import type { ApprovalRiskClassification } from 'sdk';

import { evaluatedAt, runId } from './fixtures.js';

type CapturingWriter = RunWriter & {
  readonly appendCalls: AppendIntent[][];
};

export const appendReceipt: RunAppendReceipt = {
  runId,
  firstSequence: 21,
  lastSequence: 21,
  writerEpoch: 2,
  durability: 'barrier',
  eventIds: ['evt-append-01'],
  payloadDigests: ['sha256:append-01'],
  frameDigest: 'sha256:frame-01',
  health: 'ok',
};

export const appendFailure: RunAppendFailure = {
  code: 'event-log-unavailable',
  message: 'event log unavailable',
  retryable: true,
};

export const createWriter = (
  appendImpl?: (batch: AppendIntent[]) => Result<RunAppendReceipt, RunAppendFailure>,
): CapturingWriter => {
  const appendCalls: AppendIntent[][] = [];
  const writer: CapturingWriter = {
    appendCalls,
    append(batch) {
      appendCalls.push(batch);
      return appendImpl?.(batch) ?? { ok: true, value: appendReceipt };
    },
    renew() {
      return { ok: true, value: writer };
    },
  };

  return writer;
};

export const createDecision = (overrides: Partial<Decision> = {}): Decision => ({
  schema: 'kit-vnext.approval-decision.v1',
  decisionId: 'decision-01',
  requestId: 'request-01',
  risk: 'low',
  mode: 'assisted',
  decision: 'grant',
  policyGrantPlan: {
    grantId: 'grant-01',
    scope: 'per-command',
    command: 'pnpm check',
    reason: 'verification',
  },
  decidedBy: 'policy',
  sourceEventIds: ['evt-agent-request-01', 'evt-gate-allow-01'],
  capabilityGateEventId: 'evt-gate-allow-01',
  policyRef: 'policy:approval',
  reason: 'allowlisted-low-risk-command',
  decidedAt: evaluatedAt,
  ...overrides,
});

export const createProtectedPolicyBinding = (
  overrides: Partial<ProtectedPolicyApprovalBinding> = {},
): ProtectedPolicyApprovalBinding => ({
  runId,
  candidateHeadSha: 'abc123def456',
  protectedPolicySnapshotEventId: 'evt-policy-snapshot-01',
  newPolicyDigest: 'sha256:new-policy',
  ...overrides,
});

export const expectRiskPayload = (
  payload: ApprovalRiskClassifiedPayload,
  classification: ApprovalRiskClassification,
): void => {
  expect(payload).toMatchObject({
    schema: 'kit-vnext.approval-risk-classified.v1',
    requestId: 'request-01',
    risk: classification.risk,
    triggeredRuleIds: classification.triggeredRuleIds,
    evidenceEventIds: classification.evidenceEventIds,
    classifiedAt: classification.classifiedAt,
  });
};

export const expectDecisionPayload = (payload: ApprovalDecisionRecordedPayload, decision: Decision): void => {
  expect(payload.decision).toEqual(decision);
  expect(payload.schema).toBe('kit-vnext.approval-decision-recorded.v1');
};
