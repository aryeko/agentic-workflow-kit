import type { RunEventEnvelope, RunLifecycleTransitionPayload } from '../../run-lifecycle/contracts/index.js';
import { resolveSessionLinkage } from '../../run-lifecycle/lifecycle/linkage-resolver.js';
import type {
  LivenessAdvancedPayload,
  LivenessProjection,
  LivenessReason,
  SupervisionTimerName,
  SupervisionTimerPolicy,
} from '../contracts/index.js';

import {
  classifyLivenessAdvance,
  isAgentProgressObservedPayload,
  isAgentSessionLinkedPayload,
  isAgentToolObservedPayload,
  isSessionLinkedPayload,
  isWorkerProcessExitedPayload,
  type LivenessAdvanceContext,
  toolObservationForClassification,
} from './event-classification.js';

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
  readonly linkage: ReturnType<typeof resolveSessionLinkage>['classification'];
  readonly linkedSessionIds: readonly string[];
}

type ProjectionState = {
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
};

const TERMINAL_LIFECYCLE_STATES = new Set(['completed', 'blocked', 'failed', 'canceled']);

const parseTimestamp = (value: string): number => globalThis.Date.parse(value);

const addMs = (timestamp: string, deltaMs: number): string =>
  new globalThis.Date(parseTimestamp(timestamp) + deltaMs).toISOString();

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object');

const isRunLifecycleTransitionPayload = (value: unknown): value is RunLifecycleTransitionPayload =>
  isRecord(value) && typeof value.to === 'string';

const setTimerEvidence = (
  timerEvidence: Partial<Record<SupervisionTimerName, LivenessTimerEvidence>>,
  timer: SupervisionTimerName,
  evidence: LivenessTimerEvidence,
): void => {
  timerEvidence[timer] = evidence;
};

