import { describe, expect, it } from 'vitest';

import {
  CREDENTIAL_DENIAL_REASONS,
  CREDENTIAL_FAILURE_TOKENS,
  createCredentialDenied,
  createCredentialMaterialDestroyed,
  createCredentialUseDenied,
  createCredentialUseFinished,
  createCredentialUsePlanned,
  createCredentialUseStarted,
  createEgressPolicyIssued,
  createRedactionApplied,
  denyAuditWriteUnavailable,
  destroy,
  stableCanonicalStringify,
  type CredentialAuditEvent,
  type CredentialDenialReason,
  validateCredentialAuditLifecycle,
} from '../../../../src/index.js';

const hashText = (value: string): string => `digest:${value}`;

const createAuditSeed = () => ({
  runId: 'run-123',
  taskId: 'task-456',
  operationId: 'operation-789',
  credentialRefIds: ['registry-read'],
  party: 'worker' as const,
  phase: 'dependency-install',
  policyDigest: 'digest:policy-block',
  credentialRefDigest: 'digest:credential-refs',
  scopeDigest: 'digest:scope-block',
  grantEventId: 'grant-123',
  attestationEventIds: ['attestation-1'],
  evidenceRefs: ['evidence://credential-1'],
  prevEventHash: 'digest:previous',
  at: '2026-06-22T10:00:00.000Z',
});

