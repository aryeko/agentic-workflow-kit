import { readFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import type { z } from 'zod';
import { isNodeError } from '../internal/guards.js';
import { ConfigSchema, type WorkflowConfig } from './schema.js';
import { classifyWorkflowConfigVersion } from './version.js';

const DEFAULT_CONFIG_PATH = '.workflow/config.yaml';

export interface LoadConfigOptions {
  cwd?: string;
  configPath?: string;
}

export interface LoadedConfig {
  configPath: string;
  workspaceRoot: string;
  config: WorkflowConfig;
}

export async function loadConfig(options: LoadConfigOptions = {}): Promise<LoadedConfig> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const configPath = path.resolve(cwd, options.configPath ?? DEFAULT_CONFIG_PATH);

  let raw: string;
  try {
    raw = await readFile(configPath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new Error(
        'Missing .workflow/config.yaml. Run /workflow-init before using agentic-workflow-kit orchestrator.',
      );
    }
    throw error;
  }

  const parsed = YAML.parse(raw) as unknown;
  const compatibility = classifyWorkflowConfigVersion(parsed);
  if (compatibility.blocking) {
    throw new Error(`Invalid .workflow/config.yaml — ${compatibility.message}`);
  }
  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(formatZodError(result.error));
  }
  return { configPath, workspaceRoot: cwd, config: result.data };
}

function formatZodError(error: z.ZodError): string {
  const details = error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ');
  return `Invalid .workflow/config.yaml — ${details}`;
}
