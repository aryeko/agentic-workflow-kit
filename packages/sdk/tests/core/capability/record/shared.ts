import type { CapabilityGateRecordPayload, RunAppendReceipt, RunWriter } from 'sdk';

export const gateRecordPayloadFixture: CapabilityGateRecordPayload = {
  schema: 'kit-vnext.capability-gate-record.v1',
  gateId: 'gate-record-123',
  capability: 'auto-merge',
  decision: 'allow',
  mode: 'assisted',
  scope: {
    runId: 'run-record-123',
    operationId: 'op-record-123',
    providerScopes: [
      {
        provider: 'Forge',
        scope: 'repo:aryeko/workflow-kit/pr:42/head#abc123',
        freshnessKey: 'forge:pr-42',
      },
    ],
    pullRequestRef: 'pr-42',
    expectedHeadSha: 'abc123',
  },
  policyRef: 'policy:auto-merge',
  requestedByDomain: 'core-05',
  requestedAction: 'merge-pull-request',
  evaluatedAt: '2026-06-23T12:00:00.000Z',
  evaluatedGuarantees: [
    {
      guaranteeId: 'status-checks-green',
      passed: true,
      attestationRefs: [],
      evidenceRefs: ['evidence:verification'],
    },
  ],
  attestationRefs: [],
  evidenceRefs: ['evidence:verification'],
};

export const runAppendReceiptFixture: RunAppendReceipt = {
  runId: gateRecordPayloadFixture.scope.runId,
  firstSequence: 11,
  lastSequence: 11,
  writerEpoch: 2,
  durability: 'barrier',
  eventIds: ['fixed-id'],
  payloadDigests: ['sha256:gate-record'],
  frameDigest: 'sha256:frame',
  health: 'ok',
};

export const createWriter = (append: RunWriter['append']): RunWriter => ({
  append,
  renew: () => ({ ok: true, value: createWriter(append) }),
});
