import type { AgentEvent } from '../../../providers/agent/index.js';
import type { ExecutionHostProvider } from '../../../providers/execution-host/index.js';
import type { RunEventCursor, RunEventLog } from '../../run-lifecycle/contracts/index.js';

export interface Clock {
  (): string;
}

export interface SupervisionTimerPolicy {
  readonly startupMs: number;
  readonly idleMs: number;
  readonly noProgressMs: number;
  readonly perToolMs: number;
  readonly approvalSlaMs: number;
  readonly maxRuntimeMs: number;
}

export interface SupervisionInputs {
  readonly runLog: RunEventLog;
  readonly agentEvents: AsyncIterable<AgentEvent>;
  readonly host: ExecutionHostProvider;
  readonly clock: Clock;
  readonly timers: SupervisionTimerPolicy;
}

export interface SupervisionWaitRequest {
  readonly runId: string;
  readonly cursor: RunEventCursor;
  readonly timeoutMs: number;
  readonly maxEvents?: number;
}
