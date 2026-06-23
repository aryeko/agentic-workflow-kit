import type { EvidenceEventRef, RunEventEnvelope, RunReplay } from '../../run-lifecycle/contracts/index.js';

import type { TerminalAnalysisInvariantResult } from './types.js';

const TERMINAL_STATES = new Set(['completed', 'failed', 'canceled']);
const USABLE_REPLAY_HEALTH = new Set(['ok', 'tail-repaired']);
const ANALYSIS_EVENT_TYPES = new Set(['AnalysisRecorded', 'AnalysisFailed']);

const toEventRef = (event: RunEventEnvelope): EvidenceEventRef => ({
  eventId: event.eventId,
  sequence: event.sequence,
  payloadDigest: event.payloadDigest,
  type: event.type,
});

const isTerminalLifecycleEvent = (event: RunEventEnvelope): boolean => {
  if (event.type !== 'RunLifecycleTransitioned') {
    return false;
  }

  const payload = event.payload as { readonly to?: string; readonly terminal?: boolean };
  return payload.terminal === true || (payload.to !== undefined && TERMINAL_STATES.has(payload.to));
};

export const checkTerminalAnalysisInvariant = (
  replay: RunReplay,
  options: { readonly logWritable?: boolean } = {},
): TerminalAnalysisInvariantResult => {
  const terminalEvent = replay.events
    .filter(isTerminalLifecycleEvent)
    .sort((left, right) => right.sequence - left.sequence)[0];

  if (terminalEvent === undefined) {
    return { status: 'not-terminal' };
  }

  const terminalEventRef = toEventRef(terminalEvent);
  if (!USABLE_REPLAY_HEALTH.has(replay.health) || options.logWritable === false) {
    return { status: 'unmet', reason: 'analysis-record-unwritable', terminalEventRef };
  }

  const analysisEvent = replay.events.find(
    (event) => event.sequence >= terminalEvent.sequence && ANALYSIS_EVENT_TYPES.has(event.type),
  );

  if (analysisEvent === undefined) {
    return { status: 'unmet', reason: 'analysis-invariant-missing', terminalEventRef };
  }

  return { status: 'satisfied', eventRef: toEventRef(analysisEvent) };
};
