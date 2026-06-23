import { describe, expect, it } from 'vitest';

import { buildInspectRunEnvelope } from '../../src/operator-smoke/inspect-run.js';
import { buildPreviewRunEnvelope } from '../../src/operator-smoke/preview-run.js';
import { buildStartRunEnvelope } from '../../src/operator-smoke/start-run.js';

import {
  buildClock,
  buildIds,
  inspectParamsFixture,
  previewParamsFixture,
  serialize,
  sharedActorFixture,
  startParamsFixture,
  targetFixture,
} from './support.js';

describe('edge-01-s2 CLI envelope determinism', () => {
  it('produces stable preview, start, and inspect envelope bytes under fixed inputs', () => {
    const previewFirst = buildPreviewRunEnvelope(
      previewParamsFixture,
      sharedActorFixture,
      targetFixture,
      buildClock().now,
      buildIds().nextId,
    );
    const previewSecond = buildPreviewRunEnvelope(
      previewParamsFixture,
      sharedActorFixture,
      targetFixture,
      buildClock().now,
      buildIds().nextId,
    );
    const startFirst = buildStartRunEnvelope(
      startParamsFixture,
      sharedActorFixture,
      targetFixture,
      buildClock().now,
      buildIds().nextId,
    );
    const startSecond = buildStartRunEnvelope(
      startParamsFixture,
      sharedActorFixture,
      targetFixture,
      buildClock().now,
      buildIds().nextId,
    );
    const inspectFirst = buildInspectRunEnvelope(
      inspectParamsFixture,
      sharedActorFixture,
      targetFixture,
      buildClock().now,
      buildIds().nextId,
    );
    const inspectSecond = buildInspectRunEnvelope(
      inspectParamsFixture,
      sharedActorFixture,
      targetFixture,
      buildClock().now,
      buildIds().nextId,
    );

    expect(serialize(previewFirst)).toBe(serialize(previewSecond));
    expect(serialize(startFirst)).toBe(serialize(startSecond));
    expect(serialize(inspectFirst)).toBe(serialize(inspectSecond));
  });
});
