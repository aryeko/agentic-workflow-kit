import type { OrchestratorDriver, ResolvedWorkflowConfig } from '../types.js';
import { CodexMcpStoryRunner, type CodexMcpStoryRunnerOptions } from './codex-mcp/CodexMcpStoryRunner.js';
import type { StoryRunner } from './StoryRunner.js';

export const DEFAULT_ARTIFACT_ROOT_DIR = '.codex/agentic-workflow-kit';

export interface StoryRunnerFactoryOptions {
  createCodexMcpClient?: CodexMcpStoryRunnerOptions['createClient'];
}

type StoryRunnerFactory = (config: ResolvedWorkflowConfig, options?: StoryRunnerFactoryOptions) => StoryRunner;

const DRIVER_FACTORIES = {
  'codex-mcp': (config, options) =>
    new CodexMcpStoryRunner(config, {
      ...(options?.createCodexMcpClient ? { createClient: options.createCodexMcpClient } : {}),
    }),
} satisfies Record<OrchestratorDriver, StoryRunnerFactory>;

export const SUPPORTED_DRIVERS = new Set(Object.keys(DRIVER_FACTORIES) as OrchestratorDriver[]);

export function supportedDriverNames(): OrchestratorDriver[] {
  return Object.keys(DRIVER_FACTORIES) as OrchestratorDriver[];
}

export function createStoryRunner(config: ResolvedWorkflowConfig, options?: StoryRunnerFactoryOptions): StoryRunner {
  const factory = DRIVER_FACTORIES[config.orchestrator.driver];
  if (!factory) throw new Error(unsupportedDriverMessage(config.orchestrator.driver));
  return factory(config, options);
}

export function artifactRootDirForDriver(driver: OrchestratorDriver): string {
  if (!SUPPORTED_DRIVERS.has(driver)) throw new Error(unsupportedDriverMessage(driver));
  return DEFAULT_ARTIFACT_ROOT_DIR;
}

export function discoverSessionLogsForDriver(
  config: ResolvedWorkflowConfig,
  options?: StoryRunnerFactoryOptions,
): Promise<string[]> | string[] | undefined {
  return createStoryRunner(config, options).discoverSessionLogs?.();
}

export function unsupportedDriverMessage(driver: string): string {
  return `Unsupported orchestrator.driver "${driver}". Supported drivers: ${supportedDriverNames().join(', ')}.`;
}
