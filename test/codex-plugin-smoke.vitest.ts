import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('codex local plugin smoke', () => {
  it('installs through the local marketplace and exposes implicit-safe skills', () => {
    const codexHome = mkdtempSync(path.join(tmpdir(), 'agentic-workflow-kit-codex-home-'));
    const env = { ...process.env, CODEX_HOME: codexHome };

    execFileSync('codex', ['plugin', 'marketplace', 'add', '.'], {
      cwd: repoRoot,
      env,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    execFileSync('codex', ['plugin', 'add', 'agentic-workflow-kit@agentic-workflow-kit'], {
      cwd: repoRoot,
      env,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const installedRoot = path.join(codexHome, 'plugins/cache/agentic-workflow-kit/agentic-workflow-kit/0.1.0');

    expect(existsSync(path.join(installedRoot, '.codex-plugin/plugin.json'))).toBe(true);
    expect(existsSync(path.join(installedRoot, 'skills/workflow-init/SKILL.md'))).toBe(true);
    expect(existsSync(path.join(installedRoot, 'skills/plan-product/SKILL.md'))).toBe(true);
    expect(existsSync(path.join(installedRoot, 'skills/plan-track/SKILL.md'))).toBe(true);
    expect(existsSync(path.join(installedRoot, 'skills/implement-next/SKILL.md'))).toBe(true);
    expect(existsSync(path.join(installedRoot, 'skills/workflow-autopilot/SKILL.md'))).toBe(true);

    const promptInput = execFileSync('codex', ['debug', 'prompt-input', 'hello'], {
      cwd: repoRoot,
      env,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    expect(promptInput).toContain('agentic-workflow-kit:workflow-init');
    expect(promptInput).toContain('agentic-workflow-kit:plan-product');
    expect(promptInput).toContain('agentic-workflow-kit:plan-track');
  }, 30_000);
});
