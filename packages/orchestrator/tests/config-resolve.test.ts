import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { loadConfig } from '../src/config/resolve';
import { ConfigSchema } from '../src/config/schema';

function tmpRepo(yaml: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'wk-core-'));
  mkdirSync(path.join(dir, '.workflow'), { recursive: true });
  writeFileSync(path.join(dir, '.workflow/config.yaml'), yaml);
  return dir;
}

describe('ConfigSchema', () => {
  it('fills every default from an empty (version-only) config', () => {
    const parsed = ConfigSchema.parse({ version: 1 });
    expect(parsed.paths.tracksDir).toBe('docs/tracks');
    expect(parsed.paths.archiveDir).toBe('docs/tracks/archive');
    expect(parsed.statuses.eligible).toEqual(['specced', 'plan-approved']);
    expect(parsed.statuses.inProgress).toBe('implementing');
    expect(parsed.statuses.complete).toEqual(['done', 'verified']);
    expect(parsed.tracker.idPattern).toBe('^[A-Z]{2,}[0-9]+$');
    expect(parsed.verify.changed).toBeNull();
    expect(parsed.git.strategy).toBe('worktree');
    expect(parsed.pr.create).toBe(true);
    expect(parsed.pr.merge.method).toBe('squash');
    expect(parsed.orchestrator.driver).toBe('codex-mcp');
    expect(parsed.orchestrator.maxParallel).toBe(2);
    expect(parsed.orchestrator.childTimeoutMs).toBe(1_800_000);
  });

  it('rejects version other than 1', () => {
    expect(() => ConfigSchema.parse({ version: 2 })).toThrow();
  });

  it('rejects unknown top-level keys', () => {
    expect(() => ConfigSchema.parse({ version: 1, bogus: true })).toThrow();
  });

  it('rejects an unknown paths key', () => {
    expect(() => ConfigSchema.parse({ version: 1, paths: { bogusDir: 'x' } })).toThrow();
  });

  it('rejects an invalid git.strategy and surfaces the key', () => {
    expect(() => ConfigSchema.parse({ version: 1, git: { strategy: 'fork' } })).toThrow(/git/);
  });

  it('rejects a malformed pr.merge.method (previously silently ignored)', () => {
    expect(() => ConfigSchema.parse({ version: 1, pr: { merge: { method: 'rocket' } } })).toThrow(/pr/);
  });
});

describe('loadConfig', () => {
  it('loads and resolves defaults from a minimal file', async () => {
    const cwd = tmpRepo('version: 1\n');
    const loaded = await loadConfig({ cwd });
    expect(loaded.config.paths.tracksDir).toBe('docs/tracks');
    expect(loaded.workspaceRoot).toBe(cwd);
    expect(loaded.configPath).toBe(path.resolve(cwd, '.workflow/config.yaml'));
  });

  it('throws the workflow-init hint when the file is missing', async () => {
    const cwd = mkdtempSync(path.join(tmpdir(), 'wk-core-empty-'));
    await expect(loadConfig({ cwd })).rejects.toThrow(
      'Missing .workflow/config.yaml. Run /workflow-init before using agentic-workflow-kit orchestrator.',
    );
  });

  it('surfaces a friendly single-line error naming the bad key', async () => {
    const cwd = tmpRepo('version: 1\npr:\n  merge:\n    method: rocket\n');
    await expect(loadConfig({ cwd })).rejects.toThrow(/pr\.merge\.method/);
  });

  it.each([
    'push-and-merge',
    'gated-automerge',
    'push-only',
  ])('loads the %s preset through the runtime config path', async (name) => {
    const yaml = readFileSync(path.resolve('../..', `presets/${name}.yaml`), 'utf8');
    expect(() => ConfigSchema.parse(parseYaml(yaml))).not.toThrow();

    const cwd = tmpRepo(yaml);
    const loaded = await loadConfig({ cwd });
    expect(loaded.config).toEqual(ConfigSchema.parse(parseYaml(yaml)));
  });
});
