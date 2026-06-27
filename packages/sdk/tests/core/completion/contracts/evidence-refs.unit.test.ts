import { describe, expect, it } from 'vitest';

import { dedupeEvidenceEventRefs } from '../../../../src/core/completion/contracts/evidence-refs.js';

describe('core-05-s2 evidence ref helpers', () => {
  it('dedupes evidence refs by event id while preserving the first-seen order', () => {
    const first = {
      eventId: 'evt-a',
      sequence: 3,
      payloadDigest: 'sha256:a-1',
      type: 'RunnerCommandCaptured',
    } as const;
    const second = {
      eventId: 'evt-b',
      sequence: 4,
      payloadDigest: 'sha256:b',
      type: 'LocalGitEvidenceRecorded',
    } as const;
    const duplicate = {
      eventId: 'evt-a',
      sequence: 3,
      payloadDigest: 'sha256:a-2',
      type: 'RunnerCommandCaptured',
    } as const;

    expect(dedupeEvidenceEventRefs([first, second, duplicate])).toEqual([first, second]);
    expect(dedupeEvidenceEventRefs(undefined)).toEqual([]);
  });
});
