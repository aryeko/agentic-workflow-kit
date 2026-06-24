import { describe, expect, it } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';

import { allowAutoMergeFixture } from './fixtures/allow-auto-merge.fixture.js';
import { createAttestationEvent, createReplay, createRequest, createScope } from './shared.js';

describe('core-02-s2 approved parent scopes', () => {
  it('accepts a listed approved lexical parent scope', () => {
    const events = [
      allowAutoMergeFixture.replay.events[0],
      allowAutoMergeFixture.replay.events[1],
      createAttestationEvent('evt-forge-inspect-parent', 3, 'Forge', 'canInspectProtection', {
        scope: 'repo:aryeko/workflow-kit/pr:42',
      }),
      ...allowAutoMergeFixture.replay.events.slice(3),
    ];

    const payload = evaluateCapabilityGate(
      createRequest({
        ...allowAutoMergeFixture.request,
        scope: createScope(),
      }),
      createReplay({
        ...allowAutoMergeFixture.replay,
        events,
        lastSequence: events[events.length - 1]?.sequence ?? 0,
      }),
      allowAutoMergeFixture.projections,
    );

    expect(payload.decision).toBe('allow');
  });

  it('accepts compatible positive attestations for approved parent and exact child scopes', () => {
    const events = [
      ...allowAutoMergeFixture.replay.events,
      createAttestationEvent('evt-forge-inspect-parent', 7, 'Forge', 'canInspectProtection', {
        scope: 'repo:aryeko/workflow-kit/pr:42',
      }),
    ];

    const payload = evaluateCapabilityGate(
      createRequest({
        ...allowAutoMergeFixture.request,
        scope: createScope(),
      }),
      createReplay({
        ...allowAutoMergeFixture.replay,
        events,
        lastSequence: events[events.length - 1]?.sequence ?? 0,
      }),
      allowAutoMergeFixture.projections,
    );

    expect(payload.decision).toBe('allow');
    expect(payload.failureReason).toBeUndefined();
  });

  it('denies an unlisted lexical parent scope', () => {
    const events = [
      allowAutoMergeFixture.replay.events[0],
      allowAutoMergeFixture.replay.events[1],
      createAttestationEvent('evt-forge-inspect-parent-unlisted', 3, 'Forge', 'canInspectProtection', {
        scope: 'repo:aryeko/workflow-kit/pr:42',
      }),
      ...allowAutoMergeFixture.replay.events.slice(3),
    ];

    const payload = evaluateCapabilityGate(
      createRequest({
        ...allowAutoMergeFixture.request,
        scope: createScope({
          providerScopes: [
            {
              provider: 'Forge',
              scope: 'repo:aryeko/workflow-kit/pr:42/head#abc123',
              freshnessKey: 'forge:pr-42',
            },
            {
              provider: 'Work Source',
              scope: 'work-source:epic-3/task:core-02-s2-gate-evaluator',
              freshnessKey: 'work-source:core-02-s2',
            },
          ],
        }),
      }),
      createReplay({
        ...allowAutoMergeFixture.replay,
        events,
        lastSequence: events[events.length - 1]?.sequence ?? 0,
      }),
      allowAutoMergeFixture.projections,
    );

    expect(payload.failureReason).toBe('attestation-out-of-scope');
  });
});
