import type { AttestationRef } from '../../../../../src/core/capability/evaluator/index.js';

const invalidAttestationRef: AttestationRef = {
  eventId: 'evt-1',
  provider: 'Forge',
  capability: 'canInspectProtection',
  evidenceRef: 'evidence:forge-pr-head',
  freshnessKey: 'forge:pr-42',
  scope: 'repo:aryeko/workflow-kit/pr:42/head#abc123',
};

void invalidAttestationRef;