describe('fnd-04-s4 credential audit and failures', () => {
  it('defines CredentialAuditEvent as the full credential audit payload union', () => {
    const byType = {
      CredentialUsePlanned: 'CredentialUsePlanned',
      CredentialUseStarted: 'CredentialUseStarted',
      CredentialUseFinished: 'CredentialUseFinished',
      CredentialUseDenied: 'CredentialUseDenied',
      CredentialMaterialDestroyed: 'CredentialMaterialDestroyed',
      RedactionApplied: 'RedactionApplied',
      EgressPolicyIssued: 'EgressPolicyIssued',
    } satisfies Record<CredentialAuditEvent['type'], CredentialAuditEvent['type']>;

    expect(Object.keys(byType)).toEqual([
      'CredentialUsePlanned',
      'CredentialUseStarted',
      'CredentialUseFinished',
      'CredentialUseDenied',
      'CredentialMaterialDestroyed',
      'RedactionApplied',
      'EgressPolicyIssued',
    ]);
  });

  it('includes the full AuditBase tamper-evidence fields on every payload and omits reversible secret material', () => {
    const audit = createAuditSeed();
    const planned = createCredentialUsePlanned(
      {
        audit,
        egressPolicyId: 'egress-policy-1',
        expiresAt: '2026-06-22T10:02:00.000Z',
        reason: 'scoped injection required',
      },
      { hashText },
    );
    const started = createCredentialUseStarted(
      {
        audit: { ...audit, prevEventHash: planned.eventHash, at: '2026-06-22T10:00:01.000Z' },
        injectionModes: ['env'],
        redactionFingerprintIds: ['fp-1'],
      },
      { hashText },
    );
    const finished = createCredentialUseFinished(
      {
        audit: { ...audit, prevEventHash: started.eventHash, at: '2026-06-22T10:00:02.000Z' },
        result: 'success',
        providerStatus: 'ok',
        exitCode: 0,
        destroyed: true,
      },
      { hashText },
    );
    const denied = createCredentialUseDenied(
      {
        audit: { ...audit, at: '2026-06-22T10:00:03.000Z' },
        reason: 'credential-scope-denied',
      },
      { hashText },
    );
    const destroyed = createCredentialMaterialDestroyed(
      {
        audit: { ...audit, prevEventHash: finished.eventHash, at: '2026-06-22T10:00:04.000Z' },
        tempFilesRemoved: true,
        memoryHandlesDropped: true,
      },
      { hashText },
    );
    const redacted = createRedactionApplied(
      {
        audit: { ...audit, prevEventHash: started.eventHash, at: '2026-06-22T10:00:05.000Z' },
        sink: 'stdout',
        replacementCount: 3,
        redactionFingerprintIds: ['fp-1', 'fp-2'],
      },
      { hashText },
    );
    const egress = createEgressPolicyIssued(
      {
        audit: { ...audit, at: '2026-06-22T10:00:06.000Z' },
        policyId: 'egress-policy-1',
        egressPolicyDigest: 'digest:egress-policy',
        audience: 'worker',
        hosts: ['registry.npmjs.org'],
        negativeProbeIds: ['probe-1'],
        freshnessKey: 'freshness-key-1',
        expiresAt: '2026-06-22T10:02:00.000Z',
      },
      { hashText },
    );

    const events = [planned, started, finished, denied, destroyed, redacted, egress];
    for (const event of events) {
      expect(event).toMatchObject({
        runId: audit.runId,
        taskId: audit.taskId,
        operationId: audit.operationId,
        credentialRefIds: audit.credentialRefIds,
        party: audit.party,
        phase: audit.phase,
        policyDigest: audit.policyDigest,
        credentialRefDigest: audit.credentialRefDigest,
        scopeDigest: audit.scopeDigest,
        grantEventId: audit.grantEventId,
        attestationEventIds: audit.attestationEventIds,
        evidenceRefs: audit.evidenceRefs,
        at: expect.any(String),
        prevEventHash: expect.any(String),
        eventHash: expect.any(String),
      });

      const serialized = stableCanonicalStringify(event);
      expect(serialized).not.toContain('super-secret-value');
      expect(serialized).not.toContain('"secret"');
      expect(serialized).not.toContain('materialHandle');
      expect(serialized).not.toContain('writerIdentity');
      expect(serialized).not.toContain('globalSequence');
    }

    const repeatedStarted = createCredentialUseStarted(
      {
        audit: { ...audit, prevEventHash: planned.eventHash, at: '2026-06-22T10:00:01.000Z' },
        injectionModes: ['env'],
        redactionFingerprintIds: ['fp-1'],
      },
      { hashText },
    );
    const changedChain = createCredentialUseStarted(
      {
        audit: { ...audit, prevEventHash: 'digest:other-previous', at: '2026-06-22T10:00:01.000Z' },
        injectionModes: ['env'],
        redactionFingerprintIds: ['fp-1'],
      },
      { hashText },
    );

    expect(repeatedStarted.eventHash).toBe(started.eventHash);
    expect(changedChain.eventHash).not.toBe(started.eventHash);
  });

  it('omits optional audit fields when they are not part of the payload-local record', () => {
    const finished = createCredentialUseFinished(
      {
        audit: {
          ...createAuditSeed(),
          grantEventId: undefined,
        },
        result: 'failure',
        destroyed: false,
      },
      { hashText },
    );

    expect(finished).toMatchObject({
      type: 'CredentialUseFinished',
      result: 'failure',
      destroyed: false,
    });
    expect(finished).not.toHaveProperty('grantEventId');
    expect(finished).not.toHaveProperty('providerStatus');
    expect(finished).not.toHaveProperty('exitCode');
  });

  it('returns CredentialDenied for every CredentialDenialReason value', () => {
    const reasons = [
      'credential-ref-unresolved',
      'credential-scope-denied',
      'worker-forge-credential-denied',
      'egress-policy-unattested',
      'redaction-unavailable',
      'audit-write-unavailable',
    ] satisfies readonly CredentialDenialReason[];

    expect(CREDENTIAL_DENIAL_REASONS).toEqual(reasons);

    for (const [index, reason] of reasons.entries()) {
      const auditEvent = createCredentialUseDenied(
        {
          audit: {
            ...createAuditSeed(),
            operationId: `operation-${index}`,
            at: `2026-06-22T10:00:0${index}.000Z`,
          },
          reason,
        },
        { hashText },
      );

      expect(createCredentialDenied(auditEvent)).toEqual({
        ok: false,
        reason,
        auditEvent,
      });
    }
  });

  it('rejects contradictory CredentialDenied inputs when the caller supplies a mismatched reason', () => {
    const auditEvent = createCredentialUseDenied(
      {
        audit: createAuditSeed(),
        reason: 'credential-scope-denied',
      },
      { hashText },
    );

    expect(() => createCredentialDenied('audit-write-unavailable', auditEvent)).toThrow(
      'Credential denial reason mismatch',
    );
  });

  it('returns CredentialMaterialDestroyed records from destroy(operationId)', () => {
    const { operationId, ...auditWithoutOperationId } = createAuditSeed();
    const destroyed = destroy(
      operationId,
      {
        audit: auditWithoutOperationId,
        tempFilesRemoved: true,
        memoryHandlesDropped: true,
      },
      { hashText },
    );

    expect(destroyed).toMatchObject({
      type: 'CredentialMaterialDestroyed',
      operationId: 'operation-789',
      tempFilesRemoved: true,
      memoryHandlesDropped: true,
    });
  });

  it('exposes a public destroy helper that accepts an operation id string directly', () => {
    const operationId = 'operation-public-api';
    const { operationId: _ignoredOperationId, ...auditWithoutOperationId } = createAuditSeed();
    const destroyed = destroy(
      operationId,
      {
        audit: auditWithoutOperationId,
        tempFilesRemoved: false,
        memoryHandlesDropped: true,
      },
      { hashText },
    );

    expect(destroyed.operationId).toBe(operationId);
    expect(destroyed.tempFilesRemoved).toBe(false);
    expect(destroyed.memoryHandlesDropped).toBe(true);
  });

  it('enforces the lifecycle invariant from started through finished and destroyed, degrading when destruction is unconfirmed', () => {
    const started = createCredentialUseStarted(
      {
        audit: createAuditSeed(),
        injectionModes: ['env', 'file'],
        redactionFingerprintIds: ['fp-1'],
      },
      { hashText },
    );
    const finished = createCredentialUseFinished(
      {
        audit: { ...createAuditSeed(), prevEventHash: started.eventHash, at: '2026-06-22T10:00:01.000Z' },
        result: 'success',
        destroyed: true,
      },
      { hashText },
    );
    const destroyed = createCredentialMaterialDestroyed(
      {
        audit: { ...createAuditSeed(), prevEventHash: finished.eventHash, at: '2026-06-22T10:00:02.000Z' },
        tempFilesRemoved: true,
        memoryHandlesDropped: true,
      },
      { hashText },
    );

    expect(validateCredentialAuditLifecycle({ started, finished, destroyed })).toEqual({
      ok: true,
      value: {
        started,
        finished,
        destroyed,
      },
    });

    expect(
      validateCredentialAuditLifecycle({
        started,
        finished,
        destroyed: {
          ...destroyed,
          memoryHandlesDropped: false,
        },
      }),
    ).toEqual({
      ok: false,
      error: {
        token: 'credential-destroy-unconfirmed',
        operationId: started.operationId,
      },
    });

    expect(validateCredentialAuditLifecycle({ started })).toEqual({
      ok: false,
      error: {
        token: 'credential-destroy-unconfirmed',
        operationId: started.operationId,
      },
    });

    expect(
      validateCredentialAuditLifecycle({
        started,
        finished: {
          ...finished,
          taskId: 'task-other',
        },
        destroyed,
      }),
    ).toEqual({
      ok: false,
      error: {
        token: 'credential-destroy-unconfirmed',
        operationId: started.operationId,
      },
    });

    expect(
      validateCredentialAuditLifecycle({
        started,
        finished: {
          ...finished,
          prevEventHash: 'digest:broken-chain',
        },
        destroyed,
      }),
    ).toEqual({
      ok: false,
      error: {
        token: 'credential-destroy-unconfirmed',
        operationId: started.operationId,
      },
    });
  });

  it('denies audit-write-unavailable before any material exposure can start', () => {
    const denied = denyAuditWriteUnavailable(
      {
        audit: createAuditSeed(),
      },
      { hashText },
    );

    expect(denied).toMatchObject({
      ok: false,
      reason: 'audit-write-unavailable',
      auditEvent: {
        type: 'CredentialUseDenied',
        reason: 'audit-write-unavailable',
        operationId: 'operation-789',
      },
    });
    expect(stableCanonicalStringify(denied)).not.toContain('CredentialUseStarted');
    expect(stableCanonicalStringify(denied)).not.toContain('materialHandle');
  });

  it('captures the required RedactionApplied and EgressPolicyIssued payload details and full failure token catalog', () => {
    const redaction = createRedactionApplied(
      {
        audit: createAuditSeed(),
        sink: 'artifact:summary.md',
        replacementCount: 4,
        redactionFingerprintIds: ['fp-1', 'fp-2'],
      },
      { hashText },
    );
    const egress = createEgressPolicyIssued(
      {
        audit: createAuditSeed(),
        policyId: 'egress-policy-1',
        egressPolicyDigest: 'digest:egress-policy',
        audience: 'worker',
        hosts: ['registry.npmjs.org', 'npm.pkg.github.com'],
        negativeProbeIds: ['probe-1', 'probe-2'],
        freshnessKey: 'freshness-key-1',
        expiresAt: '2026-06-22T10:05:00.000Z',
      },
      { hashText },
    );

    expect(redaction).toMatchObject({
      type: 'RedactionApplied',
      sink: 'artifact:summary.md',
      replacementCount: 4,
      redactionFingerprintIds: ['fp-1', 'fp-2'],
    });
    expect(egress).toMatchObject({
      type: 'EgressPolicyIssued',
      policyId: 'egress-policy-1',
      egressPolicyDigest: 'digest:egress-policy',
      audience: 'worker',
      hosts: ['registry.npmjs.org', 'npm.pkg.github.com'],
      negativeProbeIds: ['probe-1', 'probe-2'],
      freshnessKey: 'freshness-key-1',
      expiresAt: '2026-06-22T10:05:00.000Z',
    });

    expect(CREDENTIAL_FAILURE_TOKENS).toEqual([
      'credential-ref-unresolved',
      'credential-scope-denied',
      'worker-forge-credential-denied',
      'egress-policy-unattested',
      'redaction-unavailable',
      'audit-write-unavailable',
      'credential-destroy-unconfirmed',
      'artifact-redaction-failed',
    ]);
  });
});
