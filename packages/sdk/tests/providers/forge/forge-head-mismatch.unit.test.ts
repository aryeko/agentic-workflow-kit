import { describe, expect, it } from 'vitest';

import { createExpectedHeadActionResult } from '../../../src/providers/forge/exact-head.js';

import { expectedHeadActionRequestFixture } from './fixtures.js';

describe('prov-02-s1 forge head mismatch', () => {
  it('refuses drifted-head mutating actions fail-closed with forge-head-mismatch', () => {
    const result = createExpectedHeadActionResult({
      request: expectedHeadActionRequestFixture,
      observedHeadSha: '2222222222222222222222222222222222222222',
      redactionFingerprintIds: ['redaction-1'],
      credentialAuditEventIds: ['evt-cred-1'],
      evidenceRef: 'artifact://evidence/head-mismatch',
      at: '2026-06-22T12:15:00.000Z',
    });

    expect(result.kind).toBe('refused');
    expect(result.token).toBe('forge-head-mismatch');
    expect(result.observedHeadSha).toBe('2222222222222222222222222222222222222222');
  });
});
