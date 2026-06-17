import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { CURRENT_CONFIG_SCHEMA_VERSION, MIN_SUPPORTED_CONFIG_SCHEMA_VERSION, runtimeInfo } from '../runtime/version.js';

const DEFAULT_CONFIG_PATH = '.workflow/config.yaml';
const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

export type WorkflowConfigCompatibilityStatus =
  | 'current'
  | 'legacy-upgradeable'
  | 'supported-stale'
  | 'unsupported-old'
  | 'unsupported-new'
  | 'invalid'
  | 'missing';

export interface WorkflowConfigCompatibility {
  status: WorkflowConfigCompatibilityStatus;
  detectedVersion: string | null;
  normalizedVersion: string | null;
  currentVersion: string;
  minimumSupportedVersion: string;
  targetVersion: string | null;
  upgradeAvailable: boolean;
  blocking: boolean;
  message: string;
  addedCapabilities: string[];
  next: Array<{ label: string; cli: string; mcpTool?: string }>;
}

export interface WorkflowConfigStatusResult extends WorkflowConfigCompatibility, Record<string, unknown> {
  configPath: string;
  runtime: ReturnType<typeof runtimeInfo>;
}

export interface WorkflowConfigUpgradeChange {
  path: string;
  from: unknown;
  to: unknown;
}

export interface WorkflowConfigUpgradePlan
  extends Omit<WorkflowConfigCompatibility, 'currentVersion'>,
    Record<string, unknown> {
  configPath: string;
  currentVersion: string | null;
  runtimeCurrentVersion: string;
  writeRequired: boolean;
  changes: WorkflowConfigUpgradeChange[];
}

export interface WorkflowConfigUpgradeResult extends WorkflowConfigUpgradePlan {
  dryRun: boolean;
  wrote: boolean;
}

export interface WorkflowConfigVersionOptions {
  cwd?: string;
  configPath?: string;
}

export async function workflowConfigStatus(
  options: WorkflowConfigVersionOptions = {},
): Promise<WorkflowConfigStatusResult> {
  const configPath = resolveConfigPath(options);
  const rawConfig = await readRawConfig(configPath);
  return {
    ...classifyWorkflowConfigVersion(rawConfig),
    configPath,
    runtime: runtimeInfo(),
  };
}

export const getWorkflowConfigStatus = workflowConfigStatus;

export function classifyWorkflowConfigVersion(rawConfig: unknown): WorkflowConfigCompatibility {
  const version = rawConfig && typeof rawConfig === 'object' ? (rawConfig as { version?: unknown }).version : undefined;
  const base = {
    currentVersion: CURRENT_CONFIG_SCHEMA_VERSION,
    minimumSupportedVersion: MIN_SUPPORTED_CONFIG_SCHEMA_VERSION,
    addedCapabilities: [
      'CLI and MCP runtime version discovery',
      'Config compatibility status reporting',
      'Previewable workflow config upgrades',
    ],
  };

  if (version === undefined) {
    return compatibility({
      ...base,
      status: 'missing',
      detectedVersion: null,
      normalizedVersion: null,
      targetVersion: null,
      upgradeAvailable: false,
      blocking: true,
      message: 'Workflow config is missing a version field.',
    });
  }

  if (version === 1) {
    return compatibility({
      ...base,
      status: 'legacy-upgradeable',
      detectedVersion: '1',
      normalizedVersion: CURRENT_CONFIG_SCHEMA_VERSION,
      targetVersion: CURRENT_CONFIG_SCHEMA_VERSION,
      upgradeAvailable: true,
      blocking: false,
      message: 'Workflow config uses legacy numeric version 1 and can be upgraded to 0.6.0.',
    });
  }

  if (typeof version !== 'string' || !SEMVER_PATTERN.test(version)) {
    return compatibility({
      ...base,
      status: 'invalid',
      detectedVersion: String(version),
      normalizedVersion: null,
      targetVersion: null,
      upgradeAvailable: false,
      blocking: true,
      message: 'Workflow config version must be a semver string.',
    });
  }

  if (compareSemver(version, CURRENT_CONFIG_SCHEMA_VERSION) === 0) {
    return compatibility({
      ...base,
      status: 'current',
      detectedVersion: version,
      normalizedVersion: version,
      targetVersion: null,
      upgradeAvailable: false,
      blocking: false,
      message: 'Workflow config schema version is current.',
    });
  }

  if (compareSemver(version, MIN_SUPPORTED_CONFIG_SCHEMA_VERSION) < 0) {
    return compatibility({
      ...base,
      status: 'unsupported-old',
      detectedVersion: version,
      normalizedVersion: null,
      targetVersion: CURRENT_CONFIG_SCHEMA_VERSION,
      upgradeAvailable: true,
      blocking: true,
      message: `Workflow config version ${version} is older than the minimum supported version ${MIN_SUPPORTED_CONFIG_SCHEMA_VERSION}.`,
    });
  }

  if (compareSemver(version, CURRENT_CONFIG_SCHEMA_VERSION) > 0) {
    return compatibility({
      ...base,
      status: 'unsupported-new',
      detectedVersion: version,
      normalizedVersion: null,
      targetVersion: null,
      upgradeAvailable: false,
      blocking: true,
      message: `Workflow config version ${version} is newer than this runtime supports. Upgrade agentic-workflow-kit.`,
    });
  }

  return compatibility({
    ...base,
    status: 'supported-stale',
    detectedVersion: version,
    normalizedVersion: version,
    targetVersion: CURRENT_CONFIG_SCHEMA_VERSION,
    upgradeAvailable: true,
    blocking: false,
    message: `Workflow config version ${version} is supported but not current.`,
  });
}

