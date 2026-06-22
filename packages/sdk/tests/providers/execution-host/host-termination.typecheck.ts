import type { ExecutionHostProvider, HostFailure, HostObservation, TerminationResult } from '../../../src/index.js';

import { hostFailureFixture, terminationResultFixture } from './fixtures/shared.js';
import { terminationUnprovenObservation, terminationUnprovenResult } from './fixtures/termination-unproven.fixture.js';

const result = terminationResultFixture() satisfies TerminationResult;
const degradedResult = terminationUnprovenResult satisfies TerminationResult;
const degradedObservation = terminationUnprovenObservation satisfies Extract<HostObservation, { type: 'host-failure' }>;

type TerminateWorkerReturn = ReturnType<ExecutionHostProvider['terminateWorker']>;

void result;
void degradedResult;
void degradedObservation;

// @ts-expect-error AC-6 terminateWorker cannot return HostFailure.
const terminateWorkerFailure: TerminateWorkerReturn = hostFailureFixture('termination-unproven') as HostFailure;

// @ts-expect-error AC-6 TerminationResult requires proof.
const terminationResultWithoutProof: TerminationResult = {
  handleId: 'worker-handle-01',
};

void terminateWorkerFailure;
void terminationResultWithoutProof;
