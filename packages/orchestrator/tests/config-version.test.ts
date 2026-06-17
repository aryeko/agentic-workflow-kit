import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/resolve';
import {
  applyWorkflowConfigUpgrade,
  classifyWorkflowConfigVersion,
  planWorkflowConfigUpgrade,
  workflowConfigStatus,
} from '../src/config/version';
import {
  CURRENT_CONFIG_SCHEMA_VERSION,
  MIN_SUPPORTED_CONFIG_SCHEMA_VERSION,
  runtimeInfo,
} from '../src/runtime/version';

async function writeWorkflowConfig(root: string, yaml: string): Promise<string> {
  const configPath = path.join(root, '.workflow', 'config.yaml');
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, yaml);
  return configPath;
}

describe('workflow config version compatibility', () => {
  it('exposes runtime and config schema version metadata', () => {
    expect(CURRENT_CONFIG_SCHEMA_VERSION).toBe('0.6.0');
    expect(MIN_SUPPORTED_CONFIG_SCHEMA_VERSION).toBe('0.6.0');
    expect(runtimeInfo()).toMatchObject({
      apiVersion: '1',
      mcpServer: { name: 'agentic-workflow-kit' },
      configSchema: {
        current: '0.6.0',
        minimumSupported: '0.6.0',
      },
    });
  });

  it('classifies current, legacy, older, newer, invalid, and missing config versions', () => {
    expect(classifyWorkflowConfigVersion({ version: '0.6.0' })).toMatchObject({
      status: 'current',
      detectedVersion: '0.6.0',
      blocking: false,
      upgradeAvailable: false,
    });
    expect(classifyWorkflowConfigVersion({ version: 1 })).toMatchObject({
      status: 'legacy-upgradeable',
      detectedVersion: '1',
      normalizedVersion: '0.6.0',
      blocking: false,
      upgradeAvailable: true,
    });
    expect(classifyWorkflowConfigVersion({ version: '0.5.0' })).toMatchObject({
      status: 'unsupported-old',
      blocking: true,
      targetVersion: null,
      upgradeAvailable: false,
    });
    expect(classifyWorkflowConfigVersion({ version: '0.7.0' })).toMatchObject({
      status: 'unsupported-new',
      blocking: true,
      upgradeAvailable: false,
    });
    expect(classifyWorkflowConfigVersion({ version: 'not-semver' })).toMatchObject({
      status: 'invalid',
      blocking: true,
      upgradeAvailable: false,
    });
    expect(classifyWorkflowConfigVersion({})).toMatchObject({
      status: 'missing',
      blocking: true,
      upgradeAvailable: false,
    });
  });

  it('loads both legacy numeric and current semver configs during the transition window', async () => {
    const legacyRoot = await mkdtemp(path.join(os.tmpdir(), 'workflow-config-legacy-'));
    const currentRoot = await mkdtemp(path.join(os.tmpdir(), 'workflow-config-current-'));
    await writeWorkflowConfig(legacyRoot, 'version: 1\n');
    await writeWorkflowConfig(currentRoot, 'version: "0.6.0"\n');

    await expect(loadConfig({ cwd: legacyRoot })).resolves.toMatchObject({
      config: { version: '0.6.0' },
    });
    await expect(loadConfig({ cwd: currentRoot })).resolves.toMatchObject({
      config: { version: '0.6.0' },
    });
  });

  it('plans and applies the legacy numeric config migration without changing other fields', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'workflow-config-upgrade-'));
    const configPath = await writeWorkflowConfig(
      root,
      ['version: 1', 'paths:', '  tracksDir: custom/tracks', 'verify:', '  full: pnpm check', ''].join('\n'),
    );

    const plan = await planWorkflowConfigUpgrade({ cwd: root });

    expect(plan).toMatchObject({
      detectedVersion: '1',
      targetVersion: '0.6.0',
      writeRequired: true,
      changes: [{ path: 'version', from: 1, to: '0.6.0' }],
    });
    expect(await readFile(configPath, 'utf8')).toContain('version: 1');

    const result = await applyWorkflowConfigUpgrade({ cwd: root });

    expect(result).toMatchObject({ wrote: true, targetVersion: '0.6.0' });
    expect(await readFile(configPath, 'utf8')).toContain('version: 0.6.0');
    expect(await readFile(configPath, 'utf8')).toContain('tracksDir: custom/tracks');
    expect(await readFile(configPath, 'utf8')).toContain('full: pnpm check');
  });

  it('does not rewrite unsupported old configs without a real migration', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'workflow-config-unsupported-old-'));
    const configPath = await writeWorkflowConfig(root, 'version: "0.5.0"\n');

    const plan = await planWorkflowConfigUpgrade({ cwd: root });
    const result = await applyWorkflowConfigUpgrade({ cwd: root });

    expect(plan).toMatchObject({
      status: 'unsupported-old',
      blocking: true,
      upgradeAvailable: false,
      targetVersion: null,
      writeRequired: false,
      changes: [],
    });
    expect(result).toMatchObject({
      status: 'unsupported-old',
      wrote: false,
      changes: [],
    });
    expect(await readFile(configPath, 'utf8')).toContain('version: "0.5.0"');
  });

  it('returns structured status when the config file is missing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'workflow-config-missing-file-'));

    await expect(workflowConfigStatus({ cwd: root })).resolves.toMatchObject({
      status: 'missing',
      detectedVersion: null,
      upgradeAvailable: false,
      blocking: true,
      next: [
        {
          label: 'Initialize workflow config',
          cli: '/agentic-workflow-kit:workflow-init',
        },
      ],
    });
  });

  it('reports actionable compatibility errors during normal config loading', async () => {
    const oldRoot = await mkdtemp(path.join(os.tmpdir(), 'workflow-config-load-old-'));
    const newRoot = await mkdtemp(path.join(os.tmpdir(), 'workflow-config-load-new-'));
    await writeWorkflowConfig(oldRoot, 'version: "0.5.0"\n');
    await writeWorkflowConfig(newRoot, 'version: "0.7.0"\n');

    await expect(loadConfig({ cwd: oldRoot })).rejects.toThrow('older than the minimum supported version 0.6.0');
    await expect(loadConfig({ cwd: newRoot })).rejects.toThrow('newer than this runtime supports');
  });
});
