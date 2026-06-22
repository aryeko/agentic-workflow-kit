import { describe, expect, it } from 'vitest';

import type { HostObservation } from '../../../src/index.js';

import {
  hostFailureObservationFixture,
  outputObservationFixture,
  processExitObservationFixture,
  structuredToolExitObservationFixture,
} from './fixtures/shared.js';

const describeObservation = (observation: HostObservation): string => {
  switch (observation.type) {
    case 'output':
      return `${observation.stream}:${observation.redactionApplied}`;
    case 'structured-tool-exit':
      return `${observation.tool}:${observation.exitCode}`;
    case 'process-exit':
      return `${observation.exitCode ?? 'none'}:${observation.signal ?? 'none'}`;
    case 'host-failure':
      return observation.failure.reason;
  }
};

describe('prov-04-s1 host observations', () => {
  it('narrows each observation arm by discriminant', () => {
    const observations: readonly HostObservation[] = [
      outputObservationFixture(),
      structuredToolExitObservationFixture(),
      processExitObservationFixture(),
      hostFailureObservationFixture('host-observation-incomplete'),
    ];

    expect(describeObservation(observations[0])).toBe('stdout:true');
    expect(describeObservation(observations[1])).toBe('apply_patch:0');
    expect(describeObservation(observations[2])).toBe('0:none');
    expect(describeObservation(observations[3])).toBe('host-observation-incomplete');
  });
});
