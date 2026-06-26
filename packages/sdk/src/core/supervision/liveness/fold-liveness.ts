import { resolveSessionLinkage } from '../../run-lifecycle/lifecycle/linkage-resolver.js';
import type { LivenessProjection } from '../contracts/index.js';
import type { SupervisionTimerName } from '../contracts/index.js';

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
import {
  addMs,
  type FoldLivenessInput,
  isRecord,
  isRunLifecycleTransitionPayload,
  isTerminalLifecycleState,
  type LivenessFoldResult,
  parseTimestamp,
  type ProjectionState,
  setTimerEvidence,
  stopTimerEvidence,
} from './fold-liveness-shared.js';

export type { FoldLivenessInput, LivenessFoldResult, LivenessTimerEvidence } from './fold-liveness-shared.js';

const buildProjectionTimer = (
  state: ProjectionState,
  timer: SupervisionTimerName,
  sampledAt: string,
  durationMs: number,
): LivenessProjection['timers'][SupervisionTimerName] => {
  const evidence = state.timerEvidence[timer];
  const deadline = addMs(evidence?.basisAt ?? sampledAt, durationMs);
  const sampledEpoch = parseTimestamp(sampledAt);
  const deadlineEpoch = parseTimestamp(deadline);
  return {
    deadline,
    exceeded:
      !state.terminal &&
      evidence?.stoppedAt === undefined &&
      (sampledEpoch === undefined || deadlineEpoch === undefined || sampledEpoch > deadlineEpoch),
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
          stopTimerEvidence(state.timerEvidence, 'startup', event.occurredAt, event.eventId);
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
          stopTimerEvidence(state.timerEvidence, 'startup', event.occurredAt, event.eventId);
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
      isTerminalLifecycleState(event.payload.to)
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
      startup: buildProjectionTimer(state, 'startup', input.sampledAt, timerPolicy.startupMs),
      idle: buildProjectionTimer(state, 'idle', input.sampledAt, timerPolicy.idleMs),
      'no-progress': buildProjectionTimer(state, 'no-progress', input.sampledAt, timerPolicy.noProgressMs),
      'per-tool': buildProjectionTimer(state, 'per-tool', input.sampledAt, timerPolicy.perToolMs),
      'approval-SLA': buildProjectionTimer(state, 'approval-SLA', input.sampledAt, timerPolicy.approvalSlaMs),
      'max-runtime': buildProjectionTimer(state, 'max-runtime', input.sampledAt, timerPolicy.maxRuntimeMs),
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
