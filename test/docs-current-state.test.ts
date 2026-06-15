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
    expect(agents).toContain('package-backed MCP runtime');
    expect(agents).not.toContain('`mcp/server.mjs` is the generated plugin MCP runtime bundle');
    expect(agents).toContain('technical solution contract');
  });

  it('keeps README local Codex install guidance aligned with the fixture path', () => {
    const readme = readFileSync('README.md', 'utf8');

    expect(readme).not.toContain('local `./` source');
    expect(readme).not.toContain('pre-publish testing');
    expect(readme).toContain('codex plugin marketplace add .');
    expect(readme).toContain('codex plugin add agentic-workflow-kit@agentic-workflow-kit');
    expect(readme).toContain('./plugins/agentic-workflow-kit');
    expect(readme).toContain('agentic-workflow-kit-mcp');
    expect(readme).not.toContain('mcp/server.mjs');
  });

  it('keeps the orchestrator package README ready for npm consumers', () => {
    const readme = readFileSync('packages/orchestrator/README.md', 'utf8');

    expect(readme).toContain('# @agentic-workflow-kit/orchestrator');
    expect(readme).toContain('agentic-workflow-kit-mcp');
    expect(readme).toContain('npx -y --package @agentic-workflow-kit/orchestrator@<exact-version>');
    expect(readme).toContain('Available MCP tools');
    expect(readme).toContain('workflow_run_export');
    expect(readme).toContain('workflow_run_control');
    expect(readme).toContain('legacy tools remain available');
    expect(readme).toContain('.codex/agentic-workflow-kit/runs/<run-id>');
    expect(readme).not.toContain('.workflow/runs/<run-id>');
    expect(readme).toContain('Tracker state is authoritative');
  });

  it('keeps getting started and contributor docs aligned with published status', () => {
    const gettingStarted = readFileSync('docs/getting-started.md', 'utf8');
    const contributing = readFileSync('CONTRIBUTING.md', 'utf8');

    expect(gettingStarted).not.toContain('Install commands are planned');
    expect(gettingStarted).toContain('package-backed MCP runtime');
    expect(gettingStarted).toContain('explicit approval before any non-dry-run autonomous launch');
    expect(gettingStarted).toContain(
      'pnpm agentic-workflow-kit -- run-eligible --yes --tracks-dir examples --config presets/push-only.yaml',
    );
    expect(gettingStarted).toContain('GitHub verification is unavailable or ambiguous, the run fails closed');
    expect(gettingStarted).toContain('pnpm agentic-workflow-kit -- run status <run-id-or-path> --json');
    expect(gettingStarted).toContain('pnpm agentic-workflow-kit -- run stream <run-id-or-path> --format ndjson');
    expect(gettingStarted).toContain('pnpm agentic-workflow-kit -- run inspect <run-id-or-path> --json');
    expect(gettingStarted).not.toContain('agentic-workflow-kit run status <run-id-or-path> --json');
    expect(contributing).not.toContain('not yet published');
    expect(contributing).toContain('changeset');
  });

  it('keeps root release and security docs aligned with the current 0.5.x line', () => {
    const changelog = readFileSync('CHANGELOG.md', 'utf8');
    const security = readFileSync('SECURITY.md', 'utf8');

    expect(changelog).toContain('packages/orchestrator/CHANGELOG.md');
    expect(changelog).toContain('0.5.x');
    expect(changelog).not.toContain('## [0.1.0] - Unreleased');
    expect(security).toContain('| 0.5.x | yes |');
    expect(security).toContain('| < 0.5 | no |');
    expect(security).not.toContain('| 0.1.x | yes |');
  });

  it('keeps published package metadata aligned with the documented Node runtime', () => {
    const packageJson = JSON.parse(readFileSync('packages/orchestrator/package.json', 'utf8')) as {
      engines?: { node?: string };
    };

    expect(packageJson.engines?.node).toBe('>=24');
  });
});
