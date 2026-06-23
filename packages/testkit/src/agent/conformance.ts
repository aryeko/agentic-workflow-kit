import type {
  AgentCapability,
  AgentEvent,
  AgentFailureReason,
  AgentProvider,
  AgentResumeRequest,
  AgentStartRequest,
  ApprovalAnswer,
  CapabilityAttestation,
} from 'sdk';

import { conformanceResult, failCheck, passCheck, type ConformanceResult } from '../conformance/index.js';

export type AgentConformanceResult = ConformanceResult<AgentFailureReason>;

export interface AgentConformanceSubject {
  readonly provider: AgentProvider;
  readonly probeScope: Parameters<AgentProvider['probeCapabilities']>[0];
  readonly startRequest: AgentStartRequest;
  readonly approvalAnswer: ApprovalAnswer;
}

const requiredCapabilities: readonly AgentCapability[] = [
  'emitsStructuredToolExit',
  'emitsGuardianReview',
  'canRelayApproval',
  'canPersistApprovalAnswerChannel',
  'canResumeOwned',
  'preservesHostProcessParentage',
];

interface CollectedAgentEvents {
  readonly events: readonly AgentEvent[];
  readonly approvalResult?: ReturnType<AgentProvider['answerApproval']>;
}

const collectEvents = async (
  subject: AgentConformanceSubject,
  session: Exclude<ReturnType<AgentProvider['startWorker']>, { readonly reason: AgentFailureReason }>,
): Promise<CollectedAgentEvents> => {
  const collected: AgentEvent[] = [];
  let approvalResult: ReturnType<AgentProvider['answerApproval']> | undefined;
  for await (const event of subject.provider.observe(session)) {
    collected.push(event);
    if (
      event.type === 'approval-requested' &&
      approvalResult === undefined &&
      event.request.requestId === subject.approvalAnswer.requestId
    ) {
      approvalResult = subject.provider.answerApproval(session, subject.approvalAnswer);
    }
  }

  return approvalResult === undefined ? { events: collected } : { events: collected, approvalResult };
};

const isFreshPositive = (
  attestations: readonly CapabilityAttestation<AgentCapability>[],
  capability: AgentCapability,
  freshnessKey: string,
  at: string,
): boolean =>
  attestations.some(
    (attestation) =>
      attestation.capability === capability &&
      attestation.result === 'positive' &&
      attestation.freshnessKey === freshnessKey &&
      Date.parse(attestation.expiry) > Date.parse(at),
  );

const eventFailureReasons = (events: readonly AgentEvent[]): readonly AgentFailureReason[] =>
  events.flatMap((event) => (event.type === 'degraded' ? [event.failure.reason] : []));

const hasUsableToolEvent = (events: readonly AgentEvent[]): boolean =>
  events.some(
    (event) =>
      event.type === 'tool-observed' &&
      event.tool.exitCode !== undefined &&
      event.tool.outputRef.length > 0 &&
      event.tool.outputDigest.length > 0 &&
      event.tool.source === 'agent',
  );

const hasStableGuardianReview = (events: readonly AgentEvent[]): boolean =>
  events.some(
    (event) =>
      event.type === 'guardian-review' &&
      event.review.stable &&
      event.review.reviewId.length > 0 &&
      event.review.targetItemId !== undefined,
  );

export const agentConformance = async (subject: AgentConformanceSubject): Promise<AgentConformanceResult> => {
  const attestations = subject.provider.probeCapabilities(subject.probeScope);
  const capabilityChecks = requiredCapabilities.map((capability) =>
    isFreshPositive(attestations, capability, subject.probeScope.freshnessKey, subject.probeScope.at)
      ? passCheck<AgentFailureReason>(`capability:${capability}`)
      : failCheck('capability:fresh-positive', 'agent-capability-unattested', `${capability} is not fresh-positive.`),
  );
  const session = subject.provider.startWorker(subject.startRequest);
  if ('reason' in session) {
    return conformanceResult([
      ...capabilityChecks,
      failCheck('startWorker', session.reason, 'startWorker returned an AgentFailure.'),
    ]);
  }

  const collected = await collectEvents(subject, session);
  const events = collected.events;
  const failures = eventFailureReasons(events);
  const approvalEvent = events.find((event) => event.type === 'approval-requested');
  const resumeRequest: AgentResumeRequest = {
    providerSessionId: session.providerSessionId,
    runId: subject.startRequest.runId,
    operationId: `${subject.startRequest.operationId}-resume`,
    ownershipClass: 'owned',
    hostWorker: subject.startRequest.hostWorker,
  };
  const resumed = subject.provider.resumeOwned(resumeRequest);
  const terminalReasons = events.flatMap((event) => (event.type === 'terminal' ? [event.reason] : []));

  return conformanceResult([
    ...capabilityChecks,
    failures.includes('structured-tool-exit-missing') || failures.includes('tool-output-ref-missing')
      ? failCheck('structured-tool-exit', 'structured-tool-exit-missing', 'Provider emitted a broken tool event.')
      : hasUsableToolEvent(events)
        ? passCheck('structured-tool-exit')
        : failCheck('structured-tool-exit', 'tool-output-ref-missing', 'No usable tool observation was emitted.'),
    failures.includes('guardian-review-untrusted')
      ? failCheck('guardian-review', 'guardian-review-untrusted', 'Guardian review was unstable or incomplete.')
      : hasStableGuardianReview(events)
        ? passCheck('guardian-review')
        : failCheck('guardian-review', 'guardian-review-untrusted', 'No stable guardian review was emitted.'),
    approvalEvent === undefined
      ? failCheck('approval-relay', 'approval-relay-unattested', 'No approval request was relayed.')
      : passCheck('approval-relay'),
    collected.approvalResult?.delivered === true && collected.approvalResult.persisted
      ? passCheck('approval-answer-channel')
      : failCheck('approval-answer-channel', 'approval-answer-channel-lost', 'Approval answer was not persisted.'),
    'reason' in resumed
      ? failCheck('resume-owned', 'agent-resume-unattested', resumed.message)
      : passCheck('resume-owned'),
    session.hostWorkerHandleId === subject.startRequest.hostWorker.handleId
      ? passCheck('host-parentage')
      : failCheck('host-parentage', 'host-parentage-unproven', 'Session did not preserve host worker parentage.'),
    terminalReasons.includes('provider-lost') || terminalReasons.includes('host-lost')
      ? failCheck('terminal-reason', 'agent-terminal-ambiguous', 'Terminal reason is provider/host lost.')
      : passCheck('terminal-reason'),
  ]);
};
