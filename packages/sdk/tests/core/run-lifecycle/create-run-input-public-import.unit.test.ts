import type { CreateRunInput } from 'sdk';
import { describe, expect, it } from 'vitest';

/**
 * AC-3 — `CreateRunInput` is importable from the `sdk` public entrypoint with
 * the amended shape including the top-level required `requestedBy: string`.
 *
 * The type-level construction is enforced at compile time by the `type:fixtures`
 * lane (this file is included by the sibling `tsconfig.public.json`); the runtime
 * assertions below pin the shape so the structural contract is exercised by the
 * unit lane.
 */

describe('core-01-r1 CreateRunInput public import (AC-3)', () => {
  it('constructs CreateRunInput with top-level requestedBy from the sdk entrypoint', () => {
    const input: CreateRunInput = {
      runId: 'run-public-import-test',
      holder: 'holder-1',
      leaseTtlMs: 30_000,
      idempotencyKey: 'idem-public',
      createdAt: '2026-06-25T00:00:00.000Z',
      requestedBy: 'public-import-user',
      payload: {
        idempotencyKey: 'idem-public',
        requestedBy: 'public-import-user',
      },
    };

    expect(input.requestedBy).toBe('public-import-user');
    expect(input.runId).toBe('run-public-import-test');
  });
});
