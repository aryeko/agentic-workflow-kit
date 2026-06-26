import type { RunEventEnvelope } from '../../run-lifecycle/contracts/index.js';
import type { LivenessAdvanceClass, LivenessAdvancedPayload, SupervisionTimerName } from '../contracts/index.js';

type SessionLinkPayload = {
  readonly sessionId: string;
};

type AgentSessionLinkedPayload = {
  readonly sessionId: string;
  readonly hostWorkerHandleId?: string;
};

type AgentProgressObservedPayload = {
  readonly sessionId: string;
  readonly itemId?: string;
};

type AgentApprovalRequestedPayload = {
  readonly sessionId: string;
  readonly request?: {
    readonly answerChannel?: {
      readonly channelRef?: string;
    };
  };
};

type AgentToolObservedPayload = {
  readonly sessionId: string;
  readonly tool?: {
    readonly itemId?: string;
    readonly exitCode?: number;
    readonly outputRef?: string;
  };
};

type AgentSessionTerminalPayload = {
  readonly sessionId: string;
};

type WorkerProcessExitedPayload = {
  readonly handleId: string;
};

export interface LivenessAdvanceContext {
  readonly currentSessionId?: string;
  readonly linkage: 'known' | 'unknown' | 'ambiguous';
  readonly linkedSessionIds: ReadonlySet<string>;
  readonly stableToolItemIds: ReadonlySet<string>;
  readonly currentWorkerHandleId?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object');

const hasString = <TKey extends string>(value: Record<string, unknown>, key: TKey): value is Record<TKey, string> =>
  typeof value[key] === 'string';

export const isSessionLinkedPayload = (value: unknown): value is SessionLinkPayload =>
  isRecord(value) && hasString(value, 'sessionId');

export const isAgentSessionLinkedPayload = (value: unknown): value is AgentSessionLinkedPayload =>
  isRecord(value) && hasString(value, 'sessionId');

export const isAgentProgressObservedPayload = (value: unknown): value is AgentProgressObservedPayload =>
  isRecord(value) && hasString(value, 'sessionId');

export const isAgentApprovalRequestedPayload = (value: unknown): value is AgentApprovalRequestedPayload =>
  isRecord(value) && hasString(value, 'sessionId');

export const isAgentToolObservedPayload = (value: unknown): value is AgentToolObservedPayload =>
  isRecord(value) && hasString(value, 'sessionId');

export const isAgentSessionTerminalPayload = (value: unknown): value is AgentSessionTerminalPayload =>
  isRecord(value) && hasString(value, 'sessionId');

export const isWorkerProcessExitedPayload = (value: unknown): value is WorkerProcessExitedPayload =>
  isRecord(value) && hasString(value, 'handleId');

const getAnswerChannelRef = (payload: AgentApprovalRequestedPayload): string | undefined => {
  return isRecord(payload.request?.answerChannel) && typeof payload.request.answerChannel.channelRef === 'string'
    ? payload.request.answerChannel.channelRef
    : undefined;
};

const getToolObservation = (
  payload: AgentToolObservedPayload,
): {
  readonly itemId?: string;
  readonly exitCode?: number;
  readonly outputRef?: string;
} => {
  return {
    itemId: isRecord(payload.tool) && typeof payload.tool.itemId === 'string' ? payload.tool.itemId : undefined,
    exitCode: isRecord(payload.tool) && typeof payload.tool.exitCode === 'number' ? payload.tool.exitCode : undefined,
    outputRef:
      isRecord(payload.tool) && typeof payload.tool.outputRef === 'string' ? payload.tool.outputRef : undefined,
  };
};

const createAdvance = (
  event: RunEventEnvelope,
  sessionId: string,
  advanceClass: LivenessAdvanceClass,
  refreshedTimers: readonly SupervisionTimerName[],
  workerHandleId?: string,
): LivenessAdvancedPayload => ({
  schema: 'kit-vnext.liveness-advanced.v1',
  runId: event.runId,
  sessionId,
  workerHandleId,
  sourceEventId: event.eventId,
  sourceSequence: event.sequence,
  advanceClass,
  refreshedTimers,
  advancedAt: event.occurredAt,
});

export function classifyLivenessAdvance(
  event: RunEventEnvelope,
  context: LivenessAdvanceContext,
): LivenessAdvancedPayload | undefined {
  switch (event.type) {
    case 'AgentSessionLinked': {
      if (!isAgentSessionLinkedPayload(event.payload) || context.linkage !== 'known' || !context.currentSessionId) {
        return undefined;
      }

      if (
        event.payload.sessionId !== context.currentSessionId ||
        !context.linkedSessionIds.has(event.payload.sessionId)
      ) {
        return undefined;
      }

      const workerHandleId =
        typeof event.payload.hostWorkerHandleId === 'string'
          ? event.payload.hostWorkerHandleId
          : context.currentWorkerHandleId;

      return createAdvance(event, event.payload.sessionId, 'startup-linkage', ['idle'], workerHandleId);
    }
    case 'AgentProgressObserved': {
      if (!isAgentProgressObservedPayload(event.payload) || event.payload.sessionId !== context.currentSessionId) {
        return undefined;
      }

      return createAdvance(
        event,
        event.payload.sessionId,
        'worker-progress',
        ['idle', 'no-progress'],
        context.currentWorkerHandleId,
      );
    }
    case 'AgentApprovalRequested': {
      if (!isAgentApprovalRequestedPayload(event.payload) || event.payload.sessionId !== context.currentSessionId) {
        return undefined;
      }

      if (getAnswerChannelRef(event.payload) === undefined) {
        return undefined;
      }

      return createAdvance(
        event,
        event.payload.sessionId,
        'approval-request',
        ['idle', 'approval-SLA'],
        context.currentWorkerHandleId,
      );
    }
    case 'AgentToolObserved': {
      if (!isAgentToolObservedPayload(event.payload) || event.payload.sessionId !== context.currentSessionId) {
        return undefined;
      }

      const observation = getToolObservation(event.payload);
      if (
        observation.exitCode === undefined ||
        observation.outputRef === undefined ||
        observation.itemId === undefined ||
        !context.stableToolItemIds.has(observation.itemId)
      ) {
        return undefined;
      }

      return createAdvance(
        event,
        event.payload.sessionId,
        'tool-completion',
        ['idle', 'no-progress'],
        context.currentWorkerHandleId,
      );
    }
    case 'AgentSessionTerminal': {
      if (!isAgentSessionTerminalPayload(event.payload) || event.payload.sessionId !== context.currentSessionId) {
        return undefined;
      }

      return createAdvance(event, event.payload.sessionId, 'terminal-observation', [], context.currentWorkerHandleId);
    }
    case 'WorkerProcessExited': {
      if (!isWorkerProcessExitedPayload(event.payload) || !context.currentWorkerHandleId) {
        return undefined;
      }

      if (event.payload.handleId !== context.currentWorkerHandleId || !context.currentSessionId) {
        return undefined;
      }

      return createAdvance(event, context.currentSessionId, 'terminal-observation', [], context.currentWorkerHandleId);
    }
    default:
      return undefined;
  }
}

export function isLivenessRefreshingEvent(event: RunEventEnvelope, context: LivenessAdvanceContext): boolean {
  return classifyLivenessAdvance(event, context) !== undefined;
}

export const toolObservationForClassification = getToolObservation;
export const approvalChannelRefForClassification = getAnswerChannelRef;
