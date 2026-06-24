import { describe, expect, it } from 'vitest';

import { capabilityPostureCatalog } from '../../../../src/index.js';

import { expectedContainmentFloor } from './shared.js';

describe('core-02-s1 containment floor', () => {
  it('requires process-group or stronger containment for the dependent capabilities', () => {
    expect(capabilityPostureCatalog['auto-recover'].containmentFloor).toEqual(expectedContainmentFloor);
    expect(capabilityPostureCatalog['unattended-run'].containmentFloor).toEqual(expectedContainmentFloor);
  });
});
