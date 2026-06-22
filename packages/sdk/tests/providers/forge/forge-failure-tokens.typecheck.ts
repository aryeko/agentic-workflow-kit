import type { ForgeDegraded, ForgeFailureToken } from '../../../src/index.js';

import { forgeFailureTokens } from './fixtures.js';

const degradedFixtures: ForgeDegraded[] = forgeFailureTokens.map((token) => ({
  kind: 'degraded',
  token,
  redactionFingerprintIds: ['redaction-1'],
  credentialAuditEventIds: ['evt-cred-1'],
  evidenceRef: `artifact://evidence/${token}`,
  at: '2026-06-22T12:19:00.000Z',
}));

// @ts-expect-error AC-8 rejects non-member forge failure tokens.
const invalidToken: ForgeFailureToken = 'forge-not-a-real-token';

void degradedFixtures;
void invalidToken;
