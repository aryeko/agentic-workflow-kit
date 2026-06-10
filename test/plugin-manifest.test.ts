import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

const claudePluginRootVariable = '$' + '{CLAUDE_PLUGIN_ROOT}';
const claudeProjectDirVariable = '$' + '{CLAUDE_PROJECT_DIR}';

function readSkillFrontmatter(skillName: string): Record<string, unknown> {
  const s = readFileSync(`skills/${skillName}/SKILL.md`, 'utf8');
  const match = s.match(/^---\n([\s\S]*?)\n---\n/);
  expect(match).not.toBeNull();
  return YAML.parse((match as RegExpMatchArray)[1] ?? '') as Record<string, unknown>;
}

function listFiles(root: string, prefix = ''): string[] {
  return readdirSync(path.join(root, prefix), { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      return listFiles(root, relativePath);
    }
    return entry.isFile() ? [relativePath] : [];
  });
}

describe('plugin manifests', () => {
  it('plugin.json declares the agentic-workflow-kit plugin', () => {
    const m = JSON.parse(readFileSync('.claude-plugin/plugin.json', 'utf8'));
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(m.name).toBe('agentic-workflow-kit');
    expect(m.version).toBe(pkg.version);
    expect(typeof m.description).toBe('string');
    expect(m.skills).toBe('./skills/');
    expect(m.interface).toBeUndefined();
  });

  it('codex plugin manifest declares the shared skill plugin', () => {
    expect(existsSync('.codex-plugin/plugin.json')).toBe(true);
    const m = JSON.parse(readFileSync('.codex-plugin/plugin.json', 'utf8'));
    const claude = JSON.parse(readFileSync('.claude-plugin/plugin.json', 'utf8'));
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(m.name).toBe('agentic-workflow-kit');
    expect(m.version).toBe(pkg.version);
    expect(m.version).toBe(claude.version);
    expect(typeof m.description).toBe('string');
    expect(typeof m.author?.name).toBe('string');
    expect(m.license).toBe('MIT');
    expect(Array.isArray(m.keywords)).toBe(true);
    expect(m.skills).toBe('./skills/');
    expect(m.mcpServers).toBe('./.codex-plugin/.mcp.json');
    expect(m.repository).toBeUndefined();
    expect(m.homepage).toBeUndefined();
    expect(m.interface?.displayName).toBe('agentic-workflow-kit');
    expect(m.interface?.category).toBe('Productivity');
    expect(m.interface?.capabilities).toEqual(expect.arrayContaining(['Read', 'Write', 'Shell']));
  });

  it('codex plugin manifest points at a Codex-readable MCP config', () => {
    const manifest = JSON.parse(readFileSync('.codex-plugin/plugin.json', 'utf8'));
    const mcp = JSON.parse(readFileSync(manifest.mcpServers, 'utf8'));

    expect(mcp.mcpServers?.['agentic-workflow-kit']).toEqual({
      command: 'node',
      args: ['./mcp/server.mjs'],
    });
    expect(mcp.mcp_servers).toBeUndefined();
  });

  it('marketplace.json lists the root plugin with source "./"', () => {
    const mk = JSON.parse(readFileSync('.claude-plugin/marketplace.json', 'utf8'));
    expect(typeof mk.name).toBe('string');
    expect(typeof mk.owner?.name).toBe('string');
    expect(Array.isArray(mk.plugins)).toBe(true);
    const entry = mk.plugins.find((p: { name: string }) => p.name === 'agentic-workflow-kit');
    expect(entry).toBeDefined();
    expect(entry.source).toBe('./');
  });

  it('claude root plugin bundles the MCP runtime using plugin path variables', () => {
    expect(existsSync('.mcp.json')).toBe(true);
    expect(existsSync('mcp/server.mjs')).toBe(true);

    const mcp = JSON.parse(readFileSync('.mcp.json', 'utf8'));
    expect(mcp.mcpServers?.['agentic-workflow-kit']).toEqual({
      command: 'node',
      args: [`${claudePluginRootVariable}/mcp/server.mjs`],
      cwd: claudeProjectDirVariable,
    });
    expect(mcp.mcp_servers).toBeUndefined();
  });

  it('codex local marketplace fixture points at an installable plugin directory', () => {
    expect(existsSync('.agents/plugins/marketplace.json')).toBe(true);
    const mk = JSON.parse(readFileSync('.agents/plugins/marketplace.json', 'utf8'));

    expect(mk.name).toBe('agentic-workflow-kit');
    expect(Array.isArray(mk.plugins)).toBe(true);

    const entry = mk.plugins.find((p: { name: string }) => p.name === 'agentic-workflow-kit');
    expect(entry).toBeDefined();
    expect(entry.source).toEqual({ source: 'local', path: './plugins/agentic-workflow-kit' });
    expect(entry.repository).toBeUndefined();
    expect(entry.homepage).toBeUndefined();

    for (const requiredPath of [
      'plugins/agentic-workflow-kit/.codex-plugin/plugin.json',
      'plugins/agentic-workflow-kit/.codex-plugin/.mcp.json',
      'plugins/agentic-workflow-kit/.mcp.json',
      'plugins/agentic-workflow-kit/mcp/server.mjs',
      'plugins/agentic-workflow-kit/skills',
      'plugins/agentic-workflow-kit/references',
      'plugins/agentic-workflow-kit/presets',
      'plugins/agentic-workflow-kit/examples',
    ]) {
      expect(existsSync(requiredPath), `${requiredPath} must exist for local Codex install`).toBe(true);
      expect(lstatSync(requiredPath).isSymbolicLink(), `${requiredPath} must be materialized, not a symlink`).toBe(
        false,
      );
    }
  });

  it('codex local marketplace fixture mirrors the shared plugin source files', () => {
    for (const sourcePath of ['.codex-plugin', 'skills', 'references', 'presets', 'examples']) {
      const fixturePath = path.join('plugins/agentic-workflow-kit', sourcePath);
      const sourceFiles = listFiles(sourcePath).sort();
      const fixtureFiles = listFiles(fixturePath).sort();

      expect(fixtureFiles).toEqual(sourceFiles);

      for (const relativeFile of sourceFiles) {
        const sourceFile = path.join(sourcePath, relativeFile);
        const fixtureFile = path.join(fixturePath, relativeFile);

        expect(statSync(fixtureFile).isFile()).toBe(true);
        expect(readFileSync(fixtureFile, 'utf8')).toBe(readFileSync(sourceFile, 'utf8'));
      }
    }
  });

  it('codex local marketplace fixture includes the bundled MCP runtime', () => {
    const manifest = JSON.parse(readFileSync('plugins/agentic-workflow-kit/.codex-plugin/plugin.json', 'utf8'));
    const mcp = JSON.parse(readFileSync(path.join('plugins/agentic-workflow-kit', manifest.mcpServers), 'utf8'));

    expect(manifest.mcpServers).toBe('./.codex-plugin/.mcp.json');
    expect(mcp.mcpServers?.['agentic-workflow-kit']).toEqual({
      command: 'node',
      args: ['./mcp/server.mjs'],
    });
    expect(mcp.mcp_servers).toBeUndefined();
    expect(readFileSync('plugins/agentic-workflow-kit/mcp/server.mjs', 'utf8')).toBe(
      readFileSync('mcp/server.mjs', 'utf8'),
    );
  });

  it('ships the workflow-init skill with frontmatter', () => {
    expect(existsSync('skills/workflow-init/SKILL.md')).toBe(true);
    const s = readSkillFrontmatter('workflow-init');
    expect(s.name).toBe('workflow-init');
    expect(s.description).toEqual(expect.any(String));
    expect(s['argument-hint']).toBe('[instructions]');
    expect(s['user-invocable']).toBe(true);
  });

  it('ships the define-product skill with frontmatter', () => {
    expect(existsSync('skills/define-product/SKILL.md')).toBe(true);
    const s = readSkillFrontmatter('define-product');
    expect(s.name).toBe('define-product');
    expect(s.description).toEqual(expect.any(String));
    expect(s['argument-hint']).toBe('[slug or notes]');
    expect(s['user-invocable']).toBe(true);
  });

  it('ships the design-technical-solution skill with frontmatter', () => {
    expect(existsSync('skills/design-technical-solution/SKILL.md')).toBe(true);
    const s = readSkillFrontmatter('design-technical-solution');
    expect(s.name).toBe('design-technical-solution');
    expect(s.description).toEqual(expect.any(String));
    expect(s['argument-hint']).toBe('[prd-slug or technical notes]');
    expect(s['user-invocable']).toBe(true);
  });

  it('ships the plan-delivery-track skill with frontmatter', () => {
    expect(existsSync('skills/plan-delivery-track/SKILL.md')).toBe(true);
    const s = readSkillFrontmatter('plan-delivery-track');
    expect(s.name).toBe('plan-delivery-track');
    expect(s.description).toEqual(expect.any(String));
    expect(s['argument-hint']).toBe('[prd-slug or notes]');
    expect(s['user-invocable']).toBe(true);
  });

  it('ships the implement-next skill with frontmatter', () => {
    expect(existsSync('skills/implement-next/SKILL.md')).toBe(true);
    const s = readSkillFrontmatter('implement-next');
    expect(s.name).toBe('implement-next');
    expect(s.description).toEqual(expect.any(String));
    expect(s['argument-hint']).toBe('[story-id]');
    expect(s['user-invocable']).toBe(true);
  });

  it('ships the workflow-autopilot skill with frontmatter', () => {
    expect(existsSync('skills/workflow-autopilot/SKILL.md')).toBe(true);
    const s = readFileSync('skills/workflow-autopilot/SKILL.md', 'utf8');
    const frontmatter = readSkillFrontmatter('workflow-autopilot');
    expect(frontmatter.name).toBe('workflow-autopilot');
    expect(frontmatter.description).toEqual(expect.any(String));
    expect(frontmatter['argument-hint']).toBe('<command> [options]');
    expect(frontmatter['user-invocable']).toBe(true);
    expect(s).toContain('tracker row status is the only completion authority');
    expect(s).toContain('best-effort');
  });

  it('no longer ships a separate commands/ layer (skills provide the entry points)', () => {
    expect(existsSync('commands')).toBe(false);
  });

  it('keeps every plugin surface aligned with the orchestrator release version', () => {
    const releaseVersion = JSON.parse(readFileSync('packages/orchestrator/package.json', 'utf8')).version;
    const versionOf = (file: string) => JSON.parse(readFileSync(file, 'utf8')).version;

    expect(versionOf('package.json')).toBe(releaseVersion);
    expect(versionOf('.claude-plugin/plugin.json')).toBe(releaseVersion);
    expect(versionOf('.codex-plugin/plugin.json')).toBe(releaseVersion);
    expect(versionOf('plugins/agentic-workflow-kit/.codex-plugin/plugin.json')).toBe(releaseVersion);

    const marketplace = JSON.parse(readFileSync('.claude-plugin/marketplace.json', 'utf8'));
    const entry = marketplace.plugins.find((p: { name: string }) => p.name === 'agentic-workflow-kit');
    expect(entry.version).toBe(releaseVersion);
  });
});
