import type { RunEventEnvelope, RunLifecycleState, RunLifecycleTransitionPayload } from '../contracts/index.js';

import { isTerminalLifecycleState } from './transition-table.js';

export type ReducedRunLifecycle = {
  lifecycle: RunLifecycleState | null;
  terminalReason?: string;
  currentSequence?: number;
};

function isLifecycleTransitionPayload(value: unknown): value is RunLifecycleTransitionPayload {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'to' in value &&
      'authority' in value &&
      'reason' in value &&
      'sourceEventIds' in value &&
      Array.isArray((value as { sourceEventIds: unknown }).sourceEventIds),
  );
}

export function reduceRunLifecycle(events: readonly RunEventEnvelope[]): ReducedRunLifecycle {
  return events.reduce<ReducedRunLifecycle>(
    (state, event) => {
      if (event.type !== 'RunLifecycleTransitioned' || !isLifecycleTransitionPayload(event.payload)) {
        return state;
      }

      return {
        lifecycle: event.payload.to,
        currentSequence: event.sequence,
        terminalReason: isTerminalLifecycleState(event.payload.to) ? event.payload.reason : undefined,
      };
    },
    {
      lifecycle: null,
    },
  );
}