const stopTimerEvidence = (
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

export function foldLiveness(input: FoldLivenessInput): LivenessFoldResult {
  const timerPolicy = input.timerPolicy;
  const linkage = resolveSessionLinkage(input.events);
  const state: ProjectionState = {
    state: 'not-started',
    currentSessionId: linkage.currentSession?.sessionId,
    terminal: false,
    sawStartup: false,
    progressGuaranteeLost: false,
    advances: [],
    stableToolItemIds: new Set<string>(),
    linkedSessionIds: new Set<string>(),
    timerEvidence: {},
  };

  for (const event of input.events) {
    if (
      event.type === 'SessionLinked' &&
      isSessionLinkedPayload(event.payload) &&
      event.payload.sessionId === state.currentSessionId
    ) {
      state.linkedSessionIds.add(event.payload.sessionId);
    }

    if (
      event.type === 'RunLifecycleTransitioned' &&
      isRunLifecycleTransitionPayload(event.payload) &&
      event.payload.to === 'worker-starting'
    ) {
      state.sawStartup = true;
      state.state = state.terminal ? state.state : 'starting';
      setTimerEvidence(state.timerEvidence, 'startup', {
        basisAt: event.occurredAt,
        sourceEventIds: [event.eventId],
        sourceSequence: event.sequence,
      });
      setTimerEvidence(state.timerEvidence, 'max-runtime', {
        basisAt: event.occurredAt,
        sourceEventIds: [event.eventId],
        sourceSequence: event.sequence,
      });
      continue;
    }

    if (event.type === 'WorkerSpawned' && isRecord(event.payload)) {
      state.sawStartup = true;
      state.state = state.terminal ? state.state : 'starting';
      state.workerHandleId = typeof event.payload.handleId === 'string' ? event.payload.handleId : state.workerHandleId;
      if (!state.timerEvidence.startup) {
        setTimerEvidence(state.timerEvidence, 'startup', {
          basisAt: event.occurredAt,
          sourceEventIds: [event.eventId],
          sourceSequence: event.sequence,
        });
      }
      if (!state.timerEvidence['max-runtime']) {
        setTimerEvidence(state.timerEvidence, 'max-runtime', {
          basisAt: event.occurredAt,
          sourceEventIds: [event.eventId],
          sourceSequence: event.sequence,
        });
      }
      continue;
    }

    if (event.type === 'AgentSessionLinked' && isAgentSessionLinkedPayload(event.payload)) {
      if (event.payload.sessionId === state.currentSessionId) {
        state.workerHandleId =
          typeof event.payload.hostWorkerHandleId === 'string'
            ? event.payload.hostWorkerHandleId
            : state.workerHandleId;
      }
    }

    if (event.type === 'AgentProgressObserved' && isAgentProgressObservedPayload(event.payload)) {
      if (event.payload.sessionId === state.currentSessionId && typeof event.payload.itemId === 'string') {
        state.stableToolItemIds.add(event.payload.itemId);
        setTimerEvidence(state.timerEvidence, 'per-tool', {
          basisAt: event.occurredAt,
          sourceEventIds: [event.eventId],
          sourceSequence: event.sequence,
          itemId: event.payload.itemId,
        });
      }
    }

    const context: LivenessAdvanceContext = {
      currentSessionId: state.currentSessionId,
      linkage: linkage.classification,
      linkedSessionIds: state.linkedSessionIds,
      stableToolItemIds: state.stableToolItemIds,
      currentWorkerHandleId: state.workerHandleId,
    };
    const advance = classifyLivenessAdvance(event, context);
    if (advance) {
      state.advances.push(advance);
      state.lastWorkerEventSequence = event.sequence;
      state.currentSessionId = advance.sessionId;
      state.workerHandleId = advance.workerHandleId ?? state.workerHandleId;

      switch (advance.advanceClass) {
        case 'startup-linkage':
          state.state = state.terminal ? state.state : 'active';
          setTimerEvidence(state.timerEvidence, 'idle', {
            basisAt: event.occurredAt,
            sourceEventIds: [event.eventId],
            sourceSequence: event.sequence,
          });
          stopTimerEvidence(state.timerEvidence, 'startup', event.occurredAt, event.eventId);
          break;
        case 'worker-progress':
          state.state = state.terminal ? state.state : 'active';
          state.lastProgressSequence = event.sequence;
          setTimerEvidence(state.timerEvidence, 'idle', {
            basisAt: event.occurredAt,
            sourceEventIds: [event.eventId],
            sourceSequence: event.sequence,
          });
          setTimerEvidence(state.timerEvidence, 'no-progress', {
            basisAt: event.occurredAt,
            sourceEventIds: [event.eventId],
            sourceSequence: event.sequence,
          });
          break;
        case 'tool-completion':
          state.state = state.terminal ? state.state : 'active';
          state.lastProgressSequence = event.sequence;
          setTimerEvidence(state.timerEvidence, 'idle', {
            basisAt: event.occurredAt,
            sourceEventIds: [event.eventId],
            sourceSequence: event.sequence,
          });
          setTimerEvidence(state.timerEvidence, 'no-progress', {
            basisAt: event.occurredAt,
            sourceEventIds: [event.eventId],
            sourceSequence: event.sequence,
          });
          if (isAgentToolObservedPayload(event.payload)) {
            toolObservationForClassification(event.payload);
            stopTimerEvidence(state.timerEvidence, 'per-tool', event.occurredAt, event.eventId);
          }
          break;
        case 'approval-request':
          state.state = state.terminal ? state.state : 'waiting-for-approval';
          setTimerEvidence(state.timerEvidence, 'idle', {
            basisAt: event.occurredAt,
            sourceEventIds: [event.eventId],
            sourceSequence: event.sequence,
          });
          setTimerEvidence(state.timerEvidence, 'approval-SLA', {
            basisAt: event.occurredAt,
            sourceEventIds: [event.eventId],
            sourceSequence: event.sequence,
          });
          break;
        case 'terminal-observation':
          state.state = 'terminated';
          state.reason = 'worker-terminal-observed';
          state.terminal = true;
          stopTimerEvidence(state.timerEvidence, 'approval-SLA', event.occurredAt, event.eventId);
          stopTimerEvidence(state.timerEvidence, 'max-runtime', event.occurredAt, event.eventId);
          break;
      }

      continue;
    }

    if (
      event.type === 'AgentToolObserved' &&
      isAgentToolObservedPayload(event.payload) &&
      event.payload.sessionId === state.currentSessionId
    ) {
      const observation = toolObservationForClassification(event.payload);
      if (
        observation.exitCode !== undefined &&
        observation.outputRef !== undefined &&
        (observation.itemId === undefined || !state.stableToolItemIds.has(observation.itemId))
      ) {
        state.reason = 'tool-tracking-unavailable';
      }
      continue;
    }

    if (event.type === 'AgentObservationDegraded') {
      state.progressGuaranteeLost = true;
      if (!state.terminal) {
        state.state = 'supervision-lost';
        state.reason = 'agent-progress-unobservable';
      }
      continue;
    }

    if (
      event.type === 'RunLifecycleTransitioned' &&
      isRunLifecycleTransitionPayload(event.payload) &&
      TERMINAL_LIFECYCLE_STATES.has(event.payload.to)
    ) {
      stopTimerEvidence(state.timerEvidence, 'max-runtime', event.occurredAt, event.eventId);
    }

    if (event.type === 'AgentApprovalAnswered') {
      stopTimerEvidence(state.timerEvidence, 'approval-SLA', event.occurredAt, event.eventId);
    }

    if (
      event.type === 'WorkerProcessExited' &&
      isWorkerProcessExitedPayload(event.payload) &&
      state.workerHandleId &&
      event.payload.handleId === state.workerHandleId
    ) {
      stopTimerEvidence(state.timerEvidence, 'max-runtime', event.occurredAt, event.eventId);
      stopTimerEvidence(state.timerEvidence, 'approval-SLA', event.occurredAt, event.eventId);
    }
  }

  if (!state.terminal) {
    if (linkage.classification === 'ambiguous') {
      state.state = 'supervision-lost';
      state.reason = 'session-linkage-ambiguous';
    } else if (state.progressGuaranteeLost) {
      state.state = 'supervision-lost';
      state.reason = 'agent-progress-unobservable';
    }
  }

  const projection: LivenessProjection = {
    runId: input.runId,
    state: state.state,
    reason: state.reason,
    currentSessionId: state.currentSessionId,
    workerHandleId: state.workerHandleId,
    lastWorkerEventSequence: state.lastWorkerEventSequence,
    lastProgressSequence: state.lastProgressSequence,
    timers: {
      startup: {
        deadline: addMs(state.timerEvidence.startup?.basisAt ?? input.sampledAt, timerPolicy.startupMs),
        exceeded: false,
      },
      idle: {
        deadline: addMs(state.timerEvidence.idle?.basisAt ?? input.sampledAt, timerPolicy.idleMs),
        exceeded: false,
      },
      'no-progress': {
        deadline: addMs(state.timerEvidence['no-progress']?.basisAt ?? input.sampledAt, timerPolicy.noProgressMs),
        exceeded: false,
      },
      'per-tool': {
        deadline: addMs(state.timerEvidence['per-tool']?.basisAt ?? input.sampledAt, timerPolicy.perToolMs),
        exceeded: false,
      },
      'approval-SLA': {
        deadline: addMs(state.timerEvidence['approval-SLA']?.basisAt ?? input.sampledAt, timerPolicy.approvalSlaMs),
        exceeded: false,
      },
      'max-runtime': {
        deadline: addMs(state.timerEvidence['max-runtime']?.basisAt ?? input.sampledAt, timerPolicy.maxRuntimeMs),
        exceeded: false,
      },
    },
    terminal: state.terminal,
  };

  return {
    projection,
    advances: state.advances,
    timerEvidence: state.timerEvidence,
    linkage: linkage.classification,
    linkedSessionIds: [...state.linkedSessionIds],
  };
}

export { isLivenessRefreshingEvent } from './event-classification.js';
