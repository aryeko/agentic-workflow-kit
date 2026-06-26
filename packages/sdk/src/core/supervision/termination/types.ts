import type { CapabilityAttestation } from '../../../providers/attestation/index.js';
import type {
  ExecutionHostProvider,
  TerminationPolicy,
  TerminationResult,
  WorkerHandle,
} from '../../../providers/execution-host/index.js';
import type {
  AppendIntent,
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunEventCursor,
} from '../../run-lifecycle/contracts/index.js';
import type {
  LivenessAdvancedPayload,
  LivenessReason,
  LivenessStateChangedPayload,
  LivenessTimerExpiredPayload,
  SupervisorStartedPayload,
  SupervisorStoppedPayload,
  SupervisorTerminationRequestedPayload,
  SupervisionLostPayload,
  WorkerTerminatedPayload,
} from '../contracts/index.js';

export interface SupervisionFactGuard {
  readonly lifecycleTerminal: boolean;
  readonly supervisorStopped: boolean;
}

export interface SupervisionFactFailure {
  readonly reason: 'supervision-event-log-unavailable' | 'post-terminal-core-04-fact-forbidden' | 'supervisor-stopped';
  readonly appendFailure?: RunAppendFailure;
}

export interface SupervisionFactCommit<TPayload> {
  readonly payload: TPayload;
  readonly eventId: string;
  readonly appendReceipt: RunAppendReceipt;
}

export type SupervisionFactWriter = {
  readonly append: (batch: AppendIntent[]) => Result<RunAppendReceipt, RunAppendFailure>;
};

export type StartSupervisorInput = Omit<SupervisorStartedPayload, 'schema'> & {
  readonly guard?: SupervisionFactGuard;
};

export type RecordLivenessAdvancedInput = Omit<LivenessAdvancedPayload, 'schema'> & {
  readonly guard?: SupervisionFactGuard;
};

export type RecordTimerExpiredInput = Omit<LivenessTimerExpiredPayload, 'schema'> & {
  readonly guard?: SupervisionFactGuard;
};

export type RecordLivenessStateChangedInput = Omit<LivenessStateChangedPayload, 'schema'> & {
  readonly guard?: SupervisionFactGuard;
};

export type RecordSupervisionLostInput = Omit<SupervisionLostPayload, 'schema'> & {
  readonly guard?: SupervisionFactGuard;
};

export interface RequestWorkerTerminationInput {
  readonly runId: string;
  readonly reason: LivenessReason;
  readonly requestedAt: string;
  readonly timerEventId: string;
  readonly sourceEventIds: readonly string[];
  readonly workerHandle?: WorkerHandle;
  readonly terminationPolicy: TerminationPolicy;
  readonly canKill?: CapabilityAttestation<'canKill'>;
  readonly guard?: SupervisionFactGuard;
}

export type TerminationHost = Pick<ExecutionHostProvider, 'terminateWorker'>;

export interface RequestWorkerTerminationCommit {
  readonly terminationRequested?: SupervisionFactCommit<SupervisorTerminationRequestedPayload>;
  readonly supervisionLost?: SupervisionFactCommit<SupervisionLostPayload>;
  readonly hostResult?: TerminationResult;
}

export type RecordWorkerTerminatedInput = Omit<WorkerTerminatedPayload, 'schema'> & {
  readonly guard?: SupervisionFactGuard;
};

export type StopSupervisorInput = Omit<SupervisorStoppedPayload, 'schema'> & {
  readonly guard?: SupervisionFactGuard;
  readonly workerTerminated?: Omit<WorkerTerminatedPayload, 'schema'>;
};

export interface StopSupervisorCommit {
  readonly workerTerminated?: SupervisionFactCommit<WorkerTerminatedPayload>;
  readonly supervisorStopped: SupervisionFactCommit<SupervisorStoppedPayload>;
  readonly appendReceipt: RunAppendReceipt;
}

export type StartSupervisorResult = Result<SupervisionFactCommit<SupervisorStartedPayload>, SupervisionFactFailure>;
export type RecordLivenessAdvancedResult = Result<
  SupervisionFactCommit<LivenessAdvancedPayload>,
  SupervisionFactFailure
>;
export type RecordTimerExpiredResult = Result<
  SupervisionFactCommit<LivenessTimerExpiredPayload>,
  SupervisionFactFailure
>;
export type RecordLivenessStateChangedResult = Result<
  SupervisionFactCommit<LivenessStateChangedPayload>,
  SupervisionFactFailure
>;
export type RecordSupervisionLostResult = Result<SupervisionFactCommit<SupervisionLostPayload>, SupervisionFactFailure>;
export type RequestWorkerTerminationResult = Result<RequestWorkerTerminationCommit, SupervisionFactFailure>;
export type RecordWorkerTerminatedResult = Result<
  SupervisionFactCommit<WorkerTerminatedPayload>,
  SupervisionFactFailure
>;
export type StopSupervisorResult = Result<StopSupervisorCommit, SupervisionFactFailure>;

export type SupervisorStartedCursor = RunEventCursor;
