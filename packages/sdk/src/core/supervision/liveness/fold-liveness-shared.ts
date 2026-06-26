import type { RunEventEnvelope, RunLifecycleTransitionPayload } from '../../run-lifecycle/contracts/index.js';
import { isTerminalLifecycleState as isCanonicalTerminalLifecycleState } from '../../run-lifecycle/lifecycle/transition-table.js';

import type {
  LivenessAdvancedPayload,
  LivenessProjection,
  LivenessReason,
  SupervisionTimerName,
  SupervisionTimerPolicy,
} from '../contracts/index.js';

export interface FoldLivenessInput {
  readonly runId: string;
  readonly events: readonly RunEventEnvelope[];
  readonly sampledAt: string;
  readonly timerPolicy: SupervisionTimerPolicy;
}

export interface LivenessTimerEvidence {
  readonly basisAt?: string;
  readonly sourceEventIds: readonly string[];
  readonly sourceSequence?: number;
  readonly stoppedAt?: string;
  readonly stopSourceEventIds?: readonly string[];
  readonly itemId?: string;
}

export interface LivenessFoldResult {
  readonly projection: LivenessProjection;
  readonly advances: readonly LivenessAdvancedPayload[];
  readonly timerEvidence: Readonly<Partial<Record<SupervisionTimerName, LivenessTimerEvidence>>>;
  readonly linkage: 'known' | 'unknown' | 'ambiguous';
  readonly linkedSessionIds: readonly string[];
}

export interface ProjectionState {
  state: LivenessProjection['state'];
  reason?: LivenessReason;
  currentSessionId?: string;
  workerHandleId?: string;
  lastWorkerEventSequence?: number;
  lastProgressSequence?: number;
  terminal: boolean;
  sawStartup: boolean;
  progressGuaranteeLost: boolean;
  advances: LivenessAdvancedPayload[];
  stableToolItemIds: Set<string>;
  linkedSessionIds: Set<string>;
  timerEvidence: Partial<Record<SupervisionTimerName, LivenessTimerEvidence>>;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object');

export const parseTimestamp = (value: string): number => globalThis.Date.parse(value);

export const addMs = (timestamp: string, deltaMs: number): string =>
  new globalThis.Date(parseTimestamp(timestamp) + deltaMs).toISOString();

export const isRunLifecycleTransitionPayload = (value: unknown): value is RunLifecycleTransitionPayload =>
  isRecord(value) && typeof value.to === 'string';

export const isTerminalLifecycleState = (value: RunLifecycleTransitionPayload['to']): boolean =>
  isCanonicalTerminalLifecycleState(value);

export const setTimerEvidence = (
  timerEvidence: Partial<Record<SupervisionTimerName, LivenessTimerEvidence>>,
  timer: SupervisionTimerName,
  evidence: LivenessTimerEvidence,
): void => {
  timerEvidence[timer] = evidence;
};

export const stopTimerEvidence = (
  timerEvidence: Partial<Record<SupervisionTimerName, LivenessTimerEvidence>>,
  timer: SupervisionTimerName,
  stoppedAt: string,
  eventId: string,
): void => {
  const prior = timerEvidence[timer];
  if (!prior) {
    return;
  }

  timerEvidence[timer] = {
    ...prior,
    stoppedAt,
    stopSourceEventIds: [eventId],
  };
};
