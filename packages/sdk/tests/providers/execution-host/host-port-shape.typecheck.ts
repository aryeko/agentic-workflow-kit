import type { ExecutionHostProvider, HostFailure } from '../../../src/index.js';

import { executionHostProviderFixture, hostFailureFixture } from './fixtures/shared.js';

const validProvider = executionHostProviderFixture() satisfies ExecutionHostProvider;

void validProvider;

// @ts-expect-error AC-1 requires observeWorker.
const missingObserveWorker: ExecutionHostProvider = {
  probeCapabilities: validProvider.probeCapabilities,
  attachWorkspace: validProvider.attachWorkspace,
  spawnWorker: validProvider.spawnWorker,
  terminateWorker: validProvider.terminateWorker,
  runCommand: validProvider.runCommand,
  releaseWorkspace: validProvider.releaseWorkspace,
};

const wrongTerminateReturn: ExecutionHostProvider = {
  ...validProvider,
  // @ts-expect-error AC-1 terminateWorker must return TerminationResult, not HostFailure.
  terminateWorker: () => hostFailureFixture('termination-unproven') as HostFailure,
};

void missingObserveWorker;
void wrongTerminateReturn;
