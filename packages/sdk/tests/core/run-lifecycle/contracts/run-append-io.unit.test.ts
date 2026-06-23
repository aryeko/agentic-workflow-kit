import { describe, expect, it } from 'vitest';

import type {
  AppendIntent,
  CreateRunInput,
  RunAppendReceipt,
  RunLifecycleTransitionPayload,
} from '../../../../src/index.js';

import { appendIntentFixture, createRunInputFixture, runAppendReceiptFixture } from './fixtures.js';

describe('core-01-s1 append input and receipt types', () => {
  it('constructs create input, append intent, and append receipt fixtures', () => {
    const createRunInput: CreateRunInput = createRunInputFixture;
    const appendIntent: AppendIntent<RunLifecycleTransitionPayload> = appendIntentFixture;
    const receipt: RunAppendReceipt = runAppendReceiptFixture;

    expect(createRunInput.payload.requestedBy).toBe('runner');
    expect(appendIntent.durability).toBe('barrier');
    expect(receipt.frameDigest).toBe('sha256:frame-2');
  });
});
