import { describe, expect, it } from 'vitest';

import type { ForgeCredentialPhase, ForgeDegraded, ForgeFailureToken } from '../../../src/index.js';

import { forgeCredentialPhases, forgeFailureTokens } from './fixtures.js';

describe('prov-02-s1 forge failure tokens', () => {
  it('enumerates the twelve failure tokens and the credential phases', () => {
    const degradedFixtures: ForgeDegraded[] = forgeFailureTokens.map((token) => ({
      kind: 'degraded',
      token,
      redactionFingerprintIds: ['redaction-1'],
      credentialAuditEventIds: ['evt-cred-1'],
      evidenceRef: `artifact://evidence/${token}`,
      at: '2026-06-22T12:16:00.000Z',
    }));

    const phases: ForgeCredentialPhase[] = [...forgeCredentialPhases];
    const tokens: ForgeFailureToken[] = degradedFixtures.map((fixture) => fixture.token);

    expect(tokens).toEqual([...forgeFailureTokens]);
    expect(phases).toEqual([...forgeCredentialPhases]);
  });
});
