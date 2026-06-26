import type { RunEventCursor } from '../../run-lifecycle/contracts/index.js';

import type { LivenessAdvanceClass, LivenessReason, LivenessState, SupervisionTimerName } from './catalogs.js';
import type { SupervisionTimerPolicy } from './interfaces.js';

export interface SupervisorStartedPayload {
  readonly schema: 'kit-vnext.supervisor-started.v1';
  readonly runId: string;
  readonly cursor: RunEventCursor;
  readonly expectedSessionId?: string;
  readonly expectedWorkerHandleId?: string;
  readonly timerPolicy: SupervisionTimerPolicy;
  readonly startedAt: string;
  readonly sourceEventIds: readonly string[];
}

export interface LivenessAdvancedPayload {
  readonly schema: 'kit-vnext.liveness-advanced.v1';
  readonly runId: string;
  readonly sessionId: string;
  readonly workerHandleId?: string;
  readonly sourceEventId: string;
  readonly sourceSequence: number;
  readonly advanceClass: LivenessAdvanceClass;
  readonly refreshedTimers: readonly SupervisionTimerName[];
  readonly advancedAt: string;
}

export interface LivenessTimerExpiredPayload {
  readonly schema: 'kit-vnext.liveness-timer-expired.v1';
  readonly runId: string;
  readonly timer: SupervisionTimerName;
  readonly reason: LivenessReason;
  readonly deadline: string;
  readonly observedAt: string;
  readonly sessionId?: string;
  readonly workerHandleId?: string;
  readonly lastWorkerEventSequence?: number;
  readonly lastProgressSequence?: number;
  readonly sourceEventIds: readonly string[];
}

export interface LivenessStateChangedPayload {
  readonly schema: 'kit-vnext.liveness-state-changed.v1';
  readonly runId: string;
  readonly from: LivenessState;
  readonly to: LivenessState;
  readonly reason?: LivenessReason;
  readonly changedAt: string;
  readonly sourceEventIds: readonly string[];
}

export interface SupervisionLostPayload {
  readonly schema: 'kit-vnext.supervision-lost.v1';
  readonly runId: string;
  readonly reason: LivenessReason;
  readonly lostAt: string;
  readonly sourceEventIds: readonly string[];
}

export interface SupervisorTerminationRequestedPayload {
  readonly schema: 'kit-vnext.supervisor-termination-requested.v1';
  readonly runId: string;
  readonly workerHandleId: string;
  readonly reason: LivenessReason;
  readonly requestedAt: string;
  readonly timerEventId: string;
  readonly sourceEventIds: readonly string[];
}

export interface WorkerTerminatedPayload {
  readonly schema: 'kit-vnext.worker-terminated.v1';
  readonly runId: string;
  readonly workerHandleId: string;
  readonly observedBy: 'agent' | 'execution-host';
  readonly proofRef?: string;
  readonly containmentEmpty?: boolean;
  readonly terminatedAt: string;
  readonly sourceEventIds: readonly string[];
}

export interface SupervisorStoppedPayload {
  readonly schema: 'kit-vnext.supervisor-stopped.v1';
  readonly runId: string;
  readonly outcome: 'terminated' | 'terminal-lifecycle-observed' | 'supervision-lost';
  readonly stoppedAt: string;
  readonly terminalSourceEventIds: readonly string[];
  readonly summarizedEventIds: readonly string[];
}
