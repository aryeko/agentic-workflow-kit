import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { loadChildControlConfig } from '../src/mcp/toolHelpers';

describe('MCP tool helpers', () => {
  it('uses cwd-only defaults for direct child control when workflow config is missing', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-child-control-no-config-'));

    const config = await loadChildControlConfig({ cwd, sessionId: 'thread-1' });

    expect(config.workspace.rootAbs).toBe(cwd);
    expect(config.configPath).toBe(path.join(cwd, '.workflow/config.yaml'));
    expect(config.orchestrator.driver).toBe('codex-mcp');
  });

  it('uses resolved workflow config for direct child control when workflow config exists', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-child-control-config-'));
    await mkdir(path.join(cwd, '.workflow'), { recursive: true });
    await writeFile(
      path.join(cwd, '.workflow/config.yaml'),
      `
version: 1
childSession:
  model: gpt-test
`,
    );

    const config = await loadChildControlConfig({ cwd, sessionId: 'thread-1' });

    expect(config.workspace.rootAbs).toBe(cwd);
    expect(config.childSession.model).toBe('gpt-test');
    expect(config.codex.childSession).toBe(config.childSession);
  });
});
