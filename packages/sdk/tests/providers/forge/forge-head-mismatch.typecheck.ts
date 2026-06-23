import type { ForgeActionResult } from '../../../src/index.js';
import {
  createAcceptedForgeActionResult,
  createExpectedHeadActionResult,
} from '../../../src/providers/forge/exact-head.js';

import { expectedHeadActionRequestFixture } from './fixtures.js';

const drifted = createExpectedHeadActionResult({
  request: expectedHeadActionRequestFixture,
  observedHeadSha: '2222222222222222222222222222222222222222',
  redactionFingerprintIds: ['redaction-1'],
  credentialAuditEventIds: ['evt-cred-1'],
  evidenceRef: 'artifact://evidence/head-mismatch',
  at: '2026-06-22T12:15:00.000Z',
});

// @ts-expect-error AC-5 drifted heads cannot be accepted through the exact-head accepted builder.
const impossibleAccepted = createAcceptedForgeActionResult({
  request: {
    ...expectedHeadActionRequestFixture,
    expectedHeadSha: '1111111111111111111111111111111111111111',
  },
  observedHeadSha: '2222222222222222222222222222222222222222',
  redactionFingerprintIds: ['redaction-1'],
  credentialAuditEventIds: ['evt-cred-1'],
  evidenceRef: 'artifact://evidence/head-mismatch',
  at: '2026-06-22T12:15:00.000Z',
});

const refusal = drifted satisfies Extract<ForgeActionResult, { kind: 'refused' }>;

void drifted;
void impossibleAccepted;
void refusal;
