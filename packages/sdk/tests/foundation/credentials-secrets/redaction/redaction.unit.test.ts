import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';

import { createRedactionSet, redact, redactArtifact, stableCanonicalStringify } from '../../../../src/index.js';

const hashText = (value: string): string => `digest:${value}`;

const createAuditSeed = () => ({
  runId: 'run-redaction',
  taskId: 'task-redaction',
  operationId: 'operation-redaction',
  credentialRefIds: ['credential-1'],
  party: 'worker' as const,
  phase: 'capture-output',
  policyDigest: 'digest:policy',
  credentialRefDigest: 'digest:credential-refs',
  scopeDigest: 'digest:scope',
  grantEventId: 'grant-redaction',
  attestationEventIds: ['attestation-redaction'],
  evidenceRefs: ['evidence://redaction'],
  prevEventHash: 'digest:prev-redaction',
  at: '2026-06-22T12:00:00.000Z',
});

const secret = 'alpha "beta"/+=?';
const base64Secret = Buffer.from(secret, 'utf8').toString('base64');
const jsonEscapedSecret = JSON.stringify(secret).slice(1, -1);
const urlEncodedSecret = encodeURIComponent(secret);
const formEncodedSecret = new URLSearchParams([['token', secret]]).toString().slice('token='.length);
const redactionLabel = '[REDACTED:credential:credential-1]';
const tempFilePath = '/tmp/kit-vnext/credential-1/material.json';

const createFixtureRedactionSet = () =>
  createRedactionSet({
    id: 'redaction-set-1',
    expiresAt: '2026-06-22T12:05:00.000Z',
    secrets: [
      {
        credentialRefId: 'credential-1',
        label: redactionLabel,
        fingerprintId: 'fp-credential-1',
        secret,
        tempFilePaths: [tempFilePath],
      },
    ],
  });

