import { describe, expect, it } from 'vitest';

import type { ExecutionHostProvider } from '../../../src/index.js';

import {
  executionHostProviderFixture,
  hostProbeScopeFixture,
  hostWorkspaceHandleFixture,
  terminationPolicyFixture,
  workerHandleFixture,
} from './fixtures/shared.js';

describe('prov-04-s1 execution host provider shape', () => {
  it('constructs a provider with the seven required operations', async () => {
    const provider: ExecutionHostProvider = executionHostProviderFixture();
    const worker = workerHandleFixture();

    expect(provider.probeCapabilities(hostProbeScopeFixture())).toHaveLength(1);
    expect(provider.attachWorkspace(hostWorkspaceHandleFixture().workspace)).toBeDefined();
    expect(provider.spawnWorker).toBeTypeOf('function');
    expect(provider.observeWorker).toBeTypeOf('function');
    expect(provider.terminateWorker(worker, terminationPolicyFixture()).handleId).toBe(worker.handleId);
    expect(provider.runCommand).toBeTypeOf('function');
    expect(provider.releaseWorkspace).toBeTypeOf('function');
  });
});
