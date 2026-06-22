import { Buffer } from 'node:buffer';

import type { CreateRedactionSetInput, RedactionSet } from './redaction-types.js';

type CompiledPattern = {
  readonly value: string;
  readonly fingerprintId: string;
  readonly replacement: string;
};

type CompiledRedactionSet = {
  readonly patterns: readonly CompiledPattern[];
};

const compiledRedactionSets = new WeakMap<RedactionSet, CompiledRedactionSet>();

const unique = (values: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    ordered.push(value);
  }

  return ordered;
};

const createSecretVariants = (secret: string): readonly string[] => {
  const jsonEscaped = JSON.stringify(secret).slice(1, -1);
  const formEncoded = new URLSearchParams([['value', secret]]).toString().slice('value='.length);
  return unique([
    secret,
    Buffer.from(secret, 'utf8').toString('base64'),
    Buffer.from(secret, 'utf8').toString('base64url'),
    encodeURIComponent(secret),
    formEncoded,
    jsonEscaped,
  ]).filter((value) => value.length > 0);
};

export const getCompiledRedactionSet = (redactionSet: RedactionSet): CompiledRedactionSet | undefined =>
  compiledRedactionSets.get(redactionSet);

export const createRedactionSet = (input: CreateRedactionSetInput): RedactionSet => {
  const labels: Record<string, string> = {};
  const credentialRefIds: string[] = [];
  const fingerprintIds: string[] = [];
  const patterns: CompiledPattern[] = [];

  for (const secret of input.secrets) {
    credentialRefIds.push(secret.credentialRefId);
    fingerprintIds.push(secret.fingerprintId);
    labels[secret.credentialRefId] = secret.label;

    const variants = [...createSecretVariants(secret.secret), ...(secret.tempFilePaths ?? [])];

    for (const value of unique(variants)) {
      patterns.push({
        value,
        fingerprintId: secret.fingerprintId,
        replacement: secret.label,
      });
    }
  }

  patterns.sort((left, right) => {
    if (right.value.length !== left.value.length) {
      return right.value.length - left.value.length;
    }

    if (left.fingerprintId !== right.fingerprintId) {
      return left.fingerprintId.localeCompare(right.fingerprintId);
    }

    if (left.replacement !== right.replacement) {
      return left.replacement.localeCompare(right.replacement);
    }

    return left.value.localeCompare(right.value);
  });

  const redactionSet: RedactionSet = {
    id: input.id,
    credentialRefIds: unique(credentialRefIds),
    labels,
    fingerprintIds: unique(fingerprintIds),
    expiresAt: input.expiresAt,
  };

  compiledRedactionSets.set(redactionSet, {
    patterns,
  });

  return redactionSet;
};
