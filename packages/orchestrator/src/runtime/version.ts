import { createRequire } from 'node:module';

const requirePackage = createRequire(import.meta.url);
const packageJson = requirePackage('../../package.json') as { version?: unknown };

export const packageVersion =
  typeof packageJson.version === 'string' && packageJson.version.length > 0 ? packageJson.version : '0.0.0';

export const mcpServerName = 'agentic-workflow-kit';
export const mcpServerVersion = packageVersion;
export const apiVersion = '1';
export const CURRENT_CONFIG_SCHEMA_VERSION = '0.6.0';
export const MIN_SUPPORTED_CONFIG_SCHEMA_VERSION = '0.6.0';

export function runtimeInfo() {
  return {
    packageVersion,
    apiVersion,
    mcpServer: {
      name: mcpServerName,
      version: mcpServerVersion,
    },
    configSchema: {
      current: CURRENT_CONFIG_SCHEMA_VERSION,
      minimumSupported: MIN_SUPPORTED_CONFIG_SCHEMA_VERSION,
    },
  } as const;
}
