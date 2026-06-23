import type { HostObservation } from '../../../src/index.js';

import {
  hostFailureObservationFixture,
  outputObservationFixture,
  processExitObservationFixture,
  structuredToolExitObservationFixture,
} from './fixtures/shared.js';

const outputObservation = outputObservationFixture() satisfies Extract<HostObservation, { type: 'output' }>;
const structuredToolExitObservation = structuredToolExitObservationFixture() satisfies Extract<
  HostObservation,
  { type: 'structured-tool-exit' }
>;
const processExitObservation = processExitObservationFixture() satisfies Extract<
  HostObservation,
  { type: 'process-exit' }
>;
const hostFailureObservation = hostFailureObservationFixture('host-observation-incomplete') satisfies Extract<
  HostObservation,
  { type: 'host-failure' }
>;

void outputObservation;
void structuredToolExitObservation;
void processExitObservation;
void hostFailureObservation;

const invalidOutputObservation: HostObservation = {
  type: 'output',
  handleId: 'worker-handle-01',
  stream: 'stdout',
  outputRef: 'artifact://worker-output',
  digest: 'output-digest-01',
  // @ts-expect-error AC-4 output observations require redactionApplied: true.
  redactionApplied: false,
  at: '2026-06-22T10:02:00.000Z',
};

// @ts-expect-error AC-4 host-failure observations require a HostFailure payload.
const invalidHostFailureObservation: HostObservation = {
  type: 'host-failure',
  handleId: 'worker-handle-01',
  at: '2026-06-22T10:07:00.000Z',
};

void invalidOutputObservation;
void invalidHostFailureObservation;
