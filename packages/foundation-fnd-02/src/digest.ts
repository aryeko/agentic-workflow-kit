import { createHash } from 'node:crypto';

export const toBytes = (content: Uint8Array | string): Uint8Array =>
  typeof content === 'string' ? new TextEncoder().encode(content) : content;

export const sha256Bytes = (content: Uint8Array | string): string =>
  createHash('sha256').update(toBytes(content)).digest('hex');

export const canonicalJson = (value: unknown): string => JSON.stringify(sortForJson(value));

export const sha256Json = (value: unknown): string => sha256Bytes(canonicalJson(value));

const sortForJson = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sortForJson(item));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, sortForJson(entryValue)]),
    );
  }
  return value;
};