describe('fnd-04-s3 redaction', () => {
  it('builds a RedactionSet that records ids, labels, fingerprint ids, and expiry without raw material', () => {
    const redactionSet = createFixtureRedactionSet();

    expect(redactionSet).toEqual({
      id: 'redaction-set-1',
      credentialRefIds: ['credential-1'],
      labels: {
        'credential-1': redactionLabel,
      },
      fingerprintIds: ['fp-credential-1'],
      expiresAt: '2026-06-22T12:05:00.000Z',
    });

    const serialized = stableCanonicalStringify(redactionSet);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain(base64Secret);
    expect(serialized).not.toContain(jsonEscapedSecret);
    expect(serialized).not.toContain(urlEncodedSecret);
    expect(serialized).not.toContain(formEncodedSecret);
    expect(serialized).not.toContain(tempFilePath);
  });

  it('deduplicates repeated metadata inputs while keeping the public RedactionSet secret-free', () => {
    const redactionSet = createRedactionSet({
      id: 'redaction-set-deduped',
      expiresAt: '2026-06-22T12:05:00.000Z',
      secrets: [
        {
          credentialRefId: 'credential-a',
          label: '[REDACTED:A]',
          fingerprintId: 'fp-a',
          secret: 'AAAA',
          tempFilePaths: ['/tmp/a', '/tmp/a'],
        },
        {
          credentialRefId: 'credential-b',
          label: '[REDACTED:B]',
          fingerprintId: 'fp-b',
          secret: 'BBBB',
        },
        {
          credentialRefId: 'credential-c',
          label: '[REDACTED:C]',
          fingerprintId: 'fp-b',
          secret: 'CCCC',
        },
        {
          credentialRefId: 'credential-d',
          label: '[REDACTED:C]',
          fingerprintId: 'fp-b',
          secret: 'DDDD',
        },
      ],
    });

    expect(redactionSet).toEqual({
      id: 'redaction-set-deduped',
      credentialRefIds: ['credential-a', 'credential-b', 'credential-c', 'credential-d'],
      labels: {
        'credential-a': '[REDACTED:A]',
        'credential-b': '[REDACTED:B]',
        'credential-c': '[REDACTED:C]',
        'credential-d': '[REDACTED:C]',
      },
      fingerprintIds: ['fp-a', 'fp-b'],
      expiresAt: '2026-06-22T12:05:00.000Z',
    });

    const serialized = stableCanonicalStringify(redactionSet);
    expect(serialized).not.toContain('AAAA');
    expect(serialized).not.toContain('BBBB');
    expect(serialized).not.toContain('/tmp/a');
  });

  it('redacts corpus cases across object values and keys, base64, escaped JSON, shell assignments, headers, URLs, command lines, errors, provider responses, process output, and text artifacts', () => {
    const redactionSet = createFixtureRedactionSet();
    const corpus = [
      {
        name: 'object value',
        value: {
          token: secret,
        },
      },
      {
        name: 'object key',
        value: {
          [`secret-key:${secret}`]: 'visible',
        },
      },
      {
        name: 'base64',
        value: `payload=${base64Secret}`,
      },
      {
        name: 'json-escaped',
        value: `{"token":"${jsonEscapedSecret}"}`,
      },
      {
        name: 'shell assignment',
        value: `export TOOL_TOKEN='${secret}'`,
      },
      {
        name: 'authorization header',
        value: `Authorization: Bearer ${secret}`,
      },
      {
        name: 'url encoded',
        value: `token=${urlEncodedSecret}`,
      },
      {
        name: 'form encoded',
        value: `token=${formEncodedSecret}`,
      },
      {
        name: 'command line',
        value: `tool run --token=${secret} --input=${tempFilePath}`,
      },
      {
        name: 'error and stack',
        value: {
          name: 'Error',
          message: `request failed with ${secret}`,
          stack: `Error: request failed with ${secret}\n    at ${tempFilePath}`,
        },
      },
      {
        name: 'provider response',
        value: {
          provider: {
            headers: {
              authorization: `Bearer ${secret}`,
            },
            payload: `encoded=${urlEncodedSecret}`,
          },
        },
      },
      {
        name: 'process output chunk',
        value: {
          stream: 'stderr' as const,
          text: `stderr emitted ${secret}`,
        },
      },
      {
        name: 'text artifact',
        value: {
          artifactId: 'artifact-text',
          mediaType: 'text/plain' as const,
          text: `artifact body ${secret}`,
        },
      },
    ] as const;

    for (const [index, fixture] of corpus.entries()) {
      const result = redact(
        {
          value: fixture.value,
          redactionSet,
          audit: {
            ...createAuditSeed(),
            operationId: `operation-redaction-${index}`,
            at: `2026-06-22T12:00:${String(index).padStart(2, '0')}.000Z`,
          },
          sink: fixture.name,
        },
        { hashText },
      );

      expect(result.ok, fixture.name).toBe(true);
      if (!result.ok) {
        continue;
      }

      const serialized = stableCanonicalStringify(result.value);
      expect(serialized, fixture.name).toContain(redactionLabel);
      expect(serialized, fixture.name).not.toContain(secret);
      expect(serialized, fixture.name).not.toContain(base64Secret);
      expect(serialized, fixture.name).not.toContain(jsonEscapedSecret);
      expect(serialized, fixture.name).not.toContain(urlEncodedSecret);
      expect(serialized, fixture.name).not.toContain(formEncodedSecret);
      expect(serialized, fixture.name).not.toContain(tempFilePath);
      expect(result.replacementCount, fixture.name).toBeGreaterThan(0);
      expect(result.redactionFingerprintIds).toEqual(['fp-credential-1']);
    }
  });

  it('redacts recursively across arrays and objects while preserving non-secret values', () => {
    const redactionSet = createFixtureRedactionSet();
    const result = redact(
      {
        value: {
          keepNumber: 7,
          keepBoolean: true,
          keepNull: null,
          keepText: 'visible',
          nested: [
            {
              token: secret,
              keep: 'safe',
            },
            ['safe', `prefix ${secret}`, false],
          ],
          [`path:${tempFilePath}`]: {
            deep: base64Secret,
          },
        },
        redactionSet,
        audit: createAuditSeed(),
        sink: 'recursive-structure',
      },
      { hashText },
    );

    expect(result).toEqual({
      ok: true,
      value: {
        keepNumber: 7,
        keepBoolean: true,
        keepNull: null,
        keepText: 'visible',
        nested: [
          {
            token: redactionLabel,
            keep: 'safe',
          },
          ['safe', `prefix ${redactionLabel}`, false],
        ],
        [`path:${redactionLabel}`]: {
          deep: redactionLabel,
        },
      },
      replacementCount: 4,
      redactionFingerprintIds: ['fp-credential-1'],
      auditEvent: expect.objectContaining({
        type: 'RedactionApplied',
        sink: 'recursive-structure',
        replacementCount: 4,
        redactionFingerprintIds: ['fp-credential-1'],
      }),
    });
  });

  it('returns RedactedValue with replacement count, fingerprint ids, and a RedactionApplied audit payload', () => {
    const redactionSet = createFixtureRedactionSet();
    const result = redact(
      {
        value: `first=${secret} second=${secret}`,
        redactionSet,
        audit: createAuditSeed(),
        sink: 'stdout',
      },
      { hashText },
    );

    expect(result).toEqual({
      ok: true,
      value: `first=${redactionLabel} second=${redactionLabel}`,
      replacementCount: 2,
      redactionFingerprintIds: ['fp-credential-1'],
      auditEvent: expect.objectContaining({
        type: 'RedactionApplied',
        sink: 'stdout',
        replacementCount: 2,
        redactionFingerprintIds: ['fp-credential-1'],
      }),
    });
  });

  it('redacts Error instances and successful text artifact captures with audit evidence', () => {
    const redactionSet = createFixtureRedactionSet();
    const error = new Error(`boom ${secret}`);
    error.name = `WorkerError ${secret}`;
    error.stack = undefined;

    const errorResult = redact(
      {
        value: error as unknown as Parameters<typeof redact>[0]['value'],
        redactionSet,
        audit: createAuditSeed(),
        sink: 'error-object',
      },
      { hashText },
    );

    expect(errorResult.ok).toBe(true);
    if (!errorResult.ok) {
      return;
    }

    expect(errorResult.value).toBeInstanceOf(Error);
    expect((errorResult.value as unknown as Error).name).toBe(`WorkerError ${redactionLabel}`);
    expect((errorResult.value as unknown as Error).message).toBe(`boom ${redactionLabel}`);
    expect((errorResult.value as unknown as Error).stack).toBeUndefined();

    const artifactResult = redactArtifact(
      {
        artifact: {
          artifactId: 'artifact-json',
          mediaType: 'application/json',
          text: `{"token":"${jsonEscapedSecret}"}`,
        },
        redactionSet,
        audit: {
          ...createAuditSeed(),
          operationId: 'operation-artifact-json',
        },
        sink: 'artifact-json',
      },
      { hashText },
    );

    expect(artifactResult).toEqual({
      ok: true,
      value: {
        artifactId: 'artifact-json',
        mediaType: 'application/json',
        text: `{"token":"${redactionLabel}"}`,
      },
      replacementCount: 1,
      redactionFingerprintIds: ['fp-credential-1'],
      auditEvent: expect.objectContaining({
        type: 'RedactionApplied',
        sink: 'artifact-json',
        replacementCount: 1,
      }),
    });
  });

  it('fails closed with redaction-unavailable when a capture path requires redaction but no RedactionSet exists', () => {
    const result = redact(
      {
        value: `captured ${secret}`,
        redactionSet: undefined,
        audit: createAuditSeed(),
        sink: 'stderr',
      },
      { hashText },
    );

    expect(result).toEqual({
      ok: false,
      reason: 'redaction-unavailable',
      auditEvent: expect.objectContaining({
        type: 'CredentialUseDenied',
        reason: 'redaction-unavailable',
      }),
    });
  });

  it('quarantines binary or unredactable artifacts as artifact-redaction-failed', () => {
    const redactionSet = createFixtureRedactionSet();
    const binaryResult = redactArtifact(
      {
        artifact: {
          artifactId: 'artifact-binary',
          mediaType: 'application/octet-stream',
        },
        redactionSet,
        audit: createAuditSeed(),
      },
      { hashText },
    );

    const malformedTextResult = redactArtifact(
      {
        artifact: {
          artifactId: 'artifact-missing-text',
          mediaType: 'text/plain',
        },
        redactionSet,
        audit: createAuditSeed(),
      },
      { hashText },
    );

    expect(binaryResult).toEqual({
      ok: false,
      token: 'artifact-redaction-failed',
      artifactId: 'artifact-binary',
      mediaType: 'application/octet-stream',
      reason: 'binary-media-type',
    });
    expect(malformedTextResult).toEqual({
      ok: false,
      token: 'artifact-redaction-failed',
      artifactId: 'artifact-missing-text',
      mediaType: 'text/plain',
      reason: 'text-unavailable',
    });
  });
});
