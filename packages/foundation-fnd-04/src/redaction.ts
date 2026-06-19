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

const shellAssignmentsFor = (ref: CredentialRef, material: string): readonly string[] => [
  `${ref.secret.key}=${material}`,
  `export ${ref.secret.key}=${material}`,
];

const encodedVariantsFor = (material: string): readonly string[] => {
  const encoded = encodeURIComponent(material);
  return encoded === material ? [] : [encoded];
};

const bearerVariantsFor = (material: string): readonly string[] => [
  `Bearer ${material}`,
  `Authorization: Bearer ${material}`,
  `authorization: Bearer ${material}`,
  `token=${encodeURIComponent(material)}`,
];

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
  const patterns = unique([
    ...extraPatterns,
    ...shellAssignmentsFor(ref, material),
    ...bearerVariantsFor(material),
    ...encodedVariantsFor(material),
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
    const redacted = redactValue(entry as RedactedInput, rules);
    return [key, redacted] as const;
  });
  return {
    value: Object.fromEntries(entries.map(([key, redacted]) => [key, redacted.value])) as T,
    replacementCount: entries.reduce((count, [, redacted]) => count + redacted.replacementCount, 0),
  };
};
