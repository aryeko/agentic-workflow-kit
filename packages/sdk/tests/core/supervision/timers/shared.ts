import { foldLiveness } from '../../../../src/core/supervision/liveness/index.js';
import type { RunEventEnvelope, RunLifecycleTransitionPayload, SupervisionTimerPolicy } from '../../../../src/index.js';

export const runId = 'run-supervision-timers-01';

export const defaultPolicy: SupervisionTimerPolicy = {
  startupMs: 120_000,
  idleMs: 15 * 60_000,
  noProgressMs: 45 * 60_000,
  perToolMs: 30 * 60_000,
  approvalSlaMs: 24 * 60 * 60_000,
  maxRuntimeMs: 8 * 60 * 60_000,
};

type EventOverrides<TPayload> = Partial<
  Omit<
    RunEventEnvelope<TPayload>,
    | 'schema'
    | 'runId'
    | 'eventId'
    | 'sequence'
    | 'writerEpoch'
    | 'type'
    | 'domain'
    | 'durability'
    | 'occurredAt'
    | 'recordedAt'
    | 'payloadDigest'
    | 'payload'
  >
>;

export function makeEnvelope<TPayload>(
  sequence: number,
  type: string,
  payload: TPayload,
  overrides?: EventOverrides<TPayload> & {
    readonly domain?: string;
    readonly durability?: 'durable' | 'barrier';
    readonly occurredAt?: string;
  },
): RunEventEnvelope<TPayload> {
  const seconds = String(sequence).padStart(2, '0');
  const occurredAt = overrides?.occurredAt ?? `2026-06-25T10:00:${seconds}.000Z`;

  return {
    schema: 'kit-vnext.run-event.v1',
    runId,
    eventId: `evt-${type}-${sequence}`,
    sequence,
    writerEpoch: 1,
    domain: overrides?.domain ?? 'core-04-test',
    type,
    durability: overrides?.durability ?? 'durable',
    occurredAt,
    recordedAt: occurredAt,
    payloadDigest: `sha256:${type}-${sequence}`,
    payload,
    ...(overrides?.artifactRefs ? { artifactRefs: overrides.artifactRefs } : {}),
  };
}

export function makeLifecycle(
  sequence: number,
  to: RunLifecycleTransitionPayload['to'],
  from: RunLifecycleTransitionPayload['from'],
): RunEventEnvelope<RunLifecycleTransitionPayload> {
  return makeEnvelope(
    sequence,
    'RunLifecycleTransitioned',
    {
      from,
      to,
      reason: `${String(from)}->${to}`,
      authority: 'system',
      sourceEventIds: [`evidence:${to}`],
      terminal: to === 'completed' || to === 'blocked' || to === 'failed' || to === 'canceled',
    },
    { domain: 'core-01' },
  );
}

export const sessionLinked = (sequence: number, sessionId = 'session-01') =>
  makeEnvelope(
    sequence,
    'SessionLinked',
    {
      linkOrdinal: sequence,
      sessionId,
      linkRole: 'primary',
      startedAt: `2026-06-25T10:00:${String(sequence).padStart(2, '0')}.000Z`,
      sourceEventId: `source-session-${sequence}`,
    },
    { domain: 'core-01', durability: 'barrier' },
  );

export const agentSessionLinked = (sequence: number, sessionId = 'session-01', workerHandleId = 'worker-01') =>
  makeEnvelope(
    sequence,
    'AgentSessionLinked',
    {
      sessionId,
      hostWorkerHandleId: workerHandleId,
    },
    { domain: 'Agent' },
  );

export const progressObserved = (sequence: number, sessionId = 'session-01', itemId?: string) =>
  makeEnvelope(sequence, 'AgentProgressObserved', { sessionId, ...(itemId ? { itemId } : {}) }, { domain: 'Agent' });

export const approvalRequested = (sequence: number, sessionId = 'session-01', channelRef = 'approval-channel-01') =>
  makeEnvelope(
    sequence,
    'AgentApprovalRequested',
    {
      sessionId,
      request: {
        answerChannel: {
          channelRef,
        },
      },
    },
    { domain: 'Agent' },
  );

export const approvalAnswered = (sequence: number, sessionId = 'session-01') =>
  makeEnvelope(
    sequence,
    'AgentApprovalAnswered',
    { sessionId, answerChannelRef: 'approval-channel-01' },
    { domain: 'Agent' },
  );

export const toolObserved = (
  sequence: number,
  sessionId = 'session-01',
  itemId?: string,
  exitCode = 0,
  outputRef = 'artifact-tool-01',
) =>
  makeEnvelope(
    sequence,
    'AgentToolObserved',
    {
      sessionId,
      tool: {
        ...(itemId ? { itemId } : {}),
        exitCode,
        outputRef,
      },
    },
    { domain: 'Agent' },
  );

export const agentTerminal = (sequence: number, sessionId = 'session-01') =>
  makeEnvelope(sequence, 'AgentSessionTerminal', { sessionId, reason: 'completed' }, { domain: 'Agent' });

export const workerSpawned = (sequence: number, workerHandleId = 'worker-01') =>
  makeEnvelope(sequence, 'WorkerSpawned', { handleId: workerHandleId }, { domain: 'Execution Host' });

export const workerExited = (sequence: number, workerHandleId = 'worker-01') =>
  makeEnvelope(
    sequence,
    'WorkerProcessExited',
    { handleId: workerHandleId, exitCode: 0 },
    { domain: 'Execution Host' },
  );

export const inertEvent = (sequence: number, type: string) =>
  makeEnvelope(sequence, type, { ignored: true }, { domain: 'inert-domain' });

export function fold(events: readonly RunEventEnvelope[], sampledAt = '2026-06-25T10:30:00.000Z') {
  return foldLiveness({
    runId,
    events,
    sampledAt,
    timerPolicy: defaultPolicy,
  });
}
