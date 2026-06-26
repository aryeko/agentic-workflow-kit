import type { ApprovalRequest } from '../contracts/index.js';

const DEFAULT_DECISION_WINDOW_MS = 900_000;

export const toEpochMs = (timestamp: string): number | undefined => {
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const isoFromEpochMs = (epochMs: number): string => new globalThis.Date(epochMs).toISOString();

export const deadlineFor = (request: ApprovalRequest, decisionWindowMs = DEFAULT_DECISION_WINDOW_MS): string => {
  if (request.expiresAt !== undefined) {
    return request.expiresAt;
  }

  const requestedAtMs = toEpochMs(request.requestedAt);
  return requestedAtMs === undefined ? request.requestedAt : isoFromEpochMs(requestedAtMs + decisionWindowMs);
};

export const isExpired = (deadline: string, evaluatedAt: string): boolean => {
  const deadlineMs = toEpochMs(deadline);
  const evaluatedMs = toEpochMs(evaluatedAt);
  return deadlineMs !== undefined && evaluatedMs !== undefined && evaluatedMs > deadlineMs;
};
