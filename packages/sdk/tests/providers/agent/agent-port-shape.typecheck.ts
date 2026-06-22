import type { AgentFailure, AgentProvider, AgentSession } from '../../../src/index.js';

import { agentFailureFixture, agentProviderFixture, agentSessionFixture } from './fixtures/shared.js';

const validProvider = agentProviderFixture() satisfies AgentProvider;

void validProvider;

// @ts-expect-error AC-prov-01 requires stopObserving.
const missingStopObserving: AgentProvider = {
  probeCapabilities: validProvider.probeCapabilities,
  startWorker: validProvider.startWorker,
  observe: validProvider.observe,
  answerApproval: validProvider.answerApproval,
  resumeOwned: validProvider.resumeOwned,
};

const wrongObserveReturn: AgentProvider = {
  ...validProvider,
  // @ts-expect-error AC-prov-01 observe must return AsyncIterable<AgentEvent>, not AgentSession.
  observe: () => agentSessionFixture() as AgentSession,
};

const wrongStopReturn: AgentProvider = {
  ...validProvider,
  // @ts-expect-error AC-prov-01 stopObserving must return AgentReleaseResult, not AgentFailure.
  stopObserving: () => agentFailureFixture('agent-linkage-lost') as AgentFailure,
};

void missingStopObserving;
void wrongObserveReturn;
void wrongStopReturn;
