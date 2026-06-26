import { describe, expect, it } from 'vitest';

import { recordApprovalPending } from '../../../../src/core/approval/pending/index.js';

import { createRequest, createWriter, decisionDeadline, requestedAt } from './fixtures.js';

describe('approval deadline', () => {
  it('uses explicit request expiresAt when present', async () => {
    const writer = createWriter();

    await recordApprovalPending(
      { request: createRequest({ expiresAt: '2026-06-23T10:07:00.000Z' }), recordedAt: requestedAt },
      writer,
    );

    expect(writer.appendCalls[0]?.[1]?.payload).toMatchObject({ decisionDeadline: '2026-06-23T10:07:00.000Z' });
  });

  it('uses the default 900000 ms approval window when no policy window is supplied', async () => {
    const writer = createWriter();

    await recordApprovalPending({ request: createRequest(), recordedAt: requestedAt }, writer);

    expect(writer.appendCalls[0]?.[1]?.payload).toMatchObject({ decisionDeadline });
  });

  it('preserves the caller timestamp when requestedAt is malformed', async () => {
    const writer = createWriter();

    await recordApprovalPending(
      { request: createRequest({ requestedAt: 'not-a-timestamp' }), recordedAt: requestedAt },
      writer,
    );

    expect(writer.appendCalls[0]?.[1]?.payload).toMatchObject({ decisionDeadline: 'not-a-timestamp' });
  });
});
