import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('current-state documentation', () => {
  it('keeps AGENTS.md aligned with the current repository layout', () => {
    const agents = readFileSync('AGENTS.md', 'utf8');

    expect(agents).not.toContain('Current skill: `workflow-init`');
    expect(agents).not.toContain('`src/` contains shared TypeScript logic');
    expect(agents).not.toContain('not yet published');
    expect(agents).toContain(
      'workflow-init`, `define-product`, `design-technical-solution`, `plan-delivery-track`, `implement-next`, and `workflow-autopilot',
    );
    expect(agents).not.toContain('packages/core');
    expect(agents).toContain('bundled MCP runtime');
    expect(agents).toContain('`mcp/server.mjs` is the generated plugin MCP runtime bundle');
    expect(agents).toContain('technical solution contract');
  });

  it('keeps README local Codex install guidance aligned with the fixture path', () => {
    const readme = readFileSync('README.md', 'utf8');

    expect(readme).not.toContain('local `./` source');
    expect(readme).not.toContain('pre-publish testing');
    expect(readme).toContain('codex plugin marketplace add .');
    expect(readme).toContain('codex plugin add agentic-workflow-kit@agentic-workflow-kit');
    expect(readme).toContain('./plugins/agentic-workflow-kit');
    expect(readme).toContain('mcp/server.mjs');
  });

  it('keeps getting started and contributor docs aligned with published status', () => {
    const gettingStarted = readFileSync('docs/getting-started.md', 'utf8');
    const contributing = readFileSync('CONTRIBUTING.md', 'utf8');

    expect(gettingStarted).not.toContain('Install commands are planned');
    expect(gettingStarted).toContain('bundled MCP runtime');
    expect(contributing).not.toContain('not yet published');
    expect(contributing).toContain('changeset');
  });
});
