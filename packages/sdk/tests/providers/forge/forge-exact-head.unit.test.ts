import { describe, expect, it } from 'vitest';

import type { EvidenceRequest, ExpectedHeadActionRequest, ForgeEvidenceSnapshot } from '../../../src/index.js';

import { evidenceRequestFixture, evidenceSnapshotFixture, expectedHeadActionRequestFixture } from './fixtures.js';

describe('prov-02-s1 forge exact-head DTOs', () => {
  it('pins expectedHeadSha on the evidence request, action request, and evidence snapshot', () => {
    const evidenceRequest: EvidenceRequest = evidenceRequestFixture;
    const actionRequest: ExpectedHeadActionRequest = expectedHeadActionRequestFixture;
    const snapshot: ForgeEvidenceSnapshot = evidenceSnapshotFixture;

    expect(evidenceRequest.expectedHeadSha).toBe(actionRequest.expectedHeadSha);
    expect(snapshot.expectedHeadSha).toBe(actionRequest.expectedHeadSha);
  });
});
