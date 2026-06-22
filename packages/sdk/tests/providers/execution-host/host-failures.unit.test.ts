import { describe, expect, it } from 'vitest';

import { credentialDestroyUnconfirmedObservation } from './fixtures/credential-destroy-unconfirmed.fixture.js';
import { credentialInjectionRejectedFailure } from './fixtures/credential-injection-rejected.fixture.js';
import { egressConfinementUnattestedFailure } from './fixtures/egress-confinement-unattested.fixture.js';
import { hostCapabilityUnattestedFailure } from './fixtures/host-capability-unattested.fixture.js';
import { hostObservationIncompleteObservation } from './fixtures/host-observation-incomplete.fixture.js';
import { runnerCommandCaptureIncompleteFailure } from './fixtures/runner-command-capture-incomplete.fixture.js';
import { terminationUnprovenObservation } from './fixtures/termination-unproven.fixture.js';
import { workerSpawnFailedFailure } from './fixtures/worker-spawn-failed.fixture.js';
import { workspaceCwdOutsideMountFailure } from './fixtures/workspace-cwd-outside-mount.fixture.js';
import { workspaceMountUnavailableFailure } from './fixtures/workspace-mount-unavailable.fixture.js';

describe('prov-04-s1 host failure tokens', () => {
  it('constructs each failure token exactly once through named negative fixtures', () => {
    expect(hostCapabilityUnattestedFailure.reason).toBe('host-capability-unattested');
    expect(workspaceMountUnavailableFailure.reason).toBe('workspace-mount-unavailable');
    expect(workspaceCwdOutsideMountFailure.reason).toBe('workspace-cwd-outside-mount');
    expect(credentialInjectionRejectedFailure.reason).toBe('credential-injection-rejected');
    expect(egressConfinementUnattestedFailure.reason).toBe('egress-confinement-unattested');
    expect(workerSpawnFailedFailure.reason).toBe('worker-spawn-failed');
    expect(hostObservationIncompleteObservation.type).toBe('host-failure');
    expect(hostObservationIncompleteObservation.failure.reason).toBe('host-observation-incomplete');
    expect(terminationUnprovenObservation.failure.reason).toBe('termination-unproven');
    expect(runnerCommandCaptureIncompleteFailure.reason).toBe('runner-command-capture-incomplete');
    expect(credentialDestroyUnconfirmedObservation.failure.reason).toBe('credential-destroy-unconfirmed');
  });
});
