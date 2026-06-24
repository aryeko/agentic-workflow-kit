import type { RunDegradedHealth, RunDurabilityClass, RunLifecycleState } from '../../../../src/index.js';

const validDurability = 'durable' satisfies RunDurabilityClass;
const validLifecycle = 'running' satisfies RunLifecycleState;
const validHealth = 'ok' satisfies RunDegradedHealth;

void validDurability;
void validLifecycle;
void validHealth;

// @ts-expect-error AC-3 rejects buffered durability.
const bufferedDurability: RunDurabilityClass = 'buffered';

// @ts-expect-error AC-3 rejects a sixteenth lifecycle state.
const invalidLifecycle: RunLifecycleState = 'resuming';

// @ts-expect-error AC-3 rejects a fifth degraded-health member.
const invalidHealth: RunDegradedHealth = 'degraded';

void bufferedDurability;
void invalidLifecycle;
void invalidHealth;
