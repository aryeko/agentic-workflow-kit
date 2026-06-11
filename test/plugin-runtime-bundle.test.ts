import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { SERVER_INSTRUCTIONS } from '../packages/orchestrator/src/mcp/server.js';

describe('plugin MCP package runtime', () => {
  it('uses the package MCP entrypoint instead of checked-in generated bundles', () => {
    expect(existsSync('mcp/server.mjs')).toBe(false);
    expect(existsSync('plugins/agentic-workflow-kit/mcp/server.mjs')).toBe(false);

    const pkg = JSON.parse(readFileSync('packages/orchestrator/package.json', 'utf8'));
    expect(pkg.bin?.['agentic-workflow-kit-mcp']).toBe('./dist/mcp/server.js');
  });

  it('does not mark removed MCP package runtime artifacts as generated', () => {
    const attributes = existsSync('.gitattributes') ? readFileSync('.gitattributes', 'utf8') : '';

    expect(attributes).not.toContain('mcp/server.mjs linguist-generated=true');
    expect(attributes).not.toContain('plugins/agentic-workflow-kit/mcp/server.mjs linguist-generated=true');
  });

  it('keeps server-wide MCP instructions in the package MCP source', () => {
    expect(SERVER_INSTRUCTIONS).toContain('Use agentic-workflow-kit for tracker-driven repo delivery.');
    expect(SERVER_INSTRUCTIONS.length).toBeLessThanOrEqual(512);
    expect(readFileSync('packages/orchestrator/src/mcp/server.ts', 'utf8')).toContain(
      'instructions: SERVER_INSTRUCTIONS',
    );
  });
});
