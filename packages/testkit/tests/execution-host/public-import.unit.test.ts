import { describe, expect, it } from 'vitest';

import type { ExecutionHostProvider } from 'sdk';

import {
  createMockExecutionHostProvider,
  isHostFailure,
  type MockExecutionHostScenario,
  workspaceAttachmentFixture,
} from 'testkit';

describe('testkit Execution Host public import surface', () => {
  it('exports an ExecutionHostProvider-compatible mock and scenario selector', () => {
    const scenario = 'positive' satisfies MockExecutionHostScenario;
    const provider: ExecutionHostProvider = createMockExecutionHostProvider({ scenario });
    const workspace = provider.attachWorkspace(workspaceAttachmentFixture());

    expect(isHostFailure(workspace)).toBe(false);
    expect(typeof createMockExecutionHostProvider).toBe('function');
  });
});
