import type { EvidenceEventRef, RunEventEnvelope, RunProjections } from '../../run-lifecycle/contracts/index.js';

import type { AnalysisTrigger } from './types.js';

const RECOVERY_EVENT_TYPES = new Set([
  'RecoveryClassified',
  'RecoveryActionPlanned',
  'RecoveryActionApplied',
  'ReconciliationBlocked',
]);

const TERMINAL_LIFECYCLE_STATES = new Set(['completed', 'failed', 'canceled']);

const getEventRef = (event: RunEventEnvelope): EvidenceEventRef => ({
  eventId: event.eventId,
  sequence: event.sequence,
  payloadDigest: event.payloadDigest,
  type: event.type,
});

const getPayloadField = (payload: unknown, field: string): string | undefined => {
  if (payload === null || typeof payload !== 'object') {
    return undefined;
  }

  const value = (payload as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : undefined;
};

const getLifecycleTarget = (event: RunEventEnvelope): string | undefined =>
  event.type === 'RunLifecycleTransitioned' ? getPayloadField(event.payload, 'to') : undefined;

const getLivenessState = (event: RunEventEnvelope): string | undefined => {
  if (event.type !== 'LivenessStateChanged') {
    return undefined;
  }

  return getPayloadField(event.payload, 'to') ?? getPayloadField(event.payload, 'state');
};

const buildTrigger = (event: RunEventEnvelope, kind: AnalysisTrigger['kind'], reason: string): AnalysisTrigger => ({
  kind,
  eventRef: getEventRef(event),
  reason,
});

export function classifyTrigger(event: RunEventEnvelope, projections: RunProjections): AnalysisTrigger | null {
  void projections;

  const lifecycleTarget = getLifecycleTarget(event);
  if (lifecycleTarget !== undefined && TERMINAL_LIFECYCLE_STATES.has(lifecycleTarget)) {
    return buildTrigger(event, 'terminal-lifecycle', `run lifecycle transitioned to ${lifecycleTarget}`);
  }

  if (lifecycleTarget === 'blocked') {
    return buildTrigger(event, 'blocked-transition', 'run lifecycle transitioned to blocked');
  }

  if (event.type === 'SupervisionLost') {
    return buildTrigger(event, 'supervision-lost', 'supervision was lost');
  }

  if (getLivenessState(event) === 'supervision-lost') {
    return buildTrigger(event, 'supervision-lost', 'liveness state changed to supervision-lost');
  }

  if (event.type === 'LivenessTimerExpired') {
    return buildTrigger(event, 'stale-progress', 'liveness timer expired');
  }

  if (getLivenessState(event) === 'stale') {
    return buildTrigger(event, 'stale-progress', 'liveness state changed to stale');
  }

  if (RECOVERY_EVENT_TYPES.has(event.type)) {
    return buildTrigger(event, 'recovery-decision', `recovery event recorded: ${event.type}`);
  }

  return null;
}
