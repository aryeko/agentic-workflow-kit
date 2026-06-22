import { describe, expect, it } from 'vitest';

import {
  credentialDestroyUnconfirmedObservation,
  credentialDestroyUnconfirmedRelease,
} from './fixtures/credential-destroy-unconfirmed.fixture.js';
import { runnerCommandCaptureIncompleteFailure } from './fixtures/runner-command-capture-incomplete.fixture.js';
import { commandResultFixture, hostReleaseResultFixture } from './fixtures/shared.js';

describe('prov-04-s1 host release and command capture contracts', () => {
  it('keeps release degradation and command capture failure distinct from their success result types', () => {
    const release = hostReleaseResultFixture();
    const command = commandResultFixture();

    expect(release.credentialMaterialDestroyed).toBe(true);
    expect(credentialDestroyUnconfirmedRelease).toEqual(
      expect.objectContaining({
        released: false,
        credentialMaterialDestroyed: false,
      }),
    );
    expect(credentialDestroyUnconfirmedObservation.failure.reason).toBe('credential-destroy-unconfirmed');
    expect(command.outputDigest).toBe('output-digest-01');
    expect(runnerCommandCaptureIncompleteFailure.reason).toBe('runner-command-capture-incomplete');
  });
});
