import { describe, expect, it } from 'vitest';

import { buildStoryLaunchKey } from '../../../../src/core/recovery/leases/index.js';

import { storyLaunchKeyFixture, storyLaunchPartsFixture } from './shared.js';

describe('story-launch-key-valid', () => {
  it('builds the exact story-launch lease key', () => {
    expect(buildStoryLaunchKey(storyLaunchPartsFixture)).toBe(storyLaunchKeyFixture);
  });
});

describe('story-launch-key-unsafe-field', () => {
  it('rejects missing and delimiter-unsafe fields', () => {
    expect(() =>
      buildStoryLaunchKey({
        ...storyLaunchPartsFixture,
        taskId: 'task:01',
      }),
    ).toThrow(/must not contain/);

    expect(() =>
      buildStoryLaunchKey({
        ...storyLaunchPartsFixture,
        trackId: '   ',
      }),
    ).toThrow(/non-empty/);
  });
});
