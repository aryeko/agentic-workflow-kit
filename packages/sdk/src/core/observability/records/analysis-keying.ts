import { createHash } from 'node:crypto';

import type { AnalysisPayload, AnalysisRecordInput } from './types.js';

type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalValue[]
  | { readonly [key: string]: CanonicalValue };

const canonicalize = (value: unknown): CanonicalValue => {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)] as const),
    );
  }

  return null;
};

export const canonicalJson = (value: unknown): string => JSON.stringify(canonicalize(value));

export const sha256Digest = (value: string): string =>
  `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;

export const createAnalysisKey = (input: AnalysisRecordInput): string =>
  canonicalJson({
    runId: input.request.runId,
    triggerEventId: input.request.trigger.eventRef.eventId,
    analyzerVersion: input.request.analyzerVersion,
    ruleSetDigest: input.request.ruleSetDigest,
  });

export const createAnalysisPayloadDigest = (payload: AnalysisPayload): string => sha256Digest(canonicalJson(payload));

export const createAnalysisEventId = (
  input: AnalysisRecordInput,
  payload: AnalysisPayload,
  analysisPayloadDigest: string,
): string =>
  `analysis:${sha256Digest(
    canonicalJson({
      analysisKey: createAnalysisKey(input),
      evaluatedThrough: input.request.evaluatedThrough,
      outcomeKind: payload.schema === 'kit-vnext.analysis-recorded.v1' ? 'recorded' : 'failed',
      analysisPayloadDigest,
    }),
  ).slice('sha256:'.length)}`;
