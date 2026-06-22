import { describe, expect, it } from 'vitest';

import type { CredentialRef } from '../../../../src/index.js';
import { createStartedAuditEvent } from '../../../../src/foundation/credentials-secrets/injection/operation-audit.js';
import { buildAuditSeed } from '../../../../src/foundation/credentials-secrets/injection/operation-audit.js';

const hashText = (value: string): string => `digest:${value}`;

const refs: readonly CredentialRef[] = [
  {
    id: 'registry-read',
    kind: 'registry-read',
    purpose: 'install private packages',
    secret: {
      id: 'secret-ref:digest:{"key":"NPM_TOKEN","source":"env"}',
      source: 'env',
      key: 'NPM_TOKEN',
    },
    allowedParties: ['worker'],
    allowedPhases: ['dependency-install'],
    allowedHosts: ['registry.npmjs.org'],
    ttlSeconds: 120,
    policyDigest: 'digest:policy-a',
  },
  {
    id: 'tool-api',
    kind: 'tool-api',
    purpose: 'call hosted tool',
    secret: {
      id: 'secret-ref:digest:{"key":"TOOL_API_TOKEN","source":"env"}',
      source: 'env',
      key: 'TOOL_API_TOKEN',
    },
    allowedParties: ['worker'],
    allowedPhases: ['dependency-install'],
    allowedHosts: ['registry.npmjs.org'],
    ttlSeconds: 120,
    policyDigest: 'digest:policy-b',
  },
];

describe('fnd-04-s2 operation audit helpers', () => {
  it('deduplicates credential ids and hashes the combined policy digests for multi-ref audit seeds', () => {
    const seed = buildAuditSeed(
      {
        refs: [refs[0], refs[0], refs[1]],
        scope: {
          runId: 'run-123',
          taskId: 'task-456',
          operationId: 'operation-789',
          party: 'worker',
          phase: 'dependency-install',
          expiresAt: '2026-06-22T10:02:00.000Z',
        },
        at: '2026-06-22T10:00:30.000Z',
        prevEventHash: 'digest:previous',
        attestationEventIds: ['attestation-1', 'attestation-1'],
        evidenceRefs: ['evidence://1', 'evidence://1'],
      },
      hashText,
    );

    expect(seed.credentialRefIds).toEqual(['registry-read', 'tool-api']);
    expect(seed.policyDigest).toBe('digest:digest:policy-a|digest:policy-b');
    expect(seed.attestationEventIds).toEqual(['attestation-1', 'attestation-1']);
  });

  it('emits empty redaction fingerprints when a started event is built before a redaction set is attached', () => {
    const started = createStartedAuditEvent(
      {
        refs: [refs[0]],
        scope: {
          runId: 'run-123',
          taskId: 'task-456',
          operationId: 'operation-789',
          party: 'worker',
          phase: 'dependency-install',
          expiresAt: '2026-06-22T10:02:00.000Z',
        },
        redactionSet: undefined,
        injectionModes: ['env'],
        attestations: [],
        at: '2026-06-22T10:00:30.000Z',
        prevEventHash: 'digest:previous',
      },
      { hashText },
    );

    expect(started.redactionFingerprintIds).toEqual([]);
  });
});
