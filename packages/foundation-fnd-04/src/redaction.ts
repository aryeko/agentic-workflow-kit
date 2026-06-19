import { Buffer } from 'node:buffer';
import { createHmac } from 'node:crypto';
import type { CredentialRef, RedactedInput, RedactionSet } from './types.js';

export type RedactionRule = {
  readonly pattern: string;
  readonly replacement: string;
  readonly fingerprintId: string;
};

export type RedactionBuildResult = {
  readonly redactionSet: RedactionSet;
  readonly rules: readonly RedactionRule[];
};

const unique = <T>(values: readonly T[]): readonly T[] => [...new Set(values)];

const fingerprint = (key: string, value: string): string =>
  `hmac-sha256:${createHmac('sha256', key).update(value).digest('hex')}`;

const shellAssignmentsFor = (ref: CredentialRef, variants: readonly string[]): readonly string[] =>
  variants.flatMap((variant) => [
    `${ref.secret.key}=${variant}`,
    `${ref.secret.key}="${variant}"`,
    `${ref.secret.key}='${variant}'`,
    `export ${ref.secret.key}=${variant}`,
    `export ${ref.secret.key}="${variant}"`,
    `export ${ref.secret.key}='${variant}'`,
  ]);

const encodedVariantsFor = (material: string): readonly string[] => {
  const uriEncoded = encodeURIComponent(material);
  const jsonEscaped = JSON.stringify(material).slice(1, -1);
  const base64Encoded = Buffer.from(material, 'utf8').toString('base64');
  return unique([
    material,
    uriEncoded,
    encodeURIComponent(uriEncoded),
    jsonEscaped,
    JSON.stringify(material),
    base64Encoded,
  ]).filter((variant) => variant.length > 0);
};

const bearerVariantsFor = (variants: readonly string[]): readonly string[] =>
  variants.flatMap((variant) => [
    `Bearer ${variant}`,
    `Authorization: Bearer ${variant}`,
    `authorization: Bearer ${variant}`,
    `Authorization=Bearer ${variant}`,
    `authorization=Bearer ${variant}`,
    `--header Authorization: Bearer ${variant}`,
    `-H "Authorization: Bearer ${variant}"`,
    `token=${variant}`,
  ]);

export const redactionLabelFor = (ref: CredentialRef): string => `[REDACTED:credential:${ref.id}]`;

export const buildPlannedRedactionSet = (
  id: string,
  refs: readonly CredentialRef[],
  expiresAt: string,
): RedactionSet => {
  const labels = Object.fromEntries(refs.map((ref) => [ref.policyDigest, redactionLabelFor(ref)]));
  return {
    id,
    state: 'planned',
    credentialRefIds: refs.map((ref) => ref.id),
    labels,
    fingerprintIds: refs.map((ref) => ref.policyDigest),
    expiresAt,
  };
};

export const buildMaterialRedaction = (
  id: string,
  ref: CredentialRef,
  material: string,
  fingerprintKey: string,
  expiresAt: string,
  extraPatterns: readonly string[] = [],
): RedactionBuildResult => {
  const label = redactionLabelFor(ref);
  const encodedVariants = encodedVariantsFor(material);
  const patterns = unique([
    ...extraPatterns,
    ...shellAssignmentsFor(ref, encodedVariants),
    ...bearerVariantsFor(encodedVariants),
    ...encodedVariants,
    material,
  ]).filter((pattern) => pattern.length > 0);
  const rules = patterns
    .map((pattern) => ({ pattern, replacement: label, fingerprintId: fingerprint(fingerprintKey, pattern) }))
    .sort((left, right) => right.pattern.length - left.pattern.length);
  const labels = Object.fromEntries(rules.map((rule) => [rule.fingerprintId, label]));

  return {
    redactionSet: {
      id,
      state: 'materialized',
      credentialRefIds: [ref.id],
      labels,
      fingerprintIds: rules.map((rule) => rule.fingerprintId),
      expiresAt,
    },
    rules,
  };
};

const redactString = (
  value: string,
  rules: readonly RedactionRule[],
): { readonly value: string; readonly replacementCount: number } =>
  rules.reduce(
    (current, rule) => {
      if (!current.value.includes(rule.pattern)) {
        return current;
      }
      const parts = current.value.split(rule.pattern);
      return {
        value: parts.join(rule.replacement),
        replacementCount: current.replacementCount + parts.length - 1,
      };
    },
    { value, replacementCount: 0 },
  );

export const redactValue = <T extends RedactedInput>(
  value: T,
  rules: readonly RedactionRule[],
): { readonly value: T; readonly replacementCount: number } => {
  if (typeof value === 'string') {
    return redactString(value, rules) as { readonly value: T; readonly replacementCount: number };
  }
  if (value === null || typeof value !== 'object') {
    return { value, replacementCount: 0 };
  }
  if (Array.isArray(value)) {
    const entries = value.map((entry) => redactValue(entry, rules));
    return {
      value: entries.map((entry) => entry.value) as unknown as T,
      replacementCount: entries.reduce((count, entry) => count + entry.replacementCount, 0),
    };
  }

  const entries = Object.entries(value).map(([key, entry]) => {
    const redactedKey = redactString(key, rules);
    const redacted = redactValue(entry as RedactedInput, rules);
    return [redactedKey.value, redacted, redactedKey.replacementCount] as const;
  });
  return {
    value: Object.fromEntries(entries.map(([key, redacted]) => [key, redacted.value])) as T,
    replacementCount: entries.reduce(
      (count, [, redacted, keyReplacementCount]) => count + keyReplacementCount + redacted.replacementCount,
      0,
    ),
  };
};
