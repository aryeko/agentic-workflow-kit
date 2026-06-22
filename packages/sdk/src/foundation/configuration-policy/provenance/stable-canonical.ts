import type { FieldProvenance, PolicySourceLayer } from './types.js';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const stableCanonicalStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableCanonicalStringify(entry)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableCanonicalStringify(record[key])}`);

  return `{${entries.join(',')}}`;
};

export const buildFieldProvenance = ({
  fieldPath,
  profile,
  sourceLayer,
  sourceRef,
  value,
  hashText,
}: {
  readonly fieldPath: string;
  readonly profile?: string;
  readonly sourceLayer: PolicySourceLayer;
  readonly sourceRef: string;
  readonly value: unknown;
  readonly hashText: (value: string) => string;
}): FieldProvenance => ({
  fieldPath,
  sourceLayer,
  profile,
  sourceRef,
  valueHash: hashText(stableCanonicalStringify(value)),
});

export const isPlainRecord = isPlainObject;
