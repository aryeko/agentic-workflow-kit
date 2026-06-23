import type { Result, RunLifecycleState, RunLifecycleTransitionPayload } from '../contracts/index.js';

import { isTerminalLifecycleState, LIFECYCLE_LEGAL_EDGE_CATALOG } from './transition-table.js';

const legalEdgeMap = new Map(
  LIFECYCLE_LEGAL_EDGE_CATALOG.map((edge) => [`${edge.from ?? 'null'}->${edge.to}`, edge] as const),
);

const hasReference = (sourceEventIds: readonly string[]): boolean => sourceEventIds.length > 0;

export function validateLifecycleTransition(
  from: RunLifecycleState | null,
  payload: RunLifecycleTransitionPayload,
): Result<void, 'illegal-lifecycle-transition'> {
  if (from !== payload.from) {
    return { ok: false, error: 'illegal-lifecycle-transition' };
  }

  if (from !== null && isTerminalLifecycleState(from)) {
    return { ok: false, error: 'illegal-lifecycle-transition' };
  }

  const legalEdge = legalEdgeMap.get(`${from ?? 'null'}->${payload.to}`);

  if (!legalEdge) {
    return { ok: false, error: 'illegal-lifecycle-transition' };
  }

  if (legalEdge.constraint.kind === 'recovery-retry') {
    if (payload.authority !== 'recovery' || payload.sourceEventIds.length === 0) {
      return { ok: false, error: 'illegal-lifecycle-transition' };
    }

    return { ok: true, value: undefined };
  }

  if (!hasReference(payload.sourceEventIds)) {
    return { ok: false, error: 'illegal-lifecycle-transition' };
  }

  if (
    legalEdge.constraint.kind === 'terminal-transition' &&
    legalEdge.to === 'canceled' &&
    payload.authority !== legalEdge.constraint.requiredAuthority &&
    !hasReference(payload.sourceEventIds)
  ) {
    return { ok: false, error: 'illegal-lifecycle-transition' };
  }

  return { ok: true, value: undefined };
}
