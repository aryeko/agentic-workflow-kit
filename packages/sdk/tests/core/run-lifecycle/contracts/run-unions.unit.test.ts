import { describe, expect, it } from 'vitest';

import type { RunDegradedHealth, RunDurabilityClass, RunLifecycleState } from '../../../../src/index.js';

const renderDurability = (value: RunDurabilityClass): string => {
  switch (value) {
    case 'durable':
      return 'durable';
    case 'barrier':
      return 'barrier';
    default: {
      const exhaustive: never = value;

      return exhaustive;
    }
  }
};

const renderLifecycle = (value: RunLifecycleState): string => {
  switch (value) {
    case 'created':
    case 'configured':
    case 'task-snapshotted':
    case 'workspace-ready':
    case 'worker-starting':
    case 'running':
    case 'parked':
    case 'runner-verifying':
    case 'forge-waiting':
    case 'merge-waiting':
    case 'settling':
    case 'completed':
    case 'blocked':
    case 'failed':
    case 'canceled':
      return value;
    default: {
      const exhaustive: never = value;

      return exhaustive;
    }
  }
};

const renderHealth = (value: RunDegradedHealth): string => {
  switch (value) {
    case 'ok':
    case 'tail-repaired':
    case 'interior-corrupt':
    case 'event-log-unavailable':
      return value;
    default: {
      const exhaustive: never = value;

      return exhaustive;
    }
  }
};

describe('core-01-s1 run unions', () => {
  it('defines the exact durability members', () => {
    const members: readonly RunDurabilityClass[] = ['durable', 'barrier'];

    expect(members.map(renderDurability)).toEqual(['durable', 'barrier']);
  });

  it('defines the exact lifecycle members', () => {
    const members: readonly RunLifecycleState[] = [
      'created',
      'configured',
      'task-snapshotted',
      'workspace-ready',
      'worker-starting',
      'running',
      'parked',
      'runner-verifying',
      'forge-waiting',
      'merge-waiting',
      'settling',
      'completed',
      'blocked',
      'failed',
      'canceled',
    ];

    expect(members.map(renderLifecycle)).toHaveLength(15);
  });

  it('defines the exact degraded-health members', () => {
    const members: readonly RunDegradedHealth[] = ['ok', 'tail-repaired', 'interior-corrupt', 'event-log-unavailable'];

    expect(members.map(renderHealth)).toEqual(['ok', 'tail-repaired', 'interior-corrupt', 'event-log-unavailable']);
  });
});
