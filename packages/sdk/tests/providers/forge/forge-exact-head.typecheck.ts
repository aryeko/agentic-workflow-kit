import type { EvidenceRequest, ExpectedHeadActionRequest, ForgeEvidenceSnapshot } from '../../../src/index.js';

import { evidenceRequestFixture, evidenceSnapshotFixture, expectedHeadActionRequestFixture } from './fixtures.js';

const evidenceRequest = evidenceRequestFixture satisfies EvidenceRequest;
const actionRequest = expectedHeadActionRequestFixture satisfies ExpectedHeadActionRequest;
const snapshot = evidenceSnapshotFixture satisfies ForgeEvidenceSnapshot;

// @ts-expect-error AC-3 EvidenceRequest requires expectedHeadSha.
const missingEvidenceExpectedHead: EvidenceRequest = {
  repo: evidenceRequest.repo,
  pullRequest: evidenceRequest.pullRequest,
  credentialScope: evidenceRequest.credentialScope,
};

// @ts-expect-error AC-3 ExpectedHeadActionRequest requires expectedHeadSha.
const missingActionExpectedHead: ExpectedHeadActionRequest = {
  repo: actionRequest.repo,
  pullRequest: actionRequest.pullRequest,
  credentialScope: actionRequest.credentialScope,
};

// @ts-expect-error AC-3 ForgeEvidenceSnapshot requires expectedHeadSha.
const missingSnapshotExpectedHead: ForgeEvidenceSnapshot = {
  repo: snapshot.repo,
  pullRequest: snapshot.pullRequest,
  prState: snapshot.prState,
  statusChecks: snapshot.statusChecks,
  reviewThreads: snapshot.reviewThreads,
  protection: snapshot.protection,
  mergeQueue: snapshot.mergeQueue,
  scope: snapshot.scope,
  evidenceRefs: snapshot.evidenceRefs,
  redactionFingerprintIds: snapshot.redactionFingerprintIds,
  credentialAuditEventIds: snapshot.credentialAuditEventIds,
  collectedAt: snapshot.collectedAt,
};

void evidenceRequest;
void actionRequest;
void snapshot;
void missingEvidenceExpectedHead;
void missingActionExpectedHead;
void missingSnapshotExpectedHead;
