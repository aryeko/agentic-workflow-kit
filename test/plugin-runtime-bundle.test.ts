import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('plugin MCP runtime bundle', () => {
  it('ships a plain Node-importable MCP server artifact', () => {
    expect(existsSync('mcp/server.mjs')).toBe(true);

    const bundle = readFileSync('mcp/server.mjs', 'utf8');
    expect(bundle).toContain('agentic-workflow-kit');
    expect(bundle).toContain('list_eligible');
    expect(bundle).toContain('run_story');

    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "import('./mcp/server.mjs').then((m) => console.log(typeof m.createOrchestratorMcpServer))",
      ],
      { encoding: 'utf8' },
    );

    expect(output.trim()).toBe('function');
  });
});
