import type { CreateRunInput } from '../../../src/index.js';

/**
 * AC-1 — `CreateRunInput` declares a top-level required `requestedBy: string`.
 *
 * This file is compiled by the `type:fixtures` lane (via the sibling
 * `tsconfig.public.json`); the `@ts-expect-error` line fails the lane if
 * `requestedBy` is missing from `CreateRunInput` or made optional.
 */

// Positive: constructing CreateRunInput with top-level requestedBy must compile with zero tsc errors.
export const validInput: CreateRunInput = {
  runId: 'run-type-test',
  holder: 'holder-1',
  leaseTtlMs: 30_000,
  idempotencyKey: 'idem-type',
  createdAt: '2026-06-25T00:00:00.000Z',
  requestedBy: 'alice',
  payload: {
    idempotencyKey: 'idem-type',
    requestedBy: 'alice',
  },
};

// Confirm the top-level field is accessible.
export const requestedByValue: string = validInput.requestedBy;

// Negative: omitting the required top-level requestedBy must fail to compile.
// @ts-expect-error — requestedBy is required on CreateRunInput; omitting it must fail to compile
export const missingRequestedBy: CreateRunInput = {
  runId: 'run-type-test',
  holder: 'holder-1',
  leaseTtlMs: 30_000,
  idempotencyKey: 'idem-type',
  createdAt: '2026-06-25T00:00:00.000Z',
  payload: {
    idempotencyKey: 'idem-type',
    requestedBy: 'alice',
  },
};