export async function planWorkflowConfigUpgrade(
  options: WorkflowConfigVersionOptions = {},
): Promise<WorkflowConfigUpgradePlan> {
  const configPath = resolveConfigPath(options);
  const rawConfig = await readRawConfig(configPath);
  const status = classifyWorkflowConfigVersion(rawConfig);
  const legacyVersion = isRecord(rawConfig) ? rawConfig.version : undefined;
  const canRewriteVersion = status.status === 'legacy-upgradeable';
  const changes =
    canRewriteVersion && legacyVersion !== CURRENT_CONFIG_SCHEMA_VERSION
      ? [{ path: 'version', from: legacyVersion, to: CURRENT_CONFIG_SCHEMA_VERSION }]
      : [];

  return {
    ...status,
    configPath,
    currentVersion: status.detectedVersion,
    runtimeCurrentVersion: status.currentVersion,
    writeRequired: changes.length > 0,
    changes,
  };
}

export async function applyWorkflowConfigUpgrade(
  options: WorkflowConfigVersionOptions = {},
): Promise<WorkflowConfigUpgradeResult> {
  const plan = await planWorkflowConfigUpgrade(options);
  if (plan.writeRequired) {
    const source = await readFile(plan.configPath, 'utf8');
    const document = YAML.parseDocument(source);
    document.set('version', CURRENT_CONFIG_SCHEMA_VERSION);
    await writeFile(plan.configPath, document.toString());
  }
  return { ...plan, dryRun: false, wrote: plan.writeRequired };
}

export async function previewWorkflowConfigUpgrade(
  options: WorkflowConfigVersionOptions = {},
): Promise<WorkflowConfigUpgradeResult> {
  const plan = await planWorkflowConfigUpgrade(options);
  return { ...plan, dryRun: true, wrote: false };
}

function compatibility(input: Omit<WorkflowConfigCompatibility, 'next'>): WorkflowConfigCompatibility {
  const next = input.upgradeAvailable
    ? [
        {
          label: 'Preview config upgrade',
          cli: 'agentic-workflow-kit config upgrade --dry-run --json',
          mcpTool: 'workflow_config_upgrade',
        },
        {
          label: 'Apply config upgrade',
          cli: 'agentic-workflow-kit config upgrade --yes --json',
          mcpTool: 'workflow_config_upgrade',
        },
      ]
    : [];
  return { ...input, next };
}

async function readRawConfig(configPath: string): Promise<unknown> {
  const raw = await readFile(configPath, 'utf8');
  return YAML.parse(raw) as unknown;
}

function resolveConfigPath(options: WorkflowConfigVersionOptions): string {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  return path.resolve(cwd, options.configPath ?? DEFAULT_CONFIG_PATH);
}

function compareSemver(a: string, b: string): number {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) return 0;
  for (let index = 0; index < left.length; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function parseSemver(value: string): [number, number, number] | null {
  const match = value.match(SEMVER_PATTERN);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
