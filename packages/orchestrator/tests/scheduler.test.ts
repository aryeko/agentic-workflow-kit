import { describe, expect, it } from 'vitest';
import { isCompleteStatus, selectDispatchableStories } from '../src/scheduler/scheduler';
import type { WorkflowStory } from '../src/types';

function story(id: string, eligible: boolean, status = 'specced'): WorkflowStory {
  return {
    id,
    title: id,
    status,
    owner: null,
    dependencies: [],
    eligible,
    blockedReason: eligible ? null : 'blocked',
    metadata: { trackId: 't', trackTitle: 'T', trackerPath: 'docs/tracks/t/README.md', order: 1 },
  };
}

describe('selectDispatchableStories', () => {
  it('selects eligible non-active stories up to available slots', () => {
    expect(
      selectDispatchableStories([story('A001', true), story('A002', true), story('A003', false)], {
        maxParallel: 2,
        activeIds: new Set(['A001']),
      }).map((entry) => entry.id),
    ).toEqual(['A002']);
  });

  it('returns no stories when active children fill all slots', () => {
    expect(
      selectDispatchableStories([story('A001', true), story('A002', true)], {
        maxParallel: 1,
        activeIds: new Set(['A001']),
      }),
    ).toEqual([]);
  });
});

describe('isCompleteStatus', () => {
  it('checks configured complete statuses', () => {
    expect(isCompleteStatus('done', ['done', 'verified'])).toBe(true);
    expect(isCompleteStatus('specced', ['done', 'verified'])).toBe(false);
    expect(isCompleteStatus(undefined, ['done'])).toBe(false);
  });
});
