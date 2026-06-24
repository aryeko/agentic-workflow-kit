import type { CapabilityGateRecordPayload } from '../../../../../src/core/capability/evaluator/index.js';

const invalidPayload: CapabilityGateRecordPayload = {
  schema: 'kit-vnext.capability-gate-record.v2',
  gateId: 'gate-123',
  capability: 'auto-merge',
  decision: 'allow',
  mode: 'assisted',
  scope: {
    runId: 'run-123',
    operationId: 'op-1',
    providerScopes: [],
  },
  policyRef: 'policy:auto-merge',
  requestedByDomain: 'core-05',
  requestedAction: 'merge-pull-request',
  evaluatedAt: '2026-06-23T12:00:00.000Z',
  attestationRefs: [],
  evidenceRefs: [],
};

void invalidPayload;
