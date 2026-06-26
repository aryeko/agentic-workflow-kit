import type { LivenessTimerEvidence } from '../liveness/index.js';
import type {
  LivenessProjection,
  LivenessTimerExpiredPayload,
  SupervisionTimerName,
  SupervisionTimerPolicy,
} from '../contracts/index.js';

export interface EvaluateSupervisionTimersInput {
  readonly projection: LivenessProjection;
  readonly sampledAt: string;
  readonly timerPolicy?: SupervisionTimerPolicy;
  readonly timerEvidence?: Readonly<Partial<Record<SupervisionTimerName, LivenessTimerEvidence>>>;
}

export interface SupervisionTimerStatus {
  readonly armed: boolean;
  readonly deadline: string;
  readonly exceeded: boolean;
}

export interface SupervisionTimerEvaluation {
  readonly policy: SupervisionTimerPolicy;
  readonly timers: Readonly<Record<SupervisionTimerName, SupervisionTimerStatus>>;
  readonly expired: readonly LivenessTimerExpiredPayload[];
}
